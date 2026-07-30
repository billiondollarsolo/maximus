import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { siblingBranchMeta } from "@maximus/domain";
import { Button, IconButton } from "#/components/ui";
import { MarkdownRenderer } from "#/components/markdown/markdown-renderer";
import { cn } from "#/lib/cn";

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  status?: string;
  parentMessageId?: string | null;
  position?: number;
};

export function MessageList({
  messages,
  tree,
  onRegenerate,
  onEdit,
  onFeedback,
  onBranch,
}: {
  /** Linearized active branch for display */
  messages: UiMessage[];
  /** Full tree nodes for sibling meta (id/parent/position) */
  tree: Array<{
    id: string;
    parentMessageId: string | null;
    role: string;
    position: number;
  }>;
  onRegenerate?: (id: string) => void;
  onEdit?: (id: string, text: string) => void;
  onFeedback?: (id: string, rating: "up" | "down") => void;
  onBranch?: (messageId: string, direction: -1 | 1) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const treeForMeta = tree.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as "user" | "assistant" | "system" | "tool",
    position: m.position,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((m) => {
        const meta = siblingBranchMeta(treeForMeta, m.id);
        return (
          <div
            key={m.id}
            className={cn(
              "group flex flex-col gap-2",
              m.role === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-3",
                m.role === "user"
                  ? "bg-bg-composer text-text-primary"
                  : "bg-transparent text-text-primary",
              )}
            >
              {editingId === m.id ? (
                <div className="flex min-w-[16rem] flex-col gap-2">
                  <textarea
                    className="min-h-[80px] w-full rounded-lg border border-border-subtle bg-bg-app p-2 text-sm"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onEdit?.(m.id, editText);
                        setEditingId(null);
                      }}
                    >
                      Save & submit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : m.role === "assistant" ? (
                <MarkdownRenderer content={m.content} />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{m.content}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {meta && onBranch ? (
                <div
                  className="flex items-center gap-0.5 rounded-lg border border-border-subtle bg-bg-sidebar px-0.5 text-xs text-text-muted"
                  role="group"
                  aria-label="Branch version"
                >
                  <IconButton
                    icon={ChevronLeft}
                    label="Previous branch"
                    iconSize="sm"
                    disabled={meta.index <= 1}
                    onClick={() => onBranch(m.id, -1)}
                  />
                  <span className="min-w-[2.5rem] text-center tabular-nums">
                    {meta.index} / {meta.total}
                  </span>
                  <IconButton
                    icon={ChevronRight}
                    label="Next branch"
                    iconSize="sm"
                    disabled={meta.index >= meta.total}
                    onClick={() => onBranch(m.id, 1)}
                  />
                </div>
              ) : null}
              {m.role === "assistant" ? (
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton
                    icon={Copy}
                    label="Copy"
                    iconSize="sm"
                    onClick={() => navigator.clipboard.writeText(m.content)}
                  />
                  <IconButton
                    icon={RefreshCw}
                    label="Regenerate"
                    iconSize="sm"
                    onClick={() => onRegenerate?.(m.id)}
                  />
                  <IconButton
                    icon={ThumbsUp}
                    label="Good response"
                    iconSize="sm"
                    onClick={() => onFeedback?.(m.id, "up")}
                  />
                  <IconButton
                    icon={ThumbsDown}
                    label="Bad response"
                    iconSize="sm"
                    onClick={() => onFeedback?.(m.id, "down")}
                  />
                </div>
              ) : null}
              {m.role === "user" && editingId !== m.id ? (
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconButton
                    icon={Pencil}
                    label="Edit message"
                    iconSize="sm"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditText(m.content);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
