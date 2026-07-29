"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData, DashboardRange } from "../../lib/dashboard-data";
import { DashboardView, type DashboardPage } from "./dashboard-view";

interface ApiErrorBody { error?: { message?: string; requestId?: string } }

export function DashboardApp({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [range, setRange] = useState<DashboardRange>(30);
  const [activePage, setActivePage] = useState<DashboardPage>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const requestedRange = useRef<DashboardRange>(30);

  const load = useCallback(async (nextRange: DashboardRange, signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard?range=${nextRange}`, { cache: "no-store", signal });
      const body = (await response.json()) as DashboardData | ApiErrorBody;
      if (!response.ok) {
        const problem = body as ApiErrorBody;
        throw Object.assign(new Error(problem.error?.message ?? "仪表盘暂时无法加载，请稍后重试。"), { requestId: problem.error?.requestId });
      }
      if (sequence === requestSequence.current) {
        setData(body as DashboardData);
        setRange(nextRange);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (sequence === requestSequence.current) {
        const failure = caught instanceof Error ? caught : new Error("仪表盘暂时无法加载，请稍后重试。");
        const requestId = "requestId" in failure && typeof failure.requestId === "string" && failure.requestId ? failure.requestId : undefined;
        setError({ message: failure.message, requestId });
      }
    } finally {
      if (sequence === requestSequence.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => {
    document.documentElement.dataset.dashboardHydrated = "true";
    return () => { delete document.documentElement.dataset.dashboardHydrated; };
  }, []);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const changeRange = (nextRange: DashboardRange) => {
    requestedRange.current = nextRange;
    activeRequest.current?.abort();
    activeRequest.current = new AbortController();
    void load(nextRange, activeRequest.current.signal);
  };

  const navigate = (page: DashboardPage) => { setActivePage(page); setActionNotice(null); };

  return <DashboardView data={data} activePage={activePage} range={range} menuOpen={menuOpen} refreshing={refreshing} refreshError={error} actionNotice={actionNotice} onNavigate={navigate} onRangeChange={changeRange} onMenuToggle={() => setMenuOpen((open) => !open)} onDemoAction={setActionNotice} onRetry={() => void load(requestedRange.current)} />;
}
