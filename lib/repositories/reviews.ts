import type { DatabaseClient } from "./database";

export interface ReviewRecord { id: string; contentId: string | null; accountId: string | null; title: string; highlight: string | null; problem: string | null; hypothesis: string | null; nextAction: string | null; evidence: string | null; status: "open" | "in-progress" | "done" | "archived"; reviewedAt: string | null; createdAt: string; updatedAt: string; }
export function createReviewRepository(database: DatabaseClient) {
  return {
    async insert(review: ReviewRecord) {
      if (!review.contentId && !review.accountId) throw new Error("Review target is required");
      await database.prepare("INSERT INTO reviews (id, content_id, account_id, title, highlight, problem, hypothesis, next_action, evidence, status, reviewed_at, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)").bind(review.id, review.contentId, review.accountId, review.title, review.highlight, review.problem, review.hypothesis, review.nextAction, review.evidence, review.status, review.reviewedAt, review.createdAt, review.updatedAt).run();
      return review;
    },
    async list(status?: ReviewRecord["status"]) {
      const suffix = status ? " AND status = ?" : "";
      const result = await database.prepare(`SELECT id, content_id AS contentId, account_id AS accountId, title, highlight, problem, hypothesis, next_action AS nextAction, evidence, status, reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt FROM reviews WHERE ${"1=1"}${suffix} ORDER BY updated_at DESC`).bind(...(status ? [status] : [])).all<ReviewRecord>();
      return result.results;
    },
  };
}
