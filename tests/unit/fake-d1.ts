// A minimal in-memory stand-in for the D1 binding, so the capability pipeline
// can be exercised without workerd. It answers exactly the six statements
// src/server/store.ts issues and throws on anything else — an unhandled query
// means the store changed and this fake needs to change with it, rather than
// silently returning nothing.

export interface FakeLedgerRow {
  id: number;
  ts: string;
  session_id: string;
  actor: string;
  transport: string;
  capability: string;
  summary: string;
  outcome: string;
  duration_ms: number | null;
}

export interface FakeD1 {
  /** Pass this as `context.env.DB`. */
  db: D1Database;
  sessions: Map<string, string>;
  ledger: FakeLedgerRow[];
  /** Every SQL statement prepared, in order — useful when a test fails. */
  statements: string[];
}

interface Store {
  sessions: Map<string, string>;
  ledger: FakeLedgerRow[];
  statements: string[];
  nextLedgerId: number;
}

function normalize(sql: string): string {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

class FakeStatement {
  constructor(
    private readonly sql: string,
    private readonly store: Store,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): FakeStatement {
    return new FakeStatement(this.sql, this.store, values);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const sql = normalize(this.sql);
    if (sql.startsWith("select state from sessions where id =")) {
      const state = this.store.sessions.get(String(this.values[0]));
      return state === undefined ? null : ({ state } as T);
    }
    throw new Error(`fake D1: unhandled first() statement: ${this.sql}`);
  }

  async run(): Promise<{ success: true }> {
    const sql = normalize(this.sql);
    if (sql.startsWith("insert or ignore into sessions")) {
      const id = String(this.values[0]);
      if (!this.store.sessions.has(id)) this.store.sessions.set(id, String(this.values[1]));
      return { success: true };
    }
    if (sql.startsWith("insert into sessions")) {
      this.store.sessions.set(String(this.values[0]), String(this.values[1]));
      return { success: true };
    }
    if (sql.startsWith("delete from ledger where session_id =")) {
      const id = String(this.values[0]);
      this.store.ledger = this.store.ledger.filter((row) => row.session_id !== id);
      return { success: true };
    }
    if (sql.startsWith("insert into ledger")) {
      const [sessionId, actor, transport, capability, summary, outcome, durationMs] = this.values;
      this.store.ledger.push({
        id: this.store.nextLedgerId++,
        ts: new Date().toISOString(),
        session_id: String(sessionId),
        actor: String(actor),
        transport: String(transport),
        capability: String(capability),
        summary: String(summary),
        outcome: String(outcome),
        duration_ms: typeof durationMs === "number" ? durationMs : null,
      });
      return { success: true };
    }
    throw new Error(`fake D1: unhandled run() statement: ${this.sql}`);
  }

  async all<T = Record<string, unknown>>(): Promise<{ success: true; results: T[] }> {
    const sql = normalize(this.sql);
    if (sql.includes("from ledger where session_id =")) {
      const [sessionId, limit] = this.values;
      const results = this.store.ledger
        .filter((row) => row.session_id === String(sessionId))
        .sort((a, b) => b.id - a.id)
        .slice(0, typeof limit === "number" ? limit : Number(limit))
        // The real query aliases duration_ms as durationMs.
        .map(({ session_id: _ignored, duration_ms: durationMs, ...rest }) => ({
          ...rest,
          durationMs,
        }));
      return { success: true, results: results as T[] };
    }
    throw new Error(`fake D1: unhandled all() statement: ${this.sql}`);
  }
}

export function createFakeD1(): FakeD1 {
  const store: Store = { sessions: new Map(), ledger: [], statements: [], nextLedgerId: 1 };
  // Only `prepare` is ever reached by src/server/store.ts, so the cast keeps
  // the fake honest about what it implements instead of stubbing the rest of
  // the D1 surface with throwing no-ops.
  const db = {
    prepare(sql: string) {
      store.statements.push(sql);
      return new FakeStatement(sql, store);
    },
  } as unknown as D1Database;

  return {
    db,
    get sessions() {
      return store.sessions;
    },
    get ledger() {
      return store.ledger;
    },
    get statements() {
      return store.statements;
    },
  };
}
