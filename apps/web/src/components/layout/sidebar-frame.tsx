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
        "flex h-full shrink-0 flex-col border-r border-border-subtle bg-bg-sidebar transition-[width] duration-200 ease-out",
        collapsed ? "w-[52px]" : "w-[var(--sidebar-width)]",
        className,
      )}
    >
      {children}
    </aside>
  );
}
