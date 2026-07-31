import type { DataPaths } from "./data-dir.ts";

export const LOCAL_D1_BINDING = "DB";
export const LOCAL_D1_DATABASE_NAME = "matrix-compass-local";
export const LOCAL_D1_DATABASE_ID = "00000000-0000-4000-8000-000000000000";

export function createLocalD1PluginOptions(paths: DataPaths) {
  return {
    persistState: { path: paths.d1State },
    database: {
      binding: LOCAL_D1_BINDING,
      database_name: LOCAL_D1_DATABASE_NAME,
      database_id: LOCAL_D1_DATABASE_ID,
    },
  } as const;
}

export function createRuntimeWranglerConfig() {
  return {
    name: LOCAL_D1_DATABASE_NAME,
    compatibility_date: "2026-05-22",
    compatibility_flags: ["nodejs_compat"],
    d1_databases: [
      {
        binding: LOCAL_D1_BINDING,
        database_name: LOCAL_D1_DATABASE_NAME,
        database_id: LOCAL_D1_DATABASE_ID,
      },
    ],
  };
}

export function buildD1WranglerArgs(
  operation: "migrate" | "export",
  paths: DataPaths,
  configPath: string,
  outputPath?: string,
) {
  const operationArgs =
    operation === "migrate"
      ? ["migrations", "apply"]
      : ["export"];
  const args = [
    "d1",
    ...operationArgs,
    LOCAL_D1_DATABASE_NAME,
    "--local",
    "--config",
    configPath,
  ];

  if (operation === "migrate") {
    args.splice(5, 0, "--persist-to", paths.d1State);
  } else {
    if (!outputPath) throw new Error("D1 导出必须指定输出文件。");
    args.push("--skip-confirmation", "--output", outputPath);
  }

  return args;
}
