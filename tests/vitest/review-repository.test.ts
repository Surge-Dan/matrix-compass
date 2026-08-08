import { describe, expect, it } from "vitest";
import { createReviewRepository } from "../../lib/repositories/reviews";
import { createTestDatabase, migrateToV2, readMigration } from "../helpers/d1";
import { applyVersionedMigrationSql } from "../../db/migrate";

describe("review repository", () => {
  it("stores actionable review notes and lists open work", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3);
    await database.prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES ('a1', 'wechat', 'Daniel', 1, 1, '2026-08-08T00:00:00.000Z', '2026-08-08T00:00:00.000Z')").run();
    const repo = createReviewRepository(database);
    await repo.insert({ id: "r1", accountId: "a1", contentId: null, title: "标题清晰", highlight: "开头有钩子", problem: "结尾弱", hypothesis: "更明确 CTA 会提高收藏", nextAction: "下次增加 CTA", evidence: null, status: "open", reviewedAt: null, createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
    await expect(repo.list("open")).resolves.toHaveLength(1);
    await miniflare.dispose();
  });
});
