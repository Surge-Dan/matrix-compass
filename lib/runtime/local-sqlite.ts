import { DatabaseSync } from "node:sqlite";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function findFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await findFiles(candidate)));
    else if (entry.isFile() && entry.name.endsWith(".sqlite")) files.push(candidate);
  }
  return files;
}

export async function findLocalDatabaseFile(stateRoot: string) {
  const candidates = (await findFiles(stateRoot)).filter(
    (candidate) => path.basename(candidate) !== "metadata.sqlite",
  );
  for (const candidate of candidates) {
    try {
      const database = new DatabaseSync(candidate, { readOnly: true });
      const row = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'matrix_compass_meta'",
        )
        .get();
      database.close();
      if (row) return candidate;
    } catch {
      // Ignore transient or unrelated SQLite files in Wrangler's state tree.
    }
  }
  return undefined;
}

export async function readLocalSchemaVersion(stateRoot: string) {
  const file = await findLocalDatabaseFile(stateRoot);
  if (!file) return null;
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const row = database
      .prepare(
        "SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1",
      )
      .get() as { schemaVersion?: number } | undefined;
    return Number.isInteger(row?.schemaVersion) ? row!.schemaVersion! : null;
  } finally {
    database.close();
  }
}

function sqlValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "1" : "0";
  if (value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function dumpLocalDatabase(stateRoot: string) {
  const file = await findLocalDatabaseFile(stateRoot);
  if (!file) throw new Error("本地数据库尚未初始化，无法创建备份。");
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const objects = database
      .prepare(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END, name",
      )
      .all() as Array<{ type: string; name: string; sql: string }>;
    const tables = objects.filter(
      (object) =>
        object.type === "table" &&
        object.name !== "d1_migrations" &&
        object.name !== "_cf_METADATA",
    );
    const indexes = objects.filter(
      (object) =>
        object.type !== "table" &&
        !object.sql.includes("d1_migrations") &&
        !object.sql.includes("_cf_METADATA"),
    );
    const chunks = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];
    for (const table of tables) {
      chunks.push(`${table.sql};`);
      const rows = database
        .prepare(`SELECT * FROM "${table.name.replaceAll('"', '""')}"`)
        .all() as Array<Record<string, unknown>>;
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]).map((column) => `"${column.replaceAll('"', '""')}"`);
      for (const row of rows) {
        chunks.push(
          `INSERT INTO "${table.name.replaceAll('"', '""')}" (${columns.join(", ")}) VALUES (${columns.map((column) => sqlValue(row[column.slice(1, -1).replaceAll('""', '"')])).join(", ")});`,
        );
      }
    }
    chunks.push(...indexes.map((object) => `${object.sql};`));
    chunks.push("COMMIT;", "PRAGMA foreign_keys=ON;", "");
    return chunks.join("\n");
  } finally {
    database.close();
  }
}

export async function executeLocalSqlFile(args: {
  repositoryRoot: string;
  wranglerEntry: string;
  configPath: string;
  stateRoot: string;
  filePath: string;
  environment: NodeJS.ProcessEnv;
}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      args.wranglerEntry,
      "d1",
      "execute",
      "matrix-compass-local",
      "--local",
      "--persist-to",
      args.stateRoot,
      "--config",
      args.configPath,
      "--file",
      args.filePath,
      "--yes",
      "--json",
    ],
    {
      cwd: args.repositoryRoot,
      env: { ...args.environment, WRANGLER_SEND_METRICS: "false" },
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as Array<{ success: boolean }>;
}

export async function applyLocalMigrations(args: {
  repositoryRoot: string;
  wranglerEntry: string;
  configPath: string;
  stateRoot: string;
  migrationsDirectory: string;
  environment: NodeJS.ProcessEnv;
}) {
  const migrationNames = (await readdir(args.migrationsDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  let current = await readLocalSchemaVersion(args.stateRoot);
  for (const name of migrationNames) {
    const version = Number(name.slice(0, 4));
    if (current !== null && version <= current) continue;
    const results = await executeLocalSqlFile({
      repositoryRoot: args.repositoryRoot,
      wranglerEntry: args.wranglerEntry,
      configPath: args.configPath,
      stateRoot: args.stateRoot,
      filePath: path.join(args.migrationsDirectory, name),
      environment: args.environment,
    });
    if (results.some((result) => !result.success)) {
      throw new Error(`迁移 ${name} 执行失败。`);
    }
    current = await readLocalSchemaVersion(args.stateRoot);
  }
  return current;
}
