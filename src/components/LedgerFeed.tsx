import type { LedgerEntry } from "../server/store.ts";

export function LedgerFeed({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section class="flex min-h-0 flex-1 flex-col rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="ledger">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-zinc-300">Activity ledger</h2>
        <span class="text-[10px] text-zinc-600">every dispatch, human and agent, one contract</span>
      </div>
      {entries.length === 0 ? (
        <p class="text-xs text-zinc-600">
          Quiet so far. Tool calls and UI actions land here as they happen.
        </p>
      ) : (
        <ol class="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              class="rounded-md border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5"
              data-testid="ledger-entry"
            >
              <div class="flex items-center gap-2">
                <span
                  class={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    entry.actor === "agent"
                      ? "bg-sky-500/15 text-sky-300"
                      : "bg-violet-500/15 text-violet-300"
                  }`}
                >
                  {entry.actor === "agent" ? "agent" : "you"}
                </span>
                <span class="font-mono text-[11px] text-zinc-400">{entry.capability}</span>
                <span class="ml-auto font-mono text-[10px] text-zinc-600">
                  {entry.durationMs != null ? `${entry.durationMs}ms` : ""}
                </span>
                {entry.outcome === "error" && (
                  <span class="rounded bg-rose-500/15 px-1 text-[10px] text-rose-400">err</span>
                )}
              </div>
              <p class="mt-0.5 text-xs leading-snug text-zinc-500">{entry.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
