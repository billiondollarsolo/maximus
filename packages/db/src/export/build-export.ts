import {
  AppError,
  canWriteConversation,
  textFromParts,
  type ContentPart,
  type OrgRole,
} from "@maximus/domain";
import type { Db } from "../client.js";
import * as conversationRepo from "../repos/conversations.js";
import * as messageRepo from "../repos/messages.js";

export type ExportActor = {
  userId: string;
  orgId: string;
  role: OrgRole;
};

/**
 * Shared export builder used by /api/export and tests.
 * Enforces conversation owner-only access (D12).
 */
export async function exportConversation(
  db: Db,
  actor: ExportActor,
  input: { id: string; format?: "md" | "json" },
): Promise<
  | { format: "json"; body: { conversation: unknown; messages: unknown[] } }
  | { format: "md"; body: string }
> {
  const format = input.format ?? "md";
  const conv = await conversationRepo.getConversation(db, input.id);
  if (
    !conv ||
    !canWriteConversation({
      conversationOrgId: conv.orgId,
      conversationUserId: conv.userId,
      actorOrgId: actor.orgId,
      actorUserId: actor.userId,
      actorRole: actor.role,
    })
  ) {
    throw new AppError("NOT_FOUND", "Conversation not found");
  }
  const msgs = await messageRepo.listMessagesForConversation(db, input.id);
  if (format === "json") {
    return { format: "json", body: { conversation: conv, messages: msgs } };
  }
  const md = [
    `# ${conv.title ?? "Conversation"}`,
    "",
    ...msgs.map((m) => {
      const text = textFromParts((m.content as ContentPart[]) ?? []);
      return `## ${m.role}\n\n${text}\n`;
    }),
  ].join("\n");
  return { format: "md", body: md };
}
