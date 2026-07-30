import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Icon, Spinner } from "#/components/ui";
import {
  AuthField,
  AuthFormTitle,
  AuthPrimaryButton,
  AuthSplit,
  authInputClassName,
} from "./auth-split";

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
      const data = (await res.json()) as { error?: string };
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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black text-white/50">
        <Spinner />
        <p className="text-sm">Loading Maximus…</p>
      </div>
    );
  }

  return (
    <AuthSplit>
      <AuthFormTitle
        title={bootstrap ? "Create your workspace" : "Sign in to Maximus"}
        subtitle={
          bootstrap
            ? "First-run setup — you become the owner. After this, join is invite-only."
            : "Enter your credentials to continue"
        }
      />

      {!bootstrap ? (
        <div className="mb-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-white/30">
          <span className="h-px flex-1 bg-white/10" />
          continue with password
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        {bootstrap ? (
          <>
            <AuthField label="Your name">
              <input
                className={authInputClassName()}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </AuthField>
            <AuthField label="Workspace name">
              <input
                className={authInputClassName()}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </AuthField>
          </>
        ) : null}

        <AuthField label="Email">
          <input
            type="email"
            className={authInputClassName()}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus={!bootstrap}
            placeholder="you@example.com"
          />
        </AuthField>

        <AuthField label="Password">
          <input
            type="password"
            className={authInputClassName()}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={bootstrap ? 10 : 1}
            autoComplete={bootstrap ? "new-password" : "current-password"}
            placeholder="Enter your password"
          />
          {bootstrap ? (
            <span className="text-[11px] font-normal text-white/35">
              At least 10 characters
            </span>
          ) : null}
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
          {bootstrap ? (
            "Create workspace"
          ) : (
            <>
              Sign in
              <Icon icon={ArrowRight} size="sm" />
            </>
          )}
        </AuthPrimaryButton>

        {!bootstrap ? (
          <p className="text-center text-[12px] text-white/35">
            Need access? Ask an admin for an invite link.
          </p>
        ) : (
          <p className="text-center text-[11px] leading-relaxed text-white/30">
            By continuing, you create the first owner account for this
            deployment.
          </p>
        )}
      </form>
    </AuthSplit>
  );
}
