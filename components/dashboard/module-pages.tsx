import type { DashboardData } from "../../lib/dashboard-data";
import { formatMetricValue } from "../../lib/dashboard-format";

const ACCOUNTS = [
  { mark: "抖", name: "Daniel AI笔记", platform: "抖音", followers: 218_600, growth30: 9_800, engagement: 8.62, status: { label: "同步正常", kind: "normal" } },
  { mark: "抖", name: "产品人的日常", platform: "抖音", followers: 63_200, growth30: 2_100, engagement: 6.18, status: { label: "同步正常", kind: "normal" } },
  { mark: "抖", name: "出逃指令", platform: "抖音", followers: 41_700, growth30: 1_400, engagement: 9.21, status: { label: "7 天后过期", kind: "expiring" } },
  { mark: "薯", name: "Daniel的AI生活", platform: "小红书", followers: 72_400, growth30: 2_800, engagement: 11.42, status: { label: "同步正常", kind: "normal" } },
  { mark: "薯", name: "城市出逃指南", platform: "小红书", followers: 36_900, growth30: 912, engagement: 5.03, status: { label: "互动异常", kind: "alert" } },
  { mark: "薯", name: "产品经理灵感簿", platform: "小红书", followers: 18_300, growth30: 706, engagement: 8.04, status: { label: "同步正常", kind: "normal" } },
  { mark: "微", name: "Daniel产品手记", platform: "公众号", followers: 24_800, growth30: 621, engagement: 5.82, status: { label: "同步正常", kind: "normal" } },
  { mark: "微", name: "出逃城市观察", platform: "公众号", followers: 10_500, growth30: 275, engagement: 4.91, status: { label: "同步正常", kind: "normal" } },
] as const;

const PAGE_COPY = {
  fans: ["Audience growth", "粉丝分析", "关注净增长、来源结构与账号贡献，不混用跨平台口径。"],
  engagement: ["Engagement pulse", "互动分析", "拆解点赞、评论、收藏与分享，定位真正带来增长的互动。"],
  alerts: ["Signal watch", "异常预警", "聚合授权、数据和内容表现异常，优先处理高影响问题。"],
  api: ["System contract", "系统 / API 设置", "查看演示后端状态、接口边界与真实平台接入条件。"],
} as const;

function ModuleHero({ copy }: { copy: readonly [string, string, string] }) {
  return <section className="module-hero"><p className="eyebrow">{copy[0]}</p><h1>{copy[1]}</h1><p>{copy[2]}</p></section>;
}

export function AccountsPage({ data, actionNotice, onDemoAction }: { data: DashboardData; actionNotice?: string | null; onDemoAction(message: string): void }) {
  const normalCount = ACCOUNTS.filter((account) => account.status.kind === "normal").length;
  const rangeFactor = data.meta.range === 7 ? 0.27 : data.meta.range === 90 ? 2.78 : 1;
  return (
    <>
      <ModuleHero copy={["Account matrix", "账号管理", "统一查看授权、同步状态与账号经营表现"]} />
      <div className="module-toolbar"><span>{ACCOUNTS.length} 个账号 · {normalCount} 个正常</span><button type="button" className="primary-action" aria-label="添加监控账号" onClick={() => onDemoAction("演示模式不会连接真实平台；正式接入需配置平台授权。")}>＋ 添加监控账号</button></div>
      {actionNotice ? <div className="action-notice" role="status">{actionNotice}</div> : null}
      <section className="account-grid" aria-label="监控账号">
        {ACCOUNTS.map((account) => (
          <article className="surface-card account-card" key={`${account.platform}-${account.name}`}>
            <header><span className={`account-mark mark-${account.mark}`}>{account.mark}</span><div><h2>{account.name}</h2><p>{account.platform}</p></div><span className={`status-pill status-${account.status.kind}`}>{account.status.label}</span></header>
            <dl><div><dt>粉丝</dt><dd>{formatMetricValue(account.followers, "compact")}</dd></div><div><dt>近 {data.meta.range} 天增粉</dt><dd>+{formatMetricValue(Math.round(account.growth30 * rangeFactor), "compact")}</dd></div><div><dt>互动率</dt><dd>{account.engagement.toFixed(2)}%</dd></div></dl>
            <button type="button" className="text-action account-detail" aria-label={`查看 ${account.name} 详情`} onClick={() => onDemoAction(`${account.name}：详情面板将在接入真实平台数据后开放。`)}>查看详情</button>
          </article>
        ))}
      </section>
    </>
  );
}

export function ContentPage({ data }: { data: DashboardData }) {
  return (
    <>
      <ModuleHero copy={["Content monitor", "作品监控", "统一比较跨平台作品表现，识别爆款、高潜和长尾内容。"]} />
      <section className="content-list surface-card">
        {data.works.map((work) => <article key={work.id}><div><span>{work.platform} · {work.format}</span><h2>{work.title}</h2><p>{work.account} · {work.publishedAt}</p></div><dl><div><dt>播放 / 阅读</dt><dd>{formatMetricValue(work.reach, "integer")}</dd></div><div><dt>互动率</dt><dd>{work.engagementRate.toFixed(2)}%</dd></div><div><dt>识别</dt><dd>{work.signal}</dd></div></dl></article>)}
      </section>
    </>
  );
}

export function InsightPage({ page, data }: { page: keyof typeof PAGE_COPY; data: DashboardData }) {
  const cards = page === "fans"
    ? [["矩阵净增粉", formatMetricValue(data.summary[1].value, "integer"), "增长贡献主要来自抖音"], ["最高转化账号", "出逃指令", "涨粉转化 3.18%"], ["新增关注来源", "搜索 38%", "推荐流 34% · 主页 28%"]]
    : page === "engagement"
      ? [["综合互动率", "7.42%", "较上周期下降 0.38%"], ["收藏贡献", "31%", "知识型内容表现更强"], ["评论响应", "86%", "平均响应时间 2.4 小时"]]
      : page === "alerts"
        ? [["互动率低于基线", "城市出逃指南", "已持续 3 天，建议检查选题与首图"], ["授权即将过期", "抖音 · 出逃指令", "剩余 7 天，重新授权可避免数据中断"], ["数据延迟", "微信公众号", "最近一次同步延迟 18 分钟"]]
        : [["Dashboard API", "/api/dashboard", "支持 range=7、30、90"], ["Health API", "/api/health", "用于部署与后端健康检查"], ["数据边界", "Demo only", "当前不会请求真实平台或保存凭证"]];
  return <><ModuleHero copy={PAGE_COPY[page]} /><section className="insight-grid">{cards.map(([label, value, note]) => <article className="surface-card insight-card" key={label}><p>{label}</p><strong>{value}</strong><span>{note}</span></article>)}</section></>;
}
