import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { accounts, contents, matrixCompassMeta } from "../../db/schema";
import {
  applyMigrationSql,
  MIGRATION_STATEMENT_BREAKPOINT,
  parseMigrationStatements,
} from "../../db/migrate";
import { probeDatabase } from "../../app/api/health/route";

const temporaryDirectories: string[] = [];

async function createPersistedDatabase(root: string) {
  const miniflare = new Miniflare({
    compatibilityDate: "2026-05-22",
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: { DB: "matrix-compass-local" },
    d1Persist: root,
  });
  return {
    miniflare,
    database: await miniflare.getD1Database("DB"),
  };
}

async function createStateDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "matrix-compass-d1-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("local D1 persistence", () => {
  it("exposes typed Drizzle tables for the foundational schema", () => {
    expect(matrixCompassMeta.id.name).toBe("id");
    expect(accounts.platform.name).toBe("platform");
    expect(contents.accountId.name).toBe("account_id");
    expect(getTableConfig(matrixCompassMeta).checks).toHaveLength(1);
    expect(getTableConfig(accounts).indexes).toHaveLength(2);
    expect(getTableConfig(accounts).checks).toHaveLength(2);
    expect(getTableConfig(contents).indexes).toHaveLength(3);
    expect(getTableConfig(contents).checks).toHaveLength(4);
    expect(contents.tags.name).toBe("tags");
    expect(contents.source.name).toBe("source");
    expect(getTableConfig(contents).foreignKeys[0].reference().foreignColumns).toEqual([
      accounts.id,
    ]);
  });

  it("rejects an empty migration script", async () => {
    expect(parseMigrationStatements("  ")).toEqual([]);
    const stateDirectory = await createStateDirectory();
    const { miniflare, database } = await createPersistedDatabase(stateDirectory);
    await expect(applyMigrationSql(database, "  ")).rejects.toThrow(
      "迁移文件不包含可执行语句。",
    );
    await miniflare.dispose();
  });

  it("rejects a missing database binding and malformed schema metadata", async () => {
    await expect(probeDatabase(undefined)).rejects.toThrow("DB is unavailable");
    const stateDirectory = await createStateDirectory();
    const { miniflare, database } = await createPersistedDatabase(stateDirectory);
    await database.exec(
      "CREATE TABLE matrix_compass_meta (id INTEGER PRIMARY KEY, schema_version REAL);",
    );
    await database
      .prepare("INSERT INTO matrix_compass_meta (id, schema_version) VALUES (1, 1.5)")
      .run();
    await expect(probeDatabase(database)).rejects.toThrow(
      "Database schema metadata is unavailable",
    );
    await miniflare.dispose();
  });

  it("applies the initial schema and survives a runtime restart", async () => {
    const stateDirectory = await createStateDirectory();
    const migration = await readFile(
      new URL("../../db/migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const first = await createPersistedDatabase(stateDirectory);

    await expect(applyMigrationSql(first.database, migration)).resolves.toEqual({
      appliedStatements: parseMigrationStatements(migration).length,
    });
    await first.database
      .prepare(
        "INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
      )
      .bind("account-1", "xiaohongshu", "蛋饺er", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z")
      .run();
    await first.miniflare.dispose();

    for (let restart = 1; restart <= 3; restart += 1) {
      const restarted = await createPersistedDatabase(stateDirectory);
      const account = await restarted.database
        .prepare("SELECT id, platform, name FROM accounts WHERE id = ?")
        .bind("account-1")
        .first();
      expect(account).toEqual({
        id: "account-1",
        platform: "xiaohongshu",
        name: "蛋饺er",
      });
      await expect(probeDatabase(restarted.database)).resolves.toEqual({
        schemaVersion: 1,
      });
      if (restart === 1) {
        await expect(
          applyMigrationSql(restarted.database, migration),
        ).resolves.toEqual({
          appliedStatements: parseMigrationStatements(migration).length,
        });
      }
      await restarted.miniflare.dispose();
    }
  }, 15_000);

  it("upgrades legacy metadata and preserves the last usable state after an interrupted migration", async () => {
    const stateDirectory = await createStateDirectory();
    const migration = await readFile(
      new URL("../../db/migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const { miniflare, database } = await createPersistedDatabase(stateDirectory);
    await database.exec(
      "CREATE TABLE matrix_compass_meta (id INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL, updated_at TEXT NOT NULL); INSERT INTO matrix_compass_meta VALUES (1, 0, '2026-07-29T00:00:00.000Z');",
    );
    await applyMigrationSql(database, migration);
    await database
      .prepare(
        "INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
      )
      .bind("account-stable", "wechat", "稳定账号", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z")
      .run();

    await expect(
      applyMigrationSql(
        database,
        `ALTER TABLE accounts ADD COLUMN interrupted_marker TEXT;\n${MIGRATION_STATEMENT_BREAKPOINT}\nINSERT INTO missing_table VALUES (1);`,
      ),
    ).rejects.toThrow();

    await expect(probeDatabase(database)).resolves.toEqual({ schemaVersion: 1 });
    const stableAccount = await database
      .prepare("SELECT COUNT(*) AS count FROM accounts WHERE id = ?")
      .bind("account-stable")
      .first<{ count: number }>();
    const columns = await database
      .prepare("PRAGMA table_info(accounts)")
      .all<{ name: string }>();
    expect(stableAccount?.count).toBe(1);
    expect(columns.results.map((column: { name: string }) => column.name)).not.toContain(
      "interrupted_marker",
    );
    await miniflare.dispose();
  });

  it("enforces foreign keys and rolls back a failed batch", async () => {
    const stateDirectory = await createStateDirectory();
    const migration = await readFile(
      new URL("../../db/migrations/0001_initial.sql", import.meta.url),
      "utf8",
    );
    const { miniflare, database } = await createPersistedDatabase(stateDirectory);
    await applyMigrationSql(database, migration);

    await expect(
      database.batch([
        database
          .prepare(
            "INSERT INTO accounts (id, platform, name, active, version, created_at, updated_at) VALUES (?, ?, ?, 1, 1, ?, ?)",
          )
          .bind("account-rollback", "wechat", "应回滚账号", "2026-07-30T00:00:00.000Z", "2026-07-30T00:00:00.000Z"),
        database
          .prepare(
            "INSERT INTO contents (id, title, account_id, content_type, stage, planned_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)",
          )
          .bind(
            "content-invalid",
            "外键失败",
            "missing-account",
            "学习",
            "idea",
            "2026-07-31T00:00:00.000Z",
            "2026-07-30T00:00:00.000Z",
            "2026-07-30T00:00:00.000Z",
          ),
      ]),
    ).rejects.toThrow();

    const rolledBack = await database
      .prepare("SELECT COUNT(*) AS count FROM accounts WHERE id = ?")
      .bind("account-rollback")
      .first<{ count: number }>();
    expect(rolledBack?.count).toBe(0);
    await miniflare.dispose();
  });
});
