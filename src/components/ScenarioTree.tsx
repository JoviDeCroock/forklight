import { useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";
import { scenarioColor } from "./colors.ts";

const BLAST_STYLES: Record<string, string> = {
  low: "text-emerald-300",
  moderate: "text-amber-300",
  high: "text-rose-400",
};

function ForkCard({
  scenario,
  color,
  focused,
  onFocus,
}: {
  scenario: CanvasData["scenarios"][number];
  color: string;
  focused: boolean;
  onFocus: (id: string | null) => void;
}) {
  const a = scenario.assessment;
  return (
    <button
      type="button"
      onClick={() => onFocus(focused ? null : scenario.id)}
      class={`group relative w-64 shrink-0 rounded-lg border bg-zinc-900/60 p-3 text-left transition ${
        focused ? "border-zinc-500 ring-1 ring-zinc-500" : "border-zinc-800 hover:border-zinc-600"
      }`}
      data-testid={`scenario-${scenario.id}`}
      aria-pressed={focused}
    >
      <span class="absolute -left-px top-3 bottom-3 w-0.5 rounded" style={{ background: color }} />
      <div class="mb-1 flex items-center justify-between gap-2">
        <span class="truncate text-sm font-medium text-zinc-200">{scenario.name}</span>
        <span class="font-mono text-[10px] text-zinc-600">{scenario.id}</span>
      </div>
      {scenario.hypothesis && <p class="mb-2 line-clamp-2 text-xs text-zinc-500">{scenario.hypothesis}</p>}
      {scenario.actions.length === 0 ? (
        <p class="text-xs text-zinc-600 italic">No mitigation simulated yet</p>
      ) : (
        <div class="flex flex-col gap-1">
          {scenario.actions.map((action) => (
            <span key={action.mitigation} class="truncate text-xs text-zinc-400">
              ▸ {action.title} <span class="font-mono text-zinc-600">@{action.atClock}</span>
            </span>
          ))}
        </div>
      )}
      {a && scenario.actions.length > 0 && (
        <dl class="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-zinc-800 pt-2 text-[11px]">
          <dt class="text-zinc-600">recovery</dt>
          <dd class={a.recoveryAtClock ? "text-emerald-300" : "text-rose-400"}>
            {a.recoveryAtClock ? `${a.recoveryAtClock} (+${a.recoveryEtaMinutes}m)` : "not reached"}
          </dd>
          <dt class="text-zinc-600">confidence</dt>
          <dd class="text-zinc-300">{Math.round(a.confidence * 100)}%</dd>
          <dt class="text-zinc-600">blast radius</dt>
          <dd class={BLAST_STYLES[a.blastRadius?.level ?? ""] ?? "text-zinc-400"}>
            {a.blastRadius?.level ?? "—"}
          </dd>
          <dt class="text-zinc-600">orders lost</dt>
          <dd class="text-zinc-300">~{a.ordersLostPerMinute}/min</dd>
        </dl>
      )}
      <span class="mt-2 block text-[10px] text-zinc-600 opacity-0 transition group-hover:opacity-100">
        {focused ? "click to unfocus" : "click to focus — scenario_tune follows focus"}
      </span>
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
    <section class="rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="scenario-tree">
      <div class="mb-3 flex items-center gap-3">
        <h2 class="text-sm font-semibold text-zinc-300">Counterfactual timelines</h2>
        <span class="text-xs text-zinc-600">
          {forks.length === 0
            ? "none yet — ask your agent to fork one, or fork by hand"
            : `${forks.length} fork${forks.length > 1 ? "s" : ""} of the observed timeline`}
        </span>
        <button
          type="button"
          onClick={forkManually}
          disabled={forking}
          class="ml-auto rounded-md border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
          data-testid="fork-manual"
        >
          {forking ? "Forking…" : "+ Fork"}
        </button>
      </div>
      <div class="flex items-stretch gap-3 overflow-x-auto pb-1">
        <div class="flex w-52 shrink-0 flex-col justify-center rounded-lg border border-zinc-700 bg-zinc-900 p-3">
          <span class="text-sm font-medium text-zinc-200">Observed timeline</span>
          <span class="font-mono text-[10px] text-zinc-600">main</span>
          <p class="mt-1 text-xs text-zinc-500">
            What production is actually doing. Forks branch from here; only the human switch merges
            one back.
          </p>
        </div>
        {forks.length > 0 && (
          <div class="flex items-center text-2xl text-zinc-700" aria-hidden="true">
            ⑂
          </div>
        )}
        {forks.map((scenario) => (
          <ForkCard
            key={scenario.id}
            scenario={scenario}
            color={scenarioColor(forkIds, scenario.id)}
            focused={focused === scenario.id}
            onFocus={onFocus}
          />
        ))}
      </div>
    </section>
  );
}
