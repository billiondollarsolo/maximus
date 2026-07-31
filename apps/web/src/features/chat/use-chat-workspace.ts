import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  listActiveBranch,
  selectSiblingBranch,
  type TreeMessage,
} from "@maximus/domain";
import type { UiMessage } from "./message-list";
import {
  type ConvRow,
  type ServerMsg,
  metricsFromTokenUsage,
  textFromContent,
} from "./chat-types";
import {
  appendAssistantText,
  applyChatMetaIds,
  consumeChatSse,
  failAssistant,
  finalizeAssistant,
} from "./consume-chat-sse";
import {
  chatTurnIsBusy,
  initialChatTurnState,
  reduceChatTurn,
  type ChatTurnState,
} from "./chat-turn-state";

function resolveLeafId(
  msgs: ServerMsg[],
  preferred: string | null | undefined,
): string | null {
  if (msgs.length === 0) return null;
  if (preferred && msgs.some((m) => m.id === preferred)) return preferred;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]!.role === "assistant") return msgs[i]!.id;
  }
  return msgs[msgs.length - 1]!.id;
}

function toUiMessages(
  treeMsgs: ServerMsg[],
  tree: TreeMessage[],
  activeLeafId: string | null,
): UiMessage[] {
  const leaf = resolveLeafId(treeMsgs, activeLeafId);
  let branch = listActiveBranch(tree, leaf);
  if (branch.length === 0 && treeMsgs.length > 0) {
    branch = tree;
  }
  const byId = new Map(treeMsgs.map((m) => [m.id, m]));
  return branch.map((node) => {
    const full = byId.get(node.id);
    const metrics =
      full?.metrics ??
      metricsFromTokenUsage(full?.modelRef, full?.tokenUsage ?? null);
    return {
      id: node.id,
      role: node.role as UiMessage["role"],
      content: full ? textFromContent(full.content) : "",
      parts: full?.content,
      status: full?.status,
      parentMessageId: node.parentMessageId,
      position: node.position,
      modelRef: full?.modelRef,
      metrics,
      error: full?.error ?? null,
    };
  });
}

/**
 * Chat workspace state machine (intentionally simple):
 * - URL id → load messages (only after success mark route loaded)
 * - send → optimistic rows + SSE patches; always re-fetch when the turn ends
 * - newChat → only place that wipes the thread
 */
