import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui";
import {
  SettingsSection,
  SettingsShell,
} from "#/features/settings/settings-shell";

export const Route = createFileRoute("/settings/account")({
  component: AccountSettings,
});

function AccountSettings() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then(
        (d: {
          user?: { email?: string };
          role?: string;
        }) => {
          setEmail(d.user?.email ?? "");
          setRole(d.role ?? "");
        },
      );
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    await nav({ to: "/login" });
  }

  return (
    <SettingsShell title="Account" active="/settings/account">
      <SettingsSection title="Profile">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Email</dt>
            <dd>{email || "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Role</dt>
            <dd className="capitalize">{role || "—"}</dd>
          </div>
        </dl>
      </SettingsSection>
      <SettingsSection title="Session">
        <Button variant="secondary" type="button" onClick={() => void logout()}>
          Sign out
        </Button>
      </SettingsSection>
    </SettingsShell>
  );
}
