import { matchPriceRow } from "@maximus/domain";
import type { Db } from "../client.js";
import {
  usageEvents,
  auditEvents,
  modelPrices,
  models,
} from "../schema/index.js";
import { newId } from "../ids.js";
import { and, eq, isNull, or } from "drizzle-orm";

export async function insertUsageEvent(
  db: Db,
  input: {
    orgId: string;
    userId: string;
    conversationId?: string | null;
    messageId?: string | null;
    modelRef: string;
    providerKind: string;
    inputTokens: number;
    outputTokens: number;
    costMicros?: number | null;
    latencyMs?: number | null;
    status: string;
  },
) {
  const [row] = await db
    .insert(usageEvents)
    .values({
      id: newId("usage"),
      orgId: input.orgId,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      modelRef: input.modelRef,
      providerKind: input.providerKind,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costMicros: input.costMicros ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status,
    })
    .returning();
  return row!;
}

export async function insertAuditEvent(
  db: Db,
  input: {
    orgId?: string | null;
    actorUserId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const [row] = await db
    .insert(auditEvents)
    .values({
      id: newId("audit"),
      orgId: input.orgId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      meta: input.meta ?? {},
    })
    .returning();
  return row!;
}

export type ResolvedPrice = {
  inputUsdPer1m: number;
  outputUsdPer1m: number;
  source: "model" | "pattern";
};

/**
 * Prefer rates on the org model row (per offering / connection), then
 * fall back to model_prices pattern table (platform seeds + org overrides).
 */
export async function findPrice(
  db: Db,
  input: {
    orgId: string;
    providerKind: string;
    modelId: string;
    modelRef?: string | null;
  },
): Promise<ResolvedPrice | null> {
  if (input.modelRef) {
    const [m] = await db
      .select()
      .from(models)
      .where(
        and(eq(models.orgId, input.orgId), eq(models.modelRef, input.modelRef)),
      )
      .limit(1);
    if (
      m?.inputUsdPer1m != null &&
      m.outputUsdPer1m != null &&
      m.inputUsdPer1m !== "" &&
      m.outputUsdPer1m !== ""
    ) {
      return {
        inputUsdPer1m: Number(m.inputUsdPer1m),
        outputUsdPer1m: Number(m.outputUsdPer1m),
        source: "model",
      };
    }
  }

  const rows = await db
    .select()
    .from(modelPrices)
    .where(
      and(
        eq(modelPrices.providerKind, input.providerKind),
        or(eq(modelPrices.orgId, input.orgId), isNull(modelPrices.orgId)),
      ),
    );

  const matched = matchPriceRow(
    rows.map((r) => ({
      orgId: r.orgId,
      providerKind: r.providerKind,
      modelIdPattern: r.modelIdPattern,
      inputUsdPer1m: Number(r.inputUsdPer1m),
      outputUsdPer1m: Number(r.outputUsdPer1m),
    })),
    input,
  );
  if (!matched) return null;

  return {
    inputUsdPer1m: matched.inputUsdPer1m,
    outputUsdPer1m: matched.outputUsdPer1m,
    source: "pattern",
  };
}
