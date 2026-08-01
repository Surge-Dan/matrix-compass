import {
  DashboardRangeError,
  getDashboardData,
  parseDashboardRange,
} from "../../../lib/dashboard-data.ts";
import { createAccountRepository } from "../../../lib/repositories/accounts";
import { createContentRepository } from "../../../lib/repositories/contents";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { resolveRuntimeConfig, type RuntimeConfig } from "../../../lib/runtime/mode";
import { loadRuntimeEnvironment } from "../health/route";

type RuntimeEnvironment = Record<string, string | undefined>;

/* v8 ignore next 6 -- cloudflare:workers only resolves inside workerd */
// Stryker disable all: cloudflare:workers cannot resolve in the Node test runner
async function loadWorkerBindings() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as RuntimeEnvironment & { DB?: DatabaseClient };
}
// Stryker restore all

/* v8 ignore next -- route entrypoint request correlation */
// Stryker disable all: nondeterministic correlation is asserted through injected request ids
function createRequestId() {
  return `mc-${crypto.randomUUID()}`;
}
// Stryker restore all

export async function createDashboardResponse(
  request: Request,
  requestId: string,
  dataProvider: typeof getDashboardData = getDashboardData,
) {
  try {
    const range = parseDashboardRange(new URL(request.url).searchParams.get("range"));
    return Response.json(dataProvider(range, requestId), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DashboardRangeError) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
            requestId,
          },
        },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      {
        error: {
          code: "DASHBOARD_UNAVAILABLE",
          message: "仪表盘暂时无法加载，请稍后重试。",
          requestId,
        },
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function createRuntimeDashboardResponse(
  request: Request,
  runtime: RuntimeConfig,
  requestId: string,
  database?: DatabaseClient,
) {
  if (runtime.mode === "demo") {
    return createDashboardResponse(request, requestId);
  }
  try {
    const range = parseDashboardRange(new URL(request.url).searchParams.get("range"));
    // Stryker disable all: either branch deliberately converges on the same fail-closed 503 contract
    if (!database) throw new Error("Local database binding is unavailable");
    // Stryker restore all
    const [accounts, contents] = await Promise.all([
      createAccountRepository(database).count(),
      createContentRepository(database).count(),
    ]);
    return Response.json({
      meta: { range, updatedAt: null, source: "local-d1", requestId, accountCount: accounts },
      counts: { accounts, contents },
      summary: [],
      trend: [],
      platforms: [],
      works: [],
      alerts: [],
      unavailable: ["followers", "growth", "reach", "engagement", "revenue"],
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof DashboardRangeError) {
      return Response.json({ error: { code: error.code, message: error.message, requestId } }, {
        status: 400,
        headers: { "cache-control": "no-store" },
      });
    }
    return Response.json({
      error: { code: "DASHBOARD_UNAVAILABLE", message: "仪表盘暂时无法加载，请稍后重试。", requestId },
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function createConfiguredDashboardResponse(
  request: Request,
  loadBindings: typeof loadWorkerBindings,
  nodeEnvironment: string | undefined,
  requestId: string,
  fallbackEnvironment: RuntimeEnvironment = process.env,
) {
  const bindings = await loadRuntimeEnvironment(loadBindings, fallbackEnvironment);
  const runtime = resolveRuntimeConfig(bindings, nodeEnvironment);
  return createRuntimeDashboardResponse(
    request,
    runtime,
    requestId,
    (bindings as RuntimeEnvironment & { DB?: DatabaseClient }).DB,
  );
}

/* v8 ignore next 5 -- route entrypoint reads bindings from workerd */
// Stryker disable all: framework entrypoint delegates to the fully tested configured response
export async function GET(request: Request) {
  return createConfiguredDashboardResponse(
    request,
    loadWorkerBindings,
    process.env.NODE_ENV,
    createRequestId(),
  );
}
// Stryker restore all
