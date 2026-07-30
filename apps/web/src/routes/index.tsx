import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChatWorkspace } from "#/features/chat/chat-workspace";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/** Thin route shell — auth gate then chat workspace. */
function HomePage() {
  const nav = useNavigate();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" }).then(
      async (r) => {
        if (r.status === 401) {
          await nav({ to: "/login" });
          return;
        }
        setOk(true);
      },
    );
  }, [nav]);

  if (!ok) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-app text-sm text-text-muted">
        Loading Maximus…
      </div>
    );
  }

  return <ChatWorkspace />;
}
