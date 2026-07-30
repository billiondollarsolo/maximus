import { Link } from "@tanstack/react-router";
import { cn } from "#/lib/cn";

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/members", label: "Members" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/models", label: "Models" },
  { to: "/admin/usage", label: "Usage" },
  { to: "/admin/audit", label: "Audit" },
] as const;

export function AdminShell({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active: string;
}) {
  return (
    <div className="flex min-h-dvh bg-bg-app text-text-primary">
      <aside className="hidden w-56 shrink-0 border-r border-border-subtle bg-bg-sidebar p-4 md:flex md:flex-col">
        <Link to="/" className="mb-2 text-sm font-semibold">
          ← Chat
        </Link>
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-text-muted">
          Admin
        </p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const isActive =
              "exact" in item && item.exact
                ? active === item.to
                : active.startsWith(item.to) &&
                  (item.to !== "/admin" || active === "/admin");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-[var(--radius-md)] px-3 py-2 text-[13.5px]",
                  isActive
                    ? "bg-bg-sidebar-active font-medium text-text-primary"
                    : "text-text-muted hover:bg-bg-sidebar-hover hover:text-text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6 md:p-10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function AdminTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border-subtle">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-border-subtle bg-bg-sidebar text-text-muted">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
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
                className="px-3 py-8 text-center text-text-muted"
              >
                No rows yet
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border-subtle last:border-0"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top">
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
