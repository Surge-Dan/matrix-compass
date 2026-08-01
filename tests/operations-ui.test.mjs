import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("real-data empty state exposes the three approved onboarding actions", async () => {
  const { OperationsView } = await import(
    `../components/app/operations-view.tsx?test=${Date.now()}`
  );
  const html = renderToStaticMarkup(
    React.createElement(OperationsView, {
      data: {
        mode: "local",
        source: "local-d1",
        readOnly: false,
        needsOnboarding: true,
        counts: { accounts: 0, contents: 0 },
        metrics: null,
        actions: ["connect-feishu", "import-file", "create-manually"],
      },
    }),
  );

  for (const label of ["连接飞书", "导入 Excel / CSV", "手动创建第一条记录"]) {
    assert.match(html, new RegExp(label.replace("/", "\\/")));
  }
  assert.doesNotMatch(html, /486,392|演示数据已同步/);
});

test("new navigation contains the confirmed operations modules", async () => {
  const { OperationsView } = await import(
    `../components/app/operations-view.tsx?test=${Date.now()}-${Math.random()}`
  );
  const html = renderToStaticMarkup(
    React.createElement(OperationsView, {
      data: {
        mode: "demo",
        source: "demo",
        readOnly: true,
        needsOnboarding: false,
        counts: { accounts: 6, contents: 139 },
        metrics: { revenueMinor: 243_000, settledMinor: 221_000, pendingMinor: 22_000 },
        actions: [],
      },
    }),
  );

  for (const label of [
    "经营总览",
    "内容日历",
    "内容库",
    "收入管理",
    "账号资产",
    "复盘实验",
    "数据导入与同步",
    "设置",
  ]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /演示模式/);
});

test("non-empty local data never fabricates financial metrics", async () => {
  const { OperationsView } = await import(
    `../components/app/operations-view.tsx?test=${Date.now()}-${Math.random()}`
  );
  const html = renderToStaticMarkup(
    React.createElement(OperationsView, {
      data: {
        mode: "local",
        source: "local-d1",
        readOnly: false,
        needsOnboarding: false,
        counts: { accounts: 2, contents: 9 },
        metrics: null,
        actions: ["connect-feishu", "import-file", "create-manually"],
      },
    }),
  );
  assert.match(html, /2 个账号/);
  assert.match(html, /9 条内容/);
  assert.match(html, /无法计算/);
  assert.doesNotMatch(html, /¥0|90\.9%|演示口径|需要跟进/);
});
