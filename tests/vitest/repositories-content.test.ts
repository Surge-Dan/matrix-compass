import { describe, expect, it } from "vitest";
import { createTestDatabase, migrateToV2 } from "../helpers/d1";

describe("content repository", () => {
  it("stores a minimal published content record and returns real counts", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const [{ createAccountRepository }, { createContentRepository }] = await Promise.all([
      import("../../lib/repositories/accounts"),
      import("../../lib/repositories/contents"),
    ]);
    const accounts = createAccountRepository(database);
    const contents = createContentRepository(database);
    await accounts.insert({
      id: "account-1",
      platform: "xiaohongshu",
      name: "梅常书",
      status: "active",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    await contents.insert({
      id: "content-1",
      accountId: "account-1",
      title: "第一条真实内容",
      contentType: null,
      stage: "published",
      plannedAt: null,
      publishedAt: "2026-08-01T12:00:00.000Z",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });

    await expect(contents.count()).resolves.toBe(1);
    await expect(contents.findById("content-1")).resolves.toMatchObject({
      accountId: "account-1",
      title: "第一条真实内容",
      contentType: null,
      plannedAt: null,
    });
    await expect(contents.findById("missing")).resolves.toBeNull();
    await miniflare.dispose();
  });

  it("fails closed when a count query returns no row", async () => {
    const { createContentRepository } = await import("../../lib/repositories/contents");
    const statement = {
      bind() { return statement; },
      first: async () => null,
      all: async () => ({ results: [] }),
      run: async () => undefined,
    };
    const repository = createContentRepository({ prepare: () => statement });
    await expect(repository.count()).rejects.toThrow("Content count is unavailable");
  });
});
