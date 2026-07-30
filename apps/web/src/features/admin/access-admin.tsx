import { createColumnHelper } from "@tanstack/react-table";
import { Plus, Shield } from "lucide-react";
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
  Label,
  Select,
  Switch,
} from "#/components/ui";
import { adminFetch } from "./admin-api";
import { AdminAlert } from "./admin-alert";
import { AdminSection } from "./admin-section";
import { ConfirmDialog } from "./confirm-dialog";
import { AdminPageHeader } from "./page-header";

type GrantRow = {
  id: string;
  resourceRef: string;
  subjectType: string;
  subjectId: string | null;
};

type Offering = { modelRef: string; displayName: string };
type TeamOpt = { id: string; name: string };
type MemberOpt = { userId: string; name: string; email: string };

const grantHelper = createColumnHelper<GrantRow>();

export function AccessAdmin() {
  const [accessMode, setAccessMode] = useState<"open" | "allowlist">("open");
  const [grants, setGrants] = useState<GrantRow[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [teams, setTeams] = useState<TeamOpt[]>([]);
  const [members, setMembers] = useState<MemberOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [resourceRef, setResourceRef] = useState("");
  const [subjectType, setSubjectType] = useState<"org" | "role" | "team" | "user">(
    "role",
  );
  const [subjectId, setSubjectId] = useState("member");
  const [busy, setBusy] = useState(false);
  const [removeId, setRemoveId] = useState<GrantRow | null>(null);

  const refresh = useCallback(async () => {
    const [g, t, m] = await Promise.all([
      adminFetch<{
        accessMode: "open" | "allowlist";
        grants: GrantRow[];
        offerings: Offering[];
      }>("/api/admin/access-grants"),
      adminFetch<{ teams: Array<{ id: string; name: string }> }>(
        "/api/admin/teams",
      ),
      adminFetch<{
        members: Array<{ userId: string; name: string; email: string }>;
      }>("/api/admin/members"),
    ]);
    if (!g.ok) {
      setError(g.error);
      return;
    }
    setAccessMode(g.data.accessMode ?? "open");
    setGrants(g.data.grants ?? []);
    setOfferings(g.data.offerings ?? []);
    if (t.ok) {
      setTeams((t.data.teams ?? []).map((x) => ({ id: x.id, name: x.name })));
    }
    if (m.ok) {
      setMembers(
        (m.data.members ?? []).map((x) => ({
          userId: x.userId,
          name: x.name,
          email: x.email,
        })),
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const columns = useMemo(
    () => [
      grantHelper.accessor("resourceRef", {
        header: "Model",
        cell: (c) => (
          <code className="text-xs text-text-secondary">{c.getValue()}</code>
        ),
      }),
      grantHelper.accessor("subjectType", {
        header: "Subject",
        cell: (c) => {
          const row = c.row.original;
          return (
            <Badge>
              {row.subjectType}
              {row.subjectId ? `: ${row.subjectId}` : ""}
            </Badge>
          );
        },
      }),
      grantHelper.display({
        id: "actions",
        header: "",
        cell: (c) => (
          <Button
            type="button"
            variant="secondary"
            className="h-8 text-xs"
            onClick={() => setRemoveId(c.row.original)}
          >
            Remove
          </Button>
        ),
      }),
    ],
    [],
  );

  async function toggleMode(next: boolean) {
    const mode = next ? "allowlist" : "open";
    setBusy(true);
    const r = await adminFetch("/api/admin/access-grants", {
      method: "PATCH",
      body: JSON.stringify({ accessMode: mode }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAccessMode(mode);
    setInfo(
      mode === "open"
        ? "Open mode: all enabled models available"
        : "Allowlist mode: only granted models available",
    );
  }

  async function addGrant() {
    setBusy(true);
    setError(null);
    const r = await adminFetch("/api/admin/access-grants", {
      method: "POST",
      body: JSON.stringify({
        resourceType: "model",
        resourceRef,
        subjectType,
        subjectId: subjectType === "org" ? null : subjectId,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAddOpen(false);
    setResourceRef("");
    await refresh();
  }

  return (
    <div>
      <AdminPageHeader
        title="Access"
        description="Control who can use which models. Open mode ignores grants. Allowlist mode requires a matching grant (org, role, team, or user)."
        actions={
          <Button type="button" onClick={() => setAddOpen(true)}>
            <Icon icon={Plus} size="sm" />
            Add grant
          </Button>
        }
      />
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {info ? <AdminAlert tone="success">{info}</AdminAlert> : null}

      <AdminSection
        title="Access mode"
        description="Open = everyone with chat can use enabled models (grants unused). Allowlist = only models with a matching grant."
      >
        <label className="flex items-center gap-3 text-sm text-text-secondary">
          <Switch
            checked={accessMode === "allowlist"}
            onCheckedChange={(v) => void toggleMode(v)}
            disabled={busy}
          />
          <span>
            {accessMode === "allowlist"
              ? "Allowlist (restricted)"
              : "Open (all enabled models)"}
          </span>
        </label>
      </AdminSection>

      <AdminSection
        title="Grants"
        description="Each row allows a model for a subject. Team grants apply to all of a user’s teams in this org."
      >
        <DataTable
          data={grants}
          columns={columns}
          getRowId={(r) => r.id}
          empty={
            <EmptyStatePanel
              icon={Shield}
              title="No grants yet"
              description={
                accessMode === "open"
                  ? "Optional while open. Switch to Allowlist to enforce grants."
                  : "Add grants or members will see no models."
              }
              action={
                <Button type="button" onClick={() => setAddOpen(true)}>
                  <Icon icon={Plus} size="sm" />
                  Add grant
                </Button>
              }
            />
          }
        />
      </AdminSection>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent
          title="Add access grant"
          description="Pick a model offering and who may use it."
          size="sm"
        >
          <div className="grid gap-3">
            <div>
              <Label htmlFor="ag-model">Model</Label>
              <Select
                id="ag-model"
                value={resourceRef}
                onChange={(e) => setResourceRef(e.target.value)}
              >
                <option value="">Select model…</option>
                {offerings.map((o) => (
                  <option key={o.modelRef} value={o.modelRef}>
                    {o.displayName} ({o.modelRef})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ag-subj">Subject type</Label>
              <Select
                id="ag-subj"
                value={subjectType}
                onChange={(e) => {
                  const v = e.target.value as typeof subjectType;
                  setSubjectType(v);
                  if (v === "role") setSubjectId("member");
                  else if (v === "org") setSubjectId("");
                  else setSubjectId("");
                }}
              >
                <option value="org">Entire org</option>
                <option value="role">Role</option>
                <option value="team">Team</option>
                <option value="user">User</option>
              </Select>
            </div>
            {subjectType === "role" ? (
              <div>
                <Label htmlFor="ag-role">Role</Label>
                <Select
                  id="ag-role"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </Select>
              </div>
            ) : null}
            {subjectType === "team" ? (
              <div>
                <Label htmlFor="ag-team">Team</Label>
                <Select
                  id="ag-team"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {subjectType === "user" ? (
              <div>
                <Label htmlFor="ag-user">User</Label>
                <Select
                  id="ag-user"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                >
                  <option value="">Select member…</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !resourceRef ||
                (subjectType !== "org" && !subjectId)
              }
              onClick={() => void addGrant()}
            >
              {busy ? "Saving…" : "Add grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeId != null}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title="Remove grant?"
        description={
          removeId
            ? `Remove access to ${removeId.resourceRef} for ${removeId.subjectType}${removeId.subjectId ? ` ${removeId.subjectId}` : ""}.`
            : ""
        }
        confirmLabel="Remove"
        danger
        loading={busy}
        onConfirm={async () => {
          if (!removeId) return;
          setBusy(true);
          const r = await adminFetch("/api/admin/access-grants", {
            method: "DELETE",
            body: JSON.stringify({ id: removeId.id }),
          });
          setBusy(false);
          setRemoveId(null);
          if (!r.ok) setError(r.error);
          else await refresh();
        }}
      />
    </div>
  );
}
