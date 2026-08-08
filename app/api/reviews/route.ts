import { createReviewRepository, type ReviewRecord } from "../../../lib/repositories/reviews";
import type { DatabaseClient } from "../../../lib/repositories/database";
import { loadRuntimeEnvironment } from "../health/route";
import { resolveRuntimeConfig } from "../../../lib/runtime/mode";
type RuntimeEnvironment = Record<string, string | undefined>;
function json(data: unknown, status = 200, requestId = `mc-${crypto.randomUUID()}`) { return Response.json({ data, meta: { requestId } }, { status, headers: { "cache-control": "no-store" } }); }
export async function createReviewsResponse(request: Request, database: DatabaseClient | undefined, requestId: string) {
  if (!database) return json({ code: "DATABASE_UNAVAILABLE", message: "本地数据库不可用。" }, 503, requestId);
  try {
    const repo = createReviewRepository(database);
    if (request.method === "GET") return json(await repo.list(new URL(request.url).searchParams.get("status") as ReviewRecord["status"] | undefined), 200, requestId);
    const body = await request.json() as Partial<ReviewRecord>;
    const timestamp = new Date().toISOString();
    const review: ReviewRecord = { id: crypto.randomUUID(), contentId: body.contentId ?? null, accountId: body.accountId ?? null, title: String(body.title ?? "").trim(), highlight: body.highlight ?? null, problem: body.problem ?? null, hypothesis: body.hypothesis ?? null, nextAction: body.nextAction ?? null, evidence: body.evidence ?? null, status: body.status ?? "open", reviewedAt: body.reviewedAt ?? null, createdAt: timestamp, updatedAt: timestamp };
    if (!review.title) return json({ code: "REVIEW_TITLE_REQUIRED", message: "请填写复盘标题。" }, 400, requestId);
    return json(await repo.insert(review), 201, requestId);
  } catch (error) { return json({ code: "REVIEW_INVALID", message: error instanceof Error ? error.message : "复盘数据无效。" }, 400, requestId); }
}
async function loadWorkerBindings() { const { env } = await import("cloudflare:workers"); return env as unknown as RuntimeEnvironment & { DB?: DatabaseClient }; }
async function configured(request: Request) { const bindings = await loadRuntimeEnvironment(loadWorkerBindings, process.env); const runtime = resolveRuntimeConfig(bindings, process.env.NODE_ENV); return createReviewsResponse(request, runtime.mode === "demo" ? undefined : (bindings as RuntimeEnvironment & { DB?: DatabaseClient }).DB, `mc-${crypto.randomUUID()}`); }
export async function GET(request: Request, database?: DatabaseClient) { return database ? createReviewsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
export async function POST(request: Request, database?: DatabaseClient) { return database ? createReviewsResponse(request, database, `mc-${crypto.randomUUID()}`) : configured(request); }
