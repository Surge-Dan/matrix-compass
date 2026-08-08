import { DomainValidationError } from "./errors";

export const FINANCE_DIRECTIONS = ["income", "expense"] as const;
export const FINANCE_CATEGORIES = ["brand-deal", "platform-share", "affiliate", "course", "equipment", "other"] as const;
export const SETTLEMENT_STATUSES = ["pending", "partial", "settled", "cancelled", "overdue"] as const;
export type FinanceDirection = (typeof FINANCE_DIRECTIONS)[number];
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export interface FinanceInput {
  accountId?: string;
  contentId?: string | null;
  direction?: string;
  category?: string;
  amountMinor?: number;
  currency?: string;
  occurredAt?: string;
  settlementStatus?: string;
  settledAmountMinor?: number;
  expectedSettlementAt?: string | null;
  settledAt?: string | null;
  counterparty?: string | null;
  note?: string | null;
}

function validDate(value: string | null | undefined, field: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DomainValidationError("FINANCE_DATE_INVALID", "财务日期格式无效。", field);
  }
  return new Date(value).toISOString();
}

export function validateFinanceInput(input: FinanceInput) {
  const accountId = input.accountId?.trim() ?? "";
  if (!accountId) throw new DomainValidationError("FINANCE_ACCOUNT_REQUIRED", "请选择关联账号。", "accountId");
  if (!FINANCE_DIRECTIONS.includes(input.direction as FinanceDirection)) throw new DomainValidationError("FINANCE_DIRECTION_INVALID", "收支方向无效。", "direction");
  if (!FINANCE_CATEGORIES.includes(input.category as FinanceCategory)) throw new DomainValidationError("FINANCE_CATEGORY_INVALID", "收入类型无效。", "category");
  if (!Number.isInteger(input.amountMinor) || (input.amountMinor ?? 0) <= 0) throw new DomainValidationError("FINANCE_AMOUNT_INVALID", "金额必须是正整数分。", "amountMinor");
  const settledAmountMinor = input.settledAmountMinor ?? 0;
  if (!Number.isInteger(settledAmountMinor) || settledAmountMinor < 0 || settledAmountMinor > (input.amountMinor ?? 0)) throw new DomainValidationError("FINANCE_SETTLED_AMOUNT_INVALID", "已结算金额必须在有效范围内。", "settledAmountMinor");
  if (input.direction === "expense" && settledAmountMinor > 0) throw new DomainValidationError("FINANCE_EXPENSE_SETTLED_INVALID", "成本记录暂不支持结算金额。", "settledAmountMinor");
  const settlementStatus = input.settlementStatus ?? "pending";
  if (!SETTLEMENT_STATUSES.includes(settlementStatus as SettlementStatus)) throw new DomainValidationError("FINANCE_SETTLEMENT_INVALID", "结算状态无效。", "settlementStatus");
  if (settlementStatus === "settled" && settledAmountMinor !== input.amountMinor) throw new DomainValidationError("FINANCE_SETTLEMENT_MISMATCH", "已结算状态必须与金额一致。", "settledAmountMinor");
  return {
    accountId,
    contentId: input.contentId?.trim() || null,
    direction: input.direction as FinanceDirection,
    category: input.category as FinanceCategory,
    amountMinor: input.amountMinor as number,
    currency: input.currency?.trim().toUpperCase() || "CNY",
    occurredAt: validDate(input.occurredAt, "occurredAt"),
    settlementStatus: settlementStatus as SettlementStatus,
    settledAmountMinor,
    expectedSettlementAt: input.expectedSettlementAt ? validDate(input.expectedSettlementAt, "expectedSettlementAt") : null,
    settledAt: input.settledAt ? validDate(input.settledAt, "settledAt") : null,
    counterparty: input.counterparty?.trim() || null,
    note: input.note?.trim() || null,
  };
}
