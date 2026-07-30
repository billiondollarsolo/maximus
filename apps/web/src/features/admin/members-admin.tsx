import { createColumnHelper } from "@tanstack/react-table";
import { Plus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyStatePanel,
  Icon,
  Input,
  Label,
  Select,
} from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminSection } from "./admin-section";
import { AdminPageHeader } from "./page-header";

type Member = {
  email: string;
  name: string;
  role: string;
  userId: string;
};

type Invite = {
  id: string;
  email: string;
  role: string | null;
  status: string;
};

const memberHelper = createColumnHelper<Member>();
const inviteHelper = createColumnHelper<Invite>();

export function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await adminFetch<{ members: Member[]; invites: Invite[] }>(
      "/api/admin/members",
    );
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMembers(r.data.members ?? []);
    setInvites(r.data.invites ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const memberColumns = useMemo(
    () => [
      memberHelper.accessor("name", { header: "Name" }),
      memberHelper.accessor("email", {
        header: "Email",
        cell: (c) => <span className="text-text-secondary">{c.getValue()}</span>,
      }),
      memberHelper.accessor("role", {
        header: "Role",
        cell: (c) => <Badge>{c.getValue()}</Badge>,
      }),
    ],
    [],
  );

  const inviteColumns = useMemo(
    () => [
      inviteHelper.accessor("email", { header: "Email" }),
      inviteHelper.accessor("role", {
        header: "Role",
        cell: (c) => <Badge>{c.getValue() ?? "member"}</Badge>,
      }),
      inviteHelper.accessor("status", {
        header: "Status",
        cell: (c) => (
          <span className="text-text-muted capitalize">{c.getValue()}</span>
        ),
      }),
      inviteHelper.display({
        id: "link",
        header: "Invite path",
        cell: (c) => (
          <code className="table-mono">/invite/{c.row.original.id}</code>
        ),
      }),
    ],
    [],
  );

  async function sendInvite() {
    setBusy(true);
    setError(null);
    setInviteLink(null);
    const r = await adminFetch<{ invite?: { id: string } }>(
      "/api/admin/members",
      {
        method: "POST",
        body: JSON.stringify({ action: "invite", email, role }),
      },
    );
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEmail("");
    setInviteOpen(false);
    if (r.data.invite?.id) {
      const path = `/invite/${r.data.invite.id}`;
      setInviteLink(
        typeof window !== "undefined"
          ? `${window.location.origin}${path}`
          : path,
      );
    }
    await refresh();
  }

  return (
    <div>
      <AdminPageHeader
        title="Members"
        description="Invite teammates and review roles. Ownership transfer is reserved for future policy work."
        actions={
          <Button type="button" onClick={() => setInviteOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Invite member
          </Button>
        }
      />

      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {inviteLink ? (
        <AdminAlert tone="success">
          Share invite link: <code className="table-mono">{inviteLink}</code>
        </AdminAlert>
      ) : null}

      <AdminSection title="Team" description="Active organization members.">
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <DataTable
            data={members}
            columns={memberColumns}
            getRowId={(m) => m.userId}
            empty={
              <EmptyStatePanel
                icon={UserPlus}
                title="No members loaded"
                description="Invite the first teammate to collaborate in this org."
                action={
                  <Button type="button" onClick={() => setInviteOpen(true)}>
                    <Icon icon={Plus} size="sm" />
                    Invite member
                  </Button>
                }
              />
            }
          />
        )}
      </AdminSection>

      <AdminSection
        title="Pending invites"
        description="Links are single-use paths until accepted."
      >
        <DataTable
          data={invites}
          columns={inviteColumns}
          getRowId={(i) => i.id}
          empty={
            <p className="rounded-xl border border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
              No pending invites
            </p>
          }
        />
      </AdminSection>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent
          title="Invite member"
          description="They’ll set a password via the invite link. Default role is member."
          size="sm"
        >
          <div className="grid gap-3">
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="invite-role">Role</Label>
              <Select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !email.includes("@")}
              onClick={() => void sendInvite()}
            >
              {busy ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
