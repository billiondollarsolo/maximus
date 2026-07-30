import { createFileRoute } from "@tanstack/react-router";
import { RequireSession } from "#/features/auth/require-session";
import { ChatWorkspace } from "#/features/chat/chat-workspace";

export const Route = createFileRoute("/c/$conversationId")({
  component: ConversationPage,
});

/** Conversation deep link: `/c/{conversationId}` (DB id, e.g. conv_<uuid>). */
function ConversationPage() {
  const { conversationId } = Route.useParams();
  return (
    <RequireSession>
      <ChatWorkspace conversationId={conversationId} />
    </RequireSession>
  );
}
