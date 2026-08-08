import { validateFinanceInput } from "../../../lib/domain/finance";
import { createFinanceRepository, type FinanceRecord } from "../../../lib/repositories/finance";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../health/route";
import { resolveRuntimeConfig } from "../../../lib/runtime/mode";

function now() { return new Date().toISOString(); }
function json(data: unknown, status = 200, requestId = `mc-${crypto.randomUUID()}`) { return Response.json({ data, meta: { requestId } }, { status, headers: { "cache-control": "no-store" } }); }

export async function createFinanceResponse(request: Request, database: DatabaseClient | undefined, requestId: string) {
  if (!database) return json({ code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。", requestId }, 503, requestId);
  try {
    const repository = createFinanceRepository(database);
    if (request.method === "GET") return json({ entries: await repository.list(), summary: await repository.summary() }, 200, requestId);
    const body = await request.json() as Record<string, unknown>;
    const input = validateFinanceInput({ ...body, amountMinor: Number(body.amountMinor), settledAmountMinor: body.settledAmountMinor === undefined ? 0 : Number(body.settledAmountMinor), accountId: String(body.accountId ?? ""), direction: String(body.direction ?? ""), category: String(body.category ?? ""), occurredAt: String(body.occurredAt ?? ""), settlementStatus: typeof body.settlementStatus === "string" ? body.settlementStatus : undefined });
    const timestamp = now();
    const record: FinanceRecord = { id: crypto.randomUUID(), ...input, createdAt: timestamp, updatedAt: timestamp };
    return json(await repository.insert(record), 201, requestId);
  } catch (error) {
    return json({ code: "FINANCE_INVALID", message: error instanceof Error ? error.message : "收入数据无效。", requestId }, 400, requestId);
  }
}

export async function GET(request: Request, database?: DatabaseClient) { return database ? createFinanceResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
export async function POST(request: Request, database?: DatabaseClient) { return database ? createFinanceResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }

async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as Record<string, string | undefined> & { DB?: DatabaseClient }; }
async function configured(request: Request) {
  const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env);
  const runtime = resolveRuntimeConfig(bindings, process.env.NODE_ENV);
  return createFinanceResponse(request, runtime.mode === "demo" ? undefined : (bindings as { DB?: DatabaseClient }).DB, `mc-${crypto.randomUUID()}`);
}
