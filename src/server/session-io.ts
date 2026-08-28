// Shared capability plumbing: resolve the session, load state, and write the
// activity ledger. Actor attribution reads the transport marker pracht's
// WebMCP projection sends with every dispatch (`x-pracht-transport: webmcp`).
import { CAPABILITY_TRANSPORT_HEADER } from "@pracht/capabilities";
import type { SessionState } from "./incident.ts";
import { appendLedger, getDb, loadState, saveState, sessionIdFrom } from "./store.ts";

export interface SessionIo {
  db: D1Database;
  sessionId: string;
  state: SessionState;
  transport: "webmcp" | "http";
  actor: "agent" | "human";
  /** Persist mutated state (no-op for reads). */
  save(): Promise<void>;
  /** Append one ledger row for this dispatch. */
  log(capability: string, summary: string, startedAt: number, outcome?: "ok" | "error"): Promise<void>;
}

export async function openSession(args: { request: Request; context: unknown }): Promise<SessionIo> {
  const context = args.context as { env: { DB: D1Database }; sessionId?: string };
  const sessionId = context.sessionId ?? sessionIdFrom(args.request);
  if (!sessionId) throw new Error("no session; the session middleware must run first");
  const db = getDb(context);
  const state = await loadState(db, sessionId);
  const marker = args.request.headers.get(CAPABILITY_TRANSPORT_HEADER);
  const transport = marker === "webmcp" ? "webmcp" : "http";
  return {
    db,
    sessionId,
    state,
    transport,
    actor: transport === "webmcp" ? "agent" : "human",
    async save() {
      await saveState(db, sessionId, state);
    },
    async log(capability, summary, startedAt, outcome = "ok") {
      await appendLedger(db, sessionId, {
        actor: transport === "webmcp" ? "agent" : "human",
        transport,
        capability,
        summary,
        outcome,
        durationMs: Math.round(performance.now() - startedAt),
      });
    },
  };
}
