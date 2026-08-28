import { useEffect, useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";

export const DEMO_PROMPT =
  "Errors spiked after the 14:05 deploy. Compare rolling back against bypassing the new cache, show me the evidence, and stage the lowest-risk mitigation. Do not apply anything.";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  mitigating: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  recovered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

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
    <header class="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-900 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-2">
        <span class="text-lg font-semibold tracking-tight text-zinc-100">
          <span class="text-sky-400">⑂</span> Forklight
        </span>
        <span class="hidden text-xs text-zinc-600 sm:inline">rehearse the fix before shipping it</span>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span class="font-mono text-zinc-400">{incident.id}</span>
        <span
          class={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[incident.status] ?? ""}`}
          data-testid="incident-status"
        >
          {incident.status}
        </span>
        <span class="text-zinc-500">{incident.title}</span>
        <span class="font-mono text-xs text-zinc-500" data-testid="clock">
          now {clock}
        </span>
      </div>
      <div class="ml-auto flex items-center gap-2">
        {toolCount !== null && (
          <span
            class="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-300"
            data-testid="tool-count"
            title="WebMCP page tools registered for agents in this tab"
          >
            {toolCount} agent tools live
          </span>
        )}
        <button
          type="button"
          onClick={copyPrompt}
          class="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500"
          data-testid="copy-prompt"
        >
          {copied ? "Copied ✓" : "Copy demo prompt"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={resetting}
          class="rounded-md border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
          data-testid="reset"
        >
          {resetting ? "Resetting…" : "Reset incident"}
        </button>
        <a
          href="https://github.com/JoviDeCroock/forklight"
          class="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
