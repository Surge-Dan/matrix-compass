import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

interface PageDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: string[];
}

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
  await expect(page.locator("html")).toHaveAttribute("data-operations-hydrated", "true");
});

test("renders the new operations shell without overflow or browser errors", async ({ page }) => {
  const report = diagnostics.get(page)!;
  await expect(page.getByRole("heading", { name: "今天，先看清经营结果。" })).toBeVisible();
  await expect(page.getByText("演示模式", { exact: true })).toBeVisible();
  await expect(page.getByText("¥2,430", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(report.consoleErrors).toEqual([]);
  expect(report.pageErrors).toEqual([]);
  expect(report.failedRequests).toEqual([]);
});

test("desktop navigation reaches every confirmed operations module", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "desktop navigation audit");
  for (const label of ["内容日历", "内容库", "收入管理", "账号资产", "复盘实验", "数据导入与同步", "设置"]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
});

test("mobile bottom navigation reaches the primary workflows", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 768, "mobile navigation audit");
  for (const [button, heading] of [["日程", "内容日历"], ["内容", "内容库"], ["收入", "收入管理"], ["更多", "数据导入与同步"]]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("meets automated WCAG A and AA checks", async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
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

test("matches the approved responsive visual baseline", async ({ page }) => {
  await expect(page).toHaveScreenshot("operations-overview.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("serves bootstrap, health, and compatibility backend contracts", async ({ request }) => {
  const bootstrap = await request.get("/api/bootstrap");
  expect(bootstrap.status()).toBe(200);
  expect(await bootstrap.json()).toMatchObject({
    data: { mode: "demo", source: "demo", readOnly: true, needsOnboarding: false },
  });
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", dataSource: "demo" });
  const legacyDashboard = await request.get("/api/dashboard?range=90");
  expect(legacyDashboard.status()).toBe(200);
  expect((await legacyDashboard.json()).meta.range).toBe(90);
});
