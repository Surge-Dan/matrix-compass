import { spawn } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import {
  type BackupManifest,
  verifyBackupManifest,
} from "../lib/backup/manifest";
import {
  buildDataPaths,
  prepareDataDirectories,
  resolveDataDirectory,
} from "../lib/runtime/data-dir";
import { LOCAL_D1_DATABASE_NAME } from "../lib/runtime/local-d1";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const sourceWranglerConfig = path.join(repositoryRoot, "wrangler.local.jsonc");
const wranglerEntry = path.join(
  repositoryRoot,
  "node_modules",
  "wrangler",
  "bin",
  "wrangler.js",
);

function runWrangler(args: string[], captureOutput = false) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [wranglerEntry, ...args], {
      cwd: repositoryRoot,
      env: { ...process.env, MATRIX_COMPASS_MODE: "local" },
      stdio: captureOutput ? ["ignore", "pipe", "inherit"] : "inherit",
      windowsHide: true,
    });
    let output = "";
    if (captureOutput && child.stdout) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        output += chunk;
      });
    }
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Wrangler 退出：${signal ?? code ?? "unknown"}`));
    });
  });
}

function readBackupArgument() {
  const index = process.argv.indexOf("--backup");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || !path.isAbsolute(value)) {
    throw new Error("请使用 --backup 指定备份目录的绝对路径。");
  }
  return path.resolve(value);
}

interface D1QueryResult {
  success: boolean;
  results: Array<Record<string, number>>;
}

async function main() {
  if (!process.argv.includes("--dry-run")) {
    throw new Error("里程碑 0 仅开放 --dry-run，禁止直接覆盖当前数据库。");
  }
  const backupDirectory = readBackupArgument();
  const sqlPath = path.join(backupDirectory, "snapshot.sql");
  const manifestPath = path.join(backupDirectory, "manifest.json");
  const [sqlSnapshot, manifestText] = await Promise.all([
    readFile(sqlPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as BackupManifest;
  await verifyBackupManifest(sqlSnapshot, manifest);

  const dataRoot = resolveDataDirectory(process.env, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const dataPaths = await prepareDataDirectories(dataRoot, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const temporaryRoot = await mkdtemp(
    path.join(dataPaths.imports, "restore-dry-run-"),
  );
  const temporaryPaths = buildDataPaths(temporaryRoot);
  await prepareDataDirectories(temporaryRoot, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  try {
    await runWrangler([
      "d1",
      "execute",
      LOCAL_D1_DATABASE_NAME,
      "--local",
      "--persist-to",
      temporaryPaths.d1State,
      "--config",
      sourceWranglerConfig,
      "--file",
      sqlPath,
      "--yes",
    ]);
    const output = await runWrangler(
      [
        "d1",
        "execute",
        LOCAL_D1_DATABASE_NAME,
        "--local",
        "--persist-to",
        temporaryPaths.d1State,
        "--config",
        sourceWranglerConfig,
        "--command",
        "SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1; SELECT COUNT(*) AS accountCount FROM accounts; SELECT COUNT(*) AS contentCount FROM contents; PRAGMA foreign_key_check;",
        "--json",
      ],
      true,
    );
    const results = JSON.parse(output) as D1QueryResult[];
    const actual = {
      schemaVersion: results[0]?.results[0]?.schemaVersion,
      accounts: results[1]?.results[0]?.accountCount,
      contents: results[2]?.results[0]?.contentCount,
      foreignKeyViolations: results[3]?.results.length,
    };
    if (
      results.length !== 4 ||
      results.some((result) => !result.success) ||
      actual.schemaVersion !== manifest.schemaVersion ||
      actual.accounts !== manifest.recordCounts.accounts ||
      actual.contents !== manifest.recordCounts.contents ||
      actual.foreignKeyViolations !== 0
    ) {
      throw new Error(`恢复预演数据不一致：${JSON.stringify(actual)}`);
    }
    process.stdout.write(
      `恢复预演通过：schema v${actual.schemaVersion}，accounts=${actual.accounts}，contents=${actual.contents}\n`,
    );
  } finally {
    const relative = path.relative(dataPaths.imports, temporaryRoot);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`恢复预演失败：${message}\n`);
  process.exitCode = 1;
});
