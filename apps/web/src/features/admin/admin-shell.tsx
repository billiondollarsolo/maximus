import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/cn";
import {
  SecondarySidebar,
  SecondaryThemeButton,
} from "#/features/shell/secondary-sidebar";

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/members", label: "People" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/models", label: "Access" },
  { to: "/admin/usage", label: "Usage" },
  { to: "/admin/audit", label: "Audit" },
] as const;

function isAdminNavActive(
  item: (typeof NAV)[number],
  active: string,
): boolean {
  if ("exact" in item && item.exact) {
    return active === item.to || active === "/admin/";
  }
  return (
    active.startsWith(item.to) &&
    (item.to !== "/admin" ||
      active === "/admin" ||
      active === "/admin/")
  );
}

/**
 * Admin chrome: same wordmark + account footer as chat sidebar,
 * plus admin section nav.
 */
export function AdminShell({
  title,
  children,
  active,
  hideTitle = true,
}: {
  title: string;
  children: React.ReactNode;
  active: string;
  hideTitle?: boolean;
}) {
  return (
    <div className="admin-shell flex min-h-dvh bg-bg-app text-text-primary">
      <SecondarySidebar sectionLabel="Admin">
        <nav className="flex flex-col gap-0.5" aria-label="Admin">
          {NAV.map((item) => {
            const isActive = isAdminNavActive(item, active);
            return (
              <Link
                key={item.to}
                to={item.to}
                data-active={isActive ? "true" : "false"}
                className="admin-nav-link"
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SecondarySidebar>
      <main
        className={cn(
          "mx-auto w-full flex-1 p-6 md:p-10",
          "max-w-[var(--admin-content-max)]",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3 md:hidden">
          <nav
            className="flex flex-wrap gap-1"
            aria-label="Admin sections"
          >
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                data-active={isAdminNavActive(item, active) ? "true" : "false"}
                className="admin-nav-link !inline-flex !w-auto px-2.5 py-1.5 text-xs"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <SecondaryThemeButton />
        </div>
        {!hideTitle ? (
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
        ) : (
          <span className="sr-only">{title}</span>
        )}
        {children}
      </main>
    </div>
  );
}

/** @deprecated Prefer DataTable — kept for rare static grids. */
export function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="border-b border-border-subtle bg-bg-sidebar text-[12px] font-medium uppercase tracking-wide text-text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="px-3 py-10 text-center text-text-muted"
              >
                No rows yet
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border-subtle last:border-0 hover:bg-bg-sidebar-hover/40"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
