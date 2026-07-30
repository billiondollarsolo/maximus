import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, Input } from "#/components/ui";
import { AuthCard } from "./auth-card";

export function InvitePage({ inviteId }: { inviteId: string }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, password, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Invite failed");
        return;
      }
      await nav({ to: "/" });
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title="Accept invitation"
      subtitle="Set a password to join the workspace. Public signup is disabled."
    >
      <form className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Display name
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Password
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
          <span className="text-[11px] text-text-muted">
            At least 10 characters
          </span>
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
          {loading ? "Joining…" : "Join workspace"}
        </Button>
        <p className="text-center text-xs text-text-muted">
          Already have an account?{" "}
          <a href="/login" className="text-accent underline-offset-2 hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </AuthCard>
  );
}
