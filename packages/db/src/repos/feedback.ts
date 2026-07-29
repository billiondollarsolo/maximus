import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { messageFeedback } from "../schema/index.js";
import { newId } from "../ids.js";

export async function upsertFeedback(
  db: Db,
  input: { messageId: string; userId: string; rating: "up" | "down" },
) {
  const existing = await db
    .select()
    .from(messageFeedback)
    .where(
      and(
        eq(messageFeedback.messageId, input.messageId),
        eq(messageFeedback.userId, input.userId),
      ),
    )
    .limit(1);
  if (existing[0]) {
    const [row] = await db
      .update(messageFeedback)
      .set({ rating: input.rating })
      .where(eq(messageFeedback.id, existing[0].id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(messageFeedback)
    .values({
      id: newId("fb"),
      messageId: input.messageId,
      userId: input.userId,
      rating: input.rating,
    })
    .returning();
  return row!;
}
