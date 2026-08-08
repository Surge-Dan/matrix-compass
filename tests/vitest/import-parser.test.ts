import { describe, expect, it } from "vitest";
import { parseCsvRows, mapImportRows, type ImportTarget } from "../../lib/imports/parser";

describe("import parser", () => {
  it("parses quoted UTF-8 CSV cells without losing commas or newlines", () => {
    expect(parseCsvRows('平台,账号,标题\n公众号,Daniel,"一句话,含逗号"\n公众号,Daniel,"多行\n标题"')).toEqual([
      { 平台: "公众号", 账号: "Daniel", 标题: "一句话,含逗号" },
      { 平台: "公众号", 账号: "Daniel", 标题: "多行\n标题" },
    ]);
  });

  it("maps common Feishu headers to content fields and reports row errors", () => {
    const result = mapImportRows([
      { 平台: "公众号", 账号: "Daniel", 内容主题: "AI 产品复盘", 发布日期: "2026-08-08", 发布类型: "学习" },
      { 平台: "不存在", 账号: "", 内容主题: "", 发布日期: "not-a-date", 发布类型: "" },
    ], "contents" satisfies ImportTarget);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({ title: "AI 产品复盘", platform: "wechat", stage: "scheduled" });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].row).toBe(3);
  });
});
