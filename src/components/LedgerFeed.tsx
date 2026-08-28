import type { LedgerEntry } from "../server/store.ts";

/** Attribution is the point of this feed: sky is the agent, violet is you. */
const ACTOR = {
  agent: {
    label: "agent",
    chip: "border-sky-500/30 bg-sky-500/12 text-sky-300",
    rail: "bg-sky-400/70",
    dot: "bg-sky-400",
  },
  human: {
    label: "you",
    chip: "border-violet-500/30 bg-violet-500/12 text-violet-300",
    rail: "bg-violet-400/70",
    dot: "bg-violet-400",
  },
} as const;

export function LedgerFeed({ entries }: { entries: LedgerEntry[] }) {
  return (
    <section
      class="flex min-h-0 flex-1 shrink flex-col overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-925/60 p-4"
      data-testid="ledger"
    >
      <div class="mb-2.5 flex items-center justify-between gap-2">
        <h2 class="fl-eyebrow text-ink-300">Activity ledger</h2>
        <span class="flex items-center gap-3 text-[10.5px] text-ink-500">
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden="true" /> agent
          </span>
          <span class="flex items-center gap-1.5">
            <span class="h-1.5 w-1.5 rounded-full bg-violet-400" aria-hidden="true" /> you
          </span>
        </span>
      </div>

      {entries.length === 0 ? (
        <div class="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-ink-800 bg-ink-900/30 p-6 text-center">
          <span class="mb-3 flex gap-1.5" aria-hidden="true">
            <span class="fl-live relative h-1.5 w-1.5 rounded-full bg-sky-400/70 text-sky-400" />
            <span class="h-1.5 w-1.5 rounded-full bg-ink-700" />
            <span class="h-1.5 w-1.5 rounded-full bg-ink-700" />
          </span>
          <p class="max-w-[34ch] text-[12.5px] leading-relaxed text-ink-400">
            Quiet so far. Every dispatch — an agent tool call or your own click — lands here as it
            happens, through the same typed contract.
          </p>
        </div>
      ) : (
        <ol class="fl-scroll -mr-1 max-h-[560px] min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {entries.map((entry, index) => {
            const actor = ACTOR[entry.actor === "agent" ? "agent" : "human"];
            return (
              <li
                key={entry.id}
                class="fl-rise relative overflow-hidden rounded-lg border border-ink-800/60 bg-ink-900/50 py-1.5 pr-2.5 pl-3 transition-colors hover:border-ink-750 hover:bg-ink-900"
                style={{ animationDelay: `${Math.min(index, 9) * 28}ms` }}
                data-testid="ledger-entry"
              >
                <span
                  class={`absolute top-1 bottom-1 left-0 w-[2px] rounded-full ${actor.rail}`}
                  aria-hidden="true"
                />
                <div class="flex items-center gap-2">
                  <span class={`fl-eyebrow rounded border px-1.5 py-0.5 ${actor.chip}`}>
                    {actor.label}
                  </span>
                  <span class="truncate font-mono text-[11.5px] text-ink-200">
                    {entry.capability}
                  </span>
                  {entry.outcome === "error" && (
                    <span class="fl-eyebrow rounded bg-rose-500/15 px-1 py-0.5 text-rose-300">
                      err
                    </span>
                  )}
                  <span class="fl-nums ml-auto shrink-0 font-mono text-[10px] text-ink-500">
                    {entry.durationMs != null ? `${entry.durationMs}ms` : ""}
                  </span>
                </div>
                <p class="mt-0.5 text-[11.5px] leading-snug text-ink-400">{entry.summary}</p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
