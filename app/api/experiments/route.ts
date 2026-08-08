import { createExperimentRepository, type ExperimentRecord } from "../../../lib/repositories/experiments";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../health/route";
import { resolveRuntimeConfig } from "../../../lib/runtime/mode";
type RuntimeEnvironment = Record<string, string | undefined>;
function json(data: unknown, status = 200, requestId = `mc-${crypto.randomUUID()}`) { return Response.json({ data, meta: { requestId } }, { status, headers: { "cache-control": "no-store" } }); }
export async function createExperimentsResponse(request: Request, database: DatabaseClient | undefined, requestId: string) {
  if (!database) return json({ code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。" }, 503, requestId);
  try {
    const repo = createExperimentRepository(database);
    if (request.method === "GET") return json(await repo.list(), 200, requestId);
    const body = await request.json() as Partial<ExperimentRecord>;
    const timestamp = new Date().toISOString();
    const experiment: ExperimentRecord = { id: crypto.randomUUID(), name: String(body.name ?? "").trim(), goal: String(body.goal ?? "").trim(), hypothesis: String(body.hypothesis ?? "").trim(), variable: String(body.variable ?? "").trim(), control: body.control ?? null, primaryMetric: String(body.primaryMetric ?? "").trim(), guardrailMetric: body.guardrailMetric ?? null, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null, status: body.status ?? "draft", result: body.result ?? null, conclusion: body.conclusion ?? null, createdAt: timestamp, updatedAt: timestamp };
    if (!experiment.name || !experiment.goal || !experiment.hypothesis || !experiment.variable || !experiment.primaryMetric) return json({ code: "EXPERIMENT_REQUIRED", message: "请完整填写实验目标、假设、变量和指标。" }, 400, requestId);
    return json(await repo.insert(experiment), 201, requestId);
  } catch (error) { return json({ code: "EXPERIMENT_INVALID", message: error instanceof Error ? error.message : "实验数据无效。" }, 400, requestId); }
}
async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as RuntimeEnvironment & { DB?: DatabaseClient }; }
async function configured(request: Request) { const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env); const runtime = resolveRuntimeConfig(bindings, process.env.NODE_ENV); return createExperimentsResponse(request, runtime.mode === "demo" ? undefined : (bindings as RuntimeEnvironment & { DB?: DatabaseClient }).DB, `mc-${crypto.randomUUID()}`); }
export async function GET(request: Request, database?: DatabaseClient) { return database ? createExperimentsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
export async function POST(request: Request, database?: DatabaseClient) { return database ? createExperimentsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
