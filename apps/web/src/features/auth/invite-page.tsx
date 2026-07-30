import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Icon } from "#/components/ui";
import {
  AuthField,
  AuthFormTitle,
  AuthPrimaryButton,
  AuthSplit,
  authInputClassName,
} from "./auth-split";

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
    <AuthSplit>
      <AuthFormTitle
        title="Accept invitation"
        subtitle="Set a password to join the workspace. Public signup is disabled."
      />

      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <AuthField label="Display name">
          <input
            className={authInputClassName()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            autoFocus
            placeholder="Your name"
          />
        </AuthField>
        <AuthField label="Password">
          <input
            type="password"
            className={authInputClassName()}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
            placeholder="At least 10 characters"
          />
        </AuthField>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-red-300"
          >
            {error}
          </p>
        ) : null}

        <AuthPrimaryButton loading={loading}>
          Join workspace
          <Icon icon={ArrowRight} size="sm" />
        </AuthPrimaryButton>

        <p className="text-center text-[12px] text-white/35">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-white/70 underline-offset-2 hover:text-white hover:underline"
          >
            Sign in
          </a>
        </p>
      </form>
    </AuthSplit>
  );
}
