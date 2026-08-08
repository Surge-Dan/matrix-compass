import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestampsAndVersion = {
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const matrixCompassMeta = sqliteTable(
  "matrix_compass_meta",
  {
    id: integer("id").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [check("matrix_compass_meta_singleton", sql`${table.id} = 1`)],
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    platform: text("platform").notNull(),
    name: text("name").notNull(),
    positioning: text("positioning"),
    cadence: text("cadence"),
    topicDirections: text("topic_directions", { mode: "json" }).$type<string[]>(),
    monetizationPaths: text("monetization_paths", { mode: "json" }).$type<string[]>(),
    currentFollowers: integer("current_followers"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    deletedAt: text("deleted_at"),
    importBatchId: text("import_batch_id"),
    ...timestampsAndVersion,
  },
  (table) => [
    uniqueIndex("accounts_platform_name_unique").on(table.platform, table.name),
    index("accounts_active_platform_idx").on(table.active, table.platform),
    check(
      "accounts_followers_non_negative",
      sql`${table.currentFollowers} IS NULL OR ${table.currentFollowers} >= 0`,
    ),
    check("accounts_version_positive", sql`${table.version} >= 1`),
  ],
);

export const contents = sqliteTable(
  "contents",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    contentType: text("content_type"),
    format: text("format"),
    stage: text("stage").notNull(),
    plannedAt: text("planned_at"),
    publishedAt: text("published_at"),
    url: text("url"),
    audience: text("audience"),
    userProblem: text("user_problem"),
    corePromise: text("core_promise"),
    hypothesis: text("hypothesis"),
    primaryMetric: text("primary_metric"),
    guardrailMetrics: text("guardrail_metrics", { mode: "json" }).$type<string[]>(),
    successThreshold: text("success_threshold"),
    hookPattern: text("hook_pattern"),
    ctaPattern: text("cta_pattern"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    source: text("source").notNull().default("manual"),
    legacyReviewNote: text("legacy_review_note"),
    deletedAt: text("deleted_at"),
    importBatchId: text("import_batch_id"),
    ...timestampsAndVersion,
  },
  (table) => [
    index("contents_account_planned_idx").on(table.accountId, table.plannedAt),
    index("contents_stage_planned_idx").on(table.stage, table.plannedAt),
    uniqueIndex("contents_account_external_id_unique")
      .on(table.accountId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    check("contents_title_not_blank", sql`length(trim(${table.title})) > 0`),
    check(
      "contents_date_required",
      sql`${table.plannedAt} IS NOT NULL OR ${table.publishedAt} IS NOT NULL`,
    ),
    check(
      "contents_published_at_required",
      sql`${table.stage} <> 'published' OR ${table.publishedAt} IS NOT NULL OR (${table.source} = 'legacy-v1' AND ${table.legacyReviewNote} IS NOT NULL)`,
    ),
    check("contents_version_positive", sql`${table.version} >= 1`),
  ],
);

export const financeEntries = sqliteTable(
  "finance_entries",
  {
    id: text("id").primaryKey(),
    direction: text("direction").notNull(),
    accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    contentId: text("content_id").references(() => contents.id, { onDelete: "set null", onUpdate: "cascade" }),
    category: text("category").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("CNY"),
    occurredAt: text("occurred_at").notNull(),
    settlementStatus: text("settlement_status").notNull().default("pending"),
    settledAmountMinor: integer("settled_amount_minor").notNull().default(0),
    expectedSettlementAt: text("expected_settlement_at"),
    settledAt: text("settled_at"),
    counterparty: text("counterparty"),
    reviewHighlight: text("review_highlight"),
    reviewProblem: text("review_problem"),
    optimizationDirection: text("optimization_direction"),
    note: text("note"),
    source: text("source").notNull().default("manual"),
    deletedAt: text("deleted_at"),
    importBatchId: text("import_batch_id"),
    ...timestampsAndVersion,
  },
  (table) => [index("finance_occurred_idx").on(table.occurredAt, table.direction), index("finance_account_idx").on(table.accountId, table.occurredAt)],
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: text("id").primaryKey(),
    contentId: text("content_id").references(() => contents.id, { onDelete: "set null" }),
    accountId: text("account_id").references(() => accounts.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    highlight: text("highlight"),
    problem: text("problem"),
    hypothesis: text("hypothesis"),
    nextAction: text("next_action"),
    evidence: text("evidence"),
    status: text("status").notNull().default("open"),
    reviewedAt: text("reviewed_at"),
    source: text("source").notNull().default("manual"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("reviews_status_idx").on(table.status, table.updatedAt)],
);

export const experiments = sqliteTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    goal: text("goal").notNull(),
    hypothesis: text("hypothesis").notNull(),
    variable: text("variable").notNull(),
    control: text("control"),
    primaryMetric: text("primary_metric").notNull(),
    guardrailMetric: text("guardrail_metric"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    status: text("status").notNull().default("draft"),
    result: text("result"),
    conclusion: text("conclusion"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("experiments_status_idx").on(table.status, table.updatedAt)],
);

export const importBatches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    target: text("target").notNull(),
    fileName: text("file_name"),
    status: text("status").notNull().default("preview"),
    totalRows: integer("total_rows").notNull().default(0),
    successRows: integer("success_rows").notNull().default(0),
    duplicateRows: integer("duplicate_rows").notNull().default(0),
    conflictRows: integer("conflict_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    errorSummary: text("error_summary"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => [index("import_batches_created_idx").on(table.createdAt)],
);
