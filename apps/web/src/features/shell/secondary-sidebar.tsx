import { Link } from "@tanstack/react-router";
import { MessageSquare, Moon, Sun } from "lucide-react";
import { Icon, IconButton } from "#/components/ui";
import { Wordmark } from "#/components/layout/wordmark";
import { SidebarUserMenu } from "#/features/sidebar/sidebar-user-menu";
import { useTheme } from "#/features/theme/theme-provider";
import { cn } from "#/lib/cn";

/**
 * Persistent app chrome for Admin / Settings:
 * same wordmark + account footer as the chat sidebar so those never disappear.
 */
export function SecondarySidebar({
  sectionLabel,
  children,
  className,
}: {
  sectionLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={cn(
        "hidden h-dvh w-[var(--sidebar-width)] shrink-0 flex-col border-r border-border-subtle bg-bg-sidebar md:flex",
        className,
      )}
    >
      <div className="flex h-full flex-col px-2 pb-2 pt-2">
        <div className="mb-1 flex items-center gap-1 px-1">
          <Link
            to="/"
            className="mr-auto rounded-[var(--radius-md)] px-1.5 py-1 no-underline outline-none hover:bg-bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Maximus home"
          >
            <Wordmark />
          </Link>
        </div>

        <Link
          to="/"
          className="mb-2 flex h-9 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13px] text-text-secondary no-underline transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
        >
          <Icon icon={MessageSquare} size="sm" className="shrink-0 opacity-90" />
          <span className="min-w-0 flex-1 truncate text-left">Back to chat</span>
        </Link>

        <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-faint">
          {sectionLabel}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        <div className="mt-1 flex flex-col gap-0.5 border-t border-border-subtle pt-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 text-[13.5px] text-text-secondary transition-colors hover:bg-bg-sidebar-hover hover:text-text-primary"
          >
            <Icon
              icon={theme === "dark" ? Sun : Moon}
              size="sm"
              className="shrink-0 opacity-90"
            />
            <span className="min-w-0 flex-1 truncate text-left">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <SidebarUserMenu collapsed={false} />
        </div>
      </div>
    </aside>
  );
}

/** Compact theme control for mobile headers (shells already have desktop footer). */
export function SecondaryThemeButton() {
  const { theme, toggleTheme } = useTheme();
  return (
    <IconButton
      icon={theme === "dark" ? Sun : Moon}
      label="Toggle theme"
      onClick={toggleTheme}
    />
  );
}
