import path from "node:path";
import os from "node:os";
import { access, mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  DataDirectoryError,
  buildDataPaths,
  prepareDataDirectories,
  resolveDataDirectory,
  validateExistingDataPaths,
} from "../../lib/runtime/data-dir";
import {
  forceDemoRuntimeEnvironment,
  RuntimeModeError,
  resolveRuntimeConfig,
} from "../../lib/runtime/mode";
import {
  createConfiguredHealthResponse,
  createHealthResponse,
  loadRuntimeEnvironment,
} from "../../app/api/health/route";
import {
  buildD1WranglerArgs,
  createLocalD1PluginOptions,
  createRuntimeWranglerConfig,
} from "../../lib/runtime/local-d1";

const context = {
  localAppData: String.raw`C:\Users\Example\AppData\Local`,
  repoRoot: String.raw`C:\work\matrix-compass`,
  userHome: String.raw`C:\Users\Example`,
};

describe("local data directory", () => {
  it("defaults to a product-owned directory under LOCALAPPDATA", () => {
    expect(resolveDataDirectory({}, context)).toBe(
      path.resolve(context.localAppData, "MatrixCompass", "data"),
    );
  });

  it("accepts a dedicated absolute override including Unicode", () => {
    const configured = String.raw`D:\创作者经营数据\matrix-compass`;
    expect(
      resolveDataDirectory({ MATRIX_COMPASS_DATA_DIR: `  ${configured}  ` }, context),
    ).toBe(path.resolve(configured));
  });

  it("requires LOCALAPPDATA when no override is configured", () => {
    expect(() =>
      resolveDataDirectory({}, { ...context, localAppData: undefined }),
    ).toThrow("缺少 LOCALAPPDATA");
  });

  it.each([
    ["relative", String.raw`.\data`, "数据目录必须使用绝对路径。"],
    ["disk root", "C:\\", "数据目录不能是磁盘根目录。"],
    ["user home", context.userHome, "数据目录不能是用户主目录。"],
    ["repository", context.repoRoot, "数据目录必须与 Git 仓库分离。"],
    ["repository parent", String.raw`C:\work`, "数据目录必须与 Git 仓库分离。"],
    ["repository case variant", String.raw`C:\WORK\MATRIX-COMPASS\data`, "数据目录必须与 Git 仓库分离。"],
  ])("rejects an unsafe %s target", (_label, configured, message) => {
    try {
      resolveDataDirectory({ MATRIX_COMPASS_DATA_DIR: configured }, context);
      throw new Error("expected unsafe directory rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(DataDirectoryError);
      expect(error).toMatchObject({
        name: "DataDirectoryError",
        code: "UNSAFE_DATA_DIRECTORY",
        message,
      });
    }
  });

  it("builds isolated state, backup, import, and log paths", () => {
    const root = path.resolve(String.raw`D:\MatrixCompassData`);
    expect(buildDataPaths(root)).toEqual({
      root,
      d1State: path.join(root, ".wrangler", "state"),
      backups: path.join(root, "backups"),
      imports: path.join(root, "imports"),
      logs: path.join(root, "logs"),
      runtimeManifest: path.join(root, "runtime.json"),
    });
  });

  it("creates every product-owned directory before startup", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "matrix-compass-paths-"),
    );
    const root = path.join(temporaryRoot, "deep", "nested", "data");
    try {
      const paths = await prepareDataDirectories(root, {
        ...context,
        repoRoot: path.join(temporaryRoot, "repository"),
        userHome: path.join(temporaryRoot, "home"),
      });
      for (const directory of [
        paths.root,
        paths.d1State,
        paths.backups,
        paths.imports,
        paths.logs,
      ]) {
        expect((await stat(directory)).isDirectory()).toBe(true);
      }
      await expect(
        validateExistingDataPaths(root, {
          ...context,
          repoRoot: path.join(temporaryRoot, "repository"),
          userHome: path.join(temporaryRoot, "home"),
        }),
      ).resolves.toEqual(paths);
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });

  it("refuses a pre-existing state-directory junction before writing through it", async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "matrix-compass-junction-"),
    );
    const dataRoot = path.join(temporaryRoot, "data");
    const repository = path.join(temporaryRoot, "repository");
    await Promise.all([
      mkdir(dataRoot, { recursive: true }),
      mkdir(repository, { recursive: true }),
    ]);
    await symlink(
      repository,
      path.join(dataRoot, ".wrangler"),
      process.platform === "win32" ? "junction" : "dir",
    );

    try {
      await expect(
        validateExistingDataPaths(dataRoot, {
          localAppData: temporaryRoot,
          repoRoot: repository,
          userHome: path.join(temporaryRoot, "home"),
        }),
      ).rejects.toThrowError(DataDirectoryError);
      await expect(
        prepareDataDirectories(dataRoot, {
          localAppData: temporaryRoot,
          repoRoot: repository,
          userHome: path.join(temporaryRoot, "home"),
        }),
      ).rejects.toThrowError(DataDirectoryError);
      await expect(access(path.join(repository, "state"))).rejects.toThrow();
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});

