import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Button, Icon, IconButton } from "#/components/ui";
import { useTheme } from "#/features/theme/theme-provider";
import { cn } from "#/lib/cn";

const NAV = [
  { to: "/settings/general", label: "General" },
  { to: "/settings/personalization", label: "Personalization" },
  { to: "/settings/data", label: "Data controls" },
  { to: "/settings/account", label: "Account" },
] as const;

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
    <div className="flex min-h-dvh bg-bg-app text-text-primary">
      <aside className="hidden w-56 shrink-0 border-r border-border-subtle bg-bg-sidebar p-4 md:block">
        <Link to="/" className="mb-6 block text-sm font-semibold">
          ← Back to chat
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                active === item.to
                  ? "bg-bg-composer font-medium"
                  : "text-text-muted hover:bg-bg-composer/60 hover:text-text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-2xl flex-1 p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <IconButton
            icon={theme === "dark" ? Sun : Moon}
            label="Toggle theme"
            onClick={toggleTheme}
          />
        </div>
        {children}
      </main>
    </div>
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
    <section className="mb-8 rounded-2xl border border-border-subtle bg-bg-sidebar p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-text-muted">{description}</p>
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
