import { cn } from "#/lib/cn";
import { MainFrame } from "./main-frame";
import { SidebarFrame } from "./sidebar-frame";

export function AppShell({
  sidebar,
  children,
  collapsed,
  mobileOpen,
  onMobileClose,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-dvh w-full overflow-hidden bg-bg-app", className)}>
      {/* Desktop sidebar */}
      <div className="hidden h-full md:flex">
        <SidebarFrame collapsed={collapsed}>{sidebar}</SidebarFrame>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,var(--sidebar-width))] shadow-xl">
            <SidebarFrame collapsed={false}>{sidebar}</SidebarFrame>
          </div>
        </div>
      ) : null}

      <MainFrame>{children}</MainFrame>
    </div>
  );
}
