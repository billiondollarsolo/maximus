import {
  Folder,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Shield,
  SquarePen,
  Sun,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Icon, IconButton, Input } from "#/components/ui";
import { Wordmark } from "#/components/layout/wordmark";
import { useTheme } from "#/features/theme/theme-provider";
import { cn } from "#/lib/cn";
import { ConversationList } from "./conversation-list";
import type { FakeConversation } from "./fake-conversations";

function NavItem({
  icon,
  label,
  onClick,
  trailing,
  active,
}: {
  icon: typeof Plus;
  label: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] transition-colors",
        active
          ? "bg-bg-sidebar-active text-text-primary"
          : "text-text-secondary hover:bg-bg-sidebar-hover hover:text-text-primary",
      )}
    >
      <Icon icon={icon} size="sm" className="shrink-0 opacity-90" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {trailing}
    </button>
  );
}

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

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1 py-2">
        <IconButton
          icon={PanelLeftOpen}
          label="Expand sidebar"
          onClick={onToggleCollapsed}
        />
        <IconButton icon={SquarePen} label="New chat" onClick={onNewChat} />
        <IconButton
          icon={Search}
          label="Search chats"
          onClick={() => {
            onToggleCollapsed();
            setSearchOpen(true);
          }}
        />
        <div className="min-h-0 flex-1 overflow-hidden py-1">
          <ConversationList
            collapsed
            activeId={activeId}
            onSelect={onSelectConversation}
            items={conversations}
          />
        </div>
        <IconButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Light theme" : "Dark theme"}
          onClick={toggleTheme}
        />
        <Link to="/settings/general">
          <IconButton icon={Settings} label="Settings" />
        </Link>
        {isAdmin ? (
          <Link to="/admin">
            <IconButton icon={Shield} label="Admin" />
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-2 pb-2 pt-2">
      <div className="mb-1 flex items-center gap-1 px-1">
        <Wordmark className="mr-auto px-1.5" />
        <IconButton
          icon={PanelLeftClose}
          label="Collapse sidebar"
          onClick={onToggleCollapsed}
        />
      </div>

      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] bg-bg-sidebar-active px-2.5 text-[13.5px] text-text-primary transition-colors hover:bg-bg-sidebar-hover"
        >
          <Icon icon={SquarePen} size="sm" className="shrink-0 opacity-90" />
          <span className="min-w-0 flex-1 truncate text-left">New chat</span>
        </button>
        <NavItem
          icon={Search}
          label="Search chats"
          onClick={() => {
            setSearchOpen(true);
            queueMicrotask(() => searchRef.current?.focus());
          }}
          trailing={
            <kbd className="rounded border border-border-subtle px-1.5 py-0.5 font-sans text-[10px] text-text-faint">
              ⌘K
            </kbd>
          }
        />
        <NavItem icon={Folder} label="Projects" />
      </div>

      {(searchOpen || searchQuery) && (
        <div className="mt-2 px-0.5">
          <label className="sr-only" htmlFor="sidebar-search">
            Search conversations
          </label>
          <Input
            id="sidebar-search"
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => onSearchQueryChange?.(e.target.value)}
            placeholder="Search chats"
            className="h-9 border-border-subtle bg-bg-app text-[13px]"
            autoComplete="off"
          />
          {conversations && conversations.length === 0 && searchQuery ? (
            <p className="mt-2 px-2 text-[12px] text-text-faint">
              No chats found
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1">
        <ConversationList
          collapsed={false}
          activeId={activeId}
          onSelect={onSelectConversation}
          items={conversations}
        />
      </div>

      <div className="mt-1 flex flex-col gap-0.5 border-t border-border-subtle pt-2">
        <NavItem
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Light mode" : "Dark mode"}
          onClick={toggleTheme}
        />
        <Link
          to="/settings/general"
          className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] text-text-secondary transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
        >
          <Icon icon={Settings} size="sm" className="shrink-0 opacity-90" />
          Settings
        </Link>
        {isAdmin ? (
          <Link
            to="/admin"
            className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] text-text-secondary transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
          >
            <Icon icon={Shield} size="sm" className="shrink-0 opacity-90" />
            Admin
          </Link>
        ) : null}
      </div>
    </div>
  );
}
