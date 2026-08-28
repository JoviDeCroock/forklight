import { useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";

function LockIcon({ class: className }: { class?: string }) {
  return (
    <svg viewBox="0 0 12 12" class={className} fill="currentColor" aria-hidden="true">
      <path d="M6 0a2.6 2.6 0 0 0-2.6 2.6V4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-.4V2.6A2.6 2.6 0 0 0 6 0Zm1.4 4H4.6V2.6a1.4 1.4 0 1 1 2.8 0V4Z" />
    </svg>
  );
}

export function StagedPanel({ data }: { data: CanvasData }) {
  const staged = data.staged.filter((s) => s.status === "staged");
  const applied = data.staged.find((s) => s.status === "applied");
  const [confirming, setConfirming] = useState<{ proposal: string; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepare = async (proposal: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await capabilities.mitigation.apply({ proposal }, { prepare: true });
      if (!result.ok && result.error.code === "confirmation_required" && result.error.confirmationToken) {
        setConfirming({ proposal, token: result.error.confirmationToken });
      } else {
        setError("Could not prepare the apply — is the server missing its confirmation secret?");
      }
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    try {
      const result = await capabilities.mitigation.apply(
        { proposal: confirming.proposal },
        { confirm: confirming.token },
      );
      if (!result.ok) {
        setError(`Apply failed: ${result.error.code}`);
      }
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const titleOf = (mitigation: string) =>
    data.mitigations.find((m) => m.id === mitigation)?.title ?? mitigation;

  const scenarioOf = (id: string) => data.scenarios.find((s) => s.id === id) ?? null;

  return (
    <section
      class="fl-scroll shrink-0 overflow-y-auto rounded-2xl border border-ink-800/80 bg-ink-925/60 p-4"
      data-testid="staged-panel"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="fl-eyebrow text-ink-300">Staged for review</h2>
        <span
          class="fl-eyebrow flex shrink-0 items-center gap-1 rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-1 whitespace-nowrap text-violet-300"
          title="mitigation.apply is a destructive capability: pracht refuses to expose it as a WebMCP tool"
        >
          <LockIcon class="h-2.5 w-2.5" />
          human-only
        </span>
      </div>

      {applied && (
        <div
          class="fl-pop mb-3 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3.5"
          data-testid="applied-card"
        >
          <div class="flex items-center gap-2">
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/25 text-[11px] text-emerald-200">
              ✓
            </span>
            <span class="font-display text-[14px] font-semibold text-emerald-200">
              {titleOf(applied.mitigation)}
            </span>
            <span class="fl-eyebrow ml-auto rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
              applied
            </span>
          </div>
          <p class="mt-2 text-[12px] leading-relaxed text-ink-300">{applied.rationale}</p>
        </div>
      )}

      {staged.length === 0 && !applied && (
        <div class="rounded-xl border border-dashed border-ink-800 bg-ink-900/40 p-4">
          <div class="mb-2 flex h-7 w-7 items-center justify-center rounded-lg border border-ink-800 bg-ink-900 text-ink-500">
            <LockIcon class="h-3 w-3" />
          </div>
          <p class="text-[12.5px] leading-relaxed text-ink-300">
            No proposal yet. Once the agent has compared its forks it stages{" "}
            <span class="font-mono text-[11.5px] text-ink-200">one</span> mitigation here, with its
            rationale and evidence.
          </p>
          <p class="mt-2 text-[11.5px] leading-relaxed text-ink-500">
            Reviewing it — and shipping it — stays with you.
          </p>
        </div>
      )}

      {staged.map((proposal) => {
        const scenario = scenarioOf(proposal.scenarioId);
        const assessment = scenario?.assessment ?? null;
        return (
          <div
            key={proposal.id}
            class="fl-pop relative mb-2 overflow-hidden rounded-xl border border-amber-500/35 bg-gradient-to-b from-amber-500/[0.09] to-amber-500/[0.02] p-3.5"
            data-testid={`proposal-${proposal.id}`}
          >
            <span class="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

            <div class="mb-2 flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="fl-eyebrow mb-1.5 text-amber-400/80">proposal · {proposal.id}</div>
                <h3 class="font-display text-[16px] leading-tight font-semibold tracking-[-0.015em] text-amber-100">
                  {titleOf(proposal.mitigation)}
                </h3>
              </div>
              <span
                class={`fl-eyebrow shrink-0 rounded-full border px-2 py-1 ${
                  proposal.stagedVia === "webmcp"
                    ? "border-sky-500/35 bg-sky-500/10 text-sky-300"
                    : "border-ink-750 bg-ink-900 text-ink-400"
                }`}
              >
                {proposal.stagedVia === "webmcp" ? "staged by agent" : `staged via ${proposal.stagedVia}`}
              </span>
            </div>

            <p class="text-[12.5px] leading-snug text-ink-200">{proposal.rationale}</p>

            {assessment && (
              <dl class="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg border border-amber-500/15 bg-ink-950/40 p-2">
                <div>
                  <dt class="fl-eyebrow text-ink-500">recovery</dt>
                  <dd class="fl-nums mt-1 font-mono text-[12.5px] text-emerald-300">
                    {assessment.recoveryAtClock
                      ? `+${assessment.recoveryEtaMinutes}m`
                      : "none"}
                  </dd>
                </div>
                <div>
                  <dt class="fl-eyebrow text-ink-500">confidence</dt>
                  <dd class="fl-nums mt-1 font-mono text-[12.5px] text-ink-100">
                    {Math.round(assessment.confidence * 100)}%
                  </dd>
                </div>
                <div>
                  <dt class="fl-eyebrow text-ink-500">blast</dt>
                  <dd class="fl-nums mt-1 font-mono text-[12.5px] text-amber-300">
                    {assessment.blastRadius?.level ?? "—"}
                  </dd>
                </div>
              </dl>
            )}

            {proposal.evidence.length > 0 && (
              <div class="mt-2.5">
                <div class="fl-eyebrow mb-1 text-ink-500">evidence</div>
                <div class="flex flex-wrap gap-1">
                  {proposal.evidence.map((evidence) => (
                    <span
                      key={evidence}
                      class="rounded border border-ink-750 bg-ink-950/70 px-1.5 py-0.5 font-mono text-[10px] text-ink-300"
                    >
                      {evidence}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div class="mt-3 border-t border-amber-500/15 pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => prepare(proposal.id)}
                class="fl-switch flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-[13.5px] font-semibold tracking-[0.01em] text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                data-testid={`apply-${proposal.id}`}
              >
                <LockIcon class="h-3 w-3 opacity-80" />
                Apply to production…
              </button>
              <p class="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-ink-500">
                <span>
                  from scenario <span class="font-mono text-ink-400">{proposal.scenarioId}</span>
                </span>
                <span>prepare → confirm</span>
              </p>
            </div>
          </div>
        );
      })}

      {error && (
        <p class="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-[11.5px] text-rose-300">
          {error}
        </p>
      )}

      {confirming && (
        <div
          class="fl-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          data-testid="confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Apply to production"
        >
          <div class="fl-pop w-full max-w-lg overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-[0_40px_120px_-24px_rgb(0_0_0/0.9)]">
            <div class="flex items-center gap-2.5 border-b border-ink-800 bg-ink-850/70 px-5 py-3.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/12 text-amber-300">
                <LockIcon class="h-3.5 w-3.5" />
              </span>
              <div>
                <div class="fl-eyebrow text-amber-400/80">destructive capability</div>
                <h3 class="mt-1 font-display text-[15px] font-semibold tracking-[-0.01em] text-ink-50">
                  Apply to production?
                </h3>
              </div>
            </div>

            <div class="px-5 py-4">
              <div class="rounded-lg border border-ink-750 bg-ink-950/60 px-3.5 py-3">
                <div class="fl-eyebrow text-ink-500">commits</div>
                <div class="mt-1.5 font-display text-[15px] font-semibold text-ink-50">
                  {titleOf(data.staged.find((s) => s.id === confirming.proposal)?.mitigation ?? "")}
                </div>
                <div class="mt-1 font-mono text-[11px] text-ink-500">
                  {confirming.proposal} · to the live incident
                </div>
              </div>

              <p class="mt-3.5 text-[12.5px] leading-relaxed text-ink-300">
                The prepare/commit token binds this exact proposal — the same confirmation flow any
                HTTP caller gets.
              </p>
              <p class="mt-2 flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2.5 text-[12px] leading-relaxed text-violet-200">
                <LockIcon class="mt-[3px] h-3 w-3 shrink-0" />
                <span>
                  No agent can reach this dialog. <span class="font-mono">mitigation.apply</span> is
                  classified destructive, so it is never projected to WebMCP.
                </span>
              </p>
            </div>

            <div class="flex justify-end gap-2 border-t border-ink-800 bg-ink-925/70 px-5 py-3.5">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                class="rounded-lg border border-ink-700 px-3.5 py-2 text-[12.5px] text-ink-200 transition-colors hover:border-ink-600 hover:bg-ink-850"
                data-testid="confirm-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={commit}
                class="fl-switch rounded-lg px-4 py-2 font-display text-[12.5px] font-semibold text-white transition-all disabled:opacity-50"
                data-testid="confirm-commit"
              >
                {busy ? "Applying…" : "Confirm apply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
