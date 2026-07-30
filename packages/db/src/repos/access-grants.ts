import { and, eq } from "drizzle-orm";
import {
  accessModeFromLegacyAllowlist,
  grantsFromLegacyAllowlist,
  parseAccessMode,
  type AccessGrant as DomainGrant,
  type AccessMode,
} from "@maximus/domain";
import { newId } from "../ids.js";
import type { Db } from "../client.js";
import { accessGrants, modelAllowlists } from "../schema/index.js";
import { getOrgSettings, patchOrgSettings } from "./org-settings.js";

export type AccessGrantRow = typeof accessGrants.$inferSelect;

export async function listAccessGrants(db: Db, orgId: string) {
  return db
    .select()
    .from(accessGrants)
    .where(eq(accessGrants.orgId, orgId));
}

export function toDomainGrants(rows: AccessGrantRow[]): DomainGrant[] {
  return rows.map((r) => ({
    resourceType: r.resourceType as "model" | "agent",
    resourceRef: r.resourceRef,
    subjectType: r.subjectType as DomainGrant["subjectType"],
    subjectId: r.subjectId,
    effect: "allow" as const,
  }));
}

export async function createAccessGrant(
  db: Db,
  input: {
    orgId: string;
    resourceType: "model" | "agent";
    resourceRef: string;
    subjectType: "org" | "role" | "team" | "user";
    subjectId?: string | null;
    createdBy?: string | null;
  },
) {
  const subjectId =
    input.subjectType === "org" ? null : (input.subjectId ?? null);
  if (input.subjectType !== "org" && !subjectId) {
    throw new Error("subjectId required for non-org subjects");
  }
  const [row] = await db
    .insert(accessGrants)
    .values({
      id: newId("grant"),
      orgId: input.orgId,
      resourceType: input.resourceType,
      resourceRef: input.resourceRef,
      subjectType: input.subjectType,
      subjectId,
      effect: "allow",
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row!;
}

export async function deleteAccessGrant(
  db: Db,
  input: { id: string; orgId: string },
) {
  const [row] = await db
    .delete(accessGrants)
    .where(
      and(eq(accessGrants.id, input.id), eq(accessGrants.orgId, input.orgId)),
    )
    .returning();
  return row ?? null;
}

export async function getOrgAccessMode(db: Db, orgId: string): Promise<AccessMode> {
  const settings = await getOrgSettings(db, orgId);
  return parseAccessMode(settings.accessMode);
}

export async function setOrgAccessMode(
  db: Db,
  orgId: string,
  accessMode: AccessMode,
) {
  return patchOrgSettings(db, orgId, { accessMode });
}

/**
 * One-shot / repair: copy legacy allowlist into grants if grants empty.
 * Sets accessMode=allowlist when legacy rows exist.
 */
export async function ensureAllowlistMigrated(db: Db, orgId: string) {
  const existing = await listAccessGrants(db, orgId);
  if (existing.length > 0) return { migrated: 0, accessMode: await getOrgAccessMode(db, orgId) };

  const legacy = await db
    .select()
    .from(modelAllowlists)
    .where(eq(modelAllowlists.orgId, orgId));

  const rules = legacy.map((r) => ({
    modelRef: r.modelRef,
    role: (r.role as "owner" | "admin" | "member" | null) ?? null,
  }));
  const mode = accessModeFromLegacyAllowlist(rules);
  const grants = grantsFromLegacyAllowlist(rules);

  for (const g of grants) {
    await createAccessGrant(db, {
      orgId,
      resourceType: g.resourceType,
      resourceRef: g.resourceRef,
      subjectType: g.subjectType,
      subjectId: g.subjectId,
    });
  }
  if (mode === "allowlist") {
    await setOrgAccessMode(db, orgId, "allowlist");
  }
  return { migrated: grants.length, accessMode: mode };
}

/** Load grants + mode for catalog filtering. */
export async function loadAccessForOrg(db: Db, orgId: string) {
  await ensureAllowlistMigrated(db, orgId);
  const rows = await listAccessGrants(db, orgId);
  const accessMode = await getOrgAccessMode(db, orgId);
  return { accessMode, grants: toDomainGrants(rows) };
}
