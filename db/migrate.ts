export const MIGRATION_STATEMENT_BREAKPOINT =
  "-- matrix-compass-statement-breakpoint";

interface MigrationDatabase<TStatement> {
  prepare(query: string): TStatement;
  batch(statements: TStatement[]): Promise<unknown>;
}

interface VersionStatement {
  first<T>(): Promise<T | null>;
}

export function parseMigrationStatements(script: string) {
  return script
    .split(MIGRATION_STATEMENT_BREAKPOINT)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applyMigrationSql<TStatement>(
  database: MigrationDatabase<TStatement>,
  script: string,
) {
  const statements = parseMigrationStatements(script);
  if (statements.length === 0) {
    throw new Error("迁移文件不包含可执行语句。");
  }
  await database.batch(statements.map((statement) => database.prepare(statement)));
  return { appliedStatements: statements.length };
}

export async function applyVersionedMigrationSql<
  TStatement extends VersionStatement,
>(
  database: MigrationDatabase<TStatement>,
  script: string,
  targetVersion: number,
) {
  const metadata = await database
    .prepare("SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1")
    .first<{ schemaVersion: number }>();
  if (metadata && metadata.schemaVersion >= targetVersion) {
    return { appliedStatements: 0, skipped: true };
  }
  const result = await applyMigrationSql(database, script);
  return { ...result, skipped: false };
}
