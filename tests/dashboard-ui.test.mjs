import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = new URL("../", import.meta.url);
const viewUrl = new URL("components/dashboard/dashboard-view.tsx", root);
const formatUrl = new URL("lib/dashboard-format.ts", root);
const dataUrl = new URL("lib/dashboard-data.ts", root);
const cssUrl = new URL("app/globals.css", root);
const layoutUrl = new URL("app/layout.tsx", root);
const packageUrl = new URL("package.json", root);

async function importRequired(url, label) {
  assert.equal(existsSync(url), true, `${label} should exist`);
  return import(`${url.href}?test=${Date.now()}-${Math.random()}`);
}

test("metric formatter preserves business precision", async () => {
  const { formatMetricValue, formatChange } = await importRequired(
    formatUrl,
    "dashboard formatter",
  );
  assert.equal(formatMetricValue(486_392, "integer"), "486,392");
  assert.equal(formatMetricValue(3_280_000, "compact"), "3.28M");
  assert.equal(formatMetricValue(7.42, "percent"), "7.42%");
  assert.equal(formatChange(12.8), "+12.8%");
  assert.equal(formatChange(-0.38), "−0.38%");
  assert.equal(formatChange(0), "0%");
  assert.equal(formatMetricValue(886_000, "compact"), "886K");
  assert.equal(formatMetricValue(912, "compact"), "912");
});

test("overview renders semantic navigation, range controls, and demo boundary", async () => {
  const [{ DashboardView }, { getDashboardData }] = await Promise.all([
    importRequired(viewUrl, "dashboard view"),
    importRequired(dataUrl, "dashboard data module"),
  ]);
  const html = renderToStaticMarkup(
    React.createElement(DashboardView, {
      data: getDashboardData(30, "render-test"),
      activePage: "overview",
      range: 30,
      menuOpen: false,
      refreshing: false,
      onNavigate() {},
      onRangeChange() {},
      onMenuToggle() {},
    }),
  );
  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /aria-current="page"[^>]*>[^<]*数据总览/);
  assert.match(html, /aria-label="统计周期"/);
  assert.match(html, /aria-pressed="true"[^>]*>近 30 天/);
  assert.match(html, /演示数据/);
  assert.match(html, /今天，内容仍在生长。/);
  assert.match(html, /近期高表现作品/);
});

test("every confirmed product module is reachable from the primary navigation", async () => {
  const [{ DashboardView }, { getDashboardData }] = await Promise.all([
    importRequired(viewUrl, "dashboard view"),
    importRequired(dataUrl, "dashboard data module"),
  ]);
  const html = renderToStaticMarkup(
    React.createElement(DashboardView, {
      data: getDashboardData(30, "nav-test"),
      activePage: "accounts",
      range: 30,
      menuOpen: true,
      refreshing: false,
      onNavigate() {},
      onRangeChange() {},
      onMenuToggle() {},
    }),
  );
  for (const label of [
    "数据总览",
    "账号管理",
    "作品监控",
    "粉丝分析",
    "互动分析",
    "异常预警",
    "系统 / API 设置",
  ]) {
    assert.match(html, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(html, /aria-current="page"[^>]*>[^<]*账号管理/);
  assert.match(html, /统一查看授权、同步状态与账号经营表现/);
  assert.match(html, /8 个账号 · 6 个正常/);
  assert.match(html, /近 30 天增粉/);
  assert.match(html, /status-expiring/);
  assert.match(html, /status-alert/);
});

test("loading, empty, and error states provide recovery-oriented copy", async () => {
  const { DashboardLoading, DashboardEmpty, DashboardError } =
    await importRequired(viewUrl, "dashboard view");
  const loading = renderToStaticMarkup(React.createElement(DashboardLoading));
  const empty = renderToStaticMarkup(React.createElement(DashboardEmpty));
  const error = renderToStaticMarkup(
    React.createElement(DashboardError, {
      message: "服务暂不可用",
      requestId: "mc-test",
      onRetry() {},
    }),
  );
  assert.match(loading, /aria-label="正在加载仪表盘"/);
  assert.match(empty, /当前周期没有可展示的数据/);
  assert.match(error, /role="alert"/);
  assert.match(error, /服务暂不可用/);
  assert.match(error, /mc-test/);
  assert.match(error, />重新加载</);
});

test("responsive CSS supports phone layouts without the former fixed minimum width", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.doesNotMatch(css, /min-width:\s*1024px/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /overflow-x:\s*hidden/);
});

test("root metadata identifies the Chinese Matrix Compass product", async () => {
  const layout = await readFile(layoutUrl, "utf8");
  assert.match(layout, /const title = "矩阵罗盘｜自媒体运营监控平台"/);
  assert.match(layout, /const description = "跨平台自媒体账号经营监控与增长分析工作台。"/);
  assert.match(layout, /openGraph:/);
  assert.match(layout, /\/og\.png/);
  assert.match(layout, /<html lang="zh-CN">/);
});

test("production build and artifact validation are cross-platform", async () => {
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  assert.equal(packageJson.scripts.build, "node scripts/build-verified.mjs");
  assert.equal(packageJson.scripts["validate:artifact"], "node scripts/validate-artifact.mjs");
  assert.match(packageJson.scripts["test:unit"], /--import tsx --test/);
  assert.equal(packageJson.scripts.test, "npm run test:release");
  assert.equal(
    packageJson.scripts["dev:demo"],
    "node --import tsx scripts/demo-runtime.ts",
  );
  for (const gate of ["build", "lint", "typecheck", "test:unit", "test:coverage", "test:gherkin", "test:e2e"]) {
    assert.match(packageJson.scripts["test:quality"], new RegExp(`npm run ${gate.replace(":", "\\:")}`));
  }
  for (const gate of ["test:quality", "test:mutation", "test:security"]) {
    assert.match(packageJson.scripts["test:release"], new RegExp(`npm run ${gate.replace(":", "\\:")}`));
  }
});
