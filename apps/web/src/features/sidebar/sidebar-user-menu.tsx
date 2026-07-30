import { LogOut, Settings, Shield } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  UserAvatar,
} from "#/components/ui";
import { cn } from "#/lib/cn";

type MeUser = {
  id: string;
  email: string;
  name: string;
};

export function SidebarUserMenu({ collapsed }: { collapsed: boolean }) {
  const nav = useNavigate();
  const [user, setUser] = useState<MeUser | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { user?: MeUser; role?: string } | null) => {
          if (!d?.user) {
            setUser(null);
            setRole(null);
            return;
          }
          setUser(d.user);
          setRole(d.role ?? null);
        },
      )
      .catch(() => {
        setUser(null);
        setRole(null);
      });
  }, []);

  const isAdmin = role === "admin" || role === "owner";
  const displayName = user?.name?.trim() || user?.email || "Account";
  const email = user?.email ?? "";

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    await nav({ to: "/login" });
  }

  if (!user) {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-md)] px-2.5 py-2 text-[12px] text-text-faint",
          collapsed && "flex justify-center px-0",
        )}
      >
        {collapsed ? "…" : "Loading…"}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2.5 rounded-[var(--radius-md)] text-left transition-colors",
            "hover:bg-bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            collapsed ? "h-10 w-10 justify-center p-0" : "h-11 px-2",
          )}
          aria-label={`Account menu for ${displayName}`}
        >
          <UserAvatar name={user.name} email={user.email} size="sm" />
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-text-primary">
                {displayName}
              </span>
              {email && email !== displayName ? (
                <span className="block truncate text-[11px] text-text-faint">
                  {email}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        className="w-[14.5rem]"
      >
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <div className="px-2.5 pb-2 pt-0.5">
          <p className="truncate text-[13px] font-medium text-text-primary">
            {displayName}
          </p>
          {email ? (
            <p className="truncate text-[12px] text-text-faint">{email}</p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings/general" className="no-underline">
            <Icon icon={Settings} size="sm" />
            Settings
          </Link>
        </DropdownMenuItem>
        {isAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin" className="no-underline">
              <Icon icon={Shield} size="sm" />
              Admin
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          danger
          onSelect={(e) => {
            e.preventDefault();
            void logout();
          }}
        >
          <Icon icon={LogOut} size="sm" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
