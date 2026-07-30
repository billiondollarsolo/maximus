import { and, eq, gte, sql } from "drizzle-orm";
import type {
  ProviderProbeResultRow,
  Usage7dStrip,
} from "@maximus/domain";
import type { Db } from "../client.js";
import {
  modelAllowlists,
  providerConnections,
  usageEvents,
} from "../schema/index.js";
import { getOverviewProbeSettings } from "./org-settings.js";

export type ByokCounts = {
  total: number;
  enabled: number;
  disabled: number;
};

export async function countByokConnections(
  db: Db,
  orgId: string,
): Promise<ByokCounts> {
  const rows = await db
    .select({
      isEnabled: providerConnections.isEnabled,
    })
    .from(providerConnections)
    .where(eq(providerConnections.orgId, orgId));
  let enabled = 0;
  let disabled = 0;
  for (const r of rows) {
    if (r.isEnabled) enabled += 1;
    else disabled += 1;
  }
  return { total: rows.length, enabled, disabled };
}

export async function countAllowlistRules(
  db: Db,
  orgId: string,
): Promise<number> {
  const rows = await db
    .select({ id: modelAllowlists.id })
    .from(modelAllowlists)
    .where(eq(modelAllowlists.orgId, orgId));
  return rows.length;
}

/** Read last probe results from credentials_meta.probe on each connection. */
export async function listProviderProbeResults(
  db: Db,
  orgId: string,
): Promise<ProviderProbeResultRow[]> {
  const rows = await db
    .select({
      id: providerConnections.id,
      name: providerConnections.name,
      kind: providerConnections.kind,
      isEnabled: providerConnections.isEnabled,
      credentialsMeta: providerConnections.credentialsMeta,
    })
    .from(providerConnections)
    .where(eq(providerConnections.orgId, orgId));

  return rows.map((r) => {
    const meta = (r.credentialsMeta ?? {}) as Record<string, unknown>;
    const probe = (meta.probe ?? null) as Record<string, unknown> | null;
    if (!probe || typeof probe !== "object") {
      return {
        connectionId: r.id,
        name: r.name,
        kind: r.kind,
        ok: null,
        latencyMs: null,
        errorCode: null,
        checkedAt: null,
      };
    }
    return {
      connectionId: r.id,
      name: r.name,
      kind: r.kind,
      ok: typeof probe.ok === "boolean" ? probe.ok : null,
      latencyMs:
        typeof probe.latencyMs === "number" ? probe.latencyMs : null,
      errorCode:
        typeof probe.errorCode === "string" ? probe.errorCode : null,
      checkedAt:
        typeof probe.checkedAt === "string" ? probe.checkedAt : null,
    };
  });
}

/**
 * Merge probe result into credentials_meta without wiping other meta fields.
 */
export async function setConnectionProbeResult(
  db: Db,
  input: {
    id: string;
    orgId: string;
    probe: {
      ok: boolean;
      latencyMs: number;
      errorCode?: string | null;
      checkedAt: string;
    };
  },
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.id, input.id),
        eq(providerConnections.orgId, input.orgId),
      ),
    )
    .limit(1);
  if (!existing) return false;
  const meta = {
    ...((existing.credentialsMeta ?? {}) as Record<string, unknown>),
    probe: {
      ok: input.probe.ok,
      latencyMs: input.probe.latencyMs,
      errorCode: input.probe.errorCode ?? null,
      checkedAt: input.probe.checkedAt,
    },
  };
  await db
    .update(providerConnections)
    .set({ credentialsMeta: meta, updatedAt: new Date() })
    .where(
      and(
        eq(providerConnections.id, input.id),
        eq(providerConnections.orgId, input.orgId),
      ),
    );
  return true;
}

export async function listEnabledConnectionsForProbe(
  db: Db,
  orgId: string,
) {
  return db
    .select({
      id: providerConnections.id,
      kind: providerConnections.kind,
      name: providerConnections.name,
      baseUrl: providerConnections.baseUrl,
      credentialsEncrypted: providerConnections.credentialsEncrypted,
      isEnabled: providerConnections.isEnabled,
    })
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.orgId, orgId),
        eq(providerConnections.isEnabled, true),
      ),
    );
}

/** Aggregate usage_events for the last 7 days (org-scoped). */
export async function aggregateUsage7d(
  db: Db,
  orgId: string,
  now = new Date(),
): Promise<Usage7dStrip> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      turns: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${usageEvents.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${usageEvents.outputTokens}), 0)::int`,
      costMicros: sql<number | null>`sum(${usageEvents.costMicros})`,
      errorTurns: sql<number>`coalesce(sum(case when ${usageEvents.status} = 'error' then 1 else 0 end), 0)::int`,
    })
    .from(usageEvents)
    .where(
      and(eq(usageEvents.orgId, orgId), gte(usageEvents.createdAt, since)),
    );

  const costRaw = row?.costMicros;
  const costMicros =
    costRaw == null || costRaw === undefined
      ? null
      : typeof costRaw === "number"
        ? costRaw
        : Number(costRaw);

  return {
    turns: Number(row?.turns ?? 0),
    inputTokens: Number(row?.inputTokens ?? 0),
    outputTokens: Number(row?.outputTokens ?? 0),
    costMicros: Number.isFinite(costMicros as number)
      ? (costMicros as number)
      : null,
    errorTurns: Number(row?.errorTurns ?? 0),
  };
}

export async function loadProbeSummaryBase(db: Db, orgId: string) {
  const settings = await getOverviewProbeSettings(db, orgId);
  const results = await listProviderProbeResults(db, orgId);
  const lastRunAt = settings.providerProbeLastRunAt;
  let nextRunAt: string | null = null;
  if (settings.providerProbeEnabled && lastRunAt) {
    const next = new Date(
      new Date(lastRunAt).getTime() +
        settings.providerProbeIntervalMinutes * 60_000,
    );
    nextRunAt = next.toISOString();
  } else if (settings.providerProbeEnabled && !lastRunAt) {
    nextRunAt = new Date().toISOString();
  }
  return {
    enabled: settings.providerProbeEnabled,
    intervalMinutes: settings.providerProbeEnabled
      ? settings.providerProbeIntervalMinutes
      : null,
    lastRunAt,
    nextRunAt,
    results,
    settings,
  };
}
