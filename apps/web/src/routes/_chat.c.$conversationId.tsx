import { createFileRoute } from "@tanstack/react-router";

/**
 * Conversation deep link: `/c/{conversationId}` (DB id, e.g. conv_<uuid>).
 * UI lives in pathless `_chat` layout so streaming state survives first-message nav.
 */
export const Route = createFileRoute("/_chat/c/$conversationId")({
  component: () => null,
});
