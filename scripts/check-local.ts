import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveDataDirectory,
  validateExistingDataPaths,
} from "../lib/runtime/data-dir";
import { LOCAL_D1_DATABASE_NAME } from "../lib/runtime/local-d1";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const wranglerEntry = path.join(
  repositoryRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

interface D1QueryResult {
  success: boolean;
  results: Array<Record<string, number>>;
}

function queryDatabase(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [wranglerEntry, ...args], {
      cwd: repositoryRoot,
      env: { ...process.env, MATRIX_COMPASS_MODE: "local" },
      stdio: ["ignore", "pipe", "inherit"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Wrangler exited: ${signal ?? code ?? "unknown"}`));
    });
  });
}

async function main() {
  const dataRoot = resolveDataDirectory(process.env, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const paths = await validateExistingDataPaths(dataRoot, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const output = await queryDatabase([
    "d1",
    "execute",
    LOCAL_D1_DATABASE_NAME,
    "--local",
    "--persist-to",
    paths.d1State,
    "--config",
    path.join(repositoryRoot, "wrangler.local.jsonc"),
    "--command",
    "SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1; PRAGMA foreign_key_check;",
    "--json",
  ]);
  const results = JSON.parse(output) as D1QueryResult[];
  const schemaVersion = results[0]?.results[0]?.schemaVersion;
  const foreignKeyViolations = results[1]?.results.length;
  if (
    results.length !== 2 ||
    results.some((result) => !result.success) ||
    !Number.isInteger(schemaVersion) ||
    foreignKeyViolations !== 0
  ) {
    throw new Error("Local D1 integrity check failed.");
  }
  process.stdout.write(
    `Local D1 check passed: schema v${schemaVersion}, foreign keys valid.\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Local D1 check failed: ${message}\n`);
  process.exitCode = 1;
});
