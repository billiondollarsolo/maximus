import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { Db } from "../client.js";
import {
  modelAllowlists,
  models,
  providerConnections,
} from "../schema/index.js";
import { newId } from "../ids.js";

export async function createProviderConnection(
  db: Db,
  input: {
    orgId: string;
    kind: string;
    name: string;
    baseUrl?: string | null;
    credentialsEncrypted: string;
    /** When false, UI shows secrets as empty (e.g. Ollama). Default true. */
    hasSecret?: boolean;
    createdBy?: string | null;
  },
) {
  const [row] = await db
    .insert(providerConnections)
    .values({
      id: newId("conn"),
      orgId: input.orgId,
      kind: input.kind,
      name: input.name,
      baseUrl: input.baseUrl ?? null,
      credentialsEncrypted: input.credentialsEncrypted,
      credentialsMeta: {
        kms: "local",
        v: 1,
        hasSecret: input.hasSecret ?? true,
      },
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return row!;
}

export async function getProviderConnection(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.id, id))
    .limit(1);
  return row ?? null;
}

export async function getProviderConnectionForOrg(
  db: Db,
  orgId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.id, id),
        eq(providerConnections.orgId, orgId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listProviderConnections(db: Db, orgId: string) {
  return db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.orgId, orgId));
}

