import type {
  AlertMetric,
  PlatformMetric,
  SummaryMetric,
  WorkMetric,
} from "./dashboard-data";

export const SUMMARY_FIXTURES = [
  { id: "followers", label: "矩阵总粉丝", value: 486_392, format: "integer", change: 12.8, note: "较上周期", scalesWithRange: false },
  { id: "growth", label: "本期净增粉", value: 18_624, format: "integer", change: 8.4, note: "增长健康", scalesWithRange: true },
  { id: "reach", label: "播放 / 阅读", value: 3_280_000, format: "compact", change: 21.6, note: "2 篇爆款", scalesWithRange: true },
  { id: "engagement", label: "综合互动率", value: 7.42, format: "percent", change: -0.38, note: "需关注", scalesWithRange: false },
] satisfies ReadonlyArray<SummaryMetric & { scalesWithRange: boolean }>;

export const PLATFORM_FIXTURES = [
  { id: "douyin", name: "抖音", shortName: "抖", accounts: 3, share: 58, reach: 1_900_000, tone: "ink" },
  { id: "xiaohongshu", name: "小红书", shortName: "薯", accounts: 3, share: 27, reach: 886_000, tone: "coral" },
  { id: "wechat", name: "公众号", shortName: "微", accounts: 2, share: 15, reach: 494_000, tone: "sage" },
] satisfies ReadonlyArray<PlatformMetric>;

export const WORK_FIXTURES = [
  { id: "work-ai-pm", title: "AI 产品经理的 8 种新工作方式", publishedAt: "07.27 21:30", format: "视频", platform: "抖音", account: "Daniel AI笔记", reach: 628_420, engagementRate: 9.82, followerConversion: 2.31, signal: "爆款" },
  { id: "work-city-break", title: "周末逃离广州：阳江海风入怀", publishedAt: "07.26 18:00", format: "图文", platform: "小红书", account: "出逃指令", reach: 184_230, engagementRate: 12.41, followerConversion: 3.18, signal: "高潜" },
  { id: "work-standard-answer", title: "我为什么开始警惕 AI 的标准答案", publishedAt: "07.24 12:10", format: "文章", platform: "公众号", account: "Daniel产品手记", reach: 48_216, engagementRate: 6.94, followerConversion: 1.82, signal: "长尾" },
] satisfies ReadonlyArray<WorkMetric>;

export const ALERT_FIXTURES = [
  { id: "alert-xhs-engagement", severity: "warning", title: "2 项指标值得关注", description: "小红书「城市出逃指南」互动率连续 3 天低于基线。" },
] satisfies ReadonlyArray<AlertMetric>;
