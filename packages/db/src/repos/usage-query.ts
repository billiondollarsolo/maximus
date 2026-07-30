import { and, desc, eq, gte, ilike } from "drizzle-orm";import type { Db } from "../client.js";
import { auditEvents, usageEvents, users } from "../schema/index.js";

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
  input: {
    orgId: string;
    limit?: number;
    action?: string;
    since?: Date;
  },
) {
  const clauses = [eq(auditEvents.orgId, input.orgId)];
  if (input.action?.trim()) {
    clauses.push(ilike(auditEvents.action, `%${input.action.trim()}%`));
  }
  if (input.since) clauses.push(gte(auditEvents.createdAt, input.since));

  const rows = await db
    .select({
      id: auditEvents.id,
      orgId: auditEvents.orgId,
      actorUserId: auditEvents.actorUserId,
      action: auditEvents.action,
      resourceType: auditEvents.resourceType,
      resourceId: auditEvents.resourceId,
      meta: auditEvents.meta,
      createdAt: auditEvents.createdAt,
      actorEmail: users.email,
      actorName: users.name,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .where(and(...clauses))
    .orderBy(desc(auditEvents.createdAt))
    .limit(input.limit ?? 100);

  return rows;
}
