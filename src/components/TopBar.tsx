import { useEffect, useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";

export const DEMO_PROMPT =
  "Checkout failures started after the 14:05 deploy. Compare rolling back against bypassing the new cache, show me the evidence, and stage the lowest-risk mitigation. Do not apply anything.";

const STATUS_STYLES: Record<string, string> = {
  open: "border-rose-500/40 bg-rose-500/12 text-rose-300",
  mitigating: "border-amber-500/40 bg-amber-500/12 text-amber-200",
  recovered: "border-emerald-500/40 bg-emerald-500/12 text-emerald-300",
};

const STATUS_DOTS: Record<string, string> = {
  open: "bg-rose-400 text-rose-400",
  mitigating: "bg-amber-300 text-amber-300",
  recovered: "bg-emerald-400 text-emerald-400",
};

/** The wordmark glyph: a signal that forks. Drawn rather than typed so the
 *  identity survives any font stack. */
function Mark() {
  return (
    <svg viewBox="0 0 24 24" class="h-[26px] w-[26px] shrink-0" aria-hidden="true">
      {/* the observed timeline, running through */}
      <path
        d="M3 12 H10.5"
        fill="none"
        stroke="#8e9bb0"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <path
        d="M13.5 12 H21"
        fill="none"
        stroke="#4d5a70"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      {/* two counterfactual branches leaving the fork point */}
      <path
        d="M12 11 C15.5 11 15.5 5 19.6 5"
        fill="none"
        stroke="#38bdf8"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <path
        d="M12 13 C15.5 13 15.5 19 19.6 19"
        fill="none"
        stroke="#a78bfa"
        stroke-width="2.1"
        stroke-linecap="round"
      />
      <circle cx="11.6" cy="12" r="2.6" fill="#06070a" stroke="#e2e8f0" stroke-width="1.8" />
    </svg>
  );
}

export function TopBar({ incident, clock }: { incident: CanvasData["incident"]; clock: string }) {
  const [copied, setCopied] = useState(false);
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      const modelContext = (document as { modelContext?: { getTools?: () => Promise<unknown[]> } })
        .modelContext;
      if (!modelContext?.getTools) return;
      try {
        const tools = await modelContext.getTools();
        if (!cancelled) setToolCount(tools.length);
      } catch {
        /* tool probe is cosmetic */
      }
    };
    // The registration shim loads feature-detected after hydration.
    const timer = setTimeout(probe, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(DEMO_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const reset = async () => {
    setResetting(true);
    try {
      await capabilities.incident.reset({});
      location.reload();
    } finally {
      setResetting(false);
    }
  };

  return (
    <header class="sticky top-0 z-30 -mx-4 border-b border-ink-800/80 bg-ink-950/85 px-4 backdrop-blur-xl md:-mx-6 md:px-6">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-3 py-2.5">
        {/* identity */}
        <a href="/" class="group flex items-center gap-2.5" aria-label="Forklight home">
          <Mark />
          <span class="flex flex-col leading-none">
            <span class="font-display text-[17px] font-semibold tracking-[-0.025em] text-ink-50">
              Forklight
            </span>
            <span class="mt-1 hidden text-[10.5px] leading-none text-ink-400 sm:inline">
              rehearse the fix before shipping it
            </span>
          </span>
        </a>

        <span class="hidden h-8 w-px bg-ink-800 lg:block" aria-hidden="true" />

        {/* incident identity — the thing that must read instantly */}
        <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span class="font-mono text-[12px] tracking-tight text-ink-400">{incident.id}</span>
          <span
            class={`relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] fl-eyebrow ${
              STATUS_STYLES[incident.status] ?? ""
            }`}
            data-testid="incident-status"
          >
            <span
              class={`fl-live relative inline-block h-1.5 w-1.5 rounded-full ${
                STATUS_DOTS[incident.status] ?? "bg-ink-400 text-ink-400"
              }`}
              aria-hidden="true"
            />
            {incident.status}
          </span>
          <h1 class="truncate font-display text-[15px] font-medium tracking-[-0.01em] text-ink-100">
            {incident.title}
          </h1>
        </div>

        <div class="ml-auto flex items-center gap-2.5">
          {/* frozen narrative clock — deliberately the only large mono in the bar */}
          <div class="mr-1 hidden items-baseline gap-1.5 border-r border-ink-800 pr-4 sm:flex">
            <span class="fl-eyebrow text-ink-500">now</span>
            <span class="fl-nums font-mono text-[15px] text-ink-100" data-testid="clock">
              {clock}
            </span>
          </div>

          {toolCount !== null && (
            <span
              class="hidden items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-[5px] text-[11px] font-medium text-sky-300 md:inline-flex"
              data-testid="tool-count"
              title="WebMCP page tools registered for agents in this tab"
            >
              <span class="fl-live relative inline-block h-1.5 w-1.5 rounded-full bg-sky-400 text-sky-400" />
              <span class="fl-nums">{toolCount}</span> agent tools live
            </span>
          )}

          <button
            type="button"
            onClick={copyPrompt}
            class={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              copied
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                : "border-ink-700 bg-ink-850 text-ink-100 hover:border-ink-600 hover:bg-ink-800"
            }`}
            data-testid="copy-prompt"
          >
            {copied ? "Copied ✓" : "Copy demo prompt"}
          </button>

          <button
            type="button"
            onClick={reset}
            disabled={resetting}
            class="rounded-lg border border-transparent px-2.5 py-1.5 text-xs text-ink-400 transition-colors hover:border-ink-700 hover:text-ink-100 disabled:opacity-50"
            data-testid="reset"
          >
            {resetting ? "Resetting…" : "Reset"}
          </button>

          <a
            href="https://github.com/JoviDeCroock/forklight"
            class="rounded-md p-1.5 text-ink-500 transition-colors hover:text-ink-100"
            aria-label="Forklight on GitHub"
            title="Forklight on GitHub"
          >
            <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