describe("runtime mode", () => {
  it("forces public and demo commands closed against hostile inherited settings", () => {
    expect(
      forceDemoRuntimeEnvironment({
        MATRIX_COMPASS_MODE: "local",
        MATRIX_COMPASS_LAN: "true",
        UNRELATED: "preserved",
      }),
    ).toMatchObject({
      MATRIX_COMPASS_MODE: "demo",
      MATRIX_COMPASS_LAN: "false",
      UNRELATED: "preserved",
    });
  });

  it("uses local D1 on localhost during development", () => {
    expect(resolveRuntimeConfig({}, "development")).toEqual({
      mode: "local",
      dataSource: "local-d1",
      host: "127.0.0.1",
      lanEnabled: false,
      readOnly: false,
    });
  });

  it("keeps production preview isolated in demo mode", () => {
    expect(resolveRuntimeConfig({}, "production")).toEqual({
      mode: "demo",
      dataSource: "demo",
      host: "127.0.0.1",
      lanEnabled: false,
      readOnly: true,
    });
  });

  it("only binds to the LAN when explicitly enabled for local mode", () => {
    expect(
      resolveRuntimeConfig(
        { MATRIX_COMPASS_MODE: "local", MATRIX_COMPASS_LAN: "true" },
        "production",
      ),
    ).toMatchObject({ host: "0.0.0.0", lanEnabled: true, readOnly: false });
  });

  it.each([
    [{ MATRIX_COMPASS_MODE: "cloud" }, "production", "MATRIX_COMPASS_MODE 仅支持 local 或 demo。"],
    [
      { MATRIX_COMPASS_MODE: "demo", MATRIX_COMPASS_LAN: "true" },
      "production",
      "演示模式不能开启局域网访问。",
    ],
  ])("rejects invalid or unsafe runtime settings", (environment, nodeEnv, message) => {
    try {
      resolveRuntimeConfig(environment, nodeEnv);
      throw new Error("expected invalid runtime rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeModeError);
      expect(error).toMatchObject({
        name: "RuntimeModeError",
        code: "INVALID_RUNTIME_MODE",
        message,
      });
    }
  });
});

describe("health contract", () => {
  it("falls back only when Node cannot load the Cloudflare module scheme", async () => {
    const unsupportedScheme = Object.assign(new Error("unsupported scheme"), {
      code: "ERR_UNSUPPORTED_ESM_URL_SCHEME",
    });
    await expect(
      loadRuntimeEnvironment(
        async () => Promise.reject(unsupportedScheme),
        { MATRIX_COMPASS_MODE: "demo" },
      ),
    ).resolves.toEqual({ MATRIX_COMPASS_MODE: "demo" });

    await expect(
      loadRuntimeEnvironment(
        async () => Promise.reject(new Error("binding bootstrap failed")),
        { MATRIX_COMPASS_MODE: "demo" },
      ),
    ).rejects.toThrow("binding bootstrap failed");
  });

  it("uses the Worker runtime binding instead of the host process default", async () => {
    const response = await createConfiguredHealthResponse(
      async () => ({ MATRIX_COMPASS_MODE: "demo", MATRIX_COMPASS_LAN: "false" }),
      "development",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      mode: "demo",
      dataSource: "demo",
      readOnly: true,
    });
  });

  it("reports a verified local database without exposing its path", async () => {
    const response = await createHealthResponse(
      {
        mode: "local",
        dataSource: "local-d1",
        host: "127.0.0.1",
        lanEnabled: false,
        readOnly: false,
      },
      async () => ({ schemaVersion: 1 }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      app: "matrix-compass",
      version: "0.1.0",
      mode: "local",
      dataSource: "local-d1",
      schemaVersion: 1,
      readOnly: false,
    });
  });

  it("returns 503 when local persistence is unavailable", async () => {
    const response = await createHealthResponse(
      {
        mode: "local",
        dataSource: "local-d1",
        host: "127.0.0.1",
        lanEnabled: false,
        readOnly: false,
      },
      async () => {
        throw new Error("database unavailable at a secret path");
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "error",
      app: "matrix-compass",
      version: "0.1.0",
      mode: "local",
      dataSource: "local-d1",
      schemaVersion: null,
      readOnly: true,
      error: { code: "DATABASE_UNAVAILABLE" },
    });
  });
});

describe("local D1 command and binding configuration", () => {
  it("uses the same persistent state for Vite and Wrangler", () => {
    const paths = buildDataPaths(path.resolve(String.raw`D:\MatrixCompassData`));
    expect(createLocalD1PluginOptions(paths)).toEqual({
      persistState: { path: paths.d1State },
      database: {
        binding: "DB",
        database_name: "matrix-compass-local",
        database_id: "00000000-0000-4000-8000-000000000000",
      },
    });
    expect(buildD1WranglerArgs("migrate", paths, "wrangler.local.jsonc")).toEqual([
      "d1",
      "migrations",
      "apply",
      "matrix-compass-local",
      "--local",
      "--persist-to",
      paths.d1State,
      "--config",
      "wrangler.local.jsonc",
    ]);
  });

  it("builds an explicit local export command", () => {
    const paths = buildDataPaths(path.resolve(String.raw`D:\MatrixCompassData`));
    const output = path.join(paths.backups, "snapshot.sql");
    const runtimeConfig = path.join(paths.root, "wrangler.local.jsonc");
    expect(
      buildD1WranglerArgs("export", paths, runtimeConfig, output),
    ).toEqual([
      "d1",
      "export",
      "matrix-compass-local",
      "--local",
      "--config",
      runtimeConfig,
      "--skip-confirmation",
      "--output",
      output,
    ]);
  });

  it("creates a data-directory-local Wrangler config for export", () => {
    expect(createRuntimeWranglerConfig()).toEqual({
      name: "matrix-compass-local",
      compatibility_date: "2026-05-22",
      compatibility_flags: ["nodejs_compat"],
      d1_databases: [
        {
          binding: "DB",
          database_name: "matrix-compass-local",
          database_id: "00000000-0000-4000-8000-000000000000",
        },
      ],
    });
  });

  it("requires an output path for export", () => {
    const paths = buildDataPaths(path.resolve(String.raw`D:\MatrixCompassData`));
    expect(() =>
      buildD1WranglerArgs("export", paths, "wrangler.local.jsonc"),
    ).toThrow("D1 导出必须指定输出文件");
  });
});
