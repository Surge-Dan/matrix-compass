import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { applyMigrationSql, applyVersionedMigrationSql } from "../../db/migrate";

export async function createTestDatabase() {
  const miniflare = new Miniflare({
    compatibilityDate: "2026-05-22",
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
    d1Databases: { DB: "matrix-compass-test" },
  });
  return {
    miniflare,
    database: await miniflare.getD1Database("DB"),
  };
}

export async function readMigration(name: string) {
  return readFile(new URL(`../../db/migrations/${name}`, import.meta.url), "utf8");
}

export async function migrateToV2(database: D1Database) {
  await applyMigrationSql(database, await readMigration("0001_initial.sql"));
  await applyVersionedMigrationSql(
    database,
    await readMigration("0002_real_data_core.sql"),
    2,
  );
}
