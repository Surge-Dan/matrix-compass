import { describe, expect, it } from "vitest";
import { createTestDatabase, migrateToV2 } from "../helpers/d1";

describe("account repository", () => {
  it("creates and counts real accounts without fixture data", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const repository = createAccountRepository(database);

    await repository.insert({
      id: "account-1",
      platform: "wechat",
      name: "超级硬核的Daniel",
      status: "active",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    await expect(repository.count()).resolves.toBe(1);
    await expect(repository.findById("account-1")).resolves.toMatchObject({
      platform: "wechat",
      name: "超级硬核的Daniel",
      status: "active",
    });
    await expect(repository.findById("missing")).resolves.toBeNull();
    await miniflare.dispose();
  });

  it("preserves paused and archived account states while excluding archives from active counts", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const repository = createAccountRepository(database);
    const base = {
      platform: "douyin",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    await repository.insert({ ...base, id: "paused", name: "暂停账号", status: "paused" });
    await repository.insert({ ...base, id: "archived", name: "归档账号", status: "archived" });

    await expect(repository.findById("paused")).resolves.toMatchObject({ status: "paused" });
    await expect(repository.findById("archived")).resolves.toMatchObject({ status: "archived" });
    await expect(repository.count()).resolves.toBe(1);
    await miniflare.dispose();
  });

  it("fails closed when a count query returns no row", async () => {
    const { createAccountRepository } = await import("../../lib/repositories/accounts");
    const statement = {
      bind() { return statement; },
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => undefined,
    };
    const repository = createAccountRepository({ prepare: () => statement });
    await expect(repository.count()).rejects.toThrow("Account count is unavailable");
  });
});
