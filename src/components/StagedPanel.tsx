import { useState } from "preact/hooks";
import { capabilities } from "virtual:pracht/capabilities";
import type { CanvasData } from "../server/canvas.ts";

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

  return (
    <section class="rounded-xl border border-zinc-800 bg-zinc-950 p-4" data-testid="staged-panel">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-zinc-300">Staged for human review</h2>
        <span
          class="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300"
          title="mitigation.apply is a destructive capability: pracht refuses to expose it as a WebMCP tool"
        >
          apply = human-only
        </span>
      </div>

      {applied && (
        <div class="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3" data-testid="applied-card">
          <div class="text-sm font-medium text-emerald-300">✓ {titleOf(applied.mitigation)} — applied</div>
          <p class="mt-1 text-xs text-zinc-400">{applied.rationale}</p>
        </div>
      )}

      {staged.length === 0 && !applied && (
        <p class="text-xs text-zinc-600">
          Nothing staged yet. The agent stages a proposal here after comparing scenarios — you keep
          the production switch.
        </p>
      )}

      {staged.map((proposal) => (
        <div
          key={proposal.id}
          class="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3"
          data-testid={`proposal-${proposal.id}`}
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-amber-200">{titleOf(proposal.mitigation)}</span>
            <span class="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              staged via {proposal.stagedVia === "webmcp" ? "agent (WebMCP)" : "HTTP"}
            </span>
          </div>
          <p class="mt-1.5 text-xs leading-relaxed text-zinc-300">{proposal.rationale}</p>
          {proposal.evidence.length > 0 && (
            <div class="mt-2 flex flex-wrap gap-1">
              {proposal.evidence.map((evidence) => (
                <span
                  key={evidence}
                  class="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                >
                  {evidence}
                </span>
              ))}
            </div>
          )}
          <div class="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => prepare(proposal.id)}
              class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              data-testid={`apply-${proposal.id}`}
            >
              Apply to production…
            </button>
            <span class="text-[10px] text-zinc-600">from scenario {proposal.scenarioId}</span>
          </div>
        </div>
      ))}

      {error && <p class="mt-2 text-xs text-rose-400">{error}</p>}

      {confirming && (
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          data-testid="confirm-modal"
        >
          <div class="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl">
            <h3 class="text-sm font-semibold text-zinc-100">Apply to production?</h3>
            <p class="mt-2 text-xs leading-relaxed text-zinc-400">
              This commits{" "}
              <span class="text-zinc-200">
                {titleOf(data.staged.find((s) => s.id === confirming.proposal)?.mitigation ?? "")}
              </span>{" "}
              to the live incident. The prepare/commit token binds this exact proposal — the same
              confirmation flow any HTTP caller gets. Agents never see this dialog: the capability
              is not projected to WebMCP.
            </p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                class="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
                data-testid="confirm-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={commit}
                class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
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
