import { describe, expect, it } from "vitest";
import { createTestDatabase, migrateToV2 } from "../helpers/d1";

describe("account repository", () => {
  it("creates and counts real accounts without fixture data", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const repository = createAccountRepository(database);
    await repository.insert({ id: "account-1", platform: "wechat", name: "Daniel", status: "active", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" });
    await expect(repository.count()).resolves.toBe(1);
    await expect(repository.findById("account-1")).resolves.toMatchObject({ platform: "wechat", name: "Daniel", status: "active" });
    await expect(repository.findById("missing")).resolves.toBeNull();
    await expect(repository.list()).resolves.toHaveLength(1);
    await expect(repository.findByPlatformName("wechat", "Daniel")).resolves.toMatchObject({ id: "account-1" });
    await repository.update("account-1", { platform: "wechat", name: "Active again", status: "active" }, "2026-08-02T00:00:30.000Z");
    await repository.update("account-1", { platform: "wechat", name: "Updated", status: "paused" }, "2026-08-02T00:00:00.000Z");
    await expect(repository.findById("account-1")).resolves.toMatchObject({ name: "Updated", status: "paused" });
    await repository.update("account-1", { platform: "wechat", name: "Archived", status: "archived" }, "2026-08-02T12:00:00.000Z");
    await expect(repository.findById("account-1")).resolves.toMatchObject({ status: "archived" });
    await repository.remove("account-1", "2026-08-03T00:00:00.000Z");
    await expect(repository.list()).resolves.toHaveLength(0);
    await miniflare.dispose();
  });

  it("preserves paused and archived account states while excluding archives from active counts", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const repository = createAccountRepository(database);
    const base = { platform: "douyin", createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" };
    await repository.insert({ ...base, id: "paused", name: "Paused", status: "paused" });
    await repository.insert({ ...base, id: "archived", name: "Archived", status: "archived" });
    await expect(repository.findById("paused")).resolves.toMatchObject({ status: "paused" });
    await expect(repository.findById("archived")).resolves.toMatchObject({ status: "archived" });
    await expect(repository.count()).resolves.toBe(1);
    await miniflare.dispose();
  });

  it("fails closed when a count query returns no row", async () => {
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const statement = { bind() { return statement; }, first: async () => null, all: async () => ({ results: [] }), run: async () => undefined };
    const repository = createAccountRepository({ prepare: () => statement });
    await expect(repository.count()).rejects.toThrow("Account count is unavailable");
  });
});
