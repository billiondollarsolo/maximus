import type { Db } from "@maximus/db";
import {
  overviewRepo,
  patchOverviewProbeSettings,
} from "@maximus/db";
import type { ProviderKind } from "@maximus/domain";
import {
  decryptSecret,
  testProviderConnection,
} from "@maximus/provider-gateway";
import type { OverviewEnv } from "./build-overview-snapshot";

export type ProbeRunnerDeps = {
  db: Db;
  orgId: string;
  env: OverviewEnv;
  /** Inject for tests — when provided, never hits network */
  testConnection?: typeof testProviderConnection;
  decrypt?: typeof decryptSecret;
};

/**
 * Run cheap connectivity probes for all enabled BYOK connections.
 * Persists results on credentials_meta.probe and updates lastRunAt.
 * Does not run completions.
 */
export async function runProviderProbes(
  deps: ProbeRunnerDeps,
): Promise<{ ran: number; results: Array<{ id: string; ok: boolean }> }> {
  const testFn = deps.testConnection ?? testProviderConnection;
  const decryptFn = deps.decrypt ?? decryptSecret;
  const connections = await overviewRepo.listEnabledConnectionsForProbe(
    deps.db,
    deps.orgId,
  );

  const checkedAt = new Date().toISOString();
  const results: Array<{ id: string; ok: boolean }> = [];

  for (const c of connections) {
    let apiKey: string | null = null;
    try {
      if (deps.env.encryptionKey) {
        apiKey = decryptFn(c.credentialsEncrypted, deps.env.encryptionKey);
      }
    } catch {
      await overviewRepo.setConnectionProbeResult(deps.db, {
        id: c.id,
        orgId: deps.orgId,
        probe: {
          ok: false,
          latencyMs: 0,
          errorCode: "DECRYPT_FAILED",
          checkedAt,
        },
      });
      results.push({ id: c.id, ok: false });
      continue;
    }

    const result = await testFn({
      kind: c.kind as ProviderKind,
      baseUrl: c.baseUrl,
      apiKey,
      allowPrivateBaseUrls: deps.env.allowPrivateBaseUrls,
    });

    await overviewRepo.setConnectionProbeResult(deps.db, {
      id: c.id,
      orgId: deps.orgId,
      probe: {
        ok: result.ok,
        latencyMs: result.latencyMs,
        errorCode: result.errorCode ?? null,
        checkedAt,
      },
    });
    results.push({ id: c.id, ok: result.ok });
  }

  await patchOverviewProbeSettings(deps.db, deps.orgId, {
    providerProbeLastRunAt: checkedAt,
  });

  return { ran: results.length, results };
}

/**
 * True when probes are enabled and interval has elapsed (or never run).
 */
export function probesAreDue(input: {
  enabled: boolean;
  intervalMinutes: number | null;
  lastRunAt: string | null;
  now?: Date;
}): boolean {
  if (!input.enabled) return false;
  const interval = input.intervalMinutes ?? 15;
  if (!input.lastRunAt) return true;
  const last = new Date(input.lastRunAt).getTime();
  if (!Number.isFinite(last)) return true;
  const now = (input.now ?? new Date()).getTime();
  return now - last >= interval * 60_000;
}
