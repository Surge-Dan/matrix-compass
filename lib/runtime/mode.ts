export type RuntimeMode = "local" | "demo";

export interface RuntimeConfig {
  mode: RuntimeMode;
  dataSource: "local-d1" | "demo";
  host: "127.0.0.1" | "0.0.0.0";
  lanEnabled: boolean;
  readOnly: boolean;
}

export class RuntimeModeError extends Error {
  readonly code = "INVALID_RUNTIME_MODE";

  constructor(message: string) {
    super(message);
    this.name = "RuntimeModeError";
  }
}

export function forceDemoRuntimeEnvironment<T extends Record<string, string | undefined>>(
  environment: T,
) {
  return {
    ...environment,
    MATRIX_COMPASS_MODE: "demo" as const,
    MATRIX_COMPASS_LAN: "false" as const,
  };
}

export function resolveRuntimeConfig(
  environment: Record<string, string | undefined>,
  nodeEnvironment: string | undefined,
): RuntimeConfig {
  const configuredMode = environment.MATRIX_COMPASS_MODE?.trim().toLowerCase();
  if (configuredMode && configuredMode !== "local" && configuredMode !== "demo") {
    throw new RuntimeModeError("MATRIX_COMPASS_MODE 仅支持 local 或 demo。");
  }

  const mode: RuntimeMode =
    configuredMode === "local" || configuredMode === "demo"
      ? configuredMode
      : nodeEnvironment === "development"
        ? "local"
        : "demo";
  const lanEnabled = environment.MATRIX_COMPASS_LAN?.trim().toLowerCase() === "true";

  if (mode === "demo" && lanEnabled) {
    throw new RuntimeModeError("演示模式不能开启局域网访问。");
  }

  return {
    mode,
    dataSource: mode === "local" ? "local-d1" : "demo",
    host: lanEnabled ? "0.0.0.0" : "127.0.0.1",
    lanEnabled,
    readOnly: mode === "demo",
  };
}
