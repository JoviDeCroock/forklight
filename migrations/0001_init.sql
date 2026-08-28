-- Forklight session state and activity ledger.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,
  transport TEXT NOT NULL,
  capability TEXT NOT NULL,
  summary TEXT NOT NULL,
  outcome TEXT NOT NULL,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger (session_id, id);
