import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, Input, Label } from "#/components/ui";
import { AdminAlert } from "#/features/admin/admin-alert";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function deleteAccount() {
    if (confirmText !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      await nav({ to: "/login" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsShell title="Account" active="/settings/account">
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
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
      <SettingsSection
        title="Delete account"
        description="Permanently deletes your chats in this workspace and your login if you have no other memberships. If you are the only owner with other members, transfer ownership first."
      >
        <Button
          variant="danger"
          type="button"
          onClick={() => {
            setConfirmText("");
            setDeleteOpen(true);
          }}
        >
          Delete my account…
        </Button>
      </SettingsSection>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="Delete account permanently?"
          description="This cannot be undone. Type DELETE to confirm."
          size="sm"
        >
          <div className="space-y-2">
            <Label htmlFor="acct-del">Confirmation</Label>
            <Input
              id="acct-del"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busy || confirmText !== "DELETE"}
              onClick={() => void deleteAccount()}
            >
              {busy ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsShell>
  );
}
