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
