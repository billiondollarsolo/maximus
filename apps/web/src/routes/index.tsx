import { createFileRoute } from "@tanstack/react-router";
import { RequireSession } from "#/features/auth/require-session";
import { ChatWorkspace } from "#/features/chat/chat-workspace";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/** New chat — deep link `/` */
function HomePage() {
  return (
    <RequireSession>
      <ChatWorkspace conversationId={null} />
    </RequireSession>
  );
}
