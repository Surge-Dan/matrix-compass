import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function serveEmptyLocalBootstrap(page: import("@playwright/test").Page) {
  await page.route("**/api/bootstrap", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          mode: "local",
          source: "local-d1",
          readOnly: false,
          needsOnboarding: true,
          counts: { accounts: 0, contents: 0 },
          metrics: null,
          actions: ["connect-feishu", "import-file", "create-manually"],
        },
        meta: { requestId: "mc-e2e" },
      }),
    });
  });
}

test.beforeEach(async ({ page }) => {
  await serveEmptyLocalBootstrap(page);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-operations-hydrated", "true");
});

test("local empty state never presents demo metrics as real data", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "先接入你的真实经营数据" })).toBeVisible();
  await expect(page.getByText("本地真实数据", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /连接飞书/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /导入 Excel \/ CSV/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /手动创建第一条记录/ })).toBeVisible();
  await expect(page.getByText("486,392", { exact: true })).toHaveCount(0);
  await expect(page.getByText("¥2,430", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("every onboarding choice returns a visible next-step boundary", async ({ page }) => {
  for (const [button, notice] of [
    [/连接飞书/, "OAuth 接入将在数据同步里程碑启用"],
    [/导入 Excel \/ CSV/, "字段映射与预览将在导入里程碑启用"],
    [/手动创建第一条记录/, "账号与内容表单将在下一里程碑启用"],
  ] as const) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("status")).toContainText(notice);
  }
});

test("local onboarding meets automated WCAG checks", async ({ page }) => {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("bootstrap failure is explicit and recoverable", async ({ page }) => {
  await page.unroute("**/api/bootstrap");
  await page.route("**/api/bootstrap", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "本地数据库不可用" } }) });
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("alert")).toContainText("经营数据暂时没有响应");
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});

test("non-empty local records never render demo or fabricated financial metrics", async ({ page }) => {
  await page.unroute("**/api/bootstrap");
  await page.route("**/api/bootstrap", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          mode: "local",
          source: "local-d1",
          readOnly: false,
          needsOnboarding: false,
          counts: { accounts: 2, contents: 9 },
          metrics: null,
          actions: ["connect-feishu", "import-file", "create-manually"],
        },
        meta: { requestId: "mc-local-nonempty" },
      }),
    });
  });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "真实记录已经就位。" })).toBeVisible();
  await expect(page.getByText("2 个账号", { exact: true })).toBeVisible();
  await expect(page.getByText("9 条内容", { exact: true })).toBeVisible();
  await expect(page.getByText("无法计算", { exact: true })).toBeVisible();
  await expect(page.getByText("¥0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("90.9%", { exact: true })).toHaveCount(0);
});
