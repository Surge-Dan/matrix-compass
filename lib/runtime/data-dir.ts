import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";

export interface DataDirectoryContext {
  localAppData: string | undefined;
  repoRoot: string;
  userHome: string | undefined;
}

export interface DataPaths {
  root: string;
  d1State: string;
  backups: string;
  imports: string;
  logs: string;
  runtimeManifest: string;
}

export class DataDirectoryError extends Error {
  readonly code = "UNSAFE_DATA_DIRECTORY";

  constructor(message: string) {
    super(message);
    this.name = "DataDirectoryError";
  }
}

function normalizedForComparison(value: string) {
  return path.resolve(value).replace(/[\\/]+$/, "").toLocaleLowerCase("en-US");
}

function containsPath(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function canonicalTargetBeforeCreation(candidate: string) {
  let existing = path.resolve(candidate);
  const missingSegments: string[] = [];
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    missingSegments.push(path.basename(existing));
    existing = parent;
  }
  const canonicalAncestor = await realpath(existing);
  return path.resolve(canonicalAncestor, ...missingSegments.reverse());
}

function assertOwnedSubdirectory(safeRoot: string, candidate: string) {
  if (!containsPath(safeRoot, candidate)) {
    throw new DataDirectoryError("数据目录子路径不能通过链接逃逸安全目录。");
  }
}

async function prepareOwnedSubdirectory(directory: string, safeRoot: string) {
  const canonicalTarget = await canonicalTargetBeforeCreation(directory);
  assertOwnedSubdirectory(safeRoot, canonicalTarget);
  await mkdir(directory, { recursive: true });
  const canonicalDirectory = await realpath(directory);
  assertOwnedSubdirectory(safeRoot, canonicalDirectory);
}

function assertDedicatedDirectory(candidate: string, context: DataDirectoryContext) {
  if (!path.isAbsolute(candidate)) {
    throw new DataDirectoryError("数据目录必须使用绝对路径。");
  }

  const resolved = path.resolve(candidate);
  const normalized = normalizedForComparison(resolved);
  const root = normalizedForComparison(path.parse(resolved).root);
  if (normalized === root) {
    throw new DataDirectoryError("数据目录不能是磁盘根目录。");
  }

  if (
    context.userHome &&
    normalized === normalizedForComparison(context.userHome)
  ) {
    throw new DataDirectoryError("数据目录不能是用户主目录。");
  }

  const repository = path.resolve(context.repoRoot);
  if (containsPath(resolved, repository) || containsPath(repository, resolved)) {
    throw new DataDirectoryError("数据目录必须与 Git 仓库分离。");
  }
}

export function resolveDataDirectory(
  environment: Record<string, string | undefined>,
  context: DataDirectoryContext,
) {
  const configured = environment.MATRIX_COMPASS_DATA_DIR?.trim();
  const candidate = configured
    ? configured
    : context.localAppData
      ? path.join(context.localAppData, "MatrixCompass", "data")
      : undefined;

  if (!candidate) {
    throw new DataDirectoryError(
      "无法确定本地数据目录：缺少 LOCALAPPDATA，请设置 MATRIX_COMPASS_DATA_DIR。",
    );
  }

  assertDedicatedDirectory(candidate, context);
  return path.resolve(candidate);
}

export function buildDataPaths(root: string): DataPaths {
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    d1State: path.join(resolvedRoot, ".wrangler", "state"),
    backups: path.join(resolvedRoot, "backups"),
    imports: path.join(resolvedRoot, "imports"),
    logs: path.join(resolvedRoot, "logs"),
    runtimeManifest: path.join(resolvedRoot, "runtime.json"),
  };
}

export async function prepareDataDirectories(
  root: string,
  context: DataDirectoryContext,
) {
  assertDedicatedDirectory(root, context);
  const canonicalTarget = await canonicalTargetBeforeCreation(root);
  assertDedicatedDirectory(canonicalTarget, context);
  await mkdir(root, { recursive: true });
  const resolvedRoot = await realpath(root);
  assertDedicatedDirectory(resolvedRoot, context);

  const paths = buildDataPaths(resolvedRoot);
  await prepareOwnedSubdirectory(path.dirname(paths.d1State), resolvedRoot);
  await Promise.all([
    prepareOwnedSubdirectory(paths.d1State, resolvedRoot),
    prepareOwnedSubdirectory(paths.backups, resolvedRoot),
    prepareOwnedSubdirectory(paths.imports, resolvedRoot),
    prepareOwnedSubdirectory(paths.logs, resolvedRoot),
  ]);
  return paths;
}

export async function validateExistingDataPaths(
  root: string,
  context: DataDirectoryContext,
) {
  assertDedicatedDirectory(root, context);
  const resolvedRoot = await realpath(root);
  assertDedicatedDirectory(resolvedRoot, context);
  const paths = buildDataPaths(resolvedRoot);
  for (const directory of [path.dirname(paths.d1State), paths.d1State]) {
    assertOwnedSubdirectory(resolvedRoot, await realpath(directory));
  }
  return paths;
}
