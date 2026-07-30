import { useNavigate } from "@tanstack/react-router";
import {
  Archive,
  Download,
  Link2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  Input,
  Label,
} from "#/components/ui";
import { ConfirmDialog } from "#/features/admin/confirm-dialog";

export type ConversationMenuProps = {
  id: string;
  title: string;
  onChanged?: () => void;
  isActive?: boolean;
};

/**
 * ⋮ menu on a conversation row.
 * Rename · Export · Copy link · Archive · Delete
 */
export function ConversationMenu({
  id,
  title,
  onChanged,
  isActive,
}: ConversationMenuProps) {
  const nav = useNavigate();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onChanged?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/conversations", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setDeleteOpen(false);
      onChanged?.();
      if (isActive) void nav({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function exportChat(format: "md" | "json") {
    window.open(
      `/api/export?id=${encodeURIComponent(id)}&format=${format}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function copyLink() {
    const url = `${window.location.origin}/c/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={MoreVertical}
            label="Chat options"
            iconSize="sm"
            className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          className="w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenuItem
            onSelect={() => {
              setName(title);
              setRenameOpen(true);
            }}
          >
            <Icon icon={Pencil} size="sm" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportChat("md")}>
            <Icon icon={Download} size="sm" />
            Export Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => exportChat("json")}>
            <Icon icon={Download} size="sm" />
            Export JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <Icon icon={Link2} size="sm" />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              void patch({ archive: true }).then((ok) => {
                if (ok && isActive) void nav({ to: "/" });
              });
            }}
          >
            <Icon icon={Archive} size="sm" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem danger onSelect={() => setDeleteOpen(true)}>
            <Icon icon={Trash2} size="sm" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent
          title="Rename chat"
          description="This title appears in your sidebar history."
          size="sm"
        >
          <div className="space-y-2">
            <Label htmlFor={`rename-${id}`}>Title</Label>
            <Input
              id={`rename-${id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
            />
            {error ? (
              <p className="text-xs text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() =>
                void patch({ title: name.trim() }).then((ok) => {
                  if (ok) setRenameOpen(false);
                })
              }
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete chat?"
        description="This permanently deletes the conversation and its messages. This cannot be undone."
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={() => void remove()}
      />
    </>
  );
}
