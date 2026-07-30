import { eq } from "drizzle-orm";
import {
  clampProbeIntervalMinutes,
  DEFAULT_PROBE_INTERVAL_MINUTES,
} from "@maximus/domain";
import type { Db } from "../client.js";
import { organizationsExt } from "../schema/index.js";

/**
 * Read org-level rateLimitFailOpen (D16). Default fail-closed when unset.
 */
export async function getOrgRateLimitFailOpen(
  db: Db,
  orgId: string,
): Promise<boolean> {
  const settings = await getOrgSettings(db, orgId);
  return settings.rateLimitFailOpen === true;
}

export type OverviewProbeSettings = {
  providerProbeEnabled: boolean;
  providerProbeIntervalMinutes: number;
  /** ISO last automatic/manual probe batch run */
  providerProbeLastRunAt: string | null;
};

const DEFAULT_PROBE_SETTINGS: OverviewProbeSettings = {
  providerProbeEnabled: false,
  providerProbeIntervalMinutes: DEFAULT_PROBE_INTERVAL_MINUTES,
  providerProbeLastRunAt: null,
};

export async function getOrgSettings(
  db: Db,
  orgId: string,
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select()
    .from(organizationsExt)
    .where(eq(organizationsExt.orgId, orgId))
    .limit(1);
  if (!row) return {};
  return (row.settings ?? {}) as Record<string, unknown>;
}

/** Read overview probe settings; probes off by default. */
export async function getOverviewProbeSettings(
  db: Db,
  orgId: string,
): Promise<OverviewProbeSettings> {
  const settings = await getOrgSettings(db, orgId);
  const enabled = settings.providerProbeEnabled === true;
  const interval = clampProbeIntervalMinutes(
    settings.providerProbeIntervalMinutes ?? DEFAULT_PROBE_INTERVAL_MINUTES,
  );
  const last =
    typeof settings.providerProbeLastRunAt === "string"
      ? settings.providerProbeLastRunAt
      : null;
  return {
    providerProbeEnabled: enabled,
    providerProbeIntervalMinutes: interval,
    providerProbeLastRunAt: last,
  };
}

/**
 * Merge patch into org settings JSON.
 * Creates organizations_ext row if missing.
 */
export async function patchOrgSettings(
  db: Db,
  orgId: string,
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existing = await getOrgSettings(db, orgId);
  const next = { ...existing, ...patch };
  const [row] = await db
    .select({ orgId: organizationsExt.orgId })
    .from(organizationsExt)
    .where(eq(organizationsExt.orgId, orgId))
    .limit(1);
  if (!row) {
    await db.insert(organizationsExt).values({
      orgId,
      settings: next,
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(organizationsExt)
      .set({ settings: next, updatedAt: new Date() })
      .where(eq(organizationsExt.orgId, orgId));
  }
  return next;
}

export async function patchOverviewProbeSettings(
  db: Db,
  orgId: string,
  input: {
    providerProbeEnabled?: boolean;
    providerProbeIntervalMinutes?: number;
    providerProbeLastRunAt?: string | null;
  },
): Promise<OverviewProbeSettings> {
  const patch: Record<string, unknown> = {};
  if (input.providerProbeEnabled !== undefined) {
    patch.providerProbeEnabled = Boolean(input.providerProbeEnabled);
  }
  if (input.providerProbeIntervalMinutes !== undefined) {
    patch.providerProbeIntervalMinutes = clampProbeIntervalMinutes(
      input.providerProbeIntervalMinutes,
    );
  }
  if (input.providerProbeLastRunAt !== undefined) {
    patch.providerProbeLastRunAt = input.providerProbeLastRunAt;
  }
  await patchOrgSettings(db, orgId, patch);
  return getOverviewProbeSettings(db, orgId);
}

export { DEFAULT_PROBE_SETTINGS };
