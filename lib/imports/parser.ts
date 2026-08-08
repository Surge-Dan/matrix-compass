import { validateContentInput } from "../domain/content";
import { validateAccountInput } from "../domain/account";
import { validateFinanceInput } from "../domain/finance";

export type ImportTarget = "accounts" | "contents" | "finance";
export interface ImportError { row: number; message: string; field?: string; }

function normalizeHeader(header: string) {
  return header.replace(/^\uFEFF/, "").trim();
}

export function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = (rows.shift() ?? []).map(normalizeHeader);
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function mapPlatform(value: string) { return validateAccountInput({ platform: value, name: "import" }).platform; }

export function mapImportRows(rows: Record<string, string>[], target: ImportTarget) {
  const valid: Record<string, unknown>[] = [];
  const errors: ImportError[] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    try {
      if (target === "accounts") {
        const account = validateAccountInput({ platform: row["平台"], name: row["账号"] || row["账号名称"] });
        valid.push(account);
      } else if (target === "contents") {
        const platform = mapPlatform(row["平台"]);
        const accountName = (row["账号"] || row["账号名称"] || "").trim();
        const title = row["内容主题"] || row["标题"];
        const plannedAt = row["发布时间"] || row["发布日期"];
        const stage = row["发布状态"] === "已发布" ? "published" : "scheduled";
        const content = validateContentInput({ title, accountId: `${platform}:${accountName}`, plannedAt: plannedAt ? `${plannedAt}T00:00:00+08:00` : null, stage });
        valid.push({ ...content, platform, accountName });
      } else {
        const platform = mapPlatform(row["平台"]);
        const accountName = (row["账号"] || row["账号名称"] || "").trim();
        const input = validateFinanceInput({
          accountId: `${platform}:${accountName}`,
          direction: row["收支方向"] || row["方向"] || "income",
          category: row["收入类型"] || row["类型"] || "other",
          amountMinor: Math.round(Number(row["金额"] || row["收入金额"] || 0) * 100),
          currency: row["币种"] || "CNY",
          occurredAt: `${row["发生日期"] || row["日期"]}T00:00:00+08:00`,
          settlementStatus: row["结算状态"] || "pending",
          settledAmountMinor: Math.round(Number(row["已结算金额"] || 0) * 100),
        });
        valid.push({ ...input, platform, accountName });
      }
    } catch (error) {
      errors.push({ row: rowNumber, message: error instanceof Error ? error.message : "数据无效" });
    }
  });
  return { valid, errors };
}
