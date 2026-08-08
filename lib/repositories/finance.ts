import type { FinanceCategory, FinanceDirection, SettlementStatus } from "../domain/finance";
import type { DatabaseClient } from "./database";

export interface FinanceRecord {
  id: string;
  accountId: string;
  contentId: string | null;
  direction: FinanceDirection;
  category: FinanceCategory;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  settlementStatus: SettlementStatus;
  settledAmountMinor: number;
  expectedSettlementAt: string | null;
  settledAt: string | null;
  counterparty: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  importBatchId?: string | null;
}

export function createFinanceRepository(database: DatabaseClient) {
  return {
    async insert(entry: FinanceRecord) {
      await database.prepare("INSERT INTO finance_entries (id, direction, account_id, content_id, category, amount_minor, currency, occurred_at, settlement_status, settled_amount_minor, expected_settlement_at, settled_at, counterparty, note, source, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 1, ?, ?)").bind(entry.id, entry.direction, entry.accountId, entry.contentId, entry.category, entry.amountMinor, entry.currency, entry.occurredAt, entry.settlementStatus, entry.settledAmountMinor, entry.expectedSettlementAt, entry.settledAt, entry.counterparty, entry.note, entry.createdAt, entry.updatedAt).run();
      if (entry.importBatchId) {
        await database.prepare("UPDATE finance_entries SET import_batch_id = ? WHERE id = ?").bind(entry.importBatchId, entry.id).run();
      }
      return entry;
    },
    async list(filters: { direction?: FinanceDirection; status?: SettlementStatus } = {}) {
      const clauses = ["deleted_at IS NULL"];
      const values: unknown[] = [];
      if (filters.direction) { clauses.push("direction = ?"); values.push(filters.direction); }
      if (filters.status) { clauses.push("settlement_status = ?"); values.push(filters.status); }
      const result = await database.prepare(`SELECT id, account_id AS accountId, content_id AS contentId, direction, category, amount_minor AS amountMinor, currency, occurred_at AS occurredAt, settlement_status AS settlementStatus, settled_amount_minor AS settledAmountMinor, expected_settlement_at AS expectedSettlementAt, settled_at AS settledAt, counterparty, note, created_at AS createdAt, updated_at AS updatedAt FROM finance_entries WHERE ${clauses.join(" AND ")} ORDER BY occurred_at DESC`).bind(...values).all<FinanceRecord>();
      return result.results;
    },
    async summary() {
      const row = await database.prepare("SELECT COALESCE(SUM(CASE WHEN direction = 'income' THEN amount_minor ELSE 0 END), 0) AS totalIncomeMinor, COALESCE(SUM(CASE WHEN direction = 'expense' THEN amount_minor ELSE 0 END), 0) AS totalExpenseMinor, COALESCE(SUM(CASE WHEN direction = 'income' AND settlement_status = 'settled' THEN settled_amount_minor ELSE 0 END), 0) AS settledIncomeMinor, COALESCE(SUM(CASE WHEN direction = 'income' AND settlement_status IN ('pending', 'partial', 'overdue') THEN amount_minor - settled_amount_minor ELSE 0 END), 0) AS pendingIncomeMinor FROM finance_entries WHERE deleted_at IS NULL").first<{ totalIncomeMinor: number; totalExpenseMinor: number; settledIncomeMinor: number; pendingIncomeMinor: number }>();
      if (!row) throw new Error("Finance summary is unavailable");
      return row;
    },
  };
}
