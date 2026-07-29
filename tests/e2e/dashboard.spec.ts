import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

interface PageDiagnostics { consoleErrors: string[]; pageErrors: string[]; failedRequests: string[] }
const diagnostics = new WeakMap<Page, PageDiagnostics>();

test.beforeEach(async ({ page }) => {
  const report: PageDiagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
  diagnostics.set(page, report);
  page.on("console", (message) => {
    if (message.type() === "error") report.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("requestfailed", (request) => report.failedRequests.push(`${request.method()} ${request.url()}`));
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-dashboard-hydrated", "true");
});

test("renders without overflow, browser errors, or failed requests", async ({ page }) => {
  const report = diagnostics.get(page)!;

  await expect(page.getByRole("heading", { name: "今天，内容仍在生长。" })).toBeVisible();
  await expect(page.getByText("演示数据", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(report.consoleErrors).toEqual([]);
  expect(report.pageErrors).toEqual([]);
  expect(report.failedRequests).toEqual([]);
});

test("switches reporting range through the real dashboard API", async ({ page }) => {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/dashboard?range=7") && response.status() === 200,
  );
  const rangeButton = page.getByRole("button", { name: "近 7 天" });
  await rangeButton.click();
  const response = await responsePromise;
  expect((await response.json()).meta.range).toBe(7);
  await expect(rangeButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("5,028", { exact: true })).toBeVisible();
});

test("keeps the selected period consistent across dates and modules", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 1440, "single desktop period audit");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/dashboard?range=90") && response.status() === 200),
    page.getByRole("button", { name: "近 90 天" }).click(),
  ]);
  await expect(page.getByText("2026.05.01 — 07.29", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "账号管理", exact: true }).click();
  await expect(page.getByText("近 90 天增粉", { exact: true }).first()).toBeVisible();
});

test("navigates to account management from desktop or mobile navigation", async ({ page }) => {
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "打开导航" }).click();
  }
  await page.getByRole("button", { name: "账号管理", exact: true }).click();
  await expect(page.getByRole("heading", { name: "账号管理", exact: true })).toBeVisible();
  await expect(page.getByText("统一查看授权、同步状态与账号经营表现")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("gives every prominent dashboard action a visible result", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 1440, "single desktop interaction audit");
  await page.getByRole("button", { name: "查看预警" }).click();
  await expect(page.getByRole("heading", { name: "异常预警", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "数据总览", exact: true }).click();
  await page.getByRole("button", { name: "查看全部作品" }).click();
  await expect(page.getByRole("heading", { name: "作品监控", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "账号管理", exact: true }).click();
  await page.getByRole("button", { name: "添加监控账号" }).click();
  await expect(page.getByRole("status")).toContainText("演示模式不会连接真实平台");
  await page.getByRole("button", { name: "查看 Daniel AI笔记 详情" }).click();
  await expect(page.getByRole("status")).toContainText("Daniel AI笔记");
});

test("meets automated WCAG checks", async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await page.getByRole("button", { name: "打开导航" }).click();
    const openMenuResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(openMenuResults.violations).toEqual([]);
  }
});

test("keeps visible mobile touch targets at least 44 pixels high", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "mobile-only constraint");
  const undersized = await page.locator("button:visible").evaluateAll((buttons) =>
    buttons
      .map((button) => ({
        label: button.getAttribute("aria-label") || button.textContent?.trim() || "unlabelled",
        height: Math.round(button.getBoundingClientRect().height),
      }))
      .filter((button) => button.height < 44),
  );
  expect(undersized).toEqual([]);
});

test("closes the mobile navigation with Escape", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "mobile-only interaction");
  const toggle = page.getByRole("button", { name: "打开导航" });
  await expect(page.getByRole("button", { name: "数据总览", exact: true })).toBeHidden();
  await toggle.click();
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "数据总览", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "关闭导航" })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "打开导航" })).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
});

test("all reachable modules meet WCAG A and AA checks", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) !== 1440, "single desktop accessibility audit");
  for (const label of ["数据总览", "账号管理", "作品监控", "粉丝分析", "互动分析", "异常预警", "系统 / API 设置"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations, `${label} should have no WCAG A/AA violations`).toEqual([]);
  }
});

test("matches the approved responsive visual baseline", async ({ page }) => {
  await expect(page).toHaveScreenshot("dashboard-overview.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("serves public backend contracts", async ({ request }) => {
  const dashboard = await request.get("/api/dashboard?range=90");
  expect(dashboard.status()).toBe(200);
  expect((await dashboard.json()).meta.range).toBe(90);
  const invalid = await request.get("/api/dashboard?range=14");
  expect(invalid.status()).toBe(400);
  expect((await invalid.json()).error.code).toBe("INVALID_RANGE");
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", dataSource: "demo" });
});
