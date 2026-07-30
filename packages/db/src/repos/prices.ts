import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "../client.js";
import { modelPrices } from "../schema/index.js";
import { newId } from "../ids.js";

export async function listPrices(db: Db, orgId: string) {
  return db
    .select()
    .from(modelPrices)
    .where(or(eq(modelPrices.orgId, orgId), isNull(modelPrices.orgId)));
}

export async function createOrgPrice(
  db: Db,
  input: {
    orgId: string;
    providerKind: string;
    modelIdPattern: string;
    inputUsdPer1m: number;
    outputUsdPer1m: number;
  },
) {
  const [row] = await db
    .insert(modelPrices)
    .values({
      id: newId("price"),
      orgId: input.orgId,
      providerKind: input.providerKind,
      modelIdPattern: input.modelIdPattern,
      inputUsdPer1m: String(input.inputUsdPer1m),
      outputUsdPer1m: String(input.outputUsdPer1m),
      currency: "USD",
    })
    .returning();
  return row!;
}

export async function updateOrgPrice(
  db: Db,
  input: {
    id: string;
    orgId: string;
    modelIdPattern?: string;
    inputUsdPer1m?: number;
    outputUsdPer1m?: number;
  },
) {
  const existing = await getOrgPrice(db, input.orgId, input.id);
  if (!existing) return null;

  const patch: {
    modelIdPattern?: string;
    inputUsdPer1m?: string;
    outputUsdPer1m?: string;
  } = {};
  if (input.modelIdPattern !== undefined) {
    patch.modelIdPattern = input.modelIdPattern;
  }
  if (input.inputUsdPer1m !== undefined) {
    patch.inputUsdPer1m = String(input.inputUsdPer1m);
  }
  if (input.outputUsdPer1m !== undefined) {
    patch.outputUsdPer1m = String(input.outputUsdPer1m);
  }

  const [row] = await db
    .update(modelPrices)
    .set(patch)
    .where(
      and(eq(modelPrices.id, input.id), eq(modelPrices.orgId, input.orgId)),
    )
    .returning();
  return row ?? null;
}

export async function getOrgPrice(db: Db, orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(modelPrices)
    .where(and(eq(modelPrices.id, id), eq(modelPrices.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export async function deleteOrgPrice(
  db: Db,
  input: { id: string; orgId: string },
) {
  const [row] = await db
    .delete(modelPrices)
    .where(
      and(eq(modelPrices.id, input.id), eq(modelPrices.orgId, input.orgId)),
    )
    .returning();
  return row ?? null;
}

/** Reject deletes of platform seed rows (org_id null). */
export async function getPriceById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(modelPrices)
    .where(eq(modelPrices.id, id))
    .limit(1);
  return row ?? null;
}
