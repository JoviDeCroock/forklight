import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";
import { scenarioColor } from "./colors.ts";
import { AgentBriefing } from "./AgentBriefing.tsx";

const BLAST_STYLES: Record<string, string> = {
  low: "text-emerald-300",
  moderate: "text-amber-300",
  high: "text-rose-400",
};

function Stat({
  label,
  children,
  tone = "text-ink-100",
}: {
  label: string;
  children: ComponentChildren;
  tone?: string;
}) {
  return (
    <div class="min-w-0">
      <dt class="fl-eyebrow text-ink-500">{label}</dt>
      <dd class={`fl-nums mt-0.5 truncate font-mono text-[12.5px] ${tone}`}>{children}</dd>
    </div>
  );
}

function ForkCard({
  scenario,
  color,
  focused,
  fastest,
  onFocus,
}: {
  scenario: CanvasData["scenarios"][number];
  color: string;
  focused: boolean;
  fastest: boolean;
  onFocus: (id: string | null) => void;
}) {
  const a = scenario.assessment;
  const simulated = scenario.actions.length > 0;
  return (
    <button
      type="button"
      onClick={() => onFocus(focused ? null : scenario.id)}
      class={`fl-panel fl-rise group relative flex w-[19rem] shrink-0 flex-col overflow-hidden rounded-xl border bg-ink-900/70 p-3 pl-3.5 text-left transition-colors ${
        focused ? "border-ink-600 bg-ink-850/80" : "border-ink-800 hover:border-ink-700"
      }`}
      style={focused ? { boxShadow: `0 0 0 1px ${color}, 0 12px 32px -18px ${color}` } : undefined}
      data-testid={`scenario-${scenario.id}`}
      aria-pressed={focused}
    >
      <span
        class="absolute top-0 bottom-0 left-0 w-[3px]"
        style={{ background: color }}
        aria-hidden="true"
      />

      <div class="mb-1 flex items-start justify-between gap-2">
        <span class="flex min-w-0 items-center gap-2">
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color }}
            aria-hidden="true"
          />
          <span class="truncate font-display text-[14.5px] font-semibold tracking-[-0.01em] text-ink-50">
            {scenario.name}
          </span>
        </span>
        <span class="flex shrink-0 items-center gap-1.5">
          {fastest && simulated && (
            <span class="fl-eyebrow rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
              fastest
            </span>
          )}
          <span class="rounded border border-ink-800 bg-ink-950/60 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
            {scenario.id}
          </span>
        </span>
      </div>

      {scenario.hypothesis && (
        <p class="mb-2 line-clamp-2 text-[12px] leading-snug text-ink-400">{scenario.hypothesis}</p>
      )}

      {!simulated ? (
        <p class="mt-auto rounded-md border border-dashed border-ink-800 px-2 py-1.5 text-[11.5px] text-ink-500">
          No mitigation rehearsed yet
        </p>
      ) : (
        <div class="flex flex-col gap-1">
          {scenario.actions.map((action) => (
            <span
              key={action.mitigation}
              class="flex items-center gap-1.5 truncate text-[12px] text-ink-250"
            >
              <span class="text-ink-600">▸</span>
              <span class="truncate">{action.title}</span>
              <span class="fl-nums shrink-0 font-mono text-[10.5px] text-ink-500">
                @{action.atClock}
              </span>
            </span>
          ))}
        </div>
      )}

      {a && simulated && a.residualRisk[0] && (
        <p class="mt-2 line-clamp-2 border-l border-amber-500/30 pl-2 text-[11px] leading-snug text-ink-500">
          <span class="text-amber-400/80">residual risk</span> {a.residualRisk[0]}
        </p>
      )}

      {a && simulated && (
        <dl class="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ink-800 pt-2.5">
          <Stat label="recovery" tone={a.recoveryAtClock ? "text-emerald-300" : "text-rose-400"}>
            {a.recoveryAtClock ? `${a.recoveryAtClock} +${a.recoveryEtaMinutes}m` : "not reached"}
          </Stat>
          <Stat label="confidence">{Math.round(a.confidence * 100)}%</Stat>
          <Stat label="blast radius" tone={BLAST_STYLES[a.blastRadius?.level ?? ""] ?? "text-ink-300"}>
            {a.blastRadius?.level ?? "—"}
          </Stat>
          <Stat label="orders lost">~{a.ordersLostPerMinute}/min</Stat>
        </dl>
      )}

    </button>
  );
}

