import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export type AdminGateState =
  | { status: "loading" }
  | { status: "denied" }
  | { status: "ready"; role: string };

export function useAdminGate(): AdminGateState {
  const nav = useNavigate();
  const [state, setState] = useState<AdminGateState>({ status: "loading" });

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          await nav({ to: "/login" });
          return null;
        }
        return r.json() as Promise<{ role?: string }>;
      })
      .then((d) => {
        if (!d) return;
        if (d.role !== "admin" && d.role !== "owner") {
          setState({ status: "denied" });
          return;
        }
        setState({ status: "ready", role: d.role! });
      })
      .catch(() => setState({ status: "denied" }));
  }, [nav]);

  return state;
}

/** Shared loading / 403 shell for admin routes. */
export function AdminGateFrame({
  gate,
  children,
}: {
  gate: AdminGateState;
  children: React.ReactNode;
}) {
  if (gate.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-app text-sm text-text-muted">
        Checking access…
      </div>
    );
  }
  if (gate.status === "denied") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg-app px-4 text-center">
        <p className="text-lg font-semibold text-text-primary">Access denied</p>
        <p className="max-w-sm text-sm text-text-muted">
          Admin is only available to owners and admins. Members cannot view
          organization settings, keys, or audit logs.
        </p>
        <a
          href="/"
          className="text-sm text-accent underline-offset-2 hover:underline"
        >
          Back to chat
        </a>
      </div>
    );
  }
  return children;
}
