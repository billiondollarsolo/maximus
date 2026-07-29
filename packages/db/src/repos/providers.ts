import { and, eq } from "drizzle-orm";
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
      credentialsMeta: { kms: "local", v: 1 },
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

export async function listProviderConnections(db: Db, orgId: string) {
  return db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.orgId, orgId));
}

export async function listAllowlist(db: Db, orgId: string) {
  return db
    .select()
    .from(modelAllowlists)
    .where(eq(modelAllowlists.orgId, orgId));
}

export async function upsertAllowlist(
  db: Db,
  input: { orgId: string; modelRef: string; role?: string | null },
) {
  const [row] = await db
    .insert(modelAllowlists)
    .values({
      id: newId("al"),
      orgId: input.orgId,
      modelRef: input.modelRef,
      role: input.role ?? null,
    })
    .returning();
  return row!;
}

export async function listModels(db: Db, orgId: string) {
  return db
    .select()
    .from(models)
    .where(and(eq(models.orgId, orgId)));
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
    })
    .returning();
  return row!;
}
