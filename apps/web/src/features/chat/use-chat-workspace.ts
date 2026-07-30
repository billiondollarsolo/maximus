import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listActiveBranch,
  selectSiblingBranch,
  type TreeMessage,
} from "@maximus/domain";
import type { UiMessage } from "./message-list";
import {
  type ConvRow,
  type ServerMsg,
  textFromContent,
} from "./chat-types";
import {
  appendAssistantText,
  consumeChatSse,
  finalizeAssistant,
} from "./consume-chat-sse";

export function useChatWorkspace(
  modelRef: string,
  opts?: {
    /** Conversation id from the URL (`/c/$id` or null on `/`) */
    routeConversationId?: string | null;
    /** Keep address bar in sync (ChatGPT-style deep links) */
    onNavigateConversation?: (id: string | null) => void;
    /** Restore model picker when opening a conversation */
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

  const routeId = opts?.routeConversationId ?? null;
  const onNav = opts?.onNavigateConversation;
  const onModel = opts?.onConversationModel;
  /** Avoid re-loading the same route id in a loop */
  const loadedRouteRef = useRef<string | null>(null);

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

  const displayMessages: UiMessage[] = useMemo(() => {
    const branch = listActiveBranch(tree, activeLeafId);
    const byId = new Map(treeMsgs.map((m) => [m.id, m]));
    return branch.map((node) => {
      const full = byId.get(node.id);
      return {
        id: node.id,
        role: node.role as UiMessage["role"],
        content: full ? textFromContent(full.content) : "",
        parts: full?.content,
        status: full?.status,
        parentMessageId: node.parentMessageId,
        position: node.position,
      };
    });
  }, [tree, treeMsgs, activeLeafId]);

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
    async (id: string, options?: { fromRoute?: boolean }) => {
      setActiveId(id);
      setMobileOpen(false);
      if (!options?.fromRoute) {
        onNav?.(id);
      }
      loadedRouteRef.current = id;

      const res = await fetch(
        `/api/conversations?id=${encodeURIComponent(id)}`,
        { credentials: "same-origin" },
      );
      if (!res.ok) {
        // Missing / unauthorized — go home
        if (res.status === 404 || res.status === 403 || res.status === 401) {
          loadedRouteRef.current = null;
          setActiveId(null);
          setTreeMsgs([]);
          setActiveLeafId(null);
          onNav?.(null);
        }
        return;
      }
      const data = (await res.json()) as {
        conversation?: { modelRef?: string | null };
        messages: ServerMsg[];
        activeLeafId: string | null;
      };
      setTreeMsgs(data.messages);
      setActiveLeafId(
        data.activeLeafId ??
          data.messages[data.messages.length - 1]?.id ??
          null,
      );
      applyModelFromConversation(data);
    },
    [applyModelFromConversation, onNav],
  );

  // URL → state (deep link / sidebar navigation via router)
  useEffect(() => {
    if (routeId) {
      if (loadedRouteRef.current !== routeId) {
        void loadConversation(routeId, { fromRoute: true });
      }
      return;
    }
    // `/` — new chat shell; clear thread if we left a conversation URL
    if (loadedRouteRef.current !== null && !streaming) {
      loadedRouteRef.current = null;
      setActiveId(null);
      setTreeMsgs([]);
      setActiveLeafId(null);
      setDraft("");
      setComposerKey((k) => k + 1);
    }
  }, [routeId, loadConversation, streaming]);

  function newChat() {
    loadedRouteRef.current = null;
    setActiveId(null);
    setTreeMsgs([]);
    setActiveLeafId(null);
    setDraft("");
    setComposerKey((k) => k + 1);
    setMobileOpen(false);
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
    setAbort(ac);
    setStreaming(true);
    const tempUserId = `tmp_u_${Date.now()}`;
    const tempAsstId = `tmp_a_${Date.now()}`;
    const target = targetMessageId
      ? treeMsgs.find((m) => m.id === targetMessageId)
      : undefined;
    const tempUserParent =
      mode === "edit" ? (target?.parentMessageId ?? null) : activeLeafId;
    const tempAsstParent =
      mode === "regenerate"
        ? (target?.parentMessageId ?? null)
        : tempUserId;

    if (mode !== "regenerate") {
      setTreeMsgs((prev) => [
        ...prev,
        {
          id: tempUserId,
          role: "user",
          parentMessageId: tempUserParent,
          position: 999,
          content: [
            ...(text ? [{ type: "text", text }] : []),
            ...(attachmentIds ?? []).map((id) => ({
              type: "image",
              attachmentId: id,
              mime: "image/*",
            })),
          ],
          status: "complete",
        },
      ]);
    }
    setTreeMsgs((prev) => [
      ...prev,
      {
        id: tempAsstId,
        role: "assistant",
        parentMessageId: tempAsstParent,
        position: 999,
        content: [{ type: "text", text: "" }],
        status: "streaming",
      },
    ]);
    setActiveLeafId(tempAsstId);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text, attachmentIds },
          forwardedProps: {
            conversationId: activeId ?? undefined,
            modelRef,
            mode: mode ?? "send",
            interactionMode,
            targetMessageId,
          },
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setStreaming(false);
        return;
      }
      let convId = activeId;
      await consumeChatSse(res.body, {
        onMeta: (id) => {
          convId = id;
          setActiveId(id);
          loadedRouteRef.current = id;
          // First message creates the thread — put id in the address bar
          onNav?.(id);
        },
        onText: (t) => {
          setTreeMsgs((ms) => appendAssistantText(ms, tempAsstId, t));
        },
        onDone: (content, status, contentParts) => {
          setTreeMsgs((ms) =>
            finalizeAssistant(ms, tempAsstId, content, status, contentParts),
          );
        },
      });
      if (convId) await loadConversation(convId, { fromRoute: true });
      await refreshHistory(searchQuery);
    } finally {
      setStreaming(false);
      setAbort(null);
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
    displayMessages,
    streaming,
    history,
    searchQuery,
    setSearchQuery,
    abort,
    loadConversation,
    newChat,
    postFeedback,
    switchBranch,
    send,
    refreshHistory,
  };
}
