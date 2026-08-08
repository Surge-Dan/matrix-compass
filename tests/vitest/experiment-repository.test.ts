import { describe, expect, it } from "vitest";
import { createExperimentRepository } from "../../lib/repositories/experiments";
import { createTestDatabase, migrateToV2, readMigration } from "../helpers/d1";
import { applyVersionedMigrationSql } from "../../db/migrate";

describe("experiment repository", () => {
  it("stores a falsifiable experiment with one variable and a guardrail", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3);
    const repo = createExperimentRepository(database);
    await repo.insert({ id: "e1", name: "标题实验", goal: "提高收藏", hypothesis: "问题型标题提高收藏率", variable: "标题句式", control: "陈述型标题", primaryMetric: "收藏率", guardrailMetric: "取关率", startsAt: null, endsAt: null, status: "draft", result: null, conclusion: null, createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
    await expect(repo.list()).resolves.toHaveLength(1);
    await miniflare.dispose();
  });
});
