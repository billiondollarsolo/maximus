import { cn } from "#/lib/cn";

export function SidebarFrame({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "flex h-full shrink-0 flex-col bg-bg-sidebar text-text-primary transition-[width] duration-200 ease-out",
        /* ChatGPT: no hard divider; soft rail edge via subtle border only when expanded */
        !collapsed && "border-r border-border-subtle",
        collapsed ? "w-[52px]" : "w-[var(--sidebar-width)]",
        className,
      )}
    >
      {children}
    </aside>
  );
}
