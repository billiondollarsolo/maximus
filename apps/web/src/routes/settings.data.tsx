import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyStatePanel,
  Icon,
  Input,
  Label,
} from "#/components/ui";
import { AdminAlert } from "#/features/admin/admin-alert";
import {
  SettingsSection,
  SettingsShell,
} from "#/features/settings/settings-shell";

type ConvRow = {
  id: string;
  title: string | null;
  updatedAt: string;
  archivedAt?: string | null;
};

export const Route = createFileRoute("/settings/data")({
  component: DataSettings,
});

function DataSettings() {
  const nav = useNavigate();
  const [archived, setArchived] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [wipeOpen, setWipeOpen] = useState<"all" | "archived" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);

  const refreshArchived = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations?scope=archived", {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load archived chats");
      const data = (await res.json()) as { conversations?: ConvRow[] };
      setArchived(data.conversations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshArchived();
  }, [refreshArchived]);

  async function unarchive(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, archive: false }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Unarchive failed");
      }
      setMsg("Chat restored to sidebar");
      await refreshArchived();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unarchive failed");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteOne(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Delete failed");
      }
      setMsg("Chat deleted");
      await refreshArchived();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkDelete() {
    if (!wipeOpen || confirmText !== "DELETE") return;
    setWiping(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bulk: wipeOpen, confirm: "DELETE" }),
      });
      const data = (await res.json()) as { deleted?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Bulk delete failed");
      const n = data.deleted ?? 0;
      setMsg(
        wipeOpen === "all"
          ? `Deleted ${n} conversation(s)`
          : `Deleted ${n} archived conversation(s)`,
      );
      const wasAll = wipeOpen === "all";
      setWipeOpen(null);
      setConfirmText("");
      await refreshArchived();
      if (wasAll) void nav({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk delete failed");
    } finally {
      setWiping(false);
    }
  }

  return (
    <SettingsShell title="Data controls" active="/settings/data">
      {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
      {msg ? <AdminAlert tone="success">{msg}</AdminAlert> : null}

      <SettingsSection
        title="Archived chats"
        description="Archived threads leave the sidebar but stay recoverable here. Export from the chat ⋮ menu before permanent delete if you need a copy."
      >
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : archived.length === 0 ? (
          <EmptyStatePanel
            icon={Archive}
            title="No archived chats"
            description="Use ⋮ → Archive on a chat in the sidebar to move it here."
          />
        ) : (
          <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {archived.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm"
              >
                <Link
                  to="/c/$conversationId"
                  params={{ conversationId: c.id }}
                  className="min-w-0 flex-1 truncate font-medium text-text-primary underline-offset-2 hover:underline"
                >
                  {c.title?.trim() || "Untitled"}
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busyId === c.id}
                  onClick={() => void unarchive(c.id)}
                >
                  <Icon icon={ArchiveRestore} size="sm" />
                  Unarchive
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  disabled={busyId === c.id}
                  onClick={() => void deleteOne(c.id)}
                >
                  <Icon icon={Trash2} size="sm" />
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection
        title="Danger zone"
        description="Bulk permanent deletion. Type DELETE to confirm. Cannot be undone."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setConfirmText("");
              setWipeOpen("archived");
            }}
          >
            Delete all archived…
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setConfirmText("");
              setWipeOpen("all");
            }}
          >
            Delete all chats…
          </Button>
        </div>
      </SettingsSection>

      <Dialog
        open={wipeOpen !== null}
        onOpenChange={(open) => {
          if (!open) {
            setWipeOpen(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent
          title={
            wipeOpen === "all"
              ? "Delete all chats?"
              : "Delete all archived chats?"
          }
          description={
            wipeOpen === "all"
              ? "Permanently deletes every conversation in this workspace for your account, including archived ones."
              : "Permanently deletes only chats you have archived."
          }
          size="sm"
        >
          <div className="space-y-2">
            <Label htmlFor="wipe-confirm">
              Type <strong>DELETE</strong> to confirm
            </Label>
            <Input
              id="wipe-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={wiping}
              onClick={() => {
                setWipeOpen(null);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={wiping || confirmText !== "DELETE"}
              onClick={() => void bulkDelete()}
            >
              {wiping ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsShell>
  );
}
