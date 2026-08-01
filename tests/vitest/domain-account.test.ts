import { describe, expect, it } from "vitest";

describe("account domain", () => {
  it("normalizes supported platform aliases without excluding Bilibili or custom platforms", async () => {
    const domain = await import("../../lib/domain/account");

    const aliases = [
      ["公众号", "wechat"],
      ["微信公众平台", "wechat"],
      ["wechat", "wechat"],
      ["小红书", "xiaohongshu"],
      ["xiaohongshu", "xiaohongshu"],
      ["抖音", "douyin"],
      ["douyin", "douyin"],
      ["快手", "kuaishou"],
      ["kuaishou", "kuaishou"],
      ["B站", "bilibili"],
      ["哔哩哔哩", "bilibili"],
      ["bilibili", "bilibili"],
    ];
    for (const [platform, normalized] of aliases) {
      expect(domain.validateAccountInput({ platform, name: "账号" })).toEqual({
        platform: normalized,
        name: "账号",
        status: "active",
      });
    }
    expect(
      domain.validateAccountInput({ platform: "播客", name: "新栏目", status: "paused" }),
    ).toEqual({ platform: "播客", name: "新栏目", status: "paused" });
    expect(
      domain.validateAccountInput({ platform: "B站", name: " 我的频道 ", status: "archived" }),
    ).toEqual({ platform: "bilibili", name: "我的频道", status: "archived" });
    expect(
      domain.validateAccountInput({ platform: " B站 ", name: "空白规范化" }),
    ).toMatchObject({ platform: "bilibili" });
    expect(
      domain.validateAccountInput({ platform: "WECHAT", name: "英文大写" }),
    ).toMatchObject({ platform: "wechat" });
  });

  it.each([
    [{ name: "账号" }, "ACCOUNT_PLATFORM_REQUIRED", "请选择账号平台。", "platform"],
    [{ platform: "", name: "账号" }, "ACCOUNT_PLATFORM_REQUIRED", "请选择账号平台。", "platform"],
    [{ platform: "公众号" }, "ACCOUNT_NAME_REQUIRED", "请填写账号名称。", "name"],
    [{ platform: "公众号", name: "  " }, "ACCOUNT_NAME_REQUIRED", "请填写账号名称。", "name"],
    [{ platform: "公众号", name: "账号", status: "deleted" }, "ACCOUNT_STATUS_INVALID", "账号状态无效。", "status"],
  ])("rejects invalid account input %#", async (input, code, message, field) => {
    const domain = await import("../../lib/domain/account");
    try {
      domain.validateAccountInput(input);
      throw new Error("expected account validation to fail");
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
