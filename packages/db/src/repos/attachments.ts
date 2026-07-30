import { and, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { attachments } from "../schema/index.js";
import { newId } from "../ids.js";

export async function getAttachmentForOrg(
  db: Db,
  orgId: string,
  id: string,
) {
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

export async function createAttachment(
  db: Db,
  input: {
    id?: string;
    orgId: string;
    uploaderUserId: string;
    storageKey: string;
    filename: string;
    mime: string;
    sizeBytes: number;
    messageId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const id = input.id ?? newId("att");
  const [row] = await db
    .insert(attachments)
    .values({
      id,
      orgId: input.orgId,
      uploaderUserId: input.uploaderUserId,
      storageKey: input.storageKey,
      filename: input.filename,
      mime: input.mime,
      sizeBytes: input.sizeBytes,
      messageId: input.messageId ?? null,
      meta: input.meta ?? {},
    })
    .returning();
  return row!;
}

export async function listAttachmentsByIds(
  db: Db,
  orgId: string,
  ids: string[],
) {
  if (!ids.length) return [];
  const rows = await db.select().from(attachments);
  return rows.filter((r) => r.orgId === orgId && ids.includes(r.id));
}
