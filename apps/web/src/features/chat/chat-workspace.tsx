import { useState } from "react";
import { Menu } from "lucide-react";
import { IconButton } from "#/components/ui";
import { AppShell } from "#/components/layout/app-shell";
import { SidebarNav } from "#/features/sidebar/sidebar-nav";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { MessageList } from "./message-list";
import { useChatWorkspace } from "./use-chat-workspace";

/**
 * Black canvas + expanded composer (model inside field). Mobile menu only in header.
 */
export function ChatWorkspace() {
  const [modelRef, setModelRef] = useState("");
  const chat = useChatWorkspace(modelRef);
  const isEmpty = chat.displayMessages.length === 0;

  const composer = (
    <Composer
      key={chat.composerKey}
      modelRef={modelRef}
      onModelChange={setModelRef}
      initialValue={chat.draft}
      streaming={chat.streaming}
      disabled={!modelRef}
      centered={isEmpty}
      onStop={() => chat.abort?.abort()}
      onSend={(text, attachmentIds) =>
        void chat.send(text, "send", undefined, attachmentIds)
      }
    />
  );

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
      {/* Slim mobile-only header (model lives in composer) */}
      <header className="flex h-11 shrink-0 items-center px-2 md:h-0 md:overflow-hidden md:p-0">
        <IconButton
          icon={Menu}
          label="Open menu"
          className="md:hidden"
          onClick={() => chat.setMobileOpen(true)}
        />
      </header>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col items-center justify-center pb-6">
            <EmptyState />
            {composer}
          </div>
          <p className="pb-4 text-center text-[11px] text-text-faint">
            Maximus is AI. Check important info.
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageList
            messages={chat.displayMessages}
            tree={chat.tree}
            onRegenerate={(id) => void chat.send("", "regenerate", id)}
            onEdit={(id, text) => void chat.send(text, "edit", id)}
            onFeedback={(id, rating) => void chat.postFeedback(id, rating)}
            onBranch={(id, dir) => void chat.switchBranch(id, dir)}
          />
          {composer}
        </div>
      )}
    </AppShell>
  );
}
