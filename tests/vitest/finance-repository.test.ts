import { describe, expect, it } from "vitest";
import { createFinanceRepository } from "../../lib/repositories/finance";
import { createTestDatabase, migrateToV2, readMigration } from "../helpers/d1";
import { applyVersionedMigrationSql } from "../../db/migrate";

describe("finance repository", () => {
  it("creates, lists and summarizes real finance entries", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3);
    await database.prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES ('a1', 'wechat', 'Daniel', 1, 1, '2026-08-08T00:00:00.000Z', '2026-08-08T00:00:00.000Z')").run();
    const repo = createFinanceRepository(database);
    await repo.insert({ id: "f1", accountId: "a1", contentId: null, direction: "income", category: "brand-deal", amountMinor: 20000, currency: "CNY", occurredAt: "2026-08-08T00:00:00.000Z", settlementStatus: "settled", settledAmountMinor: 20000, expectedSettlementAt: null, settledAt: "2026-08-08T00:00:00.000Z", counterparty: "Brand", note: null, createdAt: "2026-08-08T00:00:00.000Z", updatedAt: "2026-08-08T00:00:00.000Z" });
    expect(await repo.list({})).toHaveLength(1);
    await expect(repo.summary()).resolves.toEqual({ totalIncomeMinor: 20000, totalExpenseMinor: 0, settledIncomeMinor: 20000, pendingIncomeMinor: 0 });
    await miniflare.dispose();
  });
});
