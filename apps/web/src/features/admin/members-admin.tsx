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

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  members: Array<{ userId: string }>;
};

export function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [addMemberTeam, setAddMemberTeam] = useState<TeamRow | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [r, t] = await Promise.all([
      adminFetch<{ members: Member[]; invites: Invite[] }>(
        "/api/admin/members",
      ),
      adminFetch<{ teams: TeamRow[] }>("/api/admin/teams"),
    ]);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setMembers(r.data.members ?? []);
    setInvites(r.data.invites ?? []);
    if (t.ok) setTeams(t.data.teams ?? []);
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
        title="Teams"
        description="Groups for model access grants (not private data). Manage grants under Admin → Access."
        actions={
          <Button type="button" variant="secondary" onClick={() => setTeamOpen(true)}>
            <Icon icon={Plus} size="sm" />
            New team
          </Button>
        }
      >
        {teams.length === 0 ? (
          <p className="rounded-xl border border-border-subtle px-4 py-8 text-center text-sm text-text-muted">
            No teams yet. Create a team to attach model grants.
          </p>
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {teams.map((t) => {
              const memberDetails = (t.members ?? []).map((tm) => {
                const m = members.find((x) => x.userId === tm.userId);
                return {
                  userId: tm.userId,
                  label: m
                    ? `${m.name} (${m.email})`
                    : tm.userId,
                };
              });
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-faint">
                        {memberDetails.length} members ·{" "}
                        <code className="table-mono">{t.slug}</code>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 text-xs"
                        onClick={() => {
                          setAddMemberTeam(t);
                          setAddMemberUserId(members[0]?.userId ?? "");
                        }}
                      >
                        Add member
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 text-xs text-danger"
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            await adminFetch("/api/admin/teams", {
                              method: "DELETE",
                              body: JSON.stringify({ id: t.id }),
                            });
                            setBusy(false);
                            await refresh();
                          })()
                        }
                      >
                        Delete team
                      </Button>
                    </div>
                  </div>
                  {memberDetails.length > 0 ? (
                    <ul className="mt-2 space-y-1 border-t border-border-subtle pt-2">
                      {memberDetails.map((md) => (
                        <li
                          key={md.userId}
                          className="flex items-center justify-between gap-2 text-sm text-text-secondary"
                        >
                          <span className="min-w-0 truncate">{md.label}</span>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-7 shrink-0 text-xs"
                            disabled={busy}
                            onClick={() =>
                              void (async () => {
                                setBusy(true);
                                setError(null);
                                const r = await adminFetch(
                                  "/api/admin/teams",
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      action: "remove_member",
                                      teamId: t.id,
                                      userId: md.userId,
                                    }),
                                  },
                                );
                                setBusy(false);
                                if (!r.ok) setError(r.error);
                                else await refresh();
                              })()
                            }
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-text-faint">
                      No members on this team yet.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
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

      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent title="New team" description="For model access grants." size="sm">
          <div>
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Engineering"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setTeamOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !teamName.trim()}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  const r = await adminFetch("/api/admin/teams", {
                    method: "POST",
                    body: JSON.stringify({ name: teamName.trim() }),
                  });
                  setBusy(false);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setTeamName("");
                  setTeamOpen(false);
                  await refresh();
                })()
              }
            >
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addMemberTeam != null}
        onOpenChange={(o) => !o && setAddMemberTeam(null)}
      >
        <DialogContent
          title="Add team member"
          description={addMemberTeam ? `Team: ${addMemberTeam.name}` : undefined}
          size="sm"
        >
          <div>
            <Label htmlFor="team-user">Member</Label>
            <Select
              id="team-user"
              value={addMemberUserId}
              onChange={(e) => setAddMemberUserId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.email})
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddMemberTeam(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !addMemberUserId || !addMemberTeam}
              onClick={() =>
                void (async () => {
                  if (!addMemberTeam) return;
                  setBusy(true);
                  const r = await adminFetch("/api/admin/teams", {
                    method: "POST",
                    body: JSON.stringify({
                      action: "add_member",
                      teamId: addMemberTeam.id,
                      userId: addMemberUserId,
                    }),
                  });
                  setBusy(false);
                  if (!r.ok) {
                    setError(r.error);
                    return;
                  }
                  setAddMemberTeam(null);
                  await refresh();
                })()
              }
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
