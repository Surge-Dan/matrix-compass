import { describe, expect, it } from "vitest";

describe("content domain", () => {
  it("accepts the minimum planned-content form and keeps content type optional", async () => {
    const domain = await import("../../lib/domain/content");
    expect(
      domain.validateContentInput({
        accountId: " account-1 ",
        title: " 第一条真实内容 ",
        plannedAt: "2026-08-02T10:00:00+08:00",
      }),
    ).toEqual({
      accountId: "account-1",
      title: "第一条真实内容",
      contentType: null,
      stage: "idea",
      plannedAt: "2026-08-02T02:00:00.000Z",
      publishedAt: null,
    });
  });

  it("accepts published content with only an actual publication time", async () => {
    const domain = await import("../../lib/domain/content");
    expect(
      domain.validateContentInput({
        accountId: "account-1",
        title: "已经发布",
        contentType: " 工作 ",
        stage: "published",
        publishedAt: "2026-08-01T12:00:00.000Z",
      }),
    ).toMatchObject({
      stage: "published",
      contentType: "工作",
      plannedAt: null,
      publishedAt: "2026-08-01T12:00:00.000Z",
    });
  });

  it("normalizes a valid negative timezone offset", async () => {
    const domain = await import("../../lib/domain/content");
    expect(domain.validateContentInput({
      accountId: "account-1",
      title: "跨时区内容",
      plannedAt: "2026-08-01T12:00:00-05:30",
    }).plannedAt).toBe("2026-08-01T17:30:00.000Z");
    expect(domain.validateContentInput({
      accountId: "account-1",
      title: "毫秒补齐",
      plannedAt: "2026-08-01T12:00:00.1Z",
    }).plannedAt).toBe("2026-08-01T12:00:00.100Z");
    expect(domain.validateContentInput({
      accountId: "account-1",
      title: "最大时区小时",
      plannedAt: "2026-08-01T12:00:00+23:00",
    }).plannedAt).toBe("2026-07-31T13:00:00.000Z");
    expect(domain.validateContentInput({
      accountId: "account-1",
      title: "最大时区分钟",
      plannedAt: "2026-08-01T12:00:00+08:59",
    }).plannedAt).toBe("2026-08-01T03:01:00.000Z");
  });

  it("accepts every supported lifecycle stage without weakening publication rules", async () => {
    const domain = await import("../../lib/domain/content");
    for (const stage of ["idea", "creating", "scheduled", "reviewed", "archived"]) {
      expect(
        domain.validateContentInput({
          accountId: "account-1",
          title: stage,
          stage,
          plannedAt: "2026-08-02T00:00:00.000Z",
        }),
      ).toMatchObject({ stage });
    }
    expect(
      domain.validateContentInput({
        accountId: "account-1",
        title: "published",
        stage: "published",
        publishedAt: "2026-08-02T00:00:00.000Z",
      }),
    ).toMatchObject({ stage: "published" });
  });

  it.each([
    [{ title: "内容", plannedAt: "2026-08-01" }, "CONTENT_ACCOUNT_REQUIRED", "请选择内容所属账号。", "accountId"],
    [{ accountId: "", title: "内容", plannedAt: "2026-08-01" }, "CONTENT_ACCOUNT_REQUIRED", "请选择内容所属账号。", "accountId"],
    [{ accountId: "a", plannedAt: "2026-08-01" }, "CONTENT_TITLE_REQUIRED", "请填写内容主题。", "title"],
    [{ accountId: "a", title: " ", plannedAt: "2026-08-01" }, "CONTENT_TITLE_REQUIRED", "请填写内容主题。", "title"],
    [{ accountId: "a", title: "内容" }, "CONTENT_DATE_REQUIRED", "计划时间和实际发布时间至少填写一个。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "not-a-date" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", publishedAt: "not-a-date" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "publishedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-02-30T00:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "1" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:00:00" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:00:00+24:00" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:00:00+08:60" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "x2026-08-01T12:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:00:00Zx" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "0099-08-01T12:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-13-01T12:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-32T12:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T24:00:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:60:00Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", plannedAt: "2026-08-01T12:00:60Z" }, "CONTENT_DATE_INVALID", "内容日期格式无效。", "plannedAt"],
    [{ accountId: "a", title: "内容", stage: "deleted", plannedAt: "2026-08-01" }, "CONTENT_STAGE_INVALID", "内容状态无效。", "stage"],
    [{ accountId: "a", title: "内容", stage: "published", plannedAt: "2026-08-01T00:00:00Z" }, "CONTENT_PUBLISHED_AT_REQUIRED", "已发布内容必须填写实际发布时间。", "publishedAt"],
  ])("rejects invalid content input %#", async (input, code, message, field) => {
    const domain = await import("../../lib/domain/content");
    try {
      domain.validateContentInput(input);
      throw new Error("expected content validation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        name: "DomainValidationError",
        code,
        message,
        field,
      });
    }
  });
});
