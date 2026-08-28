import { useState } from "preact/hooks";
import { DEMO_PROMPT } from "./TopBar.tsx";

const STEPS = [
  { tool: "signals.query", label: "Read the evidence" },
  { tool: "scenario.fork", label: "Fork a timeline" },
  { tool: "scenario.simulate", label: "Rehearse a fix" },
  { tool: "mitigation.stage", label: "Stage a proposal" },
];

/**
 * First-load state. The canvas is seeded but nothing has been rehearsed yet,
 * so the only thing worth doing is handing the incident to an agent — this
 * makes that the obvious next click instead of leaving an empty board.
 */
export function AgentBriefing() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(DEMO_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      class="fl-panel fl-rise relative min-w-0 flex-1 overflow-hidden rounded-xl border border-sky-500/25 bg-ink-900/70 p-4"
      data-testid="agent-briefing"
    >
      <div
        class="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(420px 160px at 0% 0%, rgb(56 189 248 / 0.09), transparent 70%)",
        }}
        aria-hidden="true"
      />
      <div class="relative">
        <div class="fl-eyebrow mb-2 flex items-center gap-1.5 text-sky-300">
          <span class="fl-live relative inline-block h-1.5 w-1.5 rounded-full bg-sky-400 text-sky-400" />
          start here
        </div>
        <h3 class="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink-50">
          Hand this incident to your agent
        </h3>
        <p class="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-300">
          The page tools in this tab let an agent read the signals, fork counterfactual timelines,
          rehearse each mitigation against the forecast, and stage one proposal — this canvas
          updates live as it works. Applying to production is not one of its tools.
        </p>

        <div class="mt-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
          <p class="min-w-0 flex-1 rounded-lg border border-ink-800 bg-ink-950/70 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink-250">
            “{DEMO_PROMPT}”
          </p>
          <button
            type="button"
            onClick={copy}
            class={`shrink-0 self-start rounded-lg border px-4 py-2.5 text-[12.5px] font-semibold transition-colors sm:self-stretch ${
              copied
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-sky-500/40 bg-sky-500/12 text-sky-200 hover:border-sky-400/60 hover:bg-sky-500/20"
            }`}
            data-testid="briefing-copy-prompt"
          >
            {copied ? "Copied ✓" : "Copy demo prompt"}
          </button>
        </div>

        <ol class="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-ink-800/70 pt-3">
          {STEPS.map((step, index) => (
            <li key={step.tool} class="flex items-center gap-1.5">
              <span class="flex flex-col rounded-md border border-ink-800 bg-ink-900/80 px-2 py-1">
                <span class="font-mono text-[10px] text-sky-300/90">{step.tool}</span>
                <span class="mt-0.5 text-[10.5px] text-ink-400">{step.label}</span>
              </span>
              {index < STEPS.length - 1 && (
                <span class="text-ink-600" aria-hidden="true">
                  →
                </span>
              )}
            </li>
          ))}
          <li class="flex items-center gap-1.5">
            <span class="text-ink-600" aria-hidden="true">
              →
            </span>
            <span class="flex flex-col rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1">
              <span class="flex items-center gap-1 font-mono text-[10px] text-violet-300">
                <svg viewBox="0 0 12 12" class="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
                  <path d="M6 0a2.6 2.6 0 0 0-2.6 2.6V4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-.4V2.6A2.6 2.6 0 0 0 6 0Zm1.4 4H4.6V2.6a1.4 1.4 0 1 1 2.8 0V4Z" />
                </svg>
                mitigation.apply
              </span>
              <span class="mt-0.5 text-[10.5px] text-violet-300/80">You only</span>
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
