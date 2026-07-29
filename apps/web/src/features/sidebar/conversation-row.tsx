import { MessageSquare } from "lucide-react";
import { cn } from "#/lib/cn";
import { Icon } from "#/components/ui";

export function ConversationRow({
  title,
  active,
  collapsed,
  onSelect,
}: {
  title: string;
  active?: boolean;
  collapsed?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      title={title}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
        active
          ? "bg-bg-composer text-text-primary"
          : "text-text-primary hover:bg-bg-composer/70",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon icon={MessageSquare} size="sm" className="text-text-muted" />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">{title}</span>
      ) : null}
    </button>
  );
}
