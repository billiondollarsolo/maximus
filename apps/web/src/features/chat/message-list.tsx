import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
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
import {
  assistantErrorDisplayText,
  isAssistantErrorStatus,
} from "./assistant-error-display";
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
  error?: { message?: string; code?: string } | null;
};

/** Show “this may take a while” only after empty streaming has lasted this long. */
const LONG_WAIT_HINT_MS = 8_000;
/** Distance from bottom still counted as “stuck to bottom”. */
const STICK_BOTTOM_PX = 80;

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

/** Pulse cursor; after LONG_WAIT_HINT_MS of still-empty stream, show load hint. */
function StreamingPlaceholder() {
  const [showLongWait, setShowLongWait] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShowLongWait(true), LONG_WAIT_HINT_MS);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="inline-block h-4 w-1.5 animate-pulse rounded-sm bg-text-muted" />
      {showLongWait ? (
        <p className="text-[12px] text-text-faint">
          Still waiting for the first token…
          <span className="text-text-muted">
            {" "}
            Large local models can take a while to load into memory.
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Conversation thread:
 * - User: right-aligned soft rectangular bubble (no per-message avatar)
 * - Assistant: left brand mark + full-width prose
 * - Auto-scroll while stuck to bottom; jump-to-bottom chip when user scrolls up
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
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showJumpBottom, setShowJumpBottom] = useState(false);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  /** Ignore scroll events we cause ourselves via scrollToBottom */
  const programmaticScrollRef = useRef(false);

  const treeForMeta = tree.map((m) => ({
    id: m.id,
    parentMessageId: m.parentMessageId,
    role: m.role as "user" | "assistant" | "system" | "tool",
    position: m.position,
  }));

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setStickToBottom(true);
    setShowJumpBottom(false);
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, behavior === "smooth" ? 350 : 50);
  }, []);

  const onScroll = useCallback(() => {
    if (programmaticScrollRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = dist <= STICK_BOTTOM_PX;
    setStickToBottom(nearBottom);
    setShowJumpBottom(!nearBottom);
  }, []);

  // New content while stuck → keep bottom in view
  useLayoutEffect(() => {
    if (!stickToBottom) return;
    const el = scrollerRef.current;
    if (!el) return;
    programmaticScrollRef.current = true;
    el.scrollTop = el.scrollHeight;
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 0);
  }, [messages, stickToBottom]);

  // New send → always re-stick to the latest turn
  const prevCountRef = useRef(messages.length);
  useLayoutEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (messages.length <= prev) return;
    const last = messages[messages.length - 1];
    if (last?.role === "user" || last?.status === "streaming") {
      setStickToBottom(true);
      setShowJumpBottom(false);
      const el = scrollerRef.current;
      if (!el) return;
      programmaticScrollRef.current = true;
      el.scrollTop = el.scrollHeight;
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 0);
    }
  }, [messages]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
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
                          {(() => {
                            const errText = isAssistantErrorStatus(m.status)
                              ? assistantErrorDisplayText({
                                  status: m.status ?? "error",
                                  content: m.parts?.length
                                    ? m.parts
                                    : m.content
                                      ? [{ type: "text", text: m.content }]
                                      : [],
                                  error: m.error,
                                })
                              : null;
                            if (errText) {
                              return (
                                <p className="whitespace-pre-wrap text-[13px] text-red-400">
                                  {errText}
                                </p>
                              );
                            }
                            if (m.content) {
                              return (
                                <MarkdownRenderer
                                  content={m.content}
                                  streaming={m.status === "streaming"}
                                />
                              );
                            }
                            return null;
                          })()}
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
                            <StreamingPlaceholder />
                          ) : null}
                          {m.status !== "streaming" && m.metrics ? (
                            <GenerationFooter metrics={m.metrics} />
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
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
                        onClick={() =>
                          navigator.clipboard.writeText(m.content)
                        }
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
                        onClick={() =>
                          navigator.clipboard.writeText(m.content)
                        }
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
          <div ref={bottomRef} aria-hidden className="h-px w-full shrink-0" />
        </div>
      </div>

      {showJumpBottom ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-elevated px-3 py-1.5 text-[12px] font-medium text-text-secondary shadow-md transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            Jump to latest
          </button>
        </div>
      ) : null}
    </div>
  );
}
