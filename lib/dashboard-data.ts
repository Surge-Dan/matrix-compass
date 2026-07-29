import {
  ALERT_FIXTURES,
  PLATFORM_FIXTURES,
  SUMMARY_FIXTURES,
  WORK_FIXTURES,
} from "./dashboard-fixtures";

export type DashboardRange = 7 | 30 | 90;

export interface SummaryMetric {
  id: "followers" | "growth" | "reach" | "engagement";
  label: string;
  value: number;
  format: "integer" | "compact" | "percent";
  change: number;
  note: string;
}

export interface TrendPoint {
  label: string;
  followers: number;
  growth: number;
}

export interface PlatformMetric {
  id: "douyin" | "xiaohongshu" | "wechat";
  name: string;
  shortName: string;
  accounts: number;
  share: number;
  reach: number;
  tone: "ink" | "coral" | "sage";
}

export interface WorkMetric {
  id: string;
  title: string;
  publishedAt: string;
  format: "视频" | "图文" | "文章";
  platform: string;
  account: string;
  reach: number;
  engagementRate: number;
  followerConversion: number;
  signal: "爆款" | "高潜" | "长尾";
}

export interface AlertMetric {
  id: string;
  severity: "warning" | "critical";
  title: string;
  description: string;
}

export interface DashboardData {
  meta: {
    range: DashboardRange;
    updatedAt: string;
    source: "demo";
    requestId: string;
    accountCount: number;
  };
  summary: SummaryMetric[];
  trend: TrendPoint[];
  platforms: PlatformMetric[];
  works: WorkMetric[];
  alerts: AlertMetric[];
}

export class DashboardRangeError extends Error {
  readonly code = "INVALID_RANGE";

  constructor() {
    super("统计周期仅支持 7、30 或 90 天。");
    this.name = "DashboardRangeError";
  }
}

const SUPPORTED_RANGES = new Set<DashboardRange>([7, 30, 90]);

export function parseDashboardRange(
  value: string | null | undefined,
): DashboardRange {
  if (value === null || value === undefined || value === "") return 30;
  const parsed = Number(value);
  if (!SUPPORTED_RANGES.has(parsed as DashboardRange) || String(parsed) !== value) {
    throw new DashboardRangeError();
  }
  return parsed as DashboardRange;
}

const RANGE_FACTOR: Record<DashboardRange, number> = {
  7: 0.27,
  30: 1,
  90: 2.78,
};

const UPDATED_AT = "2026-07-29T02:32:00.000Z";
const CURRENT_FOLLOWERS = 486_392;

function dateLabel(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
}

function trendFor(range: DashboardRange): TrendPoint[] {
  const pointCount = range === 7 ? 7 : range === 30 ? 9 : 10;
  const factor = RANGE_FACTOR[range];
  const growthTotal = Math.round(18_624 * factor);
  const startFollowers = CURRENT_FOLLOWERS - growthTotal;
  const endDate = new Date(UPDATED_AT);
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);
    const pointDate = new Date(endDate);
    pointDate.setUTCDate(endDate.getUTCDate() - Math.round((1 - progress) * (range - 1)));
    return {
      label: index === pointCount - 1 ? "今天" : dateLabel(pointDate),
      followers: Math.round(startFollowers + growthTotal * progress),
      growth: Math.round(growthTotal * progress),
    };
  });
}

export function getDashboardData(
  range: DashboardRange,
  requestId: string,
): DashboardData {
  const factor = RANGE_FACTOR[range];
  return {
    meta: {
      range,
      updatedAt: UPDATED_AT,
      source: "demo",
      requestId,
      accountCount: 8,
    },
    summary: SUMMARY_FIXTURES.map(({ scalesWithRange, ...metric }) => ({
      ...metric,
      value: scalesWithRange ? Math.round(metric.value * factor) : metric.value,
    })),
    trend: trendFor(range),
    platforms: PLATFORM_FIXTURES.map((platform) => ({
      ...platform,
      reach: Math.round(platform.reach * factor),
    })),
    works: WORK_FIXTURES.map((work) => ({ ...work })),
    alerts: ALERT_FIXTURES.map((alert) => ({ ...alert })),
  };
}
