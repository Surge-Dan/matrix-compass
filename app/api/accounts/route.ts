import { validateAccountInput } from "../../../lib/domain/account";
import { createAccountRepository, type AccountRecord } from "../../../lib/repositories/accounts";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { resolveRuntimeConfig, type RuntimeConfig } from "../../../lib/runtime/mode";
import { loadRuntimeEnvironment } from "../health/route";

type RuntimeEnvironment = Record<string, string | undefined>;
async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as RuntimeEnvironment & { DB?: DatabaseClient }; }

function now() { return new Date().toISOString(); }
function json(data: unknown, status = 200, requestId = `mc-${crypto.randomUUID()}`) { return Response.json({ data, meta: { requestId } }, { status, headers: { "cache-control": "no-store" } }); }

export async function createAccountsResponse(request: Request, database: DatabaseClient | undefined, requestId: string) {
  if (!database) return json({ code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。", requestId }, 503, requestId);
  try {
    const repository = createAccountRepository(database);
    if (request.method === "GET") return json(await repository.list(), 200, requestId);
    const id = new URL(request.url).searchParams.get("id");
    if (request.method === "DELETE") { if (!id) return json({ code: "ACCOUNT_ID_REQUIRED", message: "Account id is required" }, 400, requestId); await repository.remove(id, now()); return json({ id, deleted: true }, 200, requestId); }
    const body = await request.json() as Record<string, unknown>;
    const input = validateAccountInput({ platform: String(body.platform ?? ""), name: String(body.name ?? ""), status: typeof body.status === "string" ? body.status : undefined });
    if (request.method === "PATCH") { if (!id) return json({ code: "ACCOUNT_ID_REQUIRED", message: "Account id is required" }, 400, requestId); return json(await repository.update(id, input, now()), 200, requestId); }
    const timestamp = now();
    const record: AccountRecord = { id: crypto.randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    return json(await repository.insert(record), 201, requestId);
  } catch (error) {
    return json({ code: "ACCOUNT_INVALID", message: error instanceof Error ? error.message : "账号数据无效。", requestId }, 400, requestId);
  }
}

export async function createConfiguredAccountsResponse(request: Request, loadBindings = loadWorkerBindings, nodeEnvironment = process.env.NODE_ENV, fallbackEnvironment: RuntimeEnvironment = process.env) {
  const bindings = await loadRuntimeEnvironment(loadBindings, fallbackEnvironment);
  const runtime: RuntimeConfig = resolveRuntimeConfig(bindings, nodeEnvironment);
  if (runtime.mode === "demo") return json([], 200);
  return createAccountsResponse(request, (bindings as RuntimeEnvironment & { DB?: DatabaseClient }).DB, `mc-${crypto.randomUUID()}`);
}

export async function GET(request: Request, database?: DatabaseClient) { return database ? createAccountsResponse(request, database, `mc-${crypto.randomUUID()}`) : createConfiguredAccountsResponse(request); }
export async function POST(request: Request, database?: DatabaseClient) { return database ? createAccountsResponse(request, database, `mc-${crypto.randomUUID()}`) : createConfiguredAccountsResponse(request); }
