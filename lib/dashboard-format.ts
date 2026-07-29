import type { DashboardRange, SummaryMetric } from "./dashboard-data";

function trimFixed(value: number, digits: number) {
  return String(Number(value.toFixed(digits)));
}

export function formatMetricValue(
  value: number,
  format: SummaryMetric["format"],
) {
  if (format === "percent") return `${value.toFixed(2)}%`;
  if (format === "compact") {
    if (Math.abs(value) >= 1_000_000) {
      return `${trimFixed(value / 1_000_000, 2)}M`;
    }
    if (Math.abs(value) >= 1_000) {
      return `${trimFixed(value / 1_000, 1)}K`;
    }
  }
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatChange(value: number) {
  const magnitude = trimFixed(Math.abs(value), 2);
  if (value > 0) return `+${magnitude}%`;
  if (value < 0) return `−${magnitude}%`;
  return "0%";
}

export function formatDashboardPeriod(updatedAt: string, range: DashboardRange) {
  const end = new Date(updatedAt);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (range - 1));
  const full = (date: Date) => `${date.getUTCFullYear()}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
  const short = (date: Date) => `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCDate()).padStart(2, "0")}`;
  return `${full(start)} — ${short(end)}`;
}
