import { describe, expect, it } from "vitest";
import {
  DashboardRangeError,
  getDashboardData,
  parseDashboardRange,
} from "../../lib/dashboard-data";
import { formatChange, formatDashboardPeriod, formatMetricValue } from "../../lib/dashboard-format";
import {
  createDashboardResponse,
  GET as getDashboard,
} from "../../app/api/dashboard/route";
import { GET as getHealth } from "../../app/api/health/route";

describe("dashboard range", () => {
  it("defaults missing values to 30", () => {
    expect(parseDashboardRange(null)).toBe(30);
    expect(parseDashboardRange(undefined)).toBe(30);
    expect(parseDashboardRange("")).toBe(30);
  });

  it("accepts the three contract values", () => {
    expect(parseDashboardRange("7")).toBe(7);
    expect(parseDashboardRange("30")).toBe(30);
    expect(parseDashboardRange("90")).toBe(90);
  });

  it.each(["0", "14", "30.0", " 30 ", "abc"])(
    "rejects invalid value %s",
    (value) => {
      expect(() => parseDashboardRange(value)).toThrowError(DashboardRangeError);
    },
  );
});

describe("dashboard data", () => {
  it.each([
    [7, 7],
    [30, 9],
    [90, 10],
  ] as const)("builds deterministic %i-day data", (range, trendLength) => {
    const first = getDashboardData(range, `request-${range}`);
    const second = getDashboardData(range, `request-${range}`);
    expect(first).toEqual(second);
    expect(first.meta).toMatchObject({ range, source: "demo" });
    expect(first.trend).toHaveLength(trendLength);
    expect(first.summary).toHaveLength(4);
    expect(first.platforms).toHaveLength(3);
    expect(first.works).toHaveLength(3);
    expect(first.alerts).toHaveLength(1);
  });

  it("preserves exact range scaling and trend endpoints", () => {
    const seven = getDashboardData(7, "r7");
    const thirty = getDashboardData(30, "r30");
    const ninety = getDashboardData(90, "r90");

    expect(seven.summary.map((metric) => metric.value)).toEqual([
      486_392,
      5_028,
      885_600,
      7.42,
    ]);
    expect(thirty.summary.map((metric) => metric.value)).toEqual([
      486_392,
      18_624,
      3_280_000,
      7.42,
    ]);
    expect(ninety.summary.map((metric) => metric.value)).toEqual([
      486_392,
      51_775,
      9_118_400,
      7.42,
    ]);
    expect(seven.trend[0]).toEqual({
      label: "07.23",
      followers: 481_364,
      growth: 0,
    });
    expect(seven.trend[1].label).toBe("07.24");
    expect(seven.trend.at(-1)).toEqual({
      label: "今天",
      followers: 486_392,
      growth: 5_028,
    });
    expect(thirty.trend.at(-1)).toEqual({
      label: "今天",
      followers: 486_392,
      growth: 18_624,
    });
    expect(ninety.trend.at(-1)).toEqual({
      label: "今天",
      followers: 486_392,
      growth: 51_775,
    });
    expect(ninety.trend[0].label).toBe("05.01");
    expect(seven.works[0]).toMatchObject({ id: "work-ai-pm", title: "AI 产品经理的 8 种新工作方式" });
    expect(seven.alerts[0]).toMatchObject({ id: "alert-xhs-engagement", severity: "warning" });
    for (const dashboard of [seven, thirty, ninety]) {
      const currentFollowers = dashboard.summary.find((metric) => metric.id === "followers")?.value;
      expect(dashboard.trend.at(-1)?.followers).toBe(currentFollowers);
    }
    expect(seven.platforms.map((platform) => platform.reach)).toEqual([
      513_000,
      239_220,
      133_380,
    ]);
  });

  it("uses a recognizable validation error identity", () => {
    const error = new DashboardRangeError();
    expect(error.name).toBe("DashboardRangeError");
    expect(error.code).toBe("INVALID_RANGE");
    expect(error.message).toBe("统计周期仅支持 7、30 或 90 天。");
  });
});

describe("metric formatting", () => {
  it("formats every metric mode and magnitude", () => {
    expect(formatMetricValue(486_392, "integer")).toBe("486,392");
    expect(formatMetricValue(3_280_000, "compact")).toBe("3.28M");
    expect(formatMetricValue(886_000, "compact")).toBe("886K");
    expect(formatMetricValue(912, "compact")).toBe("912");
    expect(formatMetricValue(1_000, "compact")).toBe("1K");
    expect(formatMetricValue(1_000_000, "compact")).toBe("1M");
    expect(formatMetricValue(7.42, "percent")).toBe("7.42%");
  });

  it("formats positive, negative, and neutral changes", () => {
    expect(formatChange(12.8)).toBe("+12.8%");
    expect(formatChange(-0.38)).toBe("−0.38%");
    expect(formatChange(0)).toBe("0%");
  });

  it("formats the visible date window from the backend timestamp", () => {
    expect(formatDashboardPeriod("2026-07-29T02:32:00.000Z", 7)).toBe("2026.07.23 — 07.29");
    expect(formatDashboardPeriod("2026-07-29T02:32:00.000Z", 30)).toBe("2026.06.30 — 07.29");
    expect(formatDashboardPeriod("2026-07-29T02:32:00.000Z", 90)).toBe("2026.05.01 — 07.29");
    expect(formatDashboardPeriod("2026-08-01T02:32:00.000Z", 7)).toBe("2026.07.26 — 08.01");
  });
});

describe("API routes", () => {
  it("returns dashboard data with a request id", async () => {
    const response = await getDashboard(
      new Request("http://localhost/api/dashboard?range=7"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.meta.range).toBe(7);
    expect(body.meta.requestId).toMatch(/^mc-/);
  });

  it("uses the default range when the query is omitted", async () => {
    const response = await createDashboardResponse(
      new Request("http://localhost/api/dashboard"),
      "mc-default",
    );
    expect((await response.json()).meta.range).toBe(30);
  });

  it("returns a traceable validation problem", async () => {
    const response = await createDashboardResponse(
      new Request("http://localhost/api/dashboard?range=14"),
      "mc-invalid",
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_RANGE",
        message: "统计周期仅支持 7、30 或 90 天。",
        requestId: "mc-invalid",
      },
    });
  });

  it("contains unexpected provider failures", async () => {
    const response = await createDashboardResponse(
      new Request("http://localhost/api/dashboard?range=30"),
      "mc-failure",
      () => {
        throw new Error("provider exploded");
      },
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "DASHBOARD_UNAVAILABLE",
        message: "仪表盘暂时无法加载，请稍后重试。",
        requestId: "mc-failure",
      },
    });
  });

  it("returns a stable health contract", async () => {
    const response = await getHealth();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      app: "matrix-compass",
      version: "0.1.0",
      dataSource: "demo",
    });
  });
});