export async function updateProviderConnection(
  db: Db,
  input: {
    id: string;
    orgId: string;
    name?: string;
    baseUrl?: string | null;
    isEnabled?: boolean;
  },
) {
  const patch: {
    name?: string;
    baseUrl?: string | null;
    isEnabled?: boolean;
    updatedAt: Date;
  } = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl;
  if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;

  const [row] = await db
    .update(providerConnections)
    .set(patch)
    .where(
      and(
        eq(providerConnections.id, input.id),
        eq(providerConnections.orgId, input.orgId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function rotateProviderCredentials(
  db: Db,
  input: {
    id: string;
    orgId: string;
    credentialsEncrypted: string;
    hasSecret?: boolean;
  },
) {
  const [row] = await db
    .update(providerConnections)
    .set({
      credentialsEncrypted: input.credentialsEncrypted,
      credentialsMeta: {
        kms: "local",
        v: 1,
        hasSecret: input.hasSecret ?? true,
        rotatedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(providerConnections.id, input.id),
        eq(providerConnections.orgId, input.orgId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function countModelsForConnection(db: Db, connectionId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(models)
    .where(eq(models.connectionId, connectionId));
  return Number(row?.n ?? 0);
}

/**
 * Hard-delete connection. Caller must ensure no models reference it
 * (or accept ON DELETE SET NULL). Plan: block when model count > 0.
 */
export async function deleteProviderConnection(
  db: Db,
  input: { id: string; orgId: string },
) {
  const n = await countModelsForConnection(db, input.id);
  if (n > 0) {
    return { ok: false as const, reason: "models_exist" as const, modelCount: n };
  }
  const deleted = await db
    .delete(providerConnections)
    .where(
      and(
        eq(providerConnections.id, input.id),
        eq(providerConnections.orgId, input.orgId),
      ),
    )
    .returning();
  if (!deleted[0]) {
    return { ok: false as const, reason: "not_found" as const, modelCount: 0 };
  }
  return { ok: true as const, row: deleted[0] };
}

export async function listAllowlist(db: Db, orgId: string) {
  return db
    .select()
    .from(modelAllowlists)
    .where(eq(modelAllowlists.orgId, orgId));
}

/**
 * True upsert: (orgId, modelRef, role) unique including role=null.
 * PG UNIQUE treats NULLs as distinct, so we match role with IS NULL explicitly.
 */
export async function upsertAllowlist(
  db: Db,
  input: { orgId: string; modelRef: string; role?: string | null },
) {
  const role = input.role ?? null;
  const existing = await db
    .select()
    .from(modelAllowlists)
    .where(
      and(
        eq(modelAllowlists.orgId, input.orgId),
        eq(modelAllowlists.modelRef, input.modelRef),
        role === null
          ? isNull(modelAllowlists.role)
          : eq(modelAllowlists.role, role),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const [row] = await db
    .insert(modelAllowlists)
    .values({
      id: newId("al"),
      orgId: input.orgId,
      modelRef: input.modelRef,
      role,
    })
    .returning();
  return row!;
}

export async function deleteAllowlist(
  db: Db,
  input: { id: string; orgId: string },
) {
  const [row] = await db
    .delete(modelAllowlists)
    .where(
      and(
        eq(modelAllowlists.id, input.id),
        eq(modelAllowlists.orgId, input.orgId),
      ),
    )
    .returning();
  return row ?? null;
}

export async function listModels(db: Db, orgId: string) {
  return db
    .select()
    .from(models)
    .where(eq(models.orgId, orgId))
    .orderBy(asc(models.sortOrder), asc(models.displayName));
}

export async function listModelsForConnection(db: Db, connectionId: string) {
  return db
    .select()
    .from(models)
    .where(eq(models.connectionId, connectionId))
    .orderBy(asc(models.sortOrder), asc(models.displayName));
}

export async function getModelForOrg(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(models)
    .where(and(eq(models.id, id), eq(models.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export async function getModelByRef(db: Db, orgId: string, modelRef: string) {
  const [row] = await db
    .select()
    .from(models)
    .where(and(eq(models.orgId, orgId), eq(models.modelRef, modelRef)))
    .limit(1);
  return row ?? null;
}

/**
 * Idempotent bulk create of models on a connection (import_tags core).
 * Skips when modelRef already exists for the org.
 */
export async function importModelsOnConnection(
  db: Db,
  input: {
    orgId: string;
    connectionId: string;
    providerKind: string;
    items: Array<{
      modelId: string;
      displayName: string;
      capabilities?: Record<string, unknown>;
      isEnabled?: boolean;
      isVisible?: boolean;
      inputUsdPer1m?: number | null;
      outputUsdPer1m?: number | null;
      sortOrder?: number;
    }>;
  },
): Promise<{ created: number; skipped: number; modelRefs: string[] }> {
  let created = 0;
  let skipped = 0;
  const modelRefs: string[] = [];
  for (const item of input.items) {
    const modelId = item.modelId.trim();
    if (!modelId) continue;
    const modelRef = `${input.providerKind}:${input.connectionId}:${modelId}`;
    const already = await getModelByRef(db, input.orgId, modelRef);
    if (already) {
      skipped += 1;
      modelRefs.push(modelRef);
      continue;
    }
    await createModel(db, {
      orgId: input.orgId,
      connectionId: input.connectionId,
      providerKind: input.providerKind,
      modelId,
      displayName: item.displayName || modelId,
      modelRef,
      capabilities: item.capabilities,
      isEnabled: item.isEnabled,
      isVisible: item.isVisible,
      inputUsdPer1m: item.inputUsdPer1m,
      outputUsdPer1m: item.outputUsdPer1m,
      sortOrder: item.sortOrder,
    });
    created += 1;
    modelRefs.push(modelRef);
  }
  return { created, skipped, modelRefs };
}

export async function createModel(
  db: Db,
  input: {
    orgId: string | null;
    connectionId?: string | null;
    providerKind: string;
    modelId: string;
    displayName: string;
    modelRef: string;
    capabilities?: Record<string, unknown>;
    sortOrder?: number;
    isEnabled?: boolean;
    isVisible?: boolean;
    inputUsdPer1m?: number | null;
    outputUsdPer1m?: number | null;
  },
) {
  const [row] = await db
    .insert(models)
    .values({
      id: newId("model"),
      orgId: input.orgId,
      connectionId: input.connectionId ?? null,
      providerKind: input.providerKind,
      modelId: input.modelId,
      displayName: input.displayName,
      modelRef: input.modelRef,
      capabilities: input.capabilities ?? { streaming: true },
      sortOrder: input.sortOrder ?? 0,
      isEnabled: input.isEnabled ?? true,
      isVisible: input.isVisible ?? true,
      inputUsdPer1m:
        input.inputUsdPer1m == null ? null : String(input.inputUsdPer1m),
      outputUsdPer1m:
        input.outputUsdPer1m == null ? null : String(input.outputUsdPer1m),
    })
    .returning();
  return row!;
}

/**
 * Merge keys into an offering's capabilities JSON (later keys win).
 * Used to persist learned provider quirks (e.g. max_completion_tokens).
 */
export async function mergeModelCapabilitiesByRef(
  db: Db,
  input: {
    orgId: string;
    modelRef: string;
    patch: Record<string, unknown>;
  },
) {
  const row = await getModelByRef(db, input.orgId, input.modelRef);
  if (!row) return null;
  const prev =
    row.capabilities && typeof row.capabilities === "object"
      ? (row.capabilities as Record<string, unknown>)
      : {};
  return updateModel(db, {
    id: row.id,
    orgId: input.orgId,
    capabilities: { ...prev, ...input.patch },
  });
}

export async function updateModel(
  db: Db,
  input: {
    id: string;
    orgId: string;
    displayName?: string;
    capabilities?: Record<string, unknown>;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
    inputUsdPer1m?: number | null;
    outputUsdPer1m?: number | null;
  },
) {
  const patch: {
    displayName?: string;
    capabilities?: Record<string, unknown>;
    isEnabled?: boolean;
    isVisible?: boolean;
    sortOrder?: number;
    inputUsdPer1m?: string | null;
    outputUsdPer1m?: string | null;
  } = {};
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.capabilities !== undefined) patch.capabilities = input.capabilities;
  if (input.isEnabled !== undefined) patch.isEnabled = input.isEnabled;
  if (input.isVisible !== undefined) patch.isVisible = input.isVisible;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.inputUsdPer1m !== undefined) {
    patch.inputUsdPer1m =
      input.inputUsdPer1m == null ? null : String(input.inputUsdPer1m);
  }
  if (input.outputUsdPer1m !== undefined) {
    patch.outputUsdPer1m =
      input.outputUsdPer1m == null ? null : String(input.outputUsdPer1m);
  }

  const [row] = await db
    .update(models)
    .set(patch)
    .where(and(eq(models.id, input.id), eq(models.orgId, input.orgId)))
    .returning();
  return row ?? null;
}

export async function deleteModel(
  db: Db,
  input: { id: string; orgId: string },
) {
  const [row] = await db
    .delete(models)
    .where(and(eq(models.id, input.id), eq(models.orgId, input.orgId)))
    .returning();
  return row ?? null;
}
