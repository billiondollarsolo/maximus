import { Link } from "@tanstack/react-router";
import { Button, Icon } from "#/components/ui";
import { RequireSession } from "#/features/auth/require-session";
import {
  SecondarySidebar,
  SecondaryThemeButton,
} from "#/features/shell/secondary-sidebar";

const NAV = [
  { to: "/settings/general", label: "General" },
  { to: "/settings/personalization", label: "Personalization" },
  { to: "/settings/data", label: "Data controls" },
  { to: "/settings/account", label: "Account" },
] as const;

/** Settings chrome shares chat sidebar wordmark + account footer. */
export function SettingsShell({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active: string;
}) {
  return (
    <RequireSession>
      <div className="admin-shell flex min-h-dvh bg-bg-app text-text-primary">
        <SecondarySidebar sectionLabel="Settings">
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
        </SecondarySidebar>
        <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-10">
          <div className="mb-4 flex items-start justify-between gap-3 md:hidden">
            <nav
              className="flex flex-wrap gap-1"
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
            <SecondaryThemeButton />
          </div>
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
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

export function SettingsIcon({ icon }: { icon: typeof Icon }) {
  return <Icon icon={icon as never} size="sm" />;
}
