import {
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "../../../lib/runtime/mode";
import { MATRIX_COMPASS_VERSION } from "../../../lib/runtime/version";

interface DatabaseProbeResult {
  schemaVersion: number;
}

type DatabaseProbe = () => Promise<DatabaseProbeResult>;
type RuntimeEnvironment = Record<string, string | undefined>;
type RuntimeEnvironmentLoader = () => Promise<RuntimeEnvironment>;

export async function probeDatabase(
  database: D1Database | undefined,
): Promise<DatabaseProbeResult> {
  if (!database) throw new Error("D1 binding DB is unavailable");
  const row = await database
    .prepare("SELECT schema_version AS schemaVersion FROM matrix_compass_meta WHERE id = 1")
    .first<{ schemaVersion: number }>();
  if (!row || !Number.isInteger(row.schemaVersion)) {
    throw new Error("Database schema metadata is unavailable");
  }
  return row;
}

/* v8 ignore next 5 -- cloudflare:workers only resolves inside workerd */
async function probeLocalDatabase(): Promise<DatabaseProbeResult> {
  const { env } = await import("cloudflare:workers");
  const database = (env as unknown as { DB: D1Database }).DB;
  return probeDatabase(database);
}

/* v8 ignore next 4 -- cloudflare:workers only resolves inside workerd */
async function loadWorkerRuntimeEnvironment(): Promise<RuntimeEnvironment> {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnvironment;
}

export async function loadRuntimeEnvironment(
  loadWorkerEnvironment: RuntimeEnvironmentLoader,
  fallbackEnvironment: RuntimeEnvironment,
): Promise<RuntimeEnvironment> {
  try {
    return await loadWorkerEnvironment();
  } catch (error) {
    if (
      Reflect.get(Object(error), "code") === "ERR_UNSUPPORTED_ESM_URL_SCHEME"
    ) {
      return fallbackEnvironment;
    }
    throw error;
  }
}

export async function createHealthResponse(
  runtime: RuntimeConfig,
  probe: DatabaseProbe = probeLocalDatabase,
) {
  const base = {
    app: "matrix-compass",
    version: MATRIX_COMPASS_VERSION,
    mode: runtime.mode,
    dataSource: runtime.dataSource,
  } as const;

  if (runtime.mode === "demo") {
    return Response.json(
      { ...base, status: "ok", schemaVersion: 0, readOnly: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const result = await probe();
    return Response.json(
      {
        ...base,
        status: "ok",
        schemaVersion: result.schemaVersion,
        readOnly: runtime.readOnly,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        ...base,
        status: "error",
        schemaVersion: null,
        readOnly: true,
        error: { code: "DATABASE_UNAVAILABLE" },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function createConfiguredHealthResponse(
  loadEnvironment: RuntimeEnvironmentLoader,
  nodeEnvironment: string | undefined,
  probe: DatabaseProbe = probeLocalDatabase,
) {
  const environment = await loadRuntimeEnvironment(loadEnvironment, process.env);
  const runtime = resolveRuntimeConfig(environment, nodeEnvironment);
  return createHealthResponse(runtime, probe);
}

/* v8 ignore next 3 -- route entrypoint reads bindings from workerd */
export async function GET() {
  return createConfiguredHealthResponse(
    loadWorkerRuntimeEnvironment,
    process.env.NODE_ENV,
  );
}
