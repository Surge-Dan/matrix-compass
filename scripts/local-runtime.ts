import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareDataDirectories,
  resolveDataDirectory,
} from "../lib/runtime/data-dir";
import { buildD1WranglerArgs } from "../lib/runtime/local-d1";
import { resolveRuntimeConfig } from "../lib/runtime/mode";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const wranglerConfig = path.join(repositoryRoot, "wrangler.local.jsonc");
const wranglerEntry = path.join(
  repositoryRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);
const viteEntry = path.join(
  repositoryRoot,
  "node_modules",
  "vite",
  "bin",
  "vite.js",
);

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: environment,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`子进程退出：${signal ?? code ?? "unknown"}`));
    });
  });
}

async function main() {
  const lanEnabled = process.argv.includes("--lan");
  const migrateOnly = process.argv.includes("--migrate-only");
  const requestedEnvironment = {
    ...process.env,
    MATRIX_COMPASS_MODE: "local",
    MATRIX_COMPASS_LAN: lanEnabled ? "true" : "false",
  };
  const runtime = resolveRuntimeConfig(requestedEnvironment, "development");
  const dataRoot = resolveDataDirectory(requestedEnvironment, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const paths = await prepareDataDirectories(dataRoot, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const environment = {
    ...requestedEnvironment,
    MATRIX_COMPASS_DATA_DIR: paths.root,
  };

  await run(
    process.execPath,
    [
      wranglerEntry,
      ...buildD1WranglerArgs("migrate", paths, wranglerConfig),
    ],
    environment,
  );

  if (migrateOnly) return;
  process.stdout.write(
    `Matrix Compass 本地模式：${runtime.host}:3000\n数据目录：${paths.root}\n`,
  );
  await run(
    process.execPath,
    [viteEntry, "--host", runtime.host, "--port", "3000"],
    environment,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Matrix Compass 启动失败：${message}\n`);
  process.exitCode = 1;
});
