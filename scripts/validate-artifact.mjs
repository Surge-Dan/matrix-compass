import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workerPath = path.join(projectRoot, "dist", "server", "index.js");
const hostingPath = path.join(projectRoot, "dist", ".openai", "hosting.json");

if (!existsSync(workerPath)) throw new Error("Missing Sites Worker entry: dist/server/index.js");
if (!existsSync(hostingPath)) throw new Error("Missing packaged Sites manifest: dist/.openai/hosting.json");

JSON.parse(await readFile(hostingPath, "utf8"));
const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("sites-validation", `${process.pid}-${Date.now()}`);
const worker = await import(workerUrl.href);

if (!worker.default || typeof worker.default.fetch !== "function") {
  throw new Error("dist/server/index.js must have an ESM default export with fetch(request, env, ctx)");
}

const environment = {
  ASSETS: { fetch: async () => new Response("Asset not found", { status: 404 }) },
  IMAGES: { input: () => { throw new Error("Image binding should not be used by smoke routes"); } },
};
const context = { waitUntil() {}, passThroughOnException() {} };
const requestBuiltWorker = (path) => worker.default.fetch(new Request(`https://matrix-compass.test${path}`), environment, context);

const home = await requestBuiltWorker("/");
if (home.status !== 200 || !(await home.text()).includes("矩阵罗盘")) {
  throw new Error("Built Worker homepage smoke test failed");
}

const dashboard = await requestBuiltWorker("/api/dashboard?range=7");
const dashboardBody = await dashboard.json();
if (dashboard.status !== 200 || dashboardBody.meta?.range !== 7) {
  throw new Error("Built Worker dashboard API smoke test failed");
}

const invalidDashboard = await requestBuiltWorker("/api/dashboard?range=14");
if (invalidDashboard.status !== 400) throw new Error("Built Worker dashboard validation smoke test failed");

const health = await requestBuiltWorker("/api/health");
const healthBody = await health.json();
if (health.status !== 200 || healthBody.status !== "ok") {
  throw new Error("Built Worker health API smoke test failed");
}

console.log("Validated Sites artifact and smoke-tested /, /api/dashboard, and /api/health.");
