"use client";

import { useEffect, useRef } from "react";
import type { DashboardData, DashboardRange } from "../../lib/dashboard-data";
import { formatDashboardPeriod } from "../../lib/dashboard-format";
import { AccountsPage, ContentPage, InsightPage } from "./module-pages";
import { OverviewPage } from "./overview-page";

export type DashboardPage = "overview" | "accounts" | "content" | "fans" | "engagement" | "alerts" | "api";

const NAV_ITEMS: Array<{ id: DashboardPage; label: string; icon: string }> = [
  { id: "overview", label: "数据总览", icon: "⌂" },
  { id: "accounts", label: "账号管理", icon: "◎" },
  { id: "content", label: "作品监控", icon: "▱" },
  { id: "fans", label: "粉丝分析", icon: "♙" },
  { id: "engagement", label: "互动分析", icon: "◇" },
  { id: "alerts", label: "异常预警", icon: "△" },
];

const PAGE_LABELS: Record<DashboardPage, string> = {
  overview: "数据总览", accounts: "账号管理", content: "作品监控", fans: "粉丝分析", engagement: "互动分析", alerts: "异常预警", api: "系统 / API 设置",
};

interface DashboardViewProps {
  data: DashboardData;
  activePage: DashboardPage;
  range: DashboardRange;
  menuOpen: boolean;
  refreshing: boolean;
  refreshError?: { message: string; requestId?: string } | null;
  actionNotice?: string | null;
  onNavigate(page: DashboardPage): void;
  onRangeChange(range: DashboardRange): void;
  onMenuToggle(): void;
  onDemoAction(message: string): void;
  onRetry?: () => void;
}

function Navigation({ activePage, onNavigate }: Pick<DashboardViewProps, "activePage" | "onNavigate">) {
  return (
    <nav aria-label="主导航" className="primary-nav">
      {NAV_ITEMS.map((item) => (
        <button key={item.id} type="button" data-icon={item.icon} aria-label={item.label} aria-current={activePage === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)}>{item.label}</button>
      ))}
    </nav>
  );
}

export function DashboardLoading() {
  return <main className="state-page" aria-label="正在加载仪表盘" aria-busy="true"><div className="state-orbit" /><h1>正在校准经营数据</h1><p>连接演示后端并整理跨平台指标。</p></main>;
}

export function DashboardEmpty() {
  return <section className="state-panel"><h1>当前周期没有可展示的数据</h1><p>可以切换统计周期，或稍后重新加载。</p></section>;
}

export function DashboardError({ message, requestId, onRetry }: { message: string; requestId?: string; onRetry(): void }) {
  return <main className="state-page"><section className="state-panel error-panel" role="alert"><p className="eyebrow">Data signal lost</p><h1>数据暂时没有响应</h1><p>{message}</p>{requestId ? <code>请求 ID：{requestId}</code> : null}<button className="primary-action" type="button" onClick={onRetry}>重新加载</button></section></main>;
}

function ActivePage({ page, data, actionNotice, onNavigate, onDemoAction }: { page: DashboardPage; data: DashboardData; actionNotice?: string | null; onNavigate(page: DashboardPage): void; onDemoAction(message: string): void }) {
  if (page === "overview") return <OverviewPage data={data} onNavigate={onNavigate} />;
  if (page === "accounts") return <AccountsPage data={data} actionNotice={actionNotice} onDemoAction={onDemoAction} />;
  if (page === "content") return <ContentPage data={data} />;
  return <InsightPage page={page} data={data} />;
}

export function DashboardView(props: DashboardViewProps) {
  const { data, activePage, range, menuOpen, refreshing, refreshError, actionNotice, onNavigate, onRangeChange, onMenuToggle, onDemoAction, onRetry } = props;
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const navigate = (page: DashboardPage) => { onNavigate(page); if (menuOpen) onMenuToggle(); };

  useEffect(() => {
    if (menuOpen) sidebarRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    else if (wasOpen.current) menuToggleRef.current?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  const trapSidebarFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!menuOpen || event.key !== "Tab") return;
    const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return (
    <div className="matrix-app" data-menu-open={menuOpen ? "true" : "false"}>
      <a className="skip-link" href="#dashboard-content">跳到主要内容</a>
      <aside id="primary-sidebar" ref={sidebarRef} className="sidebar" aria-label="应用侧栏" onKeyDown={trapSidebarFocus}>
        <div className="brand-lockup"><span>矩</span><div><strong>矩阵罗盘</strong><small>MATRIX COMPASS</small></div></div>
        <p className="nav-caption">运营工作台</p>
        <Navigation activePage={activePage} onNavigate={navigate} />
        <p className="nav-caption system-caption">系统</p>
        <button className="system-link" type="button" data-icon="⌘" aria-label="系统 / API 设置" aria-current={activePage === "api" ? "page" : undefined} onClick={() => navigate("api")}>系统 / API 设置</button>
        <div className="sidebar-foot"><i />演示数据已同步 · 10:32</div>
      </aside>
      <button type="button" tabIndex={-1} className="menu-backdrop" aria-label="关闭侧栏导航" onClick={onMenuToggle} />

      <section className="workspace" inert={menuOpen ? true : undefined}>
        <header className="mobile-header"><div className="mobile-brand"><span>矩</span><strong>矩阵罗盘</strong></div><button ref={menuToggleRef} type="button" className="menu-toggle" aria-label={menuOpen ? "关闭导航" : "打开导航"} aria-controls="primary-sidebar" aria-expanded={menuOpen} onClick={onMenuToggle}><i /><i /><i /></button></header>
        <header className="topbar">
          <div className="breadcrumb"><span>矩阵罗盘</span><i>/</i><strong>{PAGE_LABELS[activePage]}</strong></div>
          <div className="topbar-actions"><span className="demo-badge">演示数据</span><span className="date-chip">{formatDashboardPeriod(data.meta.updatedAt, data.meta.range)}</span><span className="avatar" aria-label="用户 Daniel">DA</span></div>
        </header>
        <main id="dashboard-content" className="dashboard-content">
          <div className="range-row">
            <div className="range-control" aria-label="统计周期">
              {([7, 30, 90] as DashboardRange[]).map((item) => <button type="button" key={item} aria-pressed={range === item} onClick={() => onRangeChange(item)}>近 {item} 天</button>)}
            </div>
            {refreshing ? <span className="refresh-label" role="status">正在更新…</span> : null}
          </div>
          {refreshError ? <div className="inline-error" role="alert"><span>{refreshError.message}{refreshError.requestId ? ` · ${refreshError.requestId}` : ""}</span>{onRetry ? <button type="button" onClick={onRetry}>重试</button> : null}</div> : null}
          <ActivePage page={activePage} data={data} actionNotice={actionNotice} onNavigate={navigate} onDemoAction={onDemoAction} />
        </main>
      </section>
    </div>
  );
}
