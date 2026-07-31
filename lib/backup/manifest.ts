export interface BackupManifest {
  formatVersion: 1;
  appVersion: string;
  schemaVersion: number;
  createdAt: string;
  sqlFile: "snapshot.sql";
  sha256: string;
  recordCounts: Record<string, number>;
}

type BackupManifestInput = Pick<
  BackupManifest,
  "appVersion" | "schemaVersion" | "createdAt" | "recordCounts"
>;

export class BackupVerificationError extends Error {
  readonly code = "INVALID_BACKUP";

  constructor(message: string) {
    super(message);
    this.name = "BackupVerificationError";
  }
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function assertManifestShape(manifest: BackupManifest) {
  if (manifest.formatVersion !== 1 || manifest.sqlFile !== "snapshot.sql") {
    throw new BackupVerificationError("备份格式不受支持。");
  }
  if (!manifest.appVersion || !Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) {
    throw new BackupVerificationError("备份版本信息无效。");
  }
  if (!Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new BackupVerificationError("备份创建时间无效。");
  }
  if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
    throw new BackupVerificationError("备份校验值格式无效。");
  }
  for (const [table, count] of Object.entries(manifest.recordCounts)) {
    if (!table || !Number.isInteger(count) || count < 0) {
      throw new BackupVerificationError("备份记录数摘要无效。");
    }
  }
}

export async function createBackupManifest(
  sqlSnapshot: string,
  input: BackupManifestInput,
): Promise<BackupManifest> {
  const manifest: BackupManifest = {
    formatVersion: 1,
    appVersion: input.appVersion,
    schemaVersion: input.schemaVersion,
    createdAt: input.createdAt,
    sqlFile: "snapshot.sql",
    sha256: await sha256Hex(sqlSnapshot),
    recordCounts: { ...input.recordCounts },
  };
  assertManifestShape(manifest);
  return manifest;
}

export async function verifyBackupManifest(
  sqlSnapshot: string,
  manifest: BackupManifest,
) {
  assertManifestShape(manifest);
  if ((await sha256Hex(sqlSnapshot)) !== manifest.sha256) {
    throw new BackupVerificationError("备份 SQL 校验值不匹配。");
  }
  return manifest;
}