export function ScenarioTree({
  data,
  focused,
  onFocus,
}: {
  data: CanvasData;
  focused: string | null;
  onFocus: (id: string | null) => void;
}) {
  const forks = data.scenarios.filter((s) => s.id !== "main");
  const forkIds = forks.map((s) => s.id);
  const [forking, setForking] = useState(false);

  const etas = forks
    .map((s) => s.assessment?.recoveryEtaMinutes)
    .filter((eta): eta is number => typeof eta === "number");
  const bestEta = etas.length > 0 ? Math.min(...etas) : null;

  const forkManually = async () => {
    setForking(true);
    try {
      await capabilities.scenario.fork({
        name: `Manual fork ${forks.length + 1}`,
        hypothesis: "Hand-built counterfactual — simulate a mitigation to see its forecast.",
      });
    } finally {
      setForking(false);
    }
  };

  return (
    <section
      class="flex min-h-0 flex-1 flex-col rounded-2xl border border-ink-800/80 bg-ink-925/60 p-4"
      data-testid="scenario-tree"
    >
      <div class="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h2 class="fl-eyebrow text-ink-300">Counterfactual timelines</h2>
        <span class="text-[11px] text-ink-500">
          {forks.length === 0
            ? "nothing forked yet — the agent branches here, or fork by hand"
            : `${forks.length} fork${forks.length > 1 ? "s" : ""} of the observed timeline · click one to bind scenario_tune to it`}
        </span>
        <button
          type="button"
          onClick={forkManually}
          disabled={forking}
          class="ml-auto rounded-lg border border-ink-800 px-2.5 py-1.5 text-[11.5px] text-ink-300 transition-colors hover:border-ink-600 hover:text-ink-50 disabled:opacity-50"
          data-testid="fork-manual"
        >
          {forking ? "Forking…" : "+ Fork"}
        </button>
      </div>

      <div class="fl-scroll flex flex-1 items-stretch gap-3 overflow-x-auto pb-1">
        <div class="relative flex w-[16rem] shrink-0 flex-col justify-center overflow-hidden rounded-xl border border-ink-750 bg-ink-900 p-3 pl-3.5">
          <span class="absolute top-0 bottom-0 left-0 w-[3px] bg-ink-500" aria-hidden="true" />
          <span class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-ink-400" aria-hidden="true" />
            <span class="font-display text-[14.5px] font-semibold tracking-[-0.01em] text-ink-50">
              Observed timeline
            </span>
          </span>
          <span class="mt-1 font-mono text-[10px] text-ink-500">main</span>
          <p class="mt-2 text-[12px] leading-snug text-ink-400">
            What production is actually doing. Forks branch from here; only the human switch merges
            one back.
          </p>
          <p class="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-ink-500">
            <span class="h-1 w-1 rounded-full bg-rose-400" aria-hidden="true" />
            {data.incident.status} · {data.clock}
          </p>
        </div>

        {forks.length > 0 && (
          <div
            class="relative flex w-7 shrink-0 flex-col items-center justify-center"
            aria-hidden="true"
          >
            <span class="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-ink-700 to-transparent" />
            <span class="relative h-1.5 w-1.5 rounded-full bg-ink-600 ring-4 ring-ink-925" />
          </div>
        )}

        {forks.length === 0 && <AgentBriefing />}

        {forks.map((scenario) => (
          <ForkCard
            key={scenario.id}
            scenario={scenario}
            color={scenarioColor(forkIds, scenario.id)}
            focused={focused === scenario.id}
            fastest={
              bestEta !== null && scenario.assessment?.recoveryEtaMinutes === bestEta
            }
            onFocus={onFocus}
          />
        ))}
      </div>
    </section>
  );
}
