import { and, desc, eq, isNull, sql } from "drizzle-orm";
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
  input: { orgId: string; userId: string; limit?: number },
) {
  return db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.orgId, input.orgId),
        eq(conversations.userId, input.userId),
        isNull(conversations.archivedAt),
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

export async function searchConversations(
  db: Db,
  input: { orgId: string; userId: string; query: string },
) {
  const q = `%${input.query}%`;
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
