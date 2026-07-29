import { AppError } from "./errors.js";

export type ChatTurnMode = "send" | "regenerate" | "edit";

export type ChatTurnInputShape = {
  text?: string | null;
  attachmentIds?: string[] | null;
  mode?: ChatTurnMode | null;
  targetMessageId?: string | null;
  conversationId?: string | null;
  modelRef?: string | null;
};

export type NormalizedChatTurnInput = {
  text: string;
  attachmentIds: string[];
  mode: ChatTurnMode;
  targetMessageId: string | null;
  hasContent: boolean;
};

/**
 * Single pure contract for chat turns (UI + server).
 * send/edit: need text.trim() OR attachmentIds.length
 * regenerate: may omit content; requires targetMessageId
 * edit: requires targetMessageId + content
 */
export function assertChatTurnInput(
  body: ChatTurnInputShape,
): NormalizedChatTurnInput {
  const mode: ChatTurnMode = body.mode ?? "send";
  const text = (body.text ?? "").trim();
  const attachmentIds = (body.attachmentIds ?? []).filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  const hasContent = text.length > 0 || attachmentIds.length > 0;
  const targetMessageId =
    typeof body.targetMessageId === "string" && body.targetMessageId
      ? body.targetMessageId
      : null;

  if (mode === "regenerate") {
    if (!targetMessageId) {
      throw new AppError(
        "VALIDATION",
        "targetMessageId required for regenerate",
      );
    }
    return {
      text,
      attachmentIds,
      mode,
      targetMessageId,
      hasContent,
    };
  }

  if (mode === "edit") {
    if (!targetMessageId) {
      throw new AppError("VALIDATION", "targetMessageId required for edit");
    }
    if (!hasContent) {
      throw new AppError(
        "VALIDATION",
        "Message text or attachments required",
      );
    }
    return {
      text,
      attachmentIds,
      mode,
      targetMessageId,
      hasContent,
    };
  }

  // send
  if (!hasContent) {
    throw new AppError("VALIDATION", "Message text or attachments required");
  }
  return {
    text,
    attachmentIds,
    mode: "send",
    targetMessageId: null,
    hasContent: true,
  };
}

/** Title text for new conversations: prefer user text, else attachment label. */
export function conversationTitleFromInput(input: NormalizedChatTurnInput): string {
  if (input.text) return input.text;
  if (input.attachmentIds.length === 1) return "Attachment";
  if (input.attachmentIds.length > 1) {
    return `${input.attachmentIds.length} attachments`;
  }
  return "New chat";
}
