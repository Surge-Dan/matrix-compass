export const MIGRATION_STATEMENT_BREAKPOINT =
  "-- matrix-compass-statement-breakpoint";

interface MigrationDatabase<TStatement> {
  prepare(query: string): TStatement;
  batch(statements: TStatement[]): Promise<unknown>;
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
