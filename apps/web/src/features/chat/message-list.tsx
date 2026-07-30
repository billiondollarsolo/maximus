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
import { modelIdFromRef, siblingBranchMeta } from "@maximus/domain";
import { BrandMark } from "#/components/layout/brand-mark";
import { Button, IconButton } from "#/components/ui";
import { MarkdownRenderer } from "#/components/markdown/markdown-renderer";
import { cn } from "#/lib/cn";
import { AttachmentImage } from "./attachment-image";
import type { ContentPartUi, GenerationMetricsUi } from "./chat-types";

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  parts?: ContentPartUi[];
  status?: string;
  parentMessageId?: string | null;
  position?: number;
  modelRef?: string | null;
  metrics?: GenerationMetricsUi | null;
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function GenerationFooter({ metrics }: { metrics: GenerationMetricsUi }) {
  const bits: string[] = [];
  bits.push(formatDuration(metrics.latencyMs));
  if (metrics.ttftMs != null && metrics.ttftMs > 0) {
    bits.push(`TTFT ${formatDuration(metrics.ttftMs)}`);
  }
  if (metrics.inputTokens || metrics.outputTokens) {
    bits.push(`${metrics.inputTokens}→${metrics.outputTokens} tok`);
  }
  if (metrics.tokensPerSec != null && metrics.tokensPerSec > 0) {
    bits.push(`${metrics.tokensPerSec} tok/s`);
  }
  if (metrics.providerKind) {
    bits.push(metrics.providerKind);
  }
  // Full model id (e.g. gemma3:4b) — never split(":").pop() which yields "4b".
  const modelLabel = metrics.modelRef
    ? modelIdFromRef(metrics.modelRef)
    : "";
  if (modelLabel) bits.push(modelLabel);
  return (
    <p
      className="mt-2 text-[11px] tabular-nums text-text-faint"
      title={metrics.modelRef || undefined}
    >
      {bits.join(" · ")}
    </p>
  );
}

/**
 * ChatGPT-style thread:
 * - User: right-aligned soft rectangular bubble (no per-message avatar)
 * - Assistant: left brand mark + full-width prose
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
      <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col gap-4 px-4 py-6 md:px-5 md:py-8">
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
                <div className="flex gap-3.5">
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-sidebar-active text-text-primary"
                    aria-hidden
                  >
                    <BrandMark className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    {editingId === m.id ? null : (
                      <div className="space-y-2">
                        {m.content ? (
                          <MarkdownRenderer content={m.content} />
                        ) : null}
                        {(m.parts ?? [])
                          .filter((p) => p.type === "image" && p.attachmentId)
                          .map((p) => (
                            <AttachmentImage
                              key={p.attachmentId}
                              attachmentId={p.attachmentId!}
                              showDownload
                            />
                          ))}
                        {m.status === "streaming" &&
                        !m.content &&
                        !(m.parts ?? []).some((p) => p.type === "image") ? (
                          <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-muted" />
                        ) : null}
                        {m.status !== "streaming" && m.metrics ? (
                          <GenerationFooter metrics={m.metrics} />
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* ChatGPT user bubble: soft rounded rect, no avatar circle */
                <div
                  className={cn(
                    "user-msg-bubble w-fit max-w-[min(100%,42rem)] bg-bg-user-bubble px-4 py-3 text-[15px] leading-[1.55] text-text-primary",
                  )}
                >
                  {editingId === m.id ? (
                    <div className="flex min-w-[16rem] flex-col gap-2 sm:min-w-[20rem]">
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
                    <div className="space-y-2">
                      {(m.parts ?? [])
                        .filter((p) => p.type === "image" && p.attachmentId)
                        .map((p) => (
                          <AttachmentImage
                            key={p.attachmentId}
                            attachmentId={p.attachmentId!}
                            className="block"
                          />
                        ))}
                      {m.content ? (
                        <p className="whitespace-pre-wrap break-words">
                          {m.content}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* Actions under turn — hover for both user and assistant */}
              <div
                className={cn(
                  "mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
                  isUser ? "justify-end" : "ml-10",
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
                  <>
                    <IconButton
                      icon={Copy}
                      label="Copy"
                      iconSize="sm"
                      className="h-7 w-7 text-text-muted"
                      onClick={() => navigator.clipboard.writeText(m.content)}
                    />
                    <IconButton
                      icon={Pencil}
                      label="Edit message"
                      iconSize="sm"
                      className="h-7 w-7 text-text-muted"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditText(m.content);
                      }}
                    />
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
