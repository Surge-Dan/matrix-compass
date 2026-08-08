CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY NOT NULL,
  direction TEXT NOT NULL,
  account_id TEXT NOT NULL,
  content_id TEXT,
  category TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  occurred_at TEXT NOT NULL,
  settlement_status TEXT NOT NULL DEFAULT 'pending',
  settled_amount_minor INTEGER NOT NULL DEFAULT 0,
  expected_settlement_at TEXT,
  settled_at TEXT,
  counterparty TEXT,
  review_highlight TEXT,
  review_problem TEXT,
  optimization_direction TEXT,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT finance_account_fk FOREIGN KEY (account_id) REFERENCES accounts (id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT finance_content_fk FOREIGN KEY (content_id) REFERENCES contents (id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT finance_direction_valid CHECK (direction IN ('income', 'expense')),
  CONSTRAINT finance_amount_positive CHECK (amount_minor > 0),
  CONSTRAINT finance_settled_non_negative CHECK (settled_amount_minor >= 0 AND settled_amount_minor <= amount_minor),
  CONSTRAINT finance_settlement_valid CHECK (settlement_status IN ('pending', 'partial', 'settled', 'cancelled', 'overdue')),
  CONSTRAINT finance_version_positive CHECK (version >= 1)
);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_occurred_idx ON finance_entries (occurred_at, direction);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_account_idx ON finance_entries (account_id, occurred_at);
-- matrix-compass-statement-breakpoint
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  content_id TEXT,
  account_id TEXT,
  title TEXT NOT NULL,
  highlight TEXT,
  problem TEXT,
  hypothesis TEXT,
  next_action TEXT,
  evidence TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_at TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT reviews_target_required CHECK (content_id IS NOT NULL OR account_id IS NOT NULL),
  CONSTRAINT reviews_status_valid CHECK (status IN ('open', 'in-progress', 'done', 'archived')),
  CONSTRAINT reviews_content_fk FOREIGN KEY (content_id) REFERENCES contents (id) ON DELETE SET NULL,
  CONSTRAINT reviews_account_fk FOREIGN KEY (account_id) REFERENCES accounts (id) ON DELETE SET NULL
);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews (status, updated_at);
-- matrix-compass-statement-breakpoint
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  variable TEXT NOT NULL,
  control TEXT,
  primary_metric TEXT NOT NULL,
  guardrail_metric TEXT,
  starts_at TEXT,
  ends_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  result TEXT,
  conclusion TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT experiments_status_valid CHECK (status IN ('draft', 'running', 'completed', 'cancelled'))
);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS experiments_status_idx ON experiments (status, updated_at);
-- matrix-compass-statement-breakpoint
CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'preview',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  duplicate_rows INTEGER NOT NULL DEFAULT 0,
  conflict_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  CONSTRAINT imports_status_valid CHECK (status IN ('preview', 'committed', 'rolled-back', 'failed')),
  CONSTRAINT imports_counts_non_negative CHECK (total_rows >= 0 AND success_rows >= 0 AND duplicate_rows >= 0 AND conflict_rows >= 0 AND failed_rows >= 0)
);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS import_batches_created_idx ON import_batches (created_at DESC);
-- matrix-compass-statement-breakpoint
INSERT INTO matrix_compass_meta (id, schema_version, updated_at)
VALUES (1, 3, '2026-08-08T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  schema_version = CASE WHEN excluded.schema_version > matrix_compass_meta.schema_version THEN excluded.schema_version ELSE matrix_compass_meta.schema_version END,
  updated_at = excluded.updated_at;
