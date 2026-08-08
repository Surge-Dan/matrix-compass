import { describe, expect, it } from "vitest";
import { applyMigrationSql, applyVersionedMigrationSql } from "../../db/migrate";
import { createTestDatabase, readMigration } from "../helpers/d1";

describe("schema v3 migration", () => {
  it("creates finance, review, experiment and import tables without changing v2 rows", async () => {
    const { miniflare, database } = await createTestDatabase();
    await applyMigrationSql(database, await readMigration("0001_initial.sql"));
    await applyVersionedMigrationSql(database, await readMigration("0002_real_data_core.sql"), 2);
    await applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3);
    await expect(database.prepare("SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1").first()).resolves.toEqual({ schemaVersion: 3 });
    for (const table of ["finance_entries", "reviews", "experiments", "import_batches"]) {
      await expect(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first()).resolves.toEqual({ count: 0 });
    }
    await expect(applyVersionedMigrationSql(database, await readMigration("0003_operations_modules.sql"), 3)).resolves.toEqual({ appliedStatements: 0, skipped: true });
    await miniflare.dispose();
  });
});
