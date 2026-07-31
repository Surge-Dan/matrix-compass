import vinext from "vinext";
import { defineConfig } from "vite";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { sites } from "./build/sites-vite-plugin.ts";
import { buildDataPaths, resolveDataDirectory } from "./lib/runtime/data-dir.ts";
import { createLocalD1PluginOptions } from "./lib/runtime/local-d1.ts";
import { resolveRuntimeConfig } from "./lib/runtime/mode.ts";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
  const runtime = resolveRuntimeConfig(process.env, process.env.NODE_ENV);
  const localD1 =
    runtime.mode === "local"
      ? createLocalD1PluginOptions(
          buildDataPaths(
            resolveDataDirectory(process.env, {
              localAppData: process.env.LOCALAPPDATA,
              repoRoot: repositoryRoot,
              userHome: homedir(),
            }),
          ),
        )
      : null;

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: runtime.host,
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        ...(localD1 ? { persistState: localD1.persistState } : {}),
        config: {
          ...localBindingConfig,
          vars: {
            MATRIX_COMPASS_MODE: runtime.mode,
            MATRIX_COMPASS_LAN: String(runtime.lanEnabled),
          },
          d1_databases: localD1
            ? [localD1.database]
            : localBindingConfig.d1_databases,
        },
      }),
    ],
  };
});
