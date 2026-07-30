import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Session gate for deep-linked app pages (chat, settings, etc.).
 * Unauthenticated users are sent to /login.
 */
export function RequireSession({ children }: { children: ReactNode }) {
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

  return children;
}
