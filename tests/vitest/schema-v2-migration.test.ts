import { describe, expect, it } from "vitest";
import { applyMigrationSql, applyVersionedMigrationSql } from "../../db/migrate";
import { probeDatabase } from "../../app/api/health/route";
import { createTestDatabase, readMigration } from "../helpers/d1";

describe("schema v2 migration", () => {
  it("preserves legacy rows and makes a repeated versioned migration a lossless no-op", async () => {
    const { miniflare, database } = await createTestDatabase();
    const v1 = await readMigration("0001_initial.sql");
    const v2 = await readMigration("0002_real_data_core.sql");
    await applyMigrationSql(database, v1);
    await database
      .prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)")
      .bind("account-v1", "wechat", "legacy account", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z")
      .run();
    await database
      .prepare("INSERT INTO contents (id, external_id, title, account_id, content_type, stage, planned_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
      .bind("content-v1", "1", "legacy content", "account-v1", "learning", "published", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z")
      .run();

    await expect(applyVersionedMigrationSql(database, v2, 2)).resolves.toMatchObject({
      skipped: false,
    });
    await expect(probeDatabase(database)).resolves.toEqual({ schemaVersion: 2 });
    await expect(database.prepare("SELECT COUNT(*) AS count FROM accounts").first()).resolves.toEqual({ count: 1 });
    await expect(
      database.prepare("SELECT id, title, planned_at AS plannedAt, published_at AS publishedAt, source, legacy_review_note AS legacyReviewNote FROM contents").first(),
    ).resolves.toMatchObject({
      id: "content-v1",
      title: "legacy content",
      plannedAt: "2026-07-30T00:00:00.000Z",
      publishedAt: null,
      source: "legacy-v1",
    });

    await database
      .prepare("INSERT INTO contents (id, external_id, title, account_id, content_type, format, stage, planned_at, published_at, url, audience, user_problem, core_promise, hypothesis, primary_metric, guardrail_metrics, success_threshold, hook_pattern, cta_pattern, tags, source, legacy_review_note, deleted_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("content-v2", "external-v2", "published content", "account-v1", "article", "long-form", "published", null, "2026-08-01T00:00:00.000Z", "https://example.com/content-v2", "product-managers", "problem", "promise", "hypothesis", "revenue", "refund-rate", "1000", "question", "subscribe", "[\"AI\",\"product\"]", "feishu", "reviewed", null, 3, "2026-08-01T00:00:00.000Z", "2026-08-01T01:00:00.000Z")
      .run();

    const before = await database.prepare("SELECT * FROM contents WHERE id = 'content-v2'").first();
    await expect(applyVersionedMigrationSql(database, v2, 2)).resolves.toEqual({
      appliedStatements: 0,
      skipped: true,
    });
    await expect(database.prepare("SELECT COUNT(*) AS count FROM contents").first()).resolves.toEqual({ count: 2 });
    await expect(database.prepare("SELECT * FROM contents WHERE id = 'content-v2'").first()).resolves.toEqual(before);
    await miniflare.dispose();
  });

  it("enforces a date and actual publication time for new published content", async () => {
    const { miniflare, database } = await createTestDatabase();
    await applyMigrationSql(database, await readMigration("0001_initial.sql"));
    await applyVersionedMigrationSql(database, await readMigration("0002_real_data_core.sql"), 2);
    await database
      .prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)")
      .bind("account-1", "wechat", "real account", "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z")
      .run();

    await expect(
      database.prepare("INSERT INTO contents (id, title, account_id, stage, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)")
        .bind("missing-date", "missing date", "account-1", "idea", "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z").run(),
    ).rejects.toThrow();
    await expect(
      database.prepare("INSERT INTO contents (id, title, account_id, stage, planned_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
        .bind("missing-published", "missing actual time", "account-1", "published", "2026-08-02T00:00:00.000Z", "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z").run(),
    ).rejects.toThrow();
    await miniflare.dispose();
  });
});
