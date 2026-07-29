import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { IconButton } from "#/components/ui";
import { AppShell } from "#/components/layout/app-shell";
import { SidebarNav } from "#/features/sidebar/sidebar-nav";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList, type UiMessage } from "./message-list";

type ConvRow = { id: string; title: string | null; updatedAt: string };

/**
 * ChatGPT-faithful workspace wired to server-authoritative /api/chat.
 */
export function ChatWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelRef, setModelRef] = useState("openai:platform:gpt-4.1");
  const [draft, setDraft] = useState("");
  const [composerKey, setComposerKey] = useState(0);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [history, setHistory] = useState<ConvRow[]>([]);
  const [abort, setAbort] = useState<AbortController | null>(null);

  const refreshHistory = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversations: Array<{ id: string; title: string | null; updatedAt: string }>;
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

  async function loadConversation(id: string) {
    setActiveId(id);
    setMobileOpen(false);
    const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: Array<{
        id: string;
        role: string;
        content: Array<{ type: string; text?: string }>;
        status: string;
      }>;
    };
    setMessages(
      data.messages.map((m) => ({
        id: m.id,
        role: m.role as UiMessage["role"],
        content: m.content
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n"),
        status: m.status,
      })),
    );
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setDraft("");
    setComposerKey((k) => k + 1);
    setMobileOpen(false);
  }

  async function send(text: string, mode?: "send" | "regenerate", targetMessageId?: string) {
    const ac = new AbortController();
    setAbort(ac);
    setStreaming(true);
    const tempUserId = `tmp_u_${Date.now()}`;
    if (mode !== "regenerate") {
      setMessages((m) => [
        ...m,
        { id: tempUserId, role: "user", content: text, status: "complete" },
      ]);
    }
    const tempAsstId = `tmp_a_${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: tempAsstId, role: "assistant", content: "", status: "streaming" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
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
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === tempAsstId
                    ? { ...m, content: m.content + ev.text }
                    : m,
                ),
              );
            }
            if (ev.type === "done") {
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === tempAsstId
                    ? {
                        ...m,
                        content: ev.content ?? m.content,
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
      await refreshHistory();
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
        {messages.length === 0 ? (
          <EmptyState
            onSuggestion={(text) => {
              setDraft(text);
              setComposerKey((k) => k + 1);
            }}
          />
        ) : (
          <MessageList
            messages={messages}
            onRegenerate={(id) => void send("", "regenerate", id)}
          />
        )}

        <Composer
          key={composerKey}
          modelRef={modelRef}
          onModelChange={setModelRef}
          initialValue={draft}
          streaming={streaming}
          onStop={() => abort?.abort()}
          onSend={(text) => void send(text)}
        />
      </div>
    </AppShell>
  );
}
