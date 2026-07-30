import { useState } from "react";
import { Menu } from "lucide-react";
import { IconButton } from "#/components/ui";
import { AppShell } from "#/components/layout/app-shell";
import { SidebarNav } from "#/features/sidebar/sidebar-nav";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList } from "./message-list";
import { ModelSelect } from "./model-select";
import { useChatWorkspace } from "./use-chat-workspace";

/**
 * ChatGPT-class workspace chrome: top model chip, clean canvas, pill composer.
 */
export function ChatWorkspace() {
  const [modelRef, setModelRef] = useState("");
  const chat = useChatWorkspace(modelRef);

  return (
    <AppShell
      collapsed={chat.collapsed}
      mobileOpen={chat.mobileOpen}
      onMobileClose={() => chat.setMobileOpen(false)}
      sidebar={
        <SidebarNav
          collapsed={chat.collapsed}
          onToggleCollapsed={() => chat.setCollapsed((c) => !c)}
          onNewChat={chat.newChat}
          activeId={chat.activeId}
          onSelectConversation={(id) => void chat.loadConversation(id)}
          conversations={chat.history.map((h) => ({
            id: h.id,
            title: h.title ?? "New chat",
            updatedAt: h.updatedAt,
          }))}
          searchQuery={chat.searchQuery}
          onSearchQueryChange={chat.setSearchQuery}
        />
      }
    >
      {/* Top bar: mobile menu + model (ChatGPT places model at top-center) */}
      <header className="relative flex h-12 shrink-0 items-center px-2 md:h-14 md:px-3">
        <IconButton
          icon={Menu}
          label="Open menu"
          className="md:hidden"
          onClick={() => chat.setMobileOpen(true)}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <ModelSelect value={modelRef} onChange={setModelRef} />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {chat.displayMessages.length === 0 ? (
          <EmptyState
            onSuggestion={(text) => {
              chat.setDraft(text);
              chat.setComposerKey((k) => k + 1);
            }}
          />
        ) : (
          <MessageList
            messages={chat.displayMessages}
            tree={chat.tree}
            onRegenerate={(id) => void chat.send("", "regenerate", id)}
            onEdit={(id, text) => void chat.send(text, "edit", id)}
            onFeedback={(id, rating) => void chat.postFeedback(id, rating)}
            onBranch={(id, dir) => void chat.switchBranch(id, dir)}
          />
        )}

        <Composer
          key={chat.composerKey}
          initialValue={chat.draft}
          streaming={chat.streaming}
          disabled={!modelRef}
          onStop={() => chat.abort?.abort()}
          onSend={(text, attachmentIds) =>
            void chat.send(text, "send", undefined, attachmentIds)
          }
        />
      </div>
    </AppShell>
  );
}
