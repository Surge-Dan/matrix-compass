import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const port = 4173;
const systemChrome = process.platform === "win32" && existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const browserRuntime = systemChrome ? { browserName: "chromium" as const, channel: "chrome" } : { browserName: "chromium" as const };

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["line"]],
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], ...browserRuntime, viewport: { width: 1440, height: 1000 } } },
    { name: "desktop-1024", use: { ...devices["Desktop Chrome"], ...browserRuntime, viewport: { width: 1024, height: 768 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], ...browserRuntime, viewport: { width: 768, height: 1024 } } },
    { name: "mobile-390", use: { ...devices["iPhone 13"], ...browserRuntime, viewport: { width: 390, height: 844 } } },
    { name: "mobile-320", use: { ...devices["iPhone SE"], ...browserRuntime, viewport: { width: 320, height: 568 } } },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    env: { MATRIX_COMPASS_MODE: "demo", MATRIX_COMPASS_LAN: "false" },
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
