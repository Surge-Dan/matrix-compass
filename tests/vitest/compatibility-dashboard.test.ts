import { describe, expect, it } from "vitest";
import { createTestDatabase, migrateToV2 } from "../helpers/d1";
import type { RuntimeConfig } from "../../lib/runtime/mode";

const localRuntime = {
  mode: "local",
  dataSource: "local-d1",
  host: "127.0.0.1",
  lanEnabled: false,
  readOnly: false,
} satisfies RuntimeConfig;

describe("compatibility dashboard", () => {
  it("returns only traceable local counts and explicit unavailable metrics", async () => {
    const { miniflare, database } = await createTestDatabase();
    await migrateToV2(database);
    await database.prepare("INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES ('a1', 'wechat', '真实账号', 1, 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')").run();
    const { createRuntimeDashboardResponse } = await import("../../app/api/dashboard/route");
    const response = await createRuntimeDashboardResponse(
      new Request("http://localhost/api/dashboard?range=30"),
      localRuntime,
      "mc-local-dashboard",
      database,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      meta: {
        range: 30,
        updatedAt: null,
        source: "local-d1",
        requestId: "mc-local-dashboard",
        accountCount: 1,
      },
      counts: { accounts: 1, contents: 0 },
      summary: [],
      trend: [],
      platforms: [],
      works: [],
      alerts: [],
      unavailable: ["followers", "growth", "reach", "engagement", "revenue"],
    });
    await miniflare.dispose();
  });

  it("never falls back to demo when the local binding is missing", async () => {
    const { createRuntimeDashboardResponse } = await import("../../app/api/dashboard/route");
    const response = await createRuntimeDashboardResponse(
      new Request("http://localhost/api/dashboard?range=30"),
      localRuntime,
      "mc-local-missing",
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { error: { code: string; message: string; requestId: string } };
    expect(body.error.message).not.toBe("");
    expect(body).toMatchObject({
      error: { code: "DASHBOARD_UNAVAILABLE", requestId: "mc-local-missing" },
    });
  });

  it("keeps range validation explicit in local mode", async () => {
    const { createRuntimeDashboardResponse } = await import("../../app/api/dashboard/route");
    const response = await createRuntimeDashboardResponse(
      new Request("http://localhost/api/dashboard?range=14"),
      localRuntime,
      "mc-local-range",
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_RANGE",
        message: "统计周期仅支持 7、30 或 90 天。",
        requestId: "mc-local-range",
      },
    });
  });
});
