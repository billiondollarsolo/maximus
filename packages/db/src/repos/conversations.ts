import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "../client.js";
import { conversations, messages } from "../schema/index.js";
import { newId } from "../ids.js";

export async function createConversation(
  db: Db,
  input: {
    orgId: string;
    userId: string;
    modelRef?: string | null;
    projectId?: string | null;
    title?: string | null;
    titleSource?: string | null;
  },
) {
  const id = newId("conv");
  const [row] = await db
    .insert(conversations)
    .values({
      id,
      orgId: input.orgId,
      userId: input.userId,
      modelRef: input.modelRef ?? null,
      projectId: input.projectId ?? null,
      title: input.title ?? null,
      titleSource: input.titleSource ?? null,
    })
    .returning();
  return row!;
}

export async function getConversation(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return row ?? null;
}

export async function listConversations(
  db: Db,
  input: {
    orgId: string;
    userId: string;
    limit?: number;
    /** default active (not archived); `archived` = only archived */
    scope?: "active" | "archived" | "all";
    projectId?: string | null;
  },
) {
  const scope = input.scope ?? "active";
  const archiveClause =
    scope === "archived"
      ? isNotNull(conversations.archivedAt)
      : scope === "all"
        ? undefined
        : isNull(conversations.archivedAt);

  const projectClause =
    input.projectId === undefined
      ? undefined
      : input.projectId === null
        ? isNull(conversations.projectId)
        : eq(conversations.projectId, input.projectId);

  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, input.orgId),
        eq(conversations.userId, input.userId),
        archiveClause,
        projectClause,
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(input.limit ?? 50);
}

export async function updateConversation(
  db: Db,
  id: string,
  patch: Partial<{
    title: string | null;
    titleSource: string | null;
    modelRef: string | null;
    activeLeafId: string | null;
    projectId: string | null;
    archivedAt: Date | null;
  }>,
) {
  const [row] = await db
    .update(conversations)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return row ?? null;
}

export async function deleteConversation(db: Db, id: string) {
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(eq(conversations.id, id));
}

/** Hard-delete many conversations owned by a user (org-scoped). */
export async function deleteConversationsForUser(
  db: Db,
  input: {
    orgId: string;
    userId: string;
    /** When set, only these ids (still ownership-checked). */
    ids?: string[];
    /** When true, only archived rows. Ignored if ids provided. */
    archivedOnly?: boolean;
  },
): Promise<{ deleted: number }> {
  const clauses = [
    eq(conversations.orgId, input.orgId),
    eq(conversations.userId, input.userId),
  ];
  if (input.ids?.length) {
    clauses.push(inArray(conversations.id, input.ids));
  } else if (input.archivedOnly) {
    clauses.push(isNotNull(conversations.archivedAt));
  }

  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(...clauses));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { deleted: 0 };

  await db.delete(messages).where(inArray(messages.conversationId, ids));
  await db.delete(conversations).where(inArray(conversations.id, ids));
  return { deleted: ids.length };
}

export async function searchConversations(
  db: Db,
  input: { orgId: string; userId: string; query: string },
) {
  const q = `%${input.query.trim()}%`;
  if (!input.query.trim()) {
    return listConversations(db, {
      orgId: input.orgId,
      userId: input.userId,
    });
  }
  // Title match first (v1). Message-body full-text is WP41 follow-on.
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, input.orgId),
        eq(conversations.userId, input.userId),
        isNull(conversations.archivedAt),
        sql`${conversations.title} ILIKE ${q}`,
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
}
