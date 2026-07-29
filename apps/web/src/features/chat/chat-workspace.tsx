import { useState } from "react";
import { Menu } from "lucide-react";
import { IconButton } from "#/components/ui";
import { AppShell } from "#/components/layout/app-shell";
import { SidebarNav } from "#/features/sidebar/sidebar-nav";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";

/**
 * WP1 ChatGPT-faithful shell with fake data.
 * Wired to real chat API in later work packages.
 */
export function ChatWorkspace() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modelRef, setModelRef] = useState("openai:platform:gpt-4.1");
  const [draft, setDraft] = useState("");
  const [composerKey, setComposerKey] = useState(0);

  function newChat() {
    setActiveId(null);
    setDraft("");
    setComposerKey((k) => k + 1);
    setMobileOpen(false);
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
          onSelectConversation={(id) => {
            setActiveId(id);
            setMobileOpen(false);
          }}
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
        {activeId ? (
          <div className="flex flex-1 items-center justify-center px-4 text-sm text-text-muted">
            Thread view lands with chat persistence (WP6). Selected: {activeId}
          </div>
        ) : (
          <EmptyState
            onSuggestion={(text) => {
              setDraft(text);
              setComposerKey((k) => k + 1);
            }}
          />
        )}

        <Composer
          key={composerKey}
          modelRef={modelRef}
          onModelChange={setModelRef}
          initialValue={draft}
          onSend={() => {
            // WP6: create conversation + stream
          }}
        />
      </div>
    </AppShell>
  );
}
