import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input, Spinner } from "#/components/ui";
import { AuthCard } from "./auth-card";

export function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("Maximus Workspace");
  const [name, setName] = useState("Owner");
  const [bootstrap, setBootstrap] = useState(false);
  const [statusReady, setStatusReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/status", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { needsBootstrap?: boolean }) => {
        setBootstrap(Boolean(d.needsBootstrap));
      })
      .catch(() => undefined)
      .finally(() => setStatusReady(true));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const path = bootstrap ? "/api/auth/bootstrap" : "/api/auth/login";
      const body = bootstrap
        ? { email, password, name, orgName }
        : { email, password };
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setError(data.error ?? "Authentication failed");
        return;
      }
      await nav({ to: "/" });
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  if (!statusReady) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg-app text-text-muted">
        <Spinner />
        <p className="text-sm">Loading Maximus…</p>
      </div>
    );
  }

  return (
    <AuthCard
      title={bootstrap ? "Create your workspace" : "Welcome back"}
      subtitle={
        bootstrap
          ? "First-run setup — you become the owner. After this, join is invite-only."
          : "Sign in to Maximus. Public registration is disabled."
      }
    >
      <form className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
        {bootstrap ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Your name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              Workspace name
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </label>
          </>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Email
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus={!bootstrap}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={bootstrap ? 10 : 1}
            autoComplete={bootstrap ? "new-password" : "current-password"}
          />
          {bootstrap ? (
            <span className="text-[11px] text-text-muted">
              At least 10 characters
            </span>
          ) : null}
        </label>
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-2 w-full" disabled={loading}>
          {loading
            ? "Please wait…"
            : bootstrap
              ? "Create workspace"
              : "Sign in"}
        </Button>
        {!bootstrap ? (
          <p className="mt-1 text-center text-xs text-text-muted">
            Need access? Ask an admin for an invite link.
          </p>
        ) : null}
      </form>
    </AuthCard>
  );
}
