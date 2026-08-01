import type { RuntimeConfig } from "../runtime/mode";
import type { DatabaseClient } from "../repositories/database";
import { createAccountRepository } from "../repositories/accounts";
import { createContentRepository } from "../repositories/contents";

export const BOOTSTRAP_ACTIONS = [
  "connect-feishu",
  "import-file",
  "create-manually",
] as const;

export interface BootstrapMetrics {
  revenueMinor: number;
  settledMinor: number;
  pendingMinor: number;
}

export interface BootstrapData {
  mode: RuntimeConfig["mode"];
  source: RuntimeConfig["dataSource"];
  readOnly: boolean;
  needsOnboarding: boolean;
  counts: { accounts: number; contents: number };
  metrics: BootstrapMetrics | null;
  actions: Array<(typeof BOOTSTRAP_ACTIONS)[number]>;
}

export interface DemoBootstrapPayload {
  counts: BootstrapData["counts"];
  metrics: BootstrapMetrics;
}

export type DemoBootstrapProvider = () => DemoBootstrapPayload;

function defaultDemoProvider(): DemoBootstrapPayload {
  return {
    counts: { accounts: 6, contents: 139 },
    metrics: {
      revenueMinor: 243_000,
      settledMinor: 221_000,
      pendingMinor: 22_000,
    },
  };
}

export async function getBootstrapData({
  runtime,
  database,
  demoProvider = defaultDemoProvider,
}: {
  runtime: RuntimeConfig;
  database?: DatabaseClient;
  demoProvider?: DemoBootstrapProvider;
}): Promise<BootstrapData> {
  if (runtime.mode === "demo") {
    const demo = demoProvider();
    return {
      mode: runtime.mode,
      source: runtime.dataSource,
      readOnly: true,
      needsOnboarding: false,
      counts: demo.counts,
      metrics: demo.metrics,
      actions: [],
    };
  }

  if (!database) throw new Error("Local database binding is unavailable");
  const accounts = createAccountRepository(database);
  const contents = createContentRepository(database);
  const [accountCount, contentCount] = await Promise.all([
    accounts.count(),
    contents.count(),
  ]);
  return {
    mode: runtime.mode,
    source: runtime.dataSource,
    readOnly: runtime.readOnly,
    needsOnboarding: accountCount === 0 && contentCount === 0,
    counts: { accounts: accountCount, contents: contentCount },
    metrics: null,
    actions: [...BOOTSTRAP_ACTIONS],
  };
}
