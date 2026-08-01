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
  };
}
