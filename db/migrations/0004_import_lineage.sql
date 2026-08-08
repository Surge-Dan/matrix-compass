ALTER TABLE accounts ADD COLUMN import_batch_id TEXT;
-- matrix-compass-statement-breakpoint
ALTER TABLE contents ADD COLUMN import_batch_id TEXT;
-- matrix-compass-statement-breakpoint
ALTER TABLE finance_entries ADD COLUMN import_batch_id TEXT;
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS accounts_import_batch_idx ON accounts (import_batch_id);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS contents_import_batch_idx ON contents (import_batch_id);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_import_batch_idx ON finance_entries (import_batch_id);
-- matrix-compass-statement-breakpoint
INSERT INTO matrix_compass_meta (id, schema_version, updated_at)
VALUES (1, 4, '2026-08-08T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  schema_version = CASE
    WHEN excluded.schema_version > matrix_compass_meta.schema_version
      THEN excluded.schema_version
    ELSE matrix_compass_meta.schema_version
  END,
  updated_at = excluded.updated_at;
