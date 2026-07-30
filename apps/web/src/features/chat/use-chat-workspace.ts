import { useCallback, useEffect, useMemo, useState } from "react";
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

export function useChatWorkspace(modelRef: string) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [treeMsgs, setTreeMsgs] = useState<ServerMsg[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState<ConvRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [abort, setAbort] = useState<AbortController | null>(null);

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
        status: full?.status,
        parentMessageId: node.parentMessageId,
        position: node.position,
      };
    });
  }, [tree, treeMsgs, activeLeafId]);

  async function loadConversation(id: string) {
    setActiveId(id);
    setMobileOpen(false);
    const res = await fetch(
      `/api/conversations?id=${encodeURIComponent(id)}`,
      { credentials: "same-origin" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: ServerMsg[];
      activeLeafId: string | null;
    };
    setTreeMsgs(data.messages);
    setActiveLeafId(
      data.activeLeafId ?? data.messages[data.messages.length - 1]?.id ?? null,
    );
  }

  function newChat() {
    setActiveId(null);
    setTreeMsgs([]);
    setActiveLeafId(null);
    setDraft("");
    setComposerKey((k) => k + 1);
    setMobileOpen(false);
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
          content: [{ type: "text", text }],
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
        },
        onText: (t) => {
          setTreeMsgs((ms) => appendAssistantText(ms, tempAsstId, t));
        },
        onDone: (content, status) => {
          setTreeMsgs((ms) =>
            finalizeAssistant(ms, tempAsstId, content, status),
          );
        },
      });
      if (convId) await loadConversation(convId);
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
  };
}
