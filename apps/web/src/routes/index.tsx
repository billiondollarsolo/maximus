import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "#/features/chat/chat-workspace";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/** Thin route shell — compose feature modules only (D17). */
function HomePage() {
  return <ChatWorkspace />;
}
