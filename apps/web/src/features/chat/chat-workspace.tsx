import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu } from "lucide-react";
import {
  listActiveBranch,
  selectSiblingBranch,
  type TreeMessage,
} from "@maximus/domain";
import { IconButton } from "#/components/ui";
import { AppShell } from "#/components/layout/app-shell";
import { SidebarNav } from "#/features/sidebar/sidebar-nav";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList, type UiMessage } from "./message-list";

type ConvRow = { id: string; title: string | null; updatedAt: string };

type ServerMsg = {
  id: string;
  role: string;
  parentMessageId: string | null;
  position: number;
  content: Array<{ type: string; text?: string }>;
  status: string;
};

function textFromContent(
  content: Array<{ type: string; text?: string }>,
): string {
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n");
}

/**
 * ChatGPT-faithful workspace: server-authoritative chat + branch switcher.
 */
export function ChatWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelRef, setModelRef] = useState("openai:platform:gpt-4.1");
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
      q && q.trim()
        ? `?q=${encodeURIComponent(q.trim())}`
        : "";
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
      data.activeLeafId ??
        data.messages[data.messages.length - 1]?.id ??
        null,
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
    const ac = new AbortController();
    setAbort(ac);
    setStreaming(true);
    const tempUserId = `tmp_u_${Date.now()}`;
    const tempAsstId = `tmp_a_${Date.now()}`;
    const target = targetMessageId
      ? treeMsgs.find((m) => m.id === targetMessageId)
      : undefined;
    // edit-fork: sibling of edited user; send: under current leaf; regenerate: sibling of assistant
    const tempUserParent =
      mode === "edit"
        ? (target?.parentMessageId ?? null)
        : activeLeafId;
    const tempAsstParent =
      mode === "regenerate"
        ? (target?.parentMessageId ?? null)
        : tempUserId;

    // Optimistic linear preview only
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
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let convId = activeId;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          try {
            const ev = JSON.parse(json) as {
              type: string;
              conversationId?: string;
              text?: string;
              content?: string;
              status?: string;
            };
            if (ev.type === "meta" && ev.conversationId) {
              convId = ev.conversationId;
              setActiveId(ev.conversationId);
            }
            if (ev.type === "text" && ev.text) {
              setTreeMsgs((ms) =>
                ms.map((m) =>
                  m.id === tempAsstId
                    ? {
                        ...m,
                        content: [
                          {
                            type: "text",
                            text:
                              (m.content[0]?.text ?? "") + (ev.text ?? ""),
                          },
                        ],
                      }
                    : m,
                ),
              );
            }
            if (ev.type === "done") {
              setTreeMsgs((ms) =>
                ms.map((m) =>
                  m.id === tempAsstId
                    ? {
                        ...m,
                        content: [
                          {
                            type: "text",
                            text: ev.content ?? m.content[0]?.text ?? "",
                          },
                        ],
                        status: ev.status ?? "complete",
                      }
                    : m,
                ),
              );
            }
          } catch {
            // ignore partial
          }
        }
      }
      if (convId) await loadConversation(convId);
      await refreshHistory(searchQuery);
    } finally {
      setStreaming(false);
      setAbort(null);
    }
  }

  return (
    <AppShell
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onMobileClose={() => setMobileOpen(false)}
      sidebar={
        <SidebarNav
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onNewChat={newChat}
          activeId={activeId}
          onSelectConversation={(id) => void loadConversation(id)}
          conversations={history.map((h) => ({
            id: h.id,
            title: h.title ?? "New chat",
            updatedAt: h.updatedAt,
          }))}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
        />
      }
    >
      <header className="flex h-12 items-center gap-2 border-b border-border-subtle px-2 md:px-4">
        <IconButton
          icon={Menu}
          label="Open menu"
          className="md:hidden"
          onClick={() => setMobileOpen(true)}
        />
        <span className="text-sm text-text-muted">
          {activeId ? "Conversation" : "New chat"}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {displayMessages.length === 0 ? (
          <EmptyState
            onSuggestion={(text) => {
              setDraft(text);
              setComposerKey((k) => k + 1);
            }}
          />
        ) : (
          <MessageList
            messages={displayMessages}
            tree={tree}
            onRegenerate={(id) => void send("", "regenerate", id)}
            onEdit={(id, text) => void send(text, "edit", id)}
            onFeedback={(id, rating) => void postFeedback(id, rating)}
            onBranch={(id, dir) => void switchBranch(id, dir)}
          />
        )}

        <Composer
          key={composerKey}
          modelRef={modelRef}
          onModelChange={setModelRef}
          initialValue={draft}
          streaming={streaming}
          onStop={() => abort?.abort()}
          onSend={(text, attachmentIds) =>
            void send(text, "send", undefined, attachmentIds)
          }
        />
      </div>
    </AppShell>
  );
}
