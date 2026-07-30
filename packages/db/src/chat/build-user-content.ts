import type { ContentPart } from "@maximus/domain";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../client.js";
import { attachments } from "../schema/index.js";
import type { ChatActor } from "./chat-turn-types.js";

/**
 * Build multimodal parts after assertChatTurnInput has validated content.
 * Does not re-validate empty input (contract already holds).
 */
export async function buildUserContentParts(
  db: Db,
  ctx: ChatActor,
  text: string,
  attachmentIds: string[],
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [];
  if (text) parts.push({ type: "text", text });
  if (attachmentIds.length) {
    const rows = await db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.orgId, ctx.orgId),
          inArray(attachments.id, attachmentIds),
        ),
      );
    for (const a of rows) {
      if (a.mime.startsWith("image/")) {
        parts.push({ type: "image", attachmentId: a.id, mime: a.mime });
      } else {
        parts.push({
          type: "file",
          attachmentId: a.id,
          mime: a.mime,
          filename: a.filename,
        });
      }
    }
  }
  return parts;
}
