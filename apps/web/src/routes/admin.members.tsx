import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Input } from "#/components/ui";
import { AdminShell, AdminTable } from "#/features/admin/admin-shell";
import {
  AdminGateFrame,
  useAdminGate,
} from "#/features/admin/use-admin-gate";

export const Route = createFileRoute("/admin/members")({
  component: AdminMembers,
});

function AdminMembers() {
  const gate = useAdminGate();
  const [members, setMembers] = useState<
    Array<{ email: string; name: string; role: string; userId: string }>
  >([]);
  const [invites, setInvites] = useState<
    Array<{ id: string; email: string; role: string | null; status: string }>
  >([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/members", {
      credentials: "same-origin",
    });
    if (!res.ok) {
      setError("Failed to load members");
      return;
    }
    const data = (await res.json()) as {
      members: Array<{
        email: string;
        name: string;
        role: string;
        userId: string;
      }>;
      invites: Array<{
        id: string;
        email: string;
        role: string | null;
        status: string;
      }>;
    };
    setMembers(data.members);
    setInvites(data.invites);
  }

  useEffect(() => {
    if (gate.status === "ready") void refresh();
  }, [gate]);

  async function invite() {
    setError(null);
    setInviteLink(null);
    const res = await fetch("/api/admin/members", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        email,
        role: "member",
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      invite?: { id: string };
    };
    if (!res.ok) {
      setError(data.error ?? "Invite failed");
      return;
    }
    setEmail("");
    await refresh();
    if (data.invite?.id) {
      setInviteLink(`/invite/${data.invite.id}`);
    }
  }

  return (
    <AdminGateFrame gate={gate}>
      <AdminShell title="Members" active="/admin/members">
        <div className="mb-6 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-text-muted">
            Invite email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
            />
          </label>
          <Button type="button" onClick={() => void invite()}>
            Send invite
          </Button>
        </div>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {inviteLink ? (
          <p className="mb-4 rounded-lg border border-border-subtle bg-bg-composer px-3 py-2 text-sm">
            Share invite link:{" "}
            <code className="text-xs text-accent">{inviteLink}</code>
          </p>
        ) : null}
        <h2 className="mb-2 text-sm font-semibold">Team</h2>
        <AdminTable
          headers={["Name", "Email", "Role"]}
          rows={members.map((m) => [m.name, m.email, m.role])}
        />
        <h2 className="mb-2 mt-8 text-sm font-semibold">Pending invites</h2>
        <AdminTable
          headers={["Email", "Role", "Status", "Link"]}
          rows={invites.map((i) => [
            i.email,
            i.role ?? "member",
            i.status,
            `/invite/${i.id}`,
          ])}
        />
      </AdminShell>
    </AdminGateFrame>
  );
}
