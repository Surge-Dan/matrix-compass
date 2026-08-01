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
