import { validateAccountInput } from "../domain/account";
import { validateContentInput } from "../domain/content";
import { validateFinanceInput } from "../domain/finance";
import { createAccountRepository } from "../repositories/accounts";
import { createContentRepository } from "../repositories/contents";
import { createFinanceRepository } from "../repositories/finance";
import type { DatabaseClient } from "../repositories/database";
import { mapImportRows, parseCsvRows, type ImportTarget } from "./parser";

export function previewImport(text: string, target: ImportTarget) {
  const rows = parseCsvRows(text);
  const mapped = mapImportRows(rows, target);
  return { target, totalRows: rows.length, ...mapped };
}

export async function commitImport(database: DatabaseClient, preview: ReturnType<typeof previewImport>, source = "csv", fileName: string | null = null) {
  const timestamp = new Date().toISOString();
  const batchId = crypto.randomUUID();
  await database.prepare("INSERT INTO import_batches (id, source, target, file_name, status, total_rows, success_rows, failed_rows, created_at) VALUES (?, ?, ?, ?, 'preview', ?, 0, ?, ?)").bind(batchId, source, preview.target, fileName, preview.totalRows, preview.errors.length, timestamp).run();
  let successRows = 0;
  try {
    const accounts = createAccountRepository(database);
    const contents = createContentRepository(database);
    const finance = createFinanceRepository(database);
    for (const row of preview.valid) {
      const platform = String(row.platform);
      const accountName = String(row.accountName);
      let account = await accounts.findByPlatformName(platform, accountName);
      if (!account) {
        const input = validateAccountInput({ platform, name: accountName });
        account = await accounts.insert({ id: crypto.randomUUID(), ...input, importBatchId: batchId, createdAt: timestamp, updatedAt: timestamp });
      }
      if (preview.target === "contents") {
        const content = validateContentInput({ accountId: account.id, title: String(row.title), contentType: typeof row.contentType === "string" ? row.contentType : null, stage: String(row.stage), plannedAt: typeof row.plannedAt === "string" ? row.plannedAt : null, publishedAt: typeof row.publishedAt === "string" ? row.publishedAt : null });
        await contents.insert({ id: crypto.randomUUID(), ...content, importBatchId: batchId, createdAt: timestamp, updatedAt: timestamp });
      } else if (preview.target === "finance") {
        const entry = validateFinanceInput({ ...row, accountId: account.id });
        await finance.insert({ id: crypto.randomUUID(), ...entry, importBatchId: batchId, createdAt: timestamp, updatedAt: timestamp });
      }
      successRows += 1;
    }
    await database.prepare("UPDATE import_batches SET status = 'committed', success_rows = ?, completed_at = ? WHERE id = ?").bind(successRows, new Date().toISOString(), batchId).run();
    return { batchId, status: "committed", totalRows: preview.totalRows, successRows, failedRows: preview.errors.length };
  } catch (error) {
    await database.prepare("UPDATE import_batches SET status = 'failed', success_rows = ?, error_summary = ?, completed_at = ? WHERE id = ?").bind(successRows, error instanceof Error ? error.message : "导入失败", new Date().toISOString(), batchId).run();
    throw error;
  }
}

export async function rollbackImport(database: DatabaseClient, batchId: string) {
  const batch = await database
    .prepare("SELECT id, status FROM import_batches WHERE id = ?")
    .bind(batchId)
    .first<{ id: string; status: string }>();
  if (!batch) throw new Error("Import batch not found");
  if (batch.status !== "committed") throw new Error("Only committed imports can be rolled back");
  const timestamp = new Date().toISOString();
  await database.prepare("UPDATE contents SET deleted_at = ?, version = version + 1, updated_at = ? WHERE import_batch_id = ? AND deleted_at IS NULL").bind(timestamp, timestamp, batchId).run();
  await database.prepare("UPDATE finance_entries SET deleted_at = ?, version = version + 1, updated_at = ? WHERE import_batch_id = ? AND deleted_at IS NULL").bind(timestamp, timestamp, batchId).run();
  await database.prepare("UPDATE accounts SET deleted_at = ?, active = 0, version = version + 1, updated_at = ? WHERE import_batch_id = ? AND deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM contents WHERE contents.account_id = accounts.id AND contents.deleted_at IS NULL) AND NOT EXISTS (SELECT 1 FROM finance_entries WHERE finance_entries.account_id = accounts.id AND finance_entries.deleted_at IS NULL)").bind(timestamp, timestamp, batchId).run();
  await database.prepare("UPDATE import_batches SET status = 'rolled-back', completed_at = ? WHERE id = ?").bind(timestamp, batchId).run();
  return { batchId, status: "rolled-back" as const };
}
