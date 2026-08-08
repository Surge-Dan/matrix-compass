import { describe, expect, it } from "vitest";
import {
  FINANCE_CATEGORIES,
  FINANCE_DIRECTIONS,
  SETTLEMENT_STATUSES,
  validateFinanceInput,
} from "../../lib/domain/finance";

describe("finance domain", () => {
  it("accepts a settled income entry with integer minor units", () => {
    expect(validateFinanceInput({
      accountId: "account-1",
      direction: "income",
      category: "brand-deal",
      amountMinor: 20000,
      currency: "CNY",
      occurredAt: "2026-08-08T08:00:00+08:00",
      settlementStatus: "settled",
      settledAmountMinor: 20000,
    })).toMatchObject({
      accountId: "account-1",
      direction: "income",
      amountMinor: 20000,
      settlementStatus: "settled",
    });
  });

  it("rejects invalid direction, category, money and settlement combinations", () => {
    for (const direction of ["income", "expense"] as const) expect(FINANCE_DIRECTIONS).toContain(direction);
    for (const category of ["brand-deal", "platform-share", "affiliate", "course", "equipment", "other"] as const) expect(FINANCE_CATEGORIES).toContain(category);
    for (const status of ["pending", "partial", "settled", "cancelled", "overdue"] as const) expect(SETTLEMENT_STATUSES).toContain(status);
    expect(() => validateFinanceInput({ accountId: "", direction: "income", category: "brand-deal", amountMinor: 0, currency: "CNY", occurredAt: "2026-08-08T08:00:00+08:00", settlementStatus: "settled", settledAmountMinor: 1 })).toThrow();
    expect(() => validateFinanceInput({ accountId: "a", direction: "income", category: "unknown", amountMinor: 1, currency: "CNY", occurredAt: "2026-08-08T08:00:00+08:00", settlementStatus: "pending", settledAmountMinor: 2 })).toThrow();
    expect(() => validateFinanceInput({ accountId: "a", direction: "income", category: "brand-deal", amountMinor: 1.5, currency: "CNY", occurredAt: "2026-08-08T08:00:00+08:00", settlementStatus: "pending", settledAmountMinor: 0 })).toThrow();
    expect(() => validateFinanceInput({ accountId: "a", direction: "income", category: "brand-deal", amountMinor: 1, currency: "CNY", occurredAt: "2026-08-08T08:00:00+08:00", settlementStatus: "settled", settledAmountMinor: 2 })).toThrow();
  });

  it("normalizes optional fields and rejects every settlement boundary", () => {
    const base = { accountId: "  a ", direction: "income", category: "brand-deal", amountMinor: 100, currency: " usd ", occurredAt: "2026-08-08T08:00:00+08:00", settlementStatus: "partial", settledAmountMinor: 50, contentId: "  content-1 ", counterparty: "  partner ", note: "  note " } as const;
    expect(validateFinanceInput(base)).toMatchObject({ accountId: "a", contentId: "content-1", currency: "USD", counterparty: "partner", note: "note" });
    expect(validateFinanceInput({ ...base, currency: undefined, contentId: undefined, counterparty: undefined, note: undefined }).currency).toBe("CNY");
    expect(() => validateFinanceInput({ ...base, occurredAt: "invalid" })).toThrow(/日期/);
    expect(() => validateFinanceInput({ ...base, direction: "other" as never })).toThrow();
    expect(() => validateFinanceInput({ ...base, settlementStatus: "unknown" as never })).toThrow();
    expect(() => validateFinanceInput({ ...base, direction: "expense", settledAmountMinor: 1 })).toThrow();
    expect(() => validateFinanceInput({ ...base, settledAmountMinor: -1 })).toThrow();
    expect(() => validateFinanceInput({ ...base, settledAmountMinor: 101 })).toThrow();
    expect(() => validateFinanceInput({ ...base, settlementStatus: "settled", settledAmountMinor: 50 })).toThrow();
    expect(() => validateFinanceInput({ ...base, amountMinor: -1 })).toThrow();
  });
});
