CREATE TABLE IF NOT EXISTS matrix_compass_meta (
  id INTEGER PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT matrix_compass_meta_singleton CHECK (id = 1)
);
-- matrix-compass-statement-breakpoint

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  positioning TEXT,
  cadence TEXT,
  topic_directions TEXT,
  monetization_paths TEXT,
  current_followers INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT accounts_followers_non_negative
    CHECK (current_followers IS NULL OR current_followers >= 0),
  CONSTRAINT accounts_version_positive CHECK (version >= 1)
);
-- matrix-compass-statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS accounts_platform_name_unique
  ON accounts (platform, name);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS accounts_active_platform_idx
  ON accounts (active, platform);
-- matrix-compass-statement-breakpoint

CREATE TABLE IF NOT EXISTS contents (
  id TEXT PRIMARY KEY NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  account_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  format TEXT,
  stage TEXT NOT NULL,
  planned_at TEXT NOT NULL,
  published_at TEXT,
  url TEXT,
  audience TEXT,
  user_problem TEXT,
  core_promise TEXT,
  hypothesis TEXT,
  primary_metric TEXT,
  guardrail_metrics TEXT,
  success_threshold TEXT,
  hook_pattern TEXT,
  cta_pattern TEXT,
  legacy_review_note TEXT,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT contents_account_fk
    FOREIGN KEY (account_id) REFERENCES accounts (id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT contents_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT contents_version_positive CHECK (version >= 1)
);
-- matrix-compass-statement-breakpoint

CREATE INDEX IF NOT EXISTS contents_account_planned_idx
  ON contents (account_id, planned_at);
-- matrix-compass-statement-breakpoint
CREATE INDEX IF NOT EXISTS contents_stage_planned_idx
  ON contents (stage, planned_at);
-- matrix-compass-statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS contents_account_external_id_unique
  ON contents (account_id, external_id)
  WHERE external_id IS NOT NULL;
-- matrix-compass-statement-breakpoint

INSERT INTO matrix_compass_meta (id, schema_version, updated_at)
VALUES (1, 1, '2026-07-30T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  schema_version = CASE
    WHEN excluded.schema_version > matrix_compass_meta.schema_version
      THEN excluded.schema_version
    ELSE matrix_compass_meta.schema_version
  END,
  updated_at = excluded.updated_at;
