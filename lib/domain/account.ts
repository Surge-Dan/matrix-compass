import { DomainValidationError } from "./errors";

export type AccountStatus = "active" | "paused" | "archived";

export interface AccountInput {
  platform?: string;
  name?: string;
  status?: string;
}

const PLATFORM_ALIASES = new Map<string, string>([
  ["公众号", "wechat"],
  ["微信公众平台", "wechat"],
  ["wechat", "wechat"],
  ["小红书", "xiaohongshu"],
  ["xiaohongshu", "xiaohongshu"],
  ["抖音", "douyin"],
  ["douyin", "douyin"],
  ["快手", "kuaishou"],
  ["kuaishou", "kuaishou"],
  ["b站", "bilibili"],
  ["哔哩哔哩", "bilibili"],
  ["bilibili", "bilibili"],
]);

const ACCOUNT_STATUSES = new Set<AccountStatus>([
  "active",
  "paused",
  "archived",
]);

export function validateAccountInput(input: AccountInput) {
  const rawPlatform = input.platform?.trim() ?? "";
  if (!rawPlatform) {
    throw new DomainValidationError(
      "ACCOUNT_PLATFORM_REQUIRED",
      "请选择账号平台。",
      "platform",
    );
  }

  const name = input.name?.trim() ?? "";
  if (!name) {
    throw new DomainValidationError(
      "ACCOUNT_NAME_REQUIRED",
      "请填写账号名称。",
      "name",
    );
  }

  const status = input.status ?? "active";
  if (!ACCOUNT_STATUSES.has(status as AccountStatus)) {
    throw new DomainValidationError(
      "ACCOUNT_STATUS_INVALID",
      "账号状态无效。",
      "status",
    );
  }

  return {
    platform:
      PLATFORM_ALIASES.get(rawPlatform.toLocaleLowerCase("zh-CN")) ?? rawPlatform,
    name,
    status: status as AccountStatus,
  };
}
