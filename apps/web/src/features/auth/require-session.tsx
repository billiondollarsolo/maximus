import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Session gate for deep-linked app pages (chat, settings, etc.).
 * Unauthenticated users are sent to /login.
 *
 * Once authenticated, children stay mounted — re-running the session check
 * must not unmount ChatWorkspace (that wiped in-flight streams).
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { credentials: "same-origin" }).then(
      async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setStatus("denied");
          await nav({ to: "/login" });
          return;
        }
        setStatus("ok");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [nav]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-app text-sm text-text-muted">
        Loading Maximus…
      </div>
    );
  }

  if (status === "denied") {
    return null;
  }

  return children;
}
