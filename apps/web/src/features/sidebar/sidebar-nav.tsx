import {
  Folder,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Shield,
  Sun,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Icon, IconButton, Input, Separator } from "#/components/ui";
import { Wordmark } from "#/components/layout/wordmark";
import { useTheme } from "#/features/theme/theme-provider";
import { ConversationList } from "./conversation-list";
import type { FakeConversation } from "./fake-conversations";

export function SidebarNav({
  collapsed,
  onToggleCollapsed,
  onNewChat,
  activeId,
  onSelectConversation,
  conversations,
  searchQuery = "",
  onSearchQueryChange,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  activeId?: string | null;
  onSelectConversation?: (id: string) => void;
  conversations?: FakeConversation[];
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { role?: string } | null) => {
        setIsAdmin(d?.role === "admin" || d?.role === "owner");
      });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
        queueMicrotask(() => searchRef.current?.focus());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div
        className={
          collapsed
            ? "flex flex-col items-center gap-2 p-2"
            : "flex items-center gap-1 p-3"
        }
      >
        {!collapsed ? <Wordmark className="mr-auto" /> : null}
        <IconButton
          icon={PanelLeft}
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        />
      </div>

      <div className={collapsed ? "flex flex-col items-center gap-1 px-1" : "px-2"}>
        {collapsed ? (
          <IconButton icon={Plus} label="New chat" onClick={onNewChat} />
        ) : (
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={onNewChat}
          >
            <Icon icon={Plus} size="sm" />
            New chat
          </Button>
        )}
        {collapsed ? (
          <IconButton
            icon={Search}
            label="Search chats"
            onClick={() => {
              onToggleCollapsed();
              setSearchOpen(true);
            }}
          />
        ) : (
          <Button
            variant="ghost"
            className="mt-1 w-full justify-start text-text-muted"
            onClick={() => {
              setSearchOpen(true);
              queueMicrotask(() => searchRef.current?.focus());
            }}
          >
            <Icon icon={Search} size="sm" />
            Search chats
            <kbd className="ml-auto hidden text-[10px] text-text-muted sm:inline">
              ⌘K
            </kbd>
          </Button>
        )}
      </div>

      {!collapsed && (searchOpen || searchQuery) ? (
        <div className="px-2 pt-2">
          <label className="sr-only" htmlFor="sidebar-search">
            Search conversations
          </label>
          <Input
            id="sidebar-search"
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Search chats…"
            className="h-9"
            autoComplete="off"
          />
          {conversations && conversations.length === 0 && searchQuery ? (
            <p className="mt-2 px-1 text-xs text-text-muted">No chats found</p>
          ) : null}
        </div>
      ) : null}

      {!collapsed ? (
        <div className="mt-3 px-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-muted hover:bg-bg-composer hover:text-text-primary"
          >
            <Icon icon={Folder} size="sm" />
            Projects
          </button>
        </div>
      ) : null}

      <Separator className="my-2" />

      <ConversationList
        collapsed={collapsed}
        activeId={activeId}
        onSelect={onSelectConversation}
        items={conversations}
      />

      <Separator />
      <div
        className={
          collapsed
            ? "flex flex-col items-center gap-1 p-2"
            : "flex items-center gap-1 p-2"
        }
      >
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={toggleTheme}
        />
        {!collapsed ? (
          <Link
            to="/settings/general"
            className="inline-flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-bg-composer hover:text-text-primary"
          >
            <Icon icon={Settings} size="sm" />
            Settings
          </Link>
        ) : (
          <Link to="/settings/general">
            <IconButton icon={Settings} label="Settings" />
          </Link>
        )}
        {isAdmin ? (
          collapsed ? (
            <Link to="/admin">
              <IconButton icon={Shield} label="Admin" />
            </Link>
          ) : (
            <Link
              to="/admin"
              className="inline-flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-bg-composer hover:text-text-primary"
            >
              <Icon icon={Shield} size="sm" />
              Admin
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}
