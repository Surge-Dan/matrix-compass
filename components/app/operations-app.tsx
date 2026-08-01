"use client";

import { useEffect, useState } from "react";
import type { BootstrapData } from "../../lib/application/get-bootstrap";
import type { OperationsPage } from "../navigation/desktop-sidebar";
import { OperationsView } from "./operations-view";

interface BootstrapResponse {
  data?: BootstrapData;
  error?: { message?: string; requestId?: string };
}

const ACTION_NOTICES: Record<BootstrapData["actions"][number], string> = {
  "connect-feishu": "已选择连接飞书；OAuth 接入将在数据同步里程碑启用。",
  "import-file": "已选择文件导入；字段映射与预览将在导入里程碑启用。",
  "create-manually": "已选择手动创建；账号与内容表单将在下一里程碑启用。",
};

export function OperationsApp() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [activePage, setActivePage] = useState<OperationsPage>("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/bootstrap", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as BootstrapResponse;
        if (!response.ok || !body.data) {
          setRequestId(body.error?.requestId ?? null);
          throw new Error(body.error?.message ?? "经营数据暂时无法加载，请稍后重试。");
        }
        setData(body.data);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "经营数据暂时无法加载，请稍后重试。");
      } finally {
        document.documentElement.dataset.operationsHydrated = "true";
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <main className="state-page">
        <section className="state-panel error-panel" role="alert">
          {requestId ? <p className="request-id">Request ID: {requestId}</p> : null}
          <h1>经营数据暂时没有响应</h1><p>{error}</p>
          <button type="button" className="primary-action" onClick={() => window.location.reload()}>重新加载</button>
        </section>
      </main>
    );
  }
  if (!data) {
    return <main className="state-page" aria-label="正在加载经营数据" aria-busy="true"><div><div className="state-orbit" /><h1>正在读取本地经营库</h1></div></main>;
  }
  return (
    <OperationsView
      data={data}
      activePage={activePage}
      notice={notice}
      onNavigate={(page) => { setActivePage(page); setNotice(null); }}
      onAction={(action) => setNotice(ACTION_NOTICES[action])}
    />
  );
}
