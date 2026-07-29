import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const dataModuleUrl = new URL("lib/dashboard-data.ts", root);
const dashboardRouteUrl = new URL("app/api/dashboard/route.ts", root);
const healthRouteUrl = new URL("app/api/health/route.ts", root);

async function importRequired(url, label) {
  assert.equal(existsSync(url), true, `${label} should exist`);
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

test("dashboard range parser defaults to 30 days", async () => {
  const { parseDashboardRange } = await importRequired(
    dataModuleUrl,
    "dashboard data module",
  );
  assert.equal(parseDashboardRange(null), 30);
  assert.equal(parseDashboardRange(undefined), 30);
  assert.equal(parseDashboardRange(""), 30);
});

test("dashboard range parser accepts only 7, 30, and 90 days", async () => {
  const { parseDashboardRange } = await importRequired(
    dataModuleUrl,
    "dashboard data module",
  );
  for (const range of ["7", "30", "90"]) {
    assert.equal(parseDashboardRange(range), Number(range));
  }
  for (const range of ["0", "14", "30.0", " 30 ", "abc"]) {
    assert.throws(
      () => parseDashboardRange(range),
      (error) => error?.code === "INVALID_RANGE",
    );
  }
});

test("dashboard data is deterministic, complete, and explicitly demo data", async () => {
  const { getDashboardData } = await importRequired(
    dataModuleUrl,
    "dashboard data module",
  );
  const first = getDashboardData(30, "request-a");
  const second = getDashboardData(30, "request-a");
  assert.deepEqual(first, second);
  assert.equal(first.meta.range, 30);
  assert.equal(first.meta.source, "demo");
  assert.equal(first.meta.requestId, "request-a");
  assert.equal(first.summary.length, 4);
  assert.ok(first.trend.length >= 5);
  assert.equal(first.platforms.length, 3);
  assert.ok(first.works.length >= 3);
  assert.ok(first.alerts.length >= 1);
});

test("dashboard API returns the requested range and no-store response", async () => {
  const { GET } = await importRequired(
    dashboardRouteUrl,
    "dashboard API route",
  );
  const response = await GET(
    new Request("http://localhost/api/dashboard?range=7"),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.meta.range, 7);
  assert.equal(body.meta.source, "demo");
  assert.match(body.meta.requestId, /^mc-/);
});

test("dashboard API returns a traceable 400 response for invalid range", async () => {
  const { GET } = await importRequired(
    dashboardRouteUrl,
    "dashboard API route",
  );
  const response = await GET(
    new Request("http://localhost/api/dashboard?range=14"),
  );
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, "INVALID_RANGE");
  assert.equal(body.error.message, "统计周期仅支持 7、30 或 90 天。");
  assert.match(body.error.requestId, /^mc-/);
});

test("dashboard API converts unexpected provider failures into traceable 500 responses", async () => {
  const { createDashboardResponse } = await importRequired(
    dashboardRouteUrl,
    "dashboard API route",
  );
  assert.equal(typeof createDashboardResponse, "function");
  const response = await createDashboardResponse(
    new Request("http://localhost/api/dashboard?range=30"),
    "mc-provider-failure",
    () => {
      throw new Error("provider exploded");
    },
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.deepEqual(body, {
    error: {
      code: "DASHBOARD_UNAVAILABLE",
      message: "仪表盘暂时无法加载，请稍后重试。",
      requestId: "mc-provider-failure",
    },
  });
});

test("each supported range produces the intended trend resolution", async () => {
  const { getDashboardData } = await importRequired(
    dataModuleUrl,
    "dashboard data module",
  );
  assert.equal(getDashboardData(7, "r7").trend.length, 7);
  assert.equal(getDashboardData(30, "r30").trend.length, 9);
  assert.equal(getDashboardData(90, "r90").trend.length, 10);
});

test("health API identifies the app and demo data source", async () => {
  const { GET } = await importRequired(healthRouteUrl, "health API route");
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    app: "matrix-compass",
    version: "0.1.0",
    dataSource: "demo",
  });
});
