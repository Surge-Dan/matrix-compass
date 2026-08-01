import type { BootstrapData } from "../../lib/application/get-bootstrap";
import {
  DesktopSidebar,
  OPERATIONS_NAVIGATION,
  type OperationsPage,
} from "../navigation/desktop-sidebar";
import { MobileNav } from "../navigation/mobile-nav";
import { DemoModeBanner } from "../onboarding/demo-mode-banner";
import { EmptyState } from "../onboarding/empty-state";

function formatMoney(minor: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function DemoOverview({ data }: { data: BootstrapData }) {
  const metrics = data.metrics;
  return (
    <section className="operations-overview" aria-labelledby="operations-overview-title">
      <div className="operations-hero">
        <p className="operations-eyebrow">GOOD AFTERNOON, DANIEL</p>
        <h1 id="operations-overview-title">今天，先看清经营结果。</h1>
        <p>从内容、日程和收入回到同一份经营事实。</p>
      </div>
      <div className="operations-metrics" aria-label="演示经营指标">
        <article><span>发布内容</span><strong>{data.counts.contents}</strong><small>{data.counts.accounts} 个账号</small></article>
        <article><span>总收入</span><strong>{formatMoney(metrics?.revenueMinor ?? 0)}</strong><small>演示口径</small></article>
        <article><span>已结算</span><strong>{formatMoney(metrics?.settledMinor ?? 0)}</strong><small>90.9%</small></article>
        <article><span>待结算</span><strong>{formatMoney(metrics?.pendingMinor ?? 0)}</strong><small>需要跟进</small></article>
      </div>
      <section className="operations-placeholder-panel">
        <div><strong>真实数据接入后，这里会显示经营信号</strong><span>趋势、待办、收入和内容表现都将来自可追溯记录。</span></div>
      </section>
    </section>
  );
}

function LocalOverview({ data }: { data: BootstrapData }) {
  return (
    <section className="operations-overview" aria-labelledby="operations-overview-title">
      <div className="operations-hero">
        <p className="operations-eyebrow">LOCAL FACTS ONLY</p>
        <h1 id="operations-overview-title">真实记录已经就位。</h1>
        <p>只展示当前本地库能够证明的经营事实。</p>
      </div>
      <div className="operations-metrics" aria-label="本地经营记录概况">
        <article><span>账号记录</span><strong>{data.counts.accounts}</strong><small>{data.counts.accounts} 个账号</small></article>
        <article><span>内容记录</span><strong>{data.counts.contents}</strong><small>{data.counts.contents} 条内容</small></article>
        <article><span>收入指标</span><strong>无法计算</strong><small>尚未接入收入流水</small></article>
        <article><span>经营趋势</span><strong>待观察</strong><small>需要可追溯指标快照</small></article>
      </div>
      <section className="operations-placeholder-panel">
        <div><strong>没有证据的数字不会出现在这里</strong><span>完成收入与指标导入后，再按来源、时间范围和样本量计算。</span></div>
      </section>
    </section>
  );
}

function PendingModule({ page }: { page: OperationsPage }) {
  const label = OPERATIONS_NAVIGATION.find((item) => item.id === page)?.label ?? "经营模块";
  return (
    <section className="operations-module-pending">
      <p className="operations-eyebrow">REAL DATA WORKFLOW</p>
      <h1>{label}</h1>
      <p>导航结构已经切换；该工作流将在对应里程碑接入真实数据。</p>
    </section>
  );
}

export function OperationsView({
  data,
  activePage = "overview",
  notice,
  onNavigate = () => undefined,
  onAction = () => undefined,
}: {
  data: BootstrapData;
  activePage?: OperationsPage;
  notice?: string | null;
  onNavigate?(page: OperationsPage): void;
  onAction?(action: BootstrapData["actions"][number]): void;
}) {
  return (
    <div className="operations-app">
      <a className="skip-link" href="#operations-content">跳到主要内容</a>
      <DesktopSidebar activePage={activePage} onNavigate={onNavigate} />
      <section className="operations-workspace">
        <header className="operations-topbar">
          <div className="operations-mobile-brand"><span>矩</span><strong>矩阵罗盘</strong></div>
          <div><span>矩阵罗盘</span><i>/</i><strong>{OPERATIONS_NAVIGATION.find((item) => item.id === activePage)?.label}</strong></div>
          <span className={data.mode === "demo" ? "operations-source is-demo" : "operations-source"}>
            {data.mode === "demo" ? "演示数据" : "本地真实数据"}
          </span>
        </header>
        {data.mode === "demo" ? <DemoModeBanner /> : null}
        {notice ? <div className="operations-notice" role="status">{notice}</div> : null}
        <main id="operations-content" className="operations-content">
          {activePage !== "overview" ? (
            <PendingModule page={activePage} />
          ) : data.needsOnboarding ? (
            <EmptyState actions={data.actions} onAction={onAction} />
          ) : data.mode === "demo" ? (
            <DemoOverview data={data} />
          ) : (
            <LocalOverview data={data} />
          )}
        </main>
      </section>
      <MobileNav activePage={activePage} onNavigate={onNavigate} />
    </div>
  );
}
