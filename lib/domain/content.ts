import { DomainValidationError } from "./errors";

export type ContentStage =
  | "idea"
  | "creating"
  | "scheduled"
  | "published"
  | "reviewed"
  | "archived";

export interface ContentInput {
  accountId?: string;
  title?: string;
  contentType?: string | null;
  stage?: string;
  plannedAt?: string | null;
  publishedAt?: string | null;
}

const CONTENT_STAGES = new Set<ContentStage>([
  "idea",
  "creating",
  "scheduled",
  "published",
  "reviewed",
  "archived",
]);

function normalizeDate(value: string | null | undefined, field: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  const invalid = () => new DomainValidationError("CONTENT_DATE_INVALID", "内容日期格式无效。", field);
  if (!match) throw invalid();
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = "", zone] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const millisecond = Number(fraction.padEnd(3, "0"));
  const wallClock = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const normalizedWallClock = new Date(wallClock);
  if (
    normalizedWallClock.getUTCFullYear() !== year || normalizedWallClock.getUTCMonth() !== month - 1 ||
    normalizedWallClock.getUTCDate() !== day || normalizedWallClock.getUTCHours() !== hour ||
    normalizedWallClock.getUTCMinutes() !== minute || normalizedWallClock.getUTCSeconds() !== second
  ) throw invalid();
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const sign = zone[0] === "+" ? 1 : -1;
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) throw invalid();
    offsetMinutes = sign * (offsetHour * 60 + offsetMinute);
  }
  const date = new Date(wallClock - offsetMinutes * 60_000);
  return date.toISOString();
}

export function validateContentInput(input: ContentInput) {
  const accountId = input.accountId?.trim() ?? "";
  if (!accountId) {
    throw new DomainValidationError(
      "CONTENT_ACCOUNT_REQUIRED",
      "请选择内容所属账号。",
      "accountId",
    );
  }

  const title = input.title?.trim() ?? "";
  if (!title) {
    throw new DomainValidationError(
      "CONTENT_TITLE_REQUIRED",
      "请填写内容主题。",
      "title",
    );
  }

  const stage = input.stage ?? "idea";
  if (!CONTENT_STAGES.has(stage as ContentStage)) {
    throw new DomainValidationError(
      "CONTENT_STAGE_INVALID",
      "内容状态无效。",
      "stage",
    );
  }

  const plannedAt = normalizeDate(input.plannedAt, "plannedAt");
  const publishedAt = normalizeDate(input.publishedAt, "publishedAt");
  if (!plannedAt && !publishedAt) {
    throw new DomainValidationError(
      "CONTENT_DATE_REQUIRED",
      "计划时间和实际发布时间至少填写一个。",
      "plannedAt",
    );
  }
  if (stage === "published" && !publishedAt) {
    throw new DomainValidationError(
      "CONTENT_PUBLISHED_AT_REQUIRED",
      "已发布内容必须填写实际发布时间。",
      "publishedAt",
    );
  }

  return {
    accountId,
    title,
    contentType: input.contentType?.trim() || null,
    stage: stage as ContentStage,
    plannedAt,
    publishedAt,
  };
}
