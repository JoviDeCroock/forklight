// D1-backed per-session state and the append-only activity ledger.
import {
  seedState,
  type SessionState,
} from "./incident.ts";

export interface LedgerEntry {
  id: number;
  ts: string;
  actor: "agent" | "human";
  transport: string;
  capability: string;
  summary: string;
  outcome: "ok" | "error";
  durationMs: number | null;
}

export const SESSION_COOKIE = "fl_session";
export const SESSION_HEADER = "x-forklight-session";

interface RequestContext {
  env: { DB: D1Database };
}

export function getDb(context: RequestContext): D1Database {
  return context.env.DB;
}

/** Session id from the cookie (page + browser-client + WebMCP dispatches all
 * ride the same-origin cookie) or the explicit header `pracht eval` scenarios
 * use. Returns null when neither is present. */
export function sessionIdFrom(request: Request): string | null {
  const header = request.headers.get(SESSION_HEADER);
  if (header && /^[a-zA-Z0-9-]{8,64}$/.test(header)) return header;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-zA-Z0-9-]+)`));
  return match ? match[1] : null;
}

export async function loadState(db: D1Database, sessionId: string): Promise<SessionState> {
  const row = await db
    .prepare("SELECT state FROM sessions WHERE id = ?1")
    .bind(sessionId)
    .first<{ state: string }>();
  if (row) return JSON.parse(row.state) as SessionState;
  const state = seedState();
  await db
    .prepare("INSERT OR IGNORE INTO sessions (id, state) VALUES (?1, ?2)")
    .bind(sessionId, JSON.stringify(state))
    .run();
  return state;
}

export async function saveState(db: D1Database, sessionId: string, state: SessionState): Promise<void> {
  await db
    .prepare(
      "INSERT INTO sessions (id, state) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET state = ?2, updated_at = datetime('now')",
    )
    .bind(sessionId, JSON.stringify(state))
    .run();
}

export async function resetSession(db: D1Database, sessionId: string): Promise<SessionState> {
  const state = seedState();
  await saveState(db, sessionId, state);
  await db.prepare("DELETE FROM ledger WHERE session_id = ?1").bind(sessionId).run();
  return state;
}

export async function appendLedger(
  db: D1Database,
  sessionId: string,
  entry: Omit<LedgerEntry, "id" | "ts">,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO ledger (session_id, actor, transport, capability, summary, outcome, duration_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(
      sessionId,
      entry.actor,
      entry.transport,
      entry.capability,
      entry.summary,
      entry.outcome,
      entry.durationMs,
    )
    .run();
}

export async function readLedger(db: D1Database, sessionId: string, limit = 40): Promise<LedgerEntry[]> {
  const rows = await db
    .prepare(
      "SELECT id, ts, actor, transport, capability, summary, outcome, duration_ms as durationMs FROM ledger WHERE session_id = ?1 ORDER BY id DESC LIMIT ?2",
    )
    .bind(sessionId, limit)
    .all<LedgerEntry>();
  return rows.results ?? [];
}
