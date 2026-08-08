import { validateContentInput } from "../../../lib/domain/content";
import { createContentRepository, type ContentRecord } from "../../../lib/repositories/contents";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../health/route";
import { resolveRuntimeConfig } from "../../../lib/runtime/mode";

function now() { return new Date().toISOString(); }
function json(data: unknown, status = 200, requestId = `mc-${crypto.randomUUID()}`) { return Response.json({ data, meta: { requestId } }, { status, headers: { "cache-control": "no-store" } }); }

export async function createContentsResponse(request: Request, database: DatabaseClient | undefined, requestId: string) {
  if (!database) return json({ code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。", requestId }, 503, requestId);
  try {
    const repository = createContentRepository(database);
    if (request.method === "GET") return json(await repository.list({ stage: new URL(request.url).searchParams.get("stage") as ContentRecord["stage"] | undefined }), 200, requestId);
    const id = new URL(request.url).searchParams.get("id");
    if (request.method === "DELETE") { if (!id) return json({ code: "CONTENT_ID_REQUIRED", message: "Content id is required" }, 400, requestId); await repository.remove(id, new Date().toISOString()); return json({ id, deleted: true }, 200, requestId); }
    const body = await request.json() as Record<string, unknown>;
    const input = validateContentInput({ accountId: String(body.accountId ?? ""), title: String(body.title ?? ""), contentType: typeof body.contentType === "string" ? body.contentType : null, stage: typeof body.stage === "string" ? body.stage : undefined, plannedAt: typeof body.plannedAt === "string" ? body.plannedAt : null, publishedAt: typeof body.publishedAt === "string" ? body.publishedAt : null });
    if (request.method === "PATCH") { if (!id) return json({ code: "CONTENT_ID_REQUIRED", message: "Content id is required" }, 400, requestId); return json(await repository.update(id, input, new Date().toISOString()), 200, requestId); }
    const timestamp = now();
    const record: ContentRecord = { id: crypto.randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    return json(await repository.insert(record), 201, requestId);
  } catch (error) {
    return json({ code: "CONTENT_INVALID", message: error instanceof Error ? error.message : "内容数据无效。", requestId }, 400, requestId);
  }
}

export async function GET(request: Request, database?: DatabaseClient) { return database ? createContentsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
export async function POST(request: Request, database?: DatabaseClient) { return database ? createContentsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }

async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as Record<string, string | undefined> & { DB?: DatabaseClient }; }
async function configured(request: Request) {
  const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env);
  const runtime = resolveRuntimeConfig(bindings, process.env.NODE_ENV);
  return createContentsResponse(request, runtime.mode === "demo" ? undefined : (bindings as { DB?: DatabaseClient }).DB, `mc-${crypto.randomUUID()}`);
}
