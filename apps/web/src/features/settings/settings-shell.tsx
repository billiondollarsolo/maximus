import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button, Icon, IconButton } from "#/components/ui";
import { RequireSession } from "#/features/auth/require-session";
import { useTheme } from "#/features/theme/theme-provider";

const NAV = [
  { to: "/settings/general", label: "General" },
  { to: "/settings/personalization", label: "Personalization" },
  { to: "/settings/data", label: "Data controls" },
  { to: "/settings/account", label: "Account" },
] as const;

/** Settings chrome shares admin nav/link density tokens from global CSS. */
export function SettingsShell({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active: string;
}) {
  const { theme, toggleTheme } = useTheme();
  return (
    <RequireSession>
      <div className="admin-shell flex min-h-dvh bg-bg-app text-text-primary">
        <aside className="hidden w-[var(--admin-nav-width)] shrink-0 border-r border-border-subtle bg-bg-sidebar p-4 md:flex md:flex-col">
          <Link
            to="/"
            className="mb-2 px-1 text-sm font-semibold text-text-primary hover:text-text-secondary"
          >
            ← Chat
          </Link>
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.08em] text-text-faint">
            Settings
          </p>
          <nav className="flex flex-col gap-0.5" aria-label="Settings">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-active={active === item.to ? "true" : "false"}
                className="admin-nav-link"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-10">
          {/* Mobile: deep-linkable section nav */}
          <nav
            className="mb-4 flex flex-wrap gap-1 md:hidden"
            aria-label="Settings sections"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-active={active === item.to ? "true" : "false"}
                className="admin-nav-link !inline-flex !w-auto px-2.5 py-1.5 text-xs"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <header className="mb-6 flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
            <IconButton
              icon={theme === "dark" ? Sun : Moon}
              label="Toggle theme"
              onClick={toggleTheme}
            />
          </header>
          {children}
        </main>
      </div>
    </RequireSession>
  );
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-section mb-6 rounded-xl border border-border-subtle bg-bg-sidebar p-5 first:mt-0">
      <h2 className="admin-section-title">{title}</h2>
      {description ? (
        <p className="admin-section-desc mb-0 mt-1">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsPrimaryButton(
  props: React.ComponentProps<typeof Button>,
) {
  return <Button {...props} />;
}

export function SettingsIcon({ icon }: { icon: typeof Moon }) {
  return <Icon icon={icon} size="sm" />;
}
