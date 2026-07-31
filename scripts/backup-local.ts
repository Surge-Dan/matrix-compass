import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  createBackupManifest,
  verifyBackupManifest,
} from "../lib/backup/manifest";
import {
  buildDataPaths,
  prepareDataDirectories,
  resolveDataDirectory,
} from "../lib/runtime/data-dir";
import {
  buildD1WranglerArgs,
  createRuntimeWranglerConfig,
  LOCAL_D1_DATABASE_NAME,
} from "../lib/runtime/local-d1";
import { MATRIX_COMPASS_VERSION } from "../lib/runtime/version";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const wranglerConfig = path.join(repositoryRoot, "wrangler.local.jsonc");
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

interface D1QueryResult {
  success: boolean;
  results: Array<Record<string, number>>;
}

async function main() {
  const dataRoot = resolveDataDirectory(process.env, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const paths = await prepareDataDirectories(dataRoot, {
    localAppData: process.env.LOCALAPPDATA,
    repoRoot: repositoryRoot,
    userHome: homedir(),
  });
  const createdAt = new Date().toISOString();
  const backupName = createdAt.replace(/[:.]/g, "-");
  const backupDirectory = path.join(paths.backups, backupName);
  const stagingDirectory = path.join(
    paths.backups,
    `.${backupName}.in-progress-${process.pid}`,
  );
  const sqlPath = path.join(stagingDirectory, "snapshot.sql");
  const runtimeWranglerConfig = path.join(
    paths.root,
    `.matrix-compass-wrangler-${process.pid}-${randomUUID()}.jsonc`,
  );
  await mkdir(stagingDirectory, { recursive: false });
  let temporaryRoot: string | undefined;
  try {
    await writeFile(
      runtimeWranglerConfig,
      `${JSON.stringify(createRuntimeWranglerConfig(), null, 2)}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await runWrangler(
      buildD1WranglerArgs("export", paths, runtimeWranglerConfig, sqlPath),
    );
    temporaryRoot = await mkdtemp(
      path.join(paths.imports, "backup-verify-"),
    );
    const temporaryPaths = buildDataPaths(temporaryRoot);
    await prepareDataDirectories(temporaryRoot, {
      localAppData: process.env.LOCALAPPDATA,
      repoRoot: repositoryRoot,
      userHome: homedir(),
    });
    await runWrangler([
      "d1",
      "execute",
      LOCAL_D1_DATABASE_NAME,
      "--local",
      "--persist-to",
      temporaryPaths.d1State,
      "--config",
      wranglerConfig,
      "--file",
      sqlPath,
      "--yes",
    ]);
    const queryOutput = await runWrangler(
      [
        "d1",
        "execute",
        LOCAL_D1_DATABASE_NAME,
        "--local",
        "--persist-to",
        temporaryPaths.d1State,
        "--config",
        wranglerConfig,
        "--command",
        "SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1; SELECT COUNT(*) AS accountCount FROM accounts; SELECT COUNT(*) AS contentCount FROM contents; PRAGMA foreign_key_check;",
        "--json",
      ],
      true,
    );
    const queryResults = JSON.parse(queryOutput) as D1QueryResult[];
    if (
      queryResults.length !== 4 ||
      queryResults.some((result) => !result.success) ||
      queryResults.slice(0, 3).some((result) => result.results.length !== 1) ||
      queryResults[3].results.length !== 0
    ) {
      throw new Error("备份隔离恢复校验失败。");
    }

    const sqlSnapshot = await readFile(sqlPath, "utf8");
    const manifest = await createBackupManifest(sqlSnapshot, {
      appVersion: MATRIX_COMPASS_VERSION,
      schemaVersion: queryResults[0].results[0].schemaVersion,
      createdAt,
      recordCounts: {
        accounts: queryResults[1].results[0].accountCount,
        contents: queryResults[2].results[0].contentCount,
      },
    });
    await verifyBackupManifest(sqlSnapshot, manifest);
    await writeFile(
      path.join(stagingDirectory, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    await rename(stagingDirectory, backupDirectory);
    process.stdout.write(`备份已创建、隔离恢复并校验：${backupDirectory}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeFile(
      path.join(stagingDirectory, "failure.json"),
      `${JSON.stringify({ status: "failed", createdAt, message }, null, 2)}\n`,
      "utf8",
    ).catch(() => undefined);
    throw error;
  } finally {
    await unlink(runtimeWranglerConfig).catch(() => undefined);
    if (temporaryRoot) {
      const relative = path.relative(paths.imports, temporaryRoot);
      if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`备份失败：${message}\n`);
  process.exitCode = 1;
});
