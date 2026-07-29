import {
  Folder,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { Button, Icon, IconButton, Separator } from "#/components/ui";
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
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewChat: () => void;
  activeId?: string | null;
  onSelectConversation?: (id: string) => void;
  conversations?: FakeConversation[];
}) {
  const { theme, toggleTheme } = useTheme();

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
          <IconButton icon={Search} label="Search chats" />
        ) : (
          <Button variant="ghost" className="mt-1 w-full justify-start text-text-muted">
            <Icon icon={Search} size="sm" />
            Search chats
          </Button>
        )}
      </div>

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
          <Button variant="ghost" className="flex-1 justify-start text-text-muted">
            <Icon icon={Settings} size="sm" />
            Settings
          </Button>
        ) : (
          <IconButton icon={Settings} label="Settings" />
        )}
      </div>
    </div>
  );
}
