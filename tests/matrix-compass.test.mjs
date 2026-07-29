import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const htmlPath = process.env.MATRIX_HTML_PATH
  ? new URL(`file://${process.env.MATRIX_HTML_PATH}`)
  : new URL("../public/matrix-compass.html", import.meta.url);
const html = await readFile(htmlPath, "utf8");

test("single-file dashboard contains every confirmed product module", () => {
  const modules = [
    "数据总览",
    "账号管理",
    "作品监控",
    "粉丝分析",
    "互动分析",
    "异常预警",
    "系统 / API 设置",
  ];
  for (const moduleName of modules) {
    assert.match(html, new RegExp(moduleName.replace("/", "\\/")));
  }
  assert.doesNotMatch(html, /内容发布|定时发布|一键发布/);
});

test("single-file artifact has no external runtime dependency", () => {
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet["']/i);
  assert.doesNotMatch(html, /https?:\/\/(?:api|open)\./i);
});

test("production build preserves the runnable single-file artifact", async () => {
  const builtHtml = await readFile(
    new URL("../dist/client/matrix-compass.html", import.meta.url),
    "utf8",
  );
  assert.match(builtHtml, /<title>矩阵罗盘｜自媒体运营监控平台<\/title>/);
  assert.match(builtHtml, /const SocialApi = Object\.freeze/);
  assert.match(builtHtml, /id="page-api"/);
});

test("security boundary rejects browser-side secrets and real platform calls", () => {
  assert.doesNotMatch(
    html,
    /<input[^>]+(?:name|id)=["'][^"']*(?:secret|token|cookie|password|appkey)/i,
  );
  assert.doesNotMatch(html, /\bfetch\s*\(\s*["']https?:\/\//i);
  assert.match(html, /backend_only/);
  assert.match(html, /不会向真实平台发送请求/);
  assert.match(html, /401\/403\/429/);
  assert.match(html, /不尝试.*绕过/);
});

test("mock adapter has bounded retry policy for every platform", () => {
  assert.match(html, /douyin:\s*\{\s*adapter:\s*"douyin\.v1",\s*retries:\s*2/);
  assert.match(html, /xiaohongshu:\s*\{\s*adapter:\s*"xhs\.v1",\s*retries:\s*2/);
  assert.match(html, /wechat:\s*\{\s*adapter:\s*"wechat\.v1",\s*retries:\s*1/);
  assert.match(html, /MOCK_429/);
  assert.match(html, /Retry-After/);
});

test("interactive states and local persistence hooks are present", () => {
  const interactions = [
    "content-search",
    "content-platform",
    "detail-drawer",
    "account-modal",
    "export-csv",
    "api-test",
    "matrix-compass-handled-alerts",
  ];
  for (const id of interactions) assert.match(html, new RegExp(id));
  assert.match(html, /localStorage/);
  assert.match(html, /aria-live=["']polite["']/);
  assert.match(html, /prefers-reduced-motion/);
});

test("embedded application script parses as valid JavaScript", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
});
