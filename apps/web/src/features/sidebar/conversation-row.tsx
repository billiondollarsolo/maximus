import { cn } from "#/lib/cn";

/** ChatGPT-style history row: no per-row icon noise when expanded. */
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
        "group flex w-full items-center rounded-[var(--radius-md)] text-left text-[13.5px] leading-snug transition-colors",
        collapsed ? "h-9 justify-center px-0" : "min-h-9 px-2.5 py-2",
        active
          ? "bg-bg-sidebar-active text-text-primary"
          : "text-text-secondary hover:bg-bg-sidebar-hover hover:text-text-primary",
      )}
    >
      {collapsed ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-bg-sidebar-hover text-[11px] font-medium text-text-muted">
          {title.slice(0, 1).toUpperCase()}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate">{title}</span>
      )}
    </button>
  );
}
