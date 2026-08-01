CREATE TABLE IF NOT EXISTS contents_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  account_id TEXT NOT NULL,
  content_type TEXT,
  format TEXT,
  stage TEXT NOT NULL,
  planned_at TEXT,
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
  tags TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  legacy_review_note TEXT,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT contents_account_fk
    FOREIGN KEY (account_id) REFERENCES accounts (id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT contents_title_not_blank CHECK (length(trim(title)) > 0),
  CONSTRAINT contents_date_required
    CHECK (planned_at IS NOT NULL OR published_at IS NOT NULL),
  CONSTRAINT contents_published_at_required
    CHECK (
      stage <> 'published'
      OR published_at IS NOT NULL
      OR (source = 'legacy-v1' AND legacy_review_note IS NOT NULL)
    ),
  CONSTRAINT contents_version_positive CHECK (version >= 1)
);
-- matrix-compass-statement-breakpoint

INSERT OR REPLACE INTO contents_v2 (
  id,
  external_id,
  title,
  account_id,
  content_type,
  format,
  stage,
  planned_at,
  published_at,
  url,
  audience,
  user_problem,
  core_promise,
  hypothesis,
  primary_metric,
  guardrail_metrics,
  success_threshold,
  hook_pattern,
  cta_pattern,
  source,
  legacy_review_note,
  deleted_at,
  version,
  created_at,
  updated_at
)
SELECT
  id,
  external_id,
  title,
  account_id,
  content_type,
  format,
  stage,
  planned_at,
  published_at,
  url,
  audience,
  user_problem,
  core_promise,
  hypothesis,
  primary_metric,
  guardrail_metrics,
  success_threshold,
  hook_pattern,
  cta_pattern,
  CASE
    WHEN stage = 'published' AND published_at IS NULL THEN 'legacy-v1'
    ELSE 'manual'
  END,
  CASE
    WHEN stage = 'published' AND published_at IS NULL
      AND (legacy_review_note IS NULL OR instr(legacy_review_note, '历史记录缺少实际发布时间，请补录。') = 0)
      THEN CASE
        WHEN legacy_review_note IS NULL OR trim(legacy_review_note) = ''
          THEN '历史记录缺少实际发布时间，请补录。'
        ELSE legacy_review_note || '；历史记录缺少实际发布时间，请补录。'
      END
    ELSE legacy_review_note
  END,
  deleted_at,
  version,
  created_at,
  updated_at
FROM contents;
-- matrix-compass-statement-breakpoint

DROP TABLE contents;
-- matrix-compass-statement-breakpoint

ALTER TABLE contents_v2 RENAME TO contents;
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
VALUES (1, 2, '2026-08-01T00:00:00.000Z')
ON CONFLICT(id) DO UPDATE SET
  schema_version = CASE
    WHEN excluded.schema_version > matrix_compass_meta.schema_version
      THEN excluded.schema_version
    ELSE matrix_compass_meta.schema_version
  END,
  updated_at = excluded.updated_at;
