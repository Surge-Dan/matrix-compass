import { describe, expect, it, vi } from "vitest";
import { createTestDatabase, migrateToV2 } from "../helpers/d1";
import type { RuntimeConfig } from "../../lib/runtime/mode";
import type { DatabaseClient, DatabaseStatement } from "../../lib/repositories/database";

const localRuntime = {
  mode: "local",
  dataSource: "local-d1",
  host: "127.0.0.1",
  lanEnabled: false,
  readOnly: false,
} satisfies RuntimeConfig;

describe("bootstrap query", () => {
  it("returns a real-data onboarding state for an empty local database", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    const demoProvider = vi.fn();

    await expect(
      getBootstrapData({ runtime: localRuntime, database, demoProvider }),
    ).resolves.toEqual({
      mode: "local",
      source: "local-d1",
      readOnly: false,
      needsOnboarding: true,
      counts: { accounts: 0, contents: 0 },
      metrics: null,
      actions: ["connect-feishu", "import-file", "create-manually"],
    });
    expect(demoProvider).not.toHaveBeenCalled();
    await miniflare.dispose();
  });

  it("returns database counts after the first real account is created", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await database
      .prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)")
      .bind("account-1", "wechat", "真实账号", "2026-08-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z")
      .run();
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");

    await expect(
      getBootstrapData({ runtime: localRuntime, database }),
    ).resolves.toMatchObject({
      source: "local-d1",
      needsOnboarding: false,
      counts: { accounts: 1, contents: 0 },
      metrics: null,
    });
    await miniflare.dispose();
  });

  it("returns finance metrics after a real income entry exists", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await database.prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES ('finance-account', 'wechat', 'Finance', 1, 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')").run();
    await database.prepare("CREATE TABLE finance_entries (id TEXT PRIMARY KEY, direction TEXT NOT NULL, account_id TEXT NOT NULL, content_id TEXT, category TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, occurred_at TEXT NOT NULL, settlement_status TEXT NOT NULL, settled_amount_minor INTEGER NOT NULL, expected_settlement_at TEXT, settled_at TEXT, counterparty TEXT, review_highlight TEXT, review_problem TEXT, optimization_direction TEXT, note TEXT, source TEXT NOT NULL, deleted_at TEXT, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
    await database.prepare("INSERT INTO finance_entries (id, direction, account_id, category, amount_minor, currency, occurred_at, settlement_status, settled_amount_minor, source, version, created_at, updated_at) VALUES ('finance-entry', 'income', 'finance-account', 'brand-deal', 12300, 'CNY', '2026-08-01T00:00:00.000Z', 'settled', 12300, 'manual', 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')").run();
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    await expect(getBootstrapData({ runtime: localRuntime, database })).resolves.toMatchObject({ metrics: { revenueMinor: 12300, settledMinor: 12300, pendingMinor: 0 } });
    await miniflare.dispose();
  });

  it("keeps demo data isolated and traceable in demo mode", async () => {
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    const demoProvider = vi.fn(() => ({
      counts: { accounts: 6, contents: 139 },
      metrics: { revenueMinor: 243_000, settledMinor: 221_000, pendingMinor: 22_000 },
    }));

    await expect(
      getBootstrapData({
        runtime: {
          mode: "demo",
          dataSource: "demo",
          host: "127.0.0.1",
          lanEnabled: false,
          readOnly: true,
        },
        demoProvider,
      }),
    ).resolves.toMatchObject({
      mode: "demo",
      source: "demo",
      readOnly: true,
      needsOnboarding: false,
      counts: { accounts: 6, contents: 139 },
      metrics: { revenueMinor: 243_000 },
      actions: [],
    });
    expect(demoProvider).toHaveBeenCalledOnce();
  });

  it("normalizes partial finance summary fields from a compatible local binding", async () => {
    const database: DatabaseClient = {
      prepare(query: string) {
        const statement: DatabaseStatement = {
          bind() { return statement; },
          async first<T>() {
            if (query.includes("FROM accounts")) return { count: 1 } as T;
            if (query.includes("FROM contents")) return { count: 1 } as T;
            return { totalIncomeMinor: 0, totalExpenseMinor: 100 } as T;
          },
          async all<T>() { return { results: [] as T[] }; },
          async run() { return { success: true }; },
        };
        return statement;
      },
    };
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    await expect(getBootstrapData({ runtime: localRuntime, database })).resolves.toMatchObject({ metrics: { revenueMinor: -100, settledMinor: 0, pendingMinor: 0 } });
  });

  it("does not request onboarding when imported content exists before account reconciliation", async () => {
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    const database: DatabaseClient = {
      prepare(query: string) {
        const statement: DatabaseStatement = {
          bind() { return statement; },
          async first<T>() { return { count: query.includes("FROM contents") ? 1 : 0 } as T; },
          async all<T>() { return { results: [] as T[] }; },
          async run() { return { success: true }; },
        };
        return statement;
      },
    };
    await expect(getBootstrapData({ runtime: localRuntime, database })).resolves.toMatchObject({
      needsOnboarding: false,
      counts: { accounts: 0, contents: 1 },
    });
  });

  it("uses the isolated default demo payload without a database", async () => {
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    await expect(
      getBootstrapData({
        runtime: {
          mode: "demo",
          dataSource: "demo",
          host: "127.0.0.1",
          lanEnabled: false,
          readOnly: true,
        },
      }),
    ).resolves.toMatchObject({
      source: "demo",
      counts: { accounts: 6, contents: 139 },
      metrics: { revenueMinor: 243_000 },
    });
  });

  it("fails closed when local mode has no database binding", async () => {
    const { getBootstrapData } = await import("../../lib/application/get-bootstrap");
    await expect(getBootstrapData({ runtime: localRuntime })).rejects.toThrow(
      "Local database binding is unavailable",
    );
  });

  it("returns a traceable no-store API response", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    const { createBootstrapResponse } = await import("../../app/api/bootstrap/route");
    const response = await createBootstrapResponse(localRuntime, "mc-bootstrap", database);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: expect.objectContaining({ source: "local-d1", needsOnboarding: true }),
      meta: { requestId: "mc-bootstrap" },
    });
    await miniflare.dispose();
  });

  it("contains bootstrap failures without exposing their cause", async () => {
    const { createBootstrapResponse } = await import("../../app/api/bootstrap/route");
    const response = await createBootstrapResponse(localRuntime, "mc-failure");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "BOOTSTRAP_UNAVAILABLE",
        message: "经营数据暂时无法加载，请稍后重试。",
        requestId: "mc-failure",
      },
    });
  });

  it("resolves runtime bindings before building the response", async () => {
    const { createConfiguredBootstrapResponse } = await import("../../app/api/bootstrap/route");
    const response = await createConfiguredBootstrapResponse(
      async () => ({ MATRIX_COMPASS_MODE: "demo", MATRIX_COMPASS_LAN: "false" }),
      "development",
      "mc-configured",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: expect.objectContaining({ mode: "demo", source: "demo", readOnly: true }),
      meta: { requestId: "mc-configured" },
    });
  });
});
