import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/vitest/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/dashboard-data.ts",
        "lib/dashboard-format.ts",
        "app/api/dashboard/route.ts",
        "app/api/health/route.ts",
        "db/migrate.ts",
        "db/schema.ts",
        "lib/backup/manifest.ts",
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
