import { createFileRoute, Link } from "@tanstack/react-router";
import { Folder, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  EmptyStatePanel,
  Icon,
  Input,
  Label,
} from "#/components/ui";
import { RequireSession } from "#/features/auth/require-session";
import { AdminAlert } from "#/features/admin/admin-alert";
import { ConfirmDialog } from "#/features/admin/confirm-dialog";

type Project = {
  id: string;
  name: string;
  instructions: string | null;
  defaultModelRef: string | null;
  updatedAt: string;
};

export const Route = createFileRoute("/projects")({
  component: () => (
    <RequireSession>
      <ProjectsPage />
    </RequireSession>
  ),
});

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/projects", { credentials: "same-origin" });
    if (!res.ok) {
      setError("Failed to load projects");
      return;
    }
    const data = (await res.json()) as { projects?: Project[] };
    setProjects(data.projects ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Create failed");
      }
      setName("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-bg-app text-text-primary">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <Link
              to="/"
              className="text-sm text-text-muted no-underline hover:text-text-primary"
            >
              ← Chat
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Projects
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Group chats by project. Assign from the API or future chat UI;
              conversations keep a <code className="text-xs">projectId</code>.
            </p>
          </div>
        </div>

        {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}

        <div className="mb-6 rounded-xl border border-border-subtle bg-bg-sidebar p-4">
          <Label htmlFor="proj-name">New project</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="flex-1"
            />
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void create()}
            >
              <Icon icon={Plus} size="sm" />
              Create
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
          <EmptyStatePanel
            icon={Folder}
            title="No projects yet"
            description="Create a project to organize related conversations."
          />
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <Icon icon={Folder} size="sm" className="text-text-faint" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-[11px] text-text-faint">
                    <code className="table-mono">{p.id}</code>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setDeleteId(p.id)}
                >
                  <Icon icon={Trash2} size="sm" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Delete project?"
        description="Chats are not deleted; they become unassigned."
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={() => {
          if (deleteId) return remove(deleteId);
        }}
      />
    </div>
  );
}
