import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "../client.js";
import { auditEvents, usageEvents } from "../schema/index.js";

export async function listUsage(
  db: Db,
  input: { orgId: string; since?: Date; limit?: number },
) {
  const clauses = [eq(usageEvents.orgId, input.orgId)];
  if (input.since) clauses.push(gte(usageEvents.createdAt, input.since));
  return db
    .select()
    .from(usageEvents)
    .where(and(...clauses))
    .orderBy(desc(usageEvents.createdAt))
    .limit(input.limit ?? 100);
}

export async function listAudit(
  db: Db,
  input: { orgId: string; limit?: number },
) {
  return db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.orgId, input.orgId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(input.limit ?? 100);
}
