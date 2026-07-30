import {
  deriveAttention,
  deriveDemoMode,
  deriveOverall,
  type ComponentStatus,
  type HealthComponent,
  type OverviewSnapshot,
} from "@maximus/domain";
import { getDb, overviewRepo, pingDb, type Db } from "@maximus/db";
import { createStorageClient } from "@maximus/storage";
import { serverEnv } from "#/server/env";

export type OverviewEnv = ReturnType<typeof serverEnv> & {
  appVersion?: string | null;
  gitSha?: string | null;
  nodeEnv?: string | null;
  overviewSseIntervalMs?: number;
};

function withVersion(env: ReturnType<typeof serverEnv>): OverviewEnv {
  return {
    ...env,
    appVersion: process.env.APP_VERSION ?? null,
    gitSha: process.env.GIT_SHA ?? null,
    nodeEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? null,
    overviewSseIntervalMs: Number(
      process.env.OVERVIEW_SSE_INTERVAL_MS ?? 5000,
    ),
  };
}

async function timedCheck(
  id: string,
  label: string,
  timeoutMs: number,
  fn: () => Promise<void>,
  mapError?: (err: unknown) => { status: ComponentStatus; detail: string },
): Promise<HealthComponent> {
  const checkedAt = new Date().toISOString();
  const started = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs),
      ),
    ]);
    return {
      id,
      label,
      status: "ok",
      latencyMs: Math.round(performance.now() - started),
      detail: null,
      checkedAt,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    if (mapError) {
      const mapped = mapError(err);
      return {
        id,
        label,
        status: mapped.status,
        latencyMs,
        detail: mapped.detail,
        checkedAt,
      };
    }
    const msg = err instanceof Error ? err.message : "check failed";
    return {
      id,
      label,
      status: "error",
      latencyMs,
      detail: msg === "timeout" ? "timeout" : "unreachable",
      checkedAt,
    };
  }
}

export async function checkPostgres(
  databaseUrl: string,
): Promise<HealthComponent> {
  return timedCheck("postgres", "Postgres", 2000, async () => {
    await pingDb(getDb(databaseUrl));
  });
}

export async function checkValkey(valkeyUrl: string): Promise<HealthComponent> {
  return timedCheck("valkey", "Valkey", 2000, async () => {
    const Redis = (await import("ioredis")).default;
    const r = new Redis(valkeyUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: 1500,
    });
    try {
      await r.connect();
      const pong = await r.ping();
      if (pong !== "PONG") throw new Error("bad pong");
    } finally {
      try {
        await r.quit();
      } catch {
        r.disconnect();
      }
    }
  });
}

export async function checkStorage(
  s3: ReturnType<typeof serverEnv>["s3"],
): Promise<HealthComponent> {
  return timedCheck("storage", "Object store", 3000, async () => {
    const storage = createStorageClient(s3);
    await storage.probeBucket();
  });
}

export type BuildOverviewInput = {
  db: Db;
  orgId: string;
  env?: OverviewEnv;
  /** Inject checks for tests */
  checks?: {
    postgres?: () => Promise<HealthComponent>;
    valkey?: () => Promise<HealthComponent>;
    storage?: () => Promise<HealthComponent>;
  };
  now?: Date;
};

/**
 * Deep admin overview snapshot. Never includes secrets or connection strings.
 */
export async function buildOverviewSnapshot(
  input: BuildOverviewInput,
): Promise<OverviewSnapshot> {
  const env = input.env ?? withVersion(serverEnv());
  const now = input.now ?? new Date();
  const checkedAt = now.toISOString();

  const appComponent: HealthComponent = {
    id: "app",
    label: "App",
    status: "ok",
    latencyMs: 0,
    detail: `uptime ${Math.floor(process.uptime())}s`,
    checkedAt,
  };

  const [postgres, valkey, storage, byok, allowlistRuleCount, probeBase, usage7d] =
    await Promise.all([
      input.checks?.postgres
        ? input.checks.postgres()
        : checkPostgres(env.databaseUrl),
      input.checks?.valkey
        ? input.checks.valkey()
        : checkValkey(env.valkeyUrl),
      input.checks?.storage
        ? input.checks.storage()
        : checkStorage(env.s3),
      overviewRepo.countByokConnections(input.db, input.orgId),
      overviewRepo.countAllowlistRules(input.db, input.orgId),
      overviewRepo.loadProbeSummaryBase(input.db, input.orgId),
      overviewRepo.aggregateUsage7d(input.db, input.orgId, now),
    ]);

  const components = [appComponent, postgres, valkey, storage];

  const platform = {
    openai: Boolean(env.openaiApiKey),
    anthropic: Boolean(env.anthropicApiKey),
    ollamaBaseUrl: Boolean(env.ollamaBaseUrl),
  };

  const { demoMode, demoReasons } = deriveDemoMode({
    providerMode: env.providerMode,
    platform,
    byokEnabledCount: byok.enabled,
  });

  const connectivity = {
    providerMode: env.providerMode,
    encryptionKeyConfigured: Boolean(env.encryptionKey),
    platform,
    byok,
    allowlistRuleCount,
    demoMode,
    demoReasons,
  };

  const probes = {
    enabled: probeBase.enabled,
    intervalMinutes: probeBase.intervalMinutes,
    lastRunAt: probeBase.lastRunAt,
    nextRunAt: probeBase.nextRunAt,
    results: probeBase.results,
  };

  const overall = deriveOverall({ components, demoMode });
  const attention = deriveAttention({ components, connectivity, probes });

  return {
    version: env.appVersion ?? null,
    gitSha: env.gitSha ?? null,
    environment: env.nodeEnv ?? null,
    overall,
    components,
    connectivity,
    probes,
    attention,
    usage7d,
    generatedAt: now.toISOString(),
  };
}

export function getOverviewEnv(): OverviewEnv {
  return withVersion(serverEnv());
}
