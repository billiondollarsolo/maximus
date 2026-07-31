import {
  createFileRoute,
  useRouterState,
} from "@tanstack/react-router";
import { RequireSession } from "#/features/auth/require-session";
import { ChatWorkspace } from "#/features/chat/chat-workspace";
import { conversationIdFromPath } from "#/features/chat/conversation-id";

/**
 * Pathless layout for `/` and `/c/$conversationId`.
 *
 * ChatWorkspace must stay mounted across new-chat → first-message URL
 * navigation. Conversation id is taken from the **pathname only** — router
 * match tables can be empty mid-transition and previously caused the thread
 * to wipe while the address bar still showed `/c/{id}`.
 */
export const Route = createFileRoute("/_chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const conversationId = useRouterState({
    select: (s) => conversationIdFromPath(s.location.pathname),
  });

  return (
    <RequireSession>
      <ChatWorkspace conversationId={conversationId} />
    </RequireSession>
  );
}
