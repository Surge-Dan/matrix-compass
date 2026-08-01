import type { AccountStatus } from "../domain/account";
import type { DatabaseClient } from "./database";

export interface AccountRecord {
  id: string;
  platform: string;
  name: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

interface StoredAccountRow {
  id: string;
  platform: string;
  name: string;
  active: number | boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function toStatus(row: Pick<StoredAccountRow, "active" | "deletedAt">): AccountStatus {
  if (row.deletedAt) return "archived";
  return row.active ? "active" : "paused";
}

function toAccount(row: StoredAccountRow): AccountRecord {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    status: toStatus(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createAccountRepository(database: DatabaseClient) {
  return {
    async insert(account: AccountRecord) {
      await database
        .prepare(
          "INSERT INTO accounts (id, platform, name, active, deleted_at, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        )
        .bind(
          account.id,
          account.platform,
          account.name,
          account.status === "active" ? 1 : 0,
          account.status === "archived" ? account.updatedAt : null,
          account.createdAt,
          account.updatedAt,
        )
        .run();
      return account;
    },

    async count() {
      const row = await database
        .prepare("SELECT COUNT(*) AS count FROM accounts WHERE deleted_at IS NULL")
        .first<{ count: number }>();
      if (!row) {
        throw new Error("Account count is unavailable");
      }
      return row.count;
    },

    async findById(id: string) {
      const row = await database
        .prepare(
          "SELECT id, platform, name, active, deleted_at AS deletedAt, created_at AS createdAt, updated_at AS updatedAt FROM accounts WHERE id = ?",
        )
        .bind(id)
        .first<StoredAccountRow>();
      return row ? toAccount(row) : null;
    },
  };
}
