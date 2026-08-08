import type { ContentStage } from "../domain/content";
import type { DatabaseClient } from "./database";

export interface ContentRecord {
  id: string;
  accountId: string;
  title: string;
  contentType: string | null;
  stage: ContentStage;
  plannedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  importBatchId?: string | null;
}

export function createContentRepository(database: DatabaseClient) {
  return {
    async insert(content: ContentRecord) {
      await database
        .prepare(
          "INSERT INTO contents (id, title, account_id, content_type, stage, planned_at, published_at, source, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 1, ?, ?)",
        )
        .bind(
          content.id,
          content.title,
          content.accountId,
          content.contentType,
          content.stage,
          content.plannedAt,
          content.publishedAt,
          content.createdAt,
          content.updatedAt,
        )
        .run();
      if (content.importBatchId) {
        await database.prepare("UPDATE contents SET import_batch_id = ? WHERE id = ?").bind(content.importBatchId, content.id).run();
      }
      return content;
    },

    async count() {
      const row = await database
        .prepare("SELECT COUNT(*) AS count FROM contents WHERE deleted_at IS NULL")
        .first<{ count: number }>();
      if (!row) {
        throw new Error("Content count is unavailable");
      }
      return row.count;
    },

    async findById(id: string) {
      return database
        .prepare(
          "SELECT id, account_id AS accountId, title, content_type AS contentType, stage, planned_at AS plannedAt, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM contents WHERE id = ?",
        )
        .bind(id)
        .first<ContentRecord>();
    },

    async list(filters: { stage?: ContentStage } = {}) {
      const params: unknown[] = [];
      const condition = filters.stage ? "AND stage = ?" : "";
      if (filters.stage) params.push(filters.stage);
      const result = await database.prepare(`SELECT id, account_id AS accountId, title, content_type AS contentType, stage, planned_at AS plannedAt, published_at AS publishedAt, created_at AS createdAt, updated_at AS updatedAt FROM contents WHERE deleted_at IS NULL ${condition} ORDER BY COALESCE(planned_at, published_at) DESC`).bind(...params).all<ContentRecord>();
      return result.results;
    },

    async remove(id: string, updatedAt: string) {
      await database.prepare("UPDATE contents SET deleted_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL").bind(updatedAt, updatedAt, id).run();
    },

    async update(id: string, input: { title: string; stage: ContentStage; plannedAt: string | null; publishedAt: string | null }, updatedAt: string) {
      await database.prepare("UPDATE contents SET title = ?, stage = ?, planned_at = ?, published_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND deleted_at IS NULL").bind(input.title, input.stage, input.plannedAt, input.publishedAt, updatedAt, id).run();
      return this.findById(id);
    },
  };
}
