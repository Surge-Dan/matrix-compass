import { rollbackImport } from "../../../../lib/imports/service";
import type { DatabaseClient } from "../../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../../health/route";

export async function createImportRollbackResponse(request: Request, database?: DatabaseClient) {
  const requestId = `mc-${crypto.randomUUID()}`;
  if (!database) return Response.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Local database unavailable", requestId } }, { status: 503 });
  try {
    const body = await request.json() as { batchId?: string };
    if (!body.batchId?.trim()) return Response.json({ error: { code: "IMPORT_BATCH_REQUIRED", message: "batchId is required", requestId } }, { status: 400 });
    return Response.json({ data: await rollbackImport(database, body.batchId), meta: { requestId } }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: { code: "IMPORT_ROLLBACK_FAILED", message: error instanceof Error ? error.message : "Rollback failed", requestId } }, { status: 400 });
  }
}

export async function POST(request: Request, database?: DatabaseClient) {
  return database ? createImportRollbackResponse(request, database) : configured(request);
}

async function loadWorkerBindings() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as Record<string, string | undefined> & { DB?: DatabaseClient };
}

async function configured(request: Request) {
  const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env);
  return createImportRollbackResponse(request, (bindings as { DB?: DatabaseClient }).DB);
}
