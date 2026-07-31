import { Link } from "@tanstack/react-router";
import { APP_VERSION, SOCIAL_LINKS } from "#/lib/app-version";
import { cn } from "#/lib/cn";

/**
 * Product version + creator links at the foot of the main sidebar.
 */
export function SidebarBrandFooter({
  collapsed,
}: {
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 px-1 pb-1 pt-1">
        <Link
          to="/about"
          title={`About Maximus v${APP_VERSION}`}
          className="text-[10px] tabular-nums text-text-faint no-underline hover:text-text-muted"
        >
          v{APP_VERSION}
        </Link>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-1 border-t border-border-subtle px-2.5 pb-1.5 pt-2",
        "text-[11px] leading-snug text-text-faint",
      )}
    >
      <p className="tabular-nums">
        <Link
          to="/about"
          className="text-text-faint no-underline hover:text-text-muted"
        >
          Maximus v{APP_VERSION}
        </Link>
        <span className="text-text-faint/50"> · alpha</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <a
          href={SOCIAL_LINKS.mjtechguy.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-text-faint no-underline hover:text-text-muted"
        >
          @{SOCIAL_LINKS.mjtechguy.label}
        </a>
        <span className="text-text-faint/40" aria-hidden>
          ·
        </span>
        <a
          href={SOCIAL_LINKS.billiondollarsolo.href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-text-faint no-underline hover:text-text-muted"
        >
          @{SOCIAL_LINKS.billiondollarsolo.label}
        </a>
      </p>
      <p className="mt-1">
        <Link
          to="/about"
          className="text-text-faint underline-offset-2 no-underline hover:text-text-muted hover:underline"
        >
          About
        </Link>
      </p>
    </div>
  );
}