export function useChatWorkspace(
  modelRef: string,
  opts?: {
    routeConversationId?: string | null;
    onNavigateConversation?: (id: string | null) => void;
    onConversationModel?: (modelRef: string | null) => void;
  },
) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(
    opts?.routeConversationId ?? null,
  );
  const [draft, setDraft] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [treeMsgs, setTreeMsgs] = useState<ServerMsg[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState<ConvRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Pure turn lifecycle — driven by reduceChatTurn (not only ad-hoc flags). */
  const [turnState, setTurnState] =
    useState<ChatTurnState>(initialChatTurnState);
  const turnStateRef = useRef(turnState);
  turnStateRef.current = turnState;

  const routeId = opts?.routeConversationId ?? null;
  const onNav = opts?.onNavigateConversation;
  const onModel = opts?.onConversationModel;

  function dispatchTurn(
    event: Parameters<typeof reduceChatTurn>[1],
  ): ChatTurnState {
    const next = reduceChatTurn(turnStateRef.current, event);
    turnStateRef.current = next;
    setTurnState(next);
    return next;
  }

  /** Route id whose messages are currently reflected in treeMsgs */
  const syncedRouteRef = useRef<string | null>(null);
  const streamingRef = useRef(false);
  const turnGenRef = useRef(0);
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  const leafRef = useRef<string | null>(null);
  leafRef.current = activeLeafId;

  const refreshHistory = useCallback(async (q?: string) => {
    const qs =
      q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const res = await fetch(`/api/conversations${qs}`, {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversations: Array<{
        id: string;
        title: string | null;
        updatedAt: string;
      }>;
    };
    setHistory(
      data.conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
      })),
    );
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const t = setTimeout(() => {
      void refreshHistory(searchQuery);
    }, 200);
    return () => clearTimeout(t);
  }, [searchQuery, refreshHistory]);

  const tree: TreeMessage[] = useMemo(
    () =>
      treeMsgs.map((m) => ({
        id: m.id,
        parentMessageId: m.parentMessageId,
        role: m.role as TreeMessage["role"],
        position: m.position,
      })),
    [treeMsgs],
  );

  const displayMessages: UiMessage[] = useMemo(
    () => toUiMessages(treeMsgs, tree, activeLeafId),
    [tree, treeMsgs, activeLeafId],
  );

  const applyModelFromConversation = useCallback(
    (data: {
      conversation?: { modelRef?: string | null };
      messages: ServerMsg[];
    }) => {
      let restored: string | null = data.conversation?.modelRef ?? null;
      if (!restored) {
        for (let i = data.messages.length - 1; i >= 0; i--) {
          const msg = data.messages[i];
          if (msg.role === "assistant" && msg.modelRef) {
            restored = msg.modelRef;
            break;
          }
        }
      }
      onModel?.(restored);
    },
    [onModel],
  );

  const loadConversation = useCallback(
    async (
      id: string,
      options?: {
        fromRoute?: boolean;
        /** Apply even while streamingRef is true (end-of-turn sync) */
        force?: boolean;
        /** Expect this turn generation; abort apply if a newer send started */
        turnGen?: number;
      },
    ) => {
      if (streamingRef.current && !options?.force) return;

      const gen = options?.turnGen ?? turnGenRef.current;
      setActiveId(id);
      setMobileOpen(false);
      setLoadError(null);
      if (!options?.fromRoute) {
        onNav?.(id);
      }

      let res: Response;
      try {
        res = await fetch(
          `/api/conversations?id=${encodeURIComponent(id)}`,
          { credentials: "same-origin" },
        );
      } catch {
        setLoadError("Network error loading conversation");
        return;
      }

      if (turnGenRef.current !== gen && options?.force) return;
      if (streamingRef.current && !options?.force) return;

      if (!res.ok) {
        // Keep whatever is on screen — never navigate away mid-session on a blip.
        setLoadError(`Failed to load conversation (${res.status})`);
        return;
      }

      const data = (await res.json()) as {
        conversation?: {
          modelRef?: string | null;
          title?: string | null;
        };
        messages: ServerMsg[];
        activeLeafId: string | null;
      };

      if (turnGenRef.current !== gen && options?.force) return;
      if (streamingRef.current && !options?.force) return;

      setTreeMsgs(data.messages);
      setActiveLeafId(resolveLeafId(data.messages, data.activeLeafId));
      syncedRouteRef.current = id;
      applyModelFromConversation(data);

      // Keep sidebar title in sync with server
      if (data.conversation?.title) {
        setHistory((prev) => {
          const idx = prev.findIndex((c) => c.id === id);
          if (idx === -1) {
            return [
              {
                id,
                title: data.conversation!.title ?? "New chat",
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ];
          }
          const next = [...prev];
          next[idx] = {
            ...next[idx]!,
            title: data.conversation!.title ?? next[idx]!.title,
          };
          return next;
        });
      }
    },
    [applyModelFromConversation, onNav],
  );

  // URL → load. Only depends on routeId string (not loadConversation identity).
  useEffect(() => {
    if (!routeId) return;
    if (syncedRouteRef.current === routeId) return;
    if (streamingRef.current) return;
    void loadConversation(routeId, { fromRoute: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on route id change
  }, [routeId]);

  // Back to `/` only when the path actually transitions away from /c/{id}.
  // Do NOT wipe when we are still on `/` waiting for first-message nav
  // (syncedRouteRef may already be set from SSE meta).
  const prevRouteRef = useRef<string | null>(routeId);
  useEffect(() => {
    const prev = prevRouteRef.current;
    prevRouteRef.current = routeId;
    if (routeId) return;
    if (prev == null) return; // already home (or first paint on `/`)
    if (streamingRef.current) return;
    syncedRouteRef.current = null;
    setActiveId(null);
    setTreeMsgs([]);
    setActiveLeafId(null);
    setDraft("");
    setComposerKey((k) => k + 1);
    setLoadError(null);
  }, [routeId]);

  function newChat() {
    if (streamingRef.current) {
      abort?.abort();
    }
    streamingRef.current = false;
    turnGenRef.current += 1;
    dispatchTurn({ type: "reset" });
    syncedRouteRef.current = null;
    setStreaming(false);
    setAbort(null);
    setActiveId(null);
    setTreeMsgs([]);
    setActiveLeafId(null);
    setDraft("");
    setComposerKey((k) => k + 1);
    setMobileOpen(false);
    setLoadError(null);
    onNav?.(null);
  }

  async function postFeedback(messageId: string, rating: "up" | "down") {
    await fetch("/api/feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, rating }),
    });
  }

  async function switchBranch(messageId: string, direction: -1 | 1) {
    const leaf = selectSiblingBranch(tree, messageId, direction);
    if (!leaf || !activeId) return;
    setActiveLeafId(leaf);
    await fetch("/api/conversations", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeId, activeLeafId: leaf }),
    });
  }

  async function send(
    text: string,
    mode?: "send" | "regenerate" | "edit",
    targetMessageId?: string,
    attachmentIds?: string[],
    interactionMode?: "chat" | "image_gen",
  ) {
    if (!modelRef) return;

    const ac = new AbortController();
    turnGenRef.current += 1;
    const turnGen = turnGenRef.current;
    setAbort(ac);
    streamingRef.current = true;
    setStreaming(true);
    setLoadError(null);

    const tempUserId = `tmp_u_${Date.now()}_${turnGen}`;
    const tempAsstId = `tmp_a_${Date.now()}_${turnGen}`;
    dispatchTurn({ type: "send", assistantId: tempAsstId });
    let liveUserId: string | undefined =
      mode === "regenerate" ? undefined : tempUserId;
    let liveAsstId = tempAsstId;
    /** Stable id for rAF flushes (may change after meta remap). */
    const streamAsstIdRef = { current: tempAsstId };
    /** Coalesce tokens to one paint per animation frame (still progressive). */
    const pendingText = { current: "" };
    let raf = 0;

    const flushPendingText = () => {
      raf = 0;
      const chunk = pendingText.current;
      if (!chunk) return;
      pendingText.current = "";
      const id = streamAsstIdRef.current;
      // Force a paint so React 18 does not batch the whole stream into one frame.
      flushSync(() => {
        setTreeMsgs((ms) => appendAssistantText(ms, id, chunk));
      });
    };

    const enqueueStreamText = (t: string) => {
      pendingText.current += t;
      if (!raf) {
        raf = requestAnimationFrame(flushPendingText);
      }
    };

    const target = targetMessageId
      ? treeMsgs.find((m) => m.id === targetMessageId)
      : undefined;
    const tempUserParent =
      mode === "edit"
        ? (target?.parentMessageId ?? null)
        : leafRef.current;
    const tempAsstParent =
      mode === "regenerate"
        ? (target?.parentMessageId ?? null)
        : tempUserId;

    // Optimistic UI — single functional update so both rows land together
    flushSync(() => {
      setTreeMsgs((prev) => {
        const next = [...prev];
        if (mode !== "regenerate") {
          next.push({
            id: tempUserId,
            role: "user",
            parentMessageId: tempUserParent,
            position: 999,
            content: [
              ...(text ? [{ type: "text", text }] : []),
              ...(attachmentIds ?? []).map((id) => ({
                type: "image" as const,
                attachmentId: id,
                mime: "image/*",
              })),
            ],
            status: "complete",
          });
        }
        next.push({
          id: tempAsstId,
          role: "assistant",
          parentMessageId: tempAsstParent,
          position: 999,
          content: [{ type: "text", text: "" }],
          status: "streaming",
        });
        return next;
      });
      setActiveLeafId(tempAsstId);
    });
    leafRef.current = tempAsstId;

    let convId = activeIdRef.current;
    let sawStreamText = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text, attachmentIds },
          forwardedProps: {
            conversationId: activeIdRef.current ?? undefined,
            modelRef,
            mode: mode ?? "send",
            interactionMode,
            targetMessageId,
          },
        }),
        signal: ac.signal,
      });

      if (turnGenRef.current !== turnGen) return;

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setTreeMsgs((ms) =>
          failAssistant(
            ms,
            liveAsstId,
            errText || `Request failed (${res.status})`,
          ),
        );
        return;
      }

      await consumeChatSse(res.body, {
        onMeta: (meta) => {
          if (turnGenRef.current !== turnGen) return;
          // Flush under temp id before remapping durable ids
          flushPendingText();
          convId = meta.conversationId;
          activeIdRef.current = meta.conversationId;
          setActiveId(meta.conversationId);
          dispatchTurn({
            type: "meta",
            conversationId: meta.conversationId,
            assistantId: meta.assistantMessageId,
          });

          flushSync(() => {
            setTreeMsgs((ms) =>
              applyChatMetaIds(
                ms,
                { userId: liveUserId, assistantId: liveAsstId },
                meta,
              ),
            );
            if (meta.assistantMessageId) {
              setActiveLeafId(meta.assistantMessageId);
            }
          });
          if (meta.userMessageId) liveUserId = meta.userMessageId;
          if (meta.assistantMessageId) {
            liveAsstId = meta.assistantMessageId;
            streamAsstIdRef.current = meta.assistantMessageId;
            leafRef.current = meta.assistantMessageId;
          }

          setHistory((prev) => {
            if (prev.some((c) => c.id === meta.conversationId)) return prev;
            return [
              {
                id: meta.conversationId,
                title: text.trim().slice(0, 60) || "New chat",
                updatedAt: new Date().toISOString(),
              },
              ...prev,
            ];
          });

          if (routeId !== meta.conversationId) {
            onNav?.(meta.conversationId);
          }
          syncedRouteRef.current = meta.conversationId;
        },
        onText: (t) => {
          if (turnGenRef.current !== turnGen) return;
          sawStreamText = true;
          dispatchTurn({ type: "text", text: t });
          enqueueStreamText(t);
        },
        onDone: (content, status, contentParts, metrics) => {
          if (turnGenRef.current !== turnGen) return;
          flushPendingText();
          dispatchTurn({ type: "done" });
          flushSync(() => {
            setTreeMsgs((ms) =>
              finalizeAssistant(
                ms,
                liveAsstId,
                content,
                status,
                contentParts,
                metrics,
              ),
            );
          });
        },
        onTitle: (title, conversationId) => {
          if (turnGenRef.current !== turnGen) return;
          setHistory((prev) => {
            const idx = prev.findIndex((c) => c.id === conversationId);
            if (idx === -1) {
              return [
                {
                  id: conversationId,
                  title,
                  updatedAt: new Date().toISOString(),
                },
                ...prev,
              ];
            }
            const next = [...prev];
            next[idx] = { ...next[idx]!, title };
            return next;
          });
        },
        onStatus: () => {
          /* keepalives only — long-wait UI is timer-based in MessageList */
        },
        onError: (message) => {
          if (turnGenRef.current !== turnGen) return;
          flushPendingText();
          dispatchTurn({ type: "error", message });
          setTreeMsgs((ms) => failAssistant(ms, liveAsstId, message));
        },
      });
      flushPendingText();
    } catch (err) {
      if (turnGenRef.current !== turnGen) return;
      flushPendingText();
      if (err instanceof Error && err.name === "AbortError") {
        dispatchTurn({ type: "abort" });
        setTreeMsgs((ms) =>
          finalizeAssistant(ms, liveAsstId, undefined, "aborted"),
        );
      } else {
        const message =
          err instanceof Error ? err.message : "chat failed";
        dispatchTurn({ type: "error", message });
        setTreeMsgs((ms) => failAssistant(ms, liveAsstId, message));
      }
    } finally {
      if (turnGenRef.current === turnGen) {
        flushPendingText();
        // Prefer the live streamed tree. Only force-reload if we never got
        // tokens (proxy drop / missed SSE) so the UI can recover from DB.
        if (convId) {
          if (!sawStreamText) {
            try {
              await loadConversation(convId, {
                fromRoute: true,
                force: true,
                turnGen,
              });
            } catch {
              // keep local tree
            }
          } else {
            syncedRouteRef.current = convId;
          }
          await refreshHistory(searchQuery);
        }
        dispatchTurn({ type: "finalize_done" });
        streamingRef.current = false;
        setStreaming(chatTurnIsBusy(turnStateRef.current));
        // After finalize_done, phase is idle — clear streaming UI flag.
        setStreaming(false);
        setAbort(null);
      }
    }
  }

  return {
    collapsed,
    setCollapsed,
    mobileOpen,
    setMobileOpen,
    activeId,
    draft,
    setDraft,
    composerKey,
    setComposerKey,
    tree,
    treeMsgs,
    displayMessages,
    streaming,
    turnPhase: turnState.phase,
    history,
    searchQuery,
    setSearchQuery,
    abort,
    loadError,
    loadConversation,
    newChat,
    postFeedback,
    switchBranch,
    send,
    refreshHistory,
  };
}
