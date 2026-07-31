import { describe, expect, it } from "vitest";
import {
  BackupVerificationError,
  createBackupManifest,
  sha256Hex,
  verifyBackupManifest,
} from "../../lib/backup/manifest";

const sql = "CREATE TABLE example (id INTEGER);\nINSERT INTO example VALUES (1);\n";

async function expectBackupRejection(
  operation: Promise<unknown>,
  message: string,
) {
  try {
    await operation;
    throw new Error("expected backup rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(BackupVerificationError);
    expect(error).toMatchObject({
      name: "BackupVerificationError",
      code: "INVALID_BACKUP",
      message,
    });
  }
}

describe("backup manifest", () => {
  it("records a deterministic checksum and database summary", async () => {
    const manifest = await createBackupManifest(sql, {
      appVersion: "0.1.0",
      schemaVersion: 1,
      createdAt: "2026-07-30T12:00:00.000Z",
      recordCounts: { accounts: 2, contents: 7 },
    });

    expect(manifest).toEqual({
      formatVersion: 1,
      appVersion: "0.1.0",
      schemaVersion: 1,
      createdAt: "2026-07-30T12:00:00.000Z",
      sqlFile: "snapshot.sql",
      sha256: await sha256Hex(sql),
      recordCounts: { accounts: 2, contents: 7 },
    });
    await expect(verifyBackupManifest(sql, manifest)).resolves.toEqual(manifest);
  });

  it("rejects a changed SQL snapshot", async () => {
    const manifest = await createBackupManifest(sql, {
      appVersion: "0.1.0",
      schemaVersion: 1,
      createdAt: "2026-07-30T12:00:00.000Z",
      recordCounts: { accounts: 0, contents: 0 },
    });

    await expectBackupRejection(
      verifyBackupManifest(`${sql}-- tampered`, manifest),
      "备份 SQL 校验值不匹配。",
    );
  });

  it("rejects malformed versions and record counts", async () => {
    const manifest = await createBackupManifest(sql, {
      appVersion: "0.1.0",
      schemaVersion: 1,
      createdAt: "2026-07-30T12:00:00.000Z",
      recordCounts: { accounts: 0, contents: 0 },
    });

    await expectBackupRejection(
      verifyBackupManifest(sql, { ...manifest, schemaVersion: 0 }),
      "备份版本信息无效。",
    );
    await expectBackupRejection(
      verifyBackupManifest(sql, {
        ...manifest,
        recordCounts: { accounts: -1 },
      }),
      "备份记录数摘要无效。",
    );
  });

  it.each([
    [{ formatVersion: 2 }, "备份格式不受支持。"],
    [{ sqlFile: "../snapshot.sql" }, "备份格式不受支持。"],
    [{ appVersion: "" }, "备份版本信息无效。"],
    [{ createdAt: "not-a-date" }, "备份创建时间无效。"],
    [{ sha256: "not-a-checksum" }, "备份校验值格式无效。"],
    [{ sha256: `x${"a".repeat(64)}` }, "备份校验值格式无效。"],
    [{ sha256: `${"a".repeat(64)}x` }, "备份校验值格式无效。"],
    [{ recordCounts: { "": 0 } }, "备份记录数摘要无效。"],
    [{ recordCounts: { accounts: 1.5 } }, "备份记录数摘要无效。"],
  ])("rejects malformed manifest fragment %#", async (fragment, message) => {
    const manifest = await createBackupManifest(sql, {
      appVersion: "0.1.0",
      schemaVersion: 1,
      createdAt: "2026-07-30T12:00:00.000Z",
      recordCounts: { accounts: 0 },
    });
    await expectBackupRejection(
      verifyBackupManifest(sql, { ...manifest, ...fragment } as never),
      message,
    );
  });
});
