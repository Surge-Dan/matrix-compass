import { execFile } from "node:child_process";
import {
  appendFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type { BackupManifest } from "../../lib/backup/manifest";

const executeFile = promisify(execFile);
const repositoryRoot = path.resolve(".");

async function runNode(
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
) {
  return executeFile(process.execPath, arguments_, {
    cwd: repositoryRoot,
    env: environment,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
}

describe("local operations CLI", () => {
  it(
    "migrates, backs up, restores in isolation, and rejects a damaged snapshot",
    async () => {
      const temporaryRoot = await mkdtemp(
        path.join(os.tmpdir(), "matrix-compass-operations-"),
      );
      const dataRoot = path.join(temporaryRoot, "data");
      const paths = {
        d1State: path.join(dataRoot, ".wrangler", "state"),
        backups: path.join(dataRoot, "backups"),
      };
      const environment = {
        ...process.env,
        MATRIX_COMPASS_DATA_DIR: dataRoot,
        MATRIX_COMPASS_MODE: "local",
        MATRIX_COMPASS_LAN: "false",
        WRANGLER_WRITE_LOGS: "false",
      };

      try {
        await runNode(
          ["--import", "tsx", "scripts/local-runtime.ts", "--migrate-only"],
          environment,
        );
        await expect(
          runNode(["--import", "tsx", "scripts/check-local.ts"], environment),
        ).resolves.toMatchObject({ stdout: expect.stringContaining("schema v1") });
        await runNode(
          [
            "node_modules/wrangler/bin/wrangler.js",
            "d1",
            "execute",
            "matrix-compass-local",
            "--local",
            "--persist-to",
            paths.d1State,
            "--config",
            "wrangler.local.jsonc",
            "--command",
            "INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES ('cli-account', 'wechat', 'CLI account', 1, 1, '2026-07-30T00:00:00.000Z', '2026-07-30T00:00:00.000Z');",
            "--yes",
          ],
          environment,
        );
        await runNode(
          ["--import", "tsx", "scripts/backup-local.ts"],
          environment,
        );

        const backupNames = (await readdir(paths.backups)).filter(
          (name) => !name.startsWith("."),
        );
        expect(backupNames).toHaveLength(1);
        const backupDirectory = path.join(paths.backups, backupNames[0]);
        const manifest = JSON.parse(
          await readFile(path.join(backupDirectory, "manifest.json"), "utf8"),
        ) as BackupManifest;
        expect(manifest.recordCounts).toEqual({ accounts: 1, contents: 0 });
        expect(
          (await readdir(dataRoot)).some((name) =>
            name.startsWith(".matrix-compass-wrangler-"),
          ),
        ).toBe(false);

        const restore = await runNode(
          [
            "--import",
            "tsx",
            "scripts/restore-local.ts",
            "--dry-run",
            "--backup",
            backupDirectory,
          ],
          environment,
        );
        expect(restore.stdout).toContain("accounts=1");

        await appendFile(
          path.join(backupDirectory, "snapshot.sql"),
          "\n-- damaged after verification\n",
          "utf8",
        );
        await expect(
          runNode(
            [
              "--import",
              "tsx",
              "scripts/restore-local.ts",
              "--dry-run",
              "--backup",
              backupDirectory,
            ],
            environment,
          ),
        ).rejects.toMatchObject({ code: 1 });
      } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    },
    120_000,
  );
});
