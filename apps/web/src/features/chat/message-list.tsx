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

/**
 * ChatGPT layout: assistant full-width prose; user right-aligned soft bubble.
 */
export function MessageList({
  messages,
  tree,
  onRegenerate,
  onEdit,
  onFeedback,
  onBranch,
}: {
  messages: UiMessage[];
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-6 px-4 py-6 md:px-5 md:py-8">
        {messages.map((m) => {
          const meta = siblingBranchMeta(treeForMeta, m.id);
          const isUser = m.role === "user";
          const isAssistant = m.role === "assistant";

          return (
            <div
              key={m.id}
              className={cn(
                "group flex w-full flex-col",
                isUser ? "items-end" : "items-stretch",
              )}
            >
              {isAssistant ? (
                <div className="flex gap-3">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-sidebar-active text-[11px] font-semibold text-text-primary"
                    aria-hidden
                  >
                    M
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {editingId === m.id ? null : (
                      <div className="msg-prose">
                        <MarkdownRenderer content={m.content} />
                        {m.status === "streaming" && !m.content ? (
                          <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-muted" />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "max-w-[85%] rounded-[var(--radius-bubble)] bg-bg-user-bubble px-4 py-2.5 text-[15px] leading-relaxed text-text-primary sm:max-w-[75%]",
                  )}
                >
                  {editingId === m.id ? (
                    <div className="flex min-w-[16rem] flex-col gap-2">
                      <textarea
                        className="min-h-[80px] w-full rounded-[var(--radius-md)] border border-border-subtle bg-bg-app p-2 text-sm"
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
                          Send
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
                  ) : (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              )}

              {/* Actions under turn */}
              <div
                className={cn(
                  "mt-1.5 flex items-center gap-0.5",
                  isUser ? "mr-0.5" : "ml-10",
                  isAssistant &&
                    "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                )}
              >
                {meta && onBranch ? (
                  <div
                    className="mr-1 flex items-center gap-0.5 rounded-lg text-[12px] text-text-muted"
                    role="group"
                    aria-label="Branch version"
                  >
                    <IconButton
                      icon={ChevronLeft}
                      label="Previous branch"
                      iconSize="sm"
                      className="h-7 w-7"
                      disabled={meta.index <= 1}
                      onClick={() => onBranch(m.id, -1)}
                    />
                    <span className="min-w-[2.25rem] text-center tabular-nums">
                      {meta.index}/{meta.total}
                    </span>
                    <IconButton
                      icon={ChevronRight}
                      label="Next branch"
                      iconSize="sm"
                      className="h-7 w-7"
                      disabled={meta.index >= meta.total}
                      onClick={() => onBranch(m.id, 1)}
                    />
                  </div>
                ) : null}

                {isAssistant ? (
                  <>
                    <IconButton
                      icon={Copy}
                      label="Copy"
                      iconSize="sm"
                      className="h-7 w-7"
                      onClick={() => navigator.clipboard.writeText(m.content)}
                    />
                    <IconButton
                      icon={RefreshCw}
                      label="Regenerate"
                      iconSize="sm"
                      className="h-7 w-7"
                      onClick={() => onRegenerate?.(m.id)}
                    />
                    <IconButton
                      icon={ThumbsUp}
                      label="Good response"
                      iconSize="sm"
                      className="h-7 w-7"
                      onClick={() => onFeedback?.(m.id, "up")}
                    />
                    <IconButton
                      icon={ThumbsDown}
                      label="Bad response"
                      iconSize="sm"
                      className="h-7 w-7"
                      onClick={() => onFeedback?.(m.id, "down")}
                    />
                  </>
                ) : null}

                {isUser && editingId !== m.id ? (
                  <IconButton
                    icon={Pencil}
                    label="Edit message"
                    iconSize="sm"
                    className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => {
                      setEditingId(m.id);
                      setEditText(m.content);
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
