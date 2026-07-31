import { textFromContent, type ContentPartUi, type ServerMsg } from "./chat-types";

/**
 * Human-readable assistant error for the bubble.
 * Covers live SSE finalize (content already set) and DB reload shapes
 * where status is error but content is empty and `error.message` is set.
 */
export function assistantErrorDisplayText(
  msg: Pick<ServerMsg, "status" | "content" | "error"> & {
    error?: { message?: string; code?: string } | null;
  },
): string | null {
  if (msg.status !== "error" && msg.status !== "aborted") {
    // Still show content if status complete
    return null;
  }

  const fromContent = textFromContent(
    (msg.content ?? []) as ContentPartUi[],
  ).trim();
  if (fromContent) return fromContent;

  const fromError =
    typeof msg.error?.message === "string" ? msg.error.message.trim() : "";
  if (fromError) return fromError;

  if (msg.status === "aborted") {
    return "Generation stopped.";
  }
  return "Generation failed. Check provider credentials and model id, then try again.";
}

/** Whether the assistant bubble should render in error styling. */
export function isAssistantErrorStatus(status: string | undefined): boolean {
  return status === "error" || status === "aborted";
}
