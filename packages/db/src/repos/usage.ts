import type { Db } from "../client.js";
import { usageEvents, auditEvents, modelPrices } from "../schema/index.js";
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

export async function findPrice(
  db: Db,
  input: { orgId: string; providerKind: string; modelId: string },
) {
  const rows = await db
    .select()
    .from(modelPrices)
    .where(
      and(
        eq(modelPrices.providerKind, input.providerKind),
        or(eq(modelPrices.orgId, input.orgId), isNull(modelPrices.orgId)),
      ),
    );
  // prefer org-specific, then pattern match
  const sorted = [...rows].sort((a, b) => {
    if (a.orgId && !b.orgId) return -1;
    if (!a.orgId && b.orgId) return 1;
    return 0;
  });
  for (const row of sorted) {
    if (row.modelIdPattern === "*" || input.modelId.includes(row.modelIdPattern)) {
      return row;
    }
  }
  return null;
}
