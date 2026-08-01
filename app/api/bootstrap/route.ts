import {
  getBootstrapData,
  type DemoBootstrapProvider,
} from "../../../lib/application/get-bootstrap";
import type { DatabaseClient } from "../../../lib/repositories/database";
import {
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "../../../lib/runtime/mode";
import { loadRuntimeEnvironment } from "../health/route";

type RuntimeEnvironment = Record<string, string | undefined>;

/* v8 ignore next 6 -- cloudflare:workers only resolves inside workerd */
async function loadWorkerBindings() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnvironment & { DB?: DatabaseClient };
}

export async function createBootstrapResponse(
  runtime: RuntimeConfig,
  requestId: string,
  database?: DatabaseClient,
  demoProvider?: DemoBootstrapProvider,
) {
  try {
    const data = await getBootstrapData({ runtime, database, demoProvider });
    return Response.json(
      { data, meta: { requestId } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error: {
          code: "BOOTSTRAP_UNAVAILABLE",
          message: "经营数据暂时无法加载，请稍后重试。",
          requestId,
        },
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function createConfiguredBootstrapResponse(
  loadBindings: typeof loadWorkerBindings,
  nodeEnvironment: string | undefined,
  requestId: string,
  fallbackEnvironment: RuntimeEnvironment = process.env,
) {
  const bindings = await loadRuntimeEnvironment(loadBindings, fallbackEnvironment);
  const runtime = resolveRuntimeConfig(bindings, nodeEnvironment);
  return createBootstrapResponse(
    runtime,
    requestId,
    (bindings as RuntimeEnvironment & { DB?: DatabaseClient }).DB,
  );
}

/* v8 ignore next 5 -- route entrypoint reads bindings from workerd */
export async function GET() {
  return createConfiguredBootstrapResponse(
    loadWorkerBindings,
    process.env.NODE_ENV,
    `mc-${crypto.randomUUID()}`,
  );
}
