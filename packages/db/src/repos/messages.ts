import { asc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { messages } from "../schema/index.js";
import { newId } from "../ids.js";

export async function insertMessage(
  db: Db,
  input: {
    conversationId: string;
    parentMessageId?: string | null;
    role: string;
    content: unknown[];
    status: string;
    modelRef?: string | null;
    position?: number;
  },
) {
  const id = newId("msg");
  const [row] = await db
    .insert(messages)
    .values({
      id,
      conversationId: input.conversationId,
      parentMessageId: input.parentMessageId ?? null,
      role: input.role,
      content: input.content,
      status: input.status,
      modelRef: input.modelRef ?? null,
      position: input.position ?? 0,
    })
    .returning();
  return row!;
}

export async function listMessagesForConversation(db: Db, conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(messages.position));
}

export async function updateMessage(
  db: Db,
  id: string,
  patch: Partial<{
    content: unknown[];
    status: string;
    tokenUsage: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
    modelRef: string | null;
  }>,
) {
  const [row] = await db
    .update(messages)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(messages.id, id))
    .returning();
  return row ?? null;
}

export async function getMessage(db: Db, id: string) {
  const [row] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  return row ?? null;
}
