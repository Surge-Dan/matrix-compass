import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/vitest/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: [
        "lib/dashboard-data.ts",
        "lib/dashboard-format.ts",
        "app/api/bootstrap/route.ts",
        "app/api/health/route.ts",
        "db/migrate.ts",
        "lib/backup/manifest.ts",
        "lib/application/get-bootstrap.ts",
        "lib/domain/account.ts",
        "lib/domain/content.ts",
        "lib/domain/errors.ts",
        "lib/repositories/accounts.ts",
        "lib/repositories/contents.ts",
        "lib/repositories/database.ts",
        "lib/runtime/data-dir.ts",
        "lib/runtime/local-d1.ts",
        "lib/runtime/mode.ts",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
