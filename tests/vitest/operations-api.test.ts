import { describe, expect, it } from "vitest";
import { createTestDatabase, migrateToV2, readMigration } from "../helpers/d1";
import { applyVersionedMigrationSql } from "../../db/migrate";

describe("operations APIs", () => {
  it("creates an account and a content record through the API handlers", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3);
    const { POST: createAccount } = await import("../../app/api/accounts/route");
    const accountResponse = await createAccount(new Request("http://localhost/api/accounts", { method: "POST", body: JSON.stringify({ platform: "公众号", name: "Daniel" }), headers: { "content-type": "application/json" } }), database);
    expect(accountResponse.status).toBe(201);
    const account = await accountResponse.json() as { data: { id: string } };
    const { POST: createContent } = await import("../../app/api/contents/route");
    const contentResponse = await createContent(new Request("http://localhost/api/contents", { method: "POST", body: JSON.stringify({ accountId: account.data.id, title: "AI 复盘", plannedAt: "2026-08-08T08:00:00+08:00", stage: "scheduled" }), headers: { "content-type": "application/json" } }), database);
    expect(contentResponse.status).toBe(201);
    await miniflare.dispose();
  });
});
