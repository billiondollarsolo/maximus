import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/cn";
import { ConversationMenu } from "./conversation-menu";

/** ChatGPT-style history row with deep link + ⋮ actions. */
export function ConversationRow({
  id,
  title,
  active,
  collapsed,
  onChanged,
}: {
  id: string;
  title: string;
  active?: boolean;
  collapsed?: boolean;
  onChanged?: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex w-full items-center rounded-[var(--radius-md)] text-[13.5px] leading-snug transition-colors",
        collapsed ? "h-9 justify-center" : "min-h-9",
        active
          ? "bg-bg-sidebar-active text-text-primary"
          : "text-text-secondary hover:bg-bg-sidebar-hover hover:text-text-primary",
      )}
    >
      <Link
        to="/c/$conversationId"
        params={{ conversationId: id }}
        title={title}
        data-active={active ? "true" : "false"}
        className={cn(
          "flex min-w-0 flex-1 items-center text-left no-underline",
          collapsed ? "h-9 justify-center px-0" : "min-h-9 py-2 pl-2.5 pr-1",
          active ? "text-text-primary" : "text-inherit",
        )}
      >
        {collapsed ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-bg-sidebar-hover text-[11px] font-medium text-text-muted">
            {title.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate">{title}</span>
        )}
      </Link>
      {!collapsed ? (
        <div className="pr-1">
          <ConversationMenu
            id={id}
            title={title}
            isActive={active}
            onChanged={onChanged}
          />
        </div>
      ) : null}
    </div>
  );
}
