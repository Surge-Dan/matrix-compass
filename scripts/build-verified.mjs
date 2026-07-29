import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const runtimeRoot = path.join(projectRoot, ".sites-runtime");
const runtimePaths = {
  config: path.join(runtimeRoot, "xdg-config"),
  temp: path.join(runtimeRoot, "tmp"),
  logs: path.join(runtimeRoot, "wrangler", "logs"),
  registry: path.join(runtimeRoot, "wrangler", "registry"),
};

Object.values(runtimePaths).forEach((directory) => mkdirSync(directory, { recursive: true }));

const environment = {
  ...process.env,
  XDG_CONFIG_HOME: runtimePaths.config,
  TMPDIR: runtimePaths.temp,
  WRANGLER_WRITE_LOGS: "false",
  WRANGLER_LOG_PATH: runtimePaths.logs,
  MINIFLARE_REGISTRY_PATH: runtimePaths.registry,
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_update_notifier: "false",
};

const timeout = Number.parseInt(process.env.SITES_BUILD_TIMEOUT_MS ?? "180000", 10);
const vinextCli = path.join(projectRoot, "node_modules", "vinext", "dist", "cli.js");
console.log("Running bounded vinext build...");
const build = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: projectRoot,
  env: environment,
  stdio: "inherit",
  timeout,
  killSignal: "SIGTERM",
});

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const validation = spawnSync(process.execPath, [path.join(projectRoot, "scripts", "validate-artifact.mjs")], {
  cwd: projectRoot,
  env: environment,
  stdio: "inherit",
});
if (validation.error) throw validation.error;
process.exit(validation.status ?? 1);
