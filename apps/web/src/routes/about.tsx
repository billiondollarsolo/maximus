import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandMark } from "#/components/layout/brand-mark";
import { RequireSession } from "#/features/auth/require-session";
import { APP_VERSION, PRODUCT_NAME, SOCIAL_LINKS } from "#/lib/app-version";

export const Route = createFileRoute("/about")({
  component: () => (
    <RequireSession>
      <AboutPage />
    </RequireSession>
  ),
});

function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg-app text-text-primary">
      <div className="mx-auto w-full max-w-2xl px-5 py-10 md:px-8 md:py-14">
        <Link
          to="/"
          className="mb-8 inline-flex text-[13px] text-text-muted no-underline hover:text-text-primary"
        >
          ← Back to chat
        </Link>

        <header className="mb-10 flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-bg-sidebar-active text-text-primary">
            <BrandMark className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {PRODUCT_NAME}
            </h1>
            <p className="mt-1 text-[13px] tabular-nums text-text-muted">
              Version {APP_VERSION}
            </p>
          </div>
        </header>

        <section className="space-y-4 text-[15px] leading-relaxed text-text-secondary">
          <p>
            <strong className="font-medium text-text-primary">Maximus</strong>{" "}
            is a self-hosted AI workspace for teams that want streaming chat,
            multi-provider models, and admin control — without giving up their
            data plane.
          </p>
          <p>
            Conversations, attachments, and provider credentials stay on
            infrastructure you operate. Invite-only organizations, encrypted
            BYOK secrets, usage and audit trails, and a live admin overview are
            first-class — not afterthoughts.
          </p>
          <p>
            Maximus is open source (MIT), built for private self-host and
            security-conscious teams. It is not a multi-tenant public SaaS.
          </p>
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13.5px] text-amber-200/90">
            <strong className="font-medium text-amber-100">Alpha (v0.x).</strong>{" "}
            Not production-ready. Expect breaking changes and rough edges.
            Suitable for private evaluation and dogfooding — not mission-critical
            or regulated deployments yet.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-faint">
            Links
          </h2>
          <ul className="space-y-2 text-[14px]">
            <li>
              <a
                href="https://github.com/billiondollarsolo/maximus"
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline-offset-2 hover:underline"
              >
                Source on GitHub
              </a>
            </li>
            <li>
              <a
                href={SOCIAL_LINKS.mjtechguy.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline-offset-2 hover:underline"
              >
                @{SOCIAL_LINKS.mjtechguy.label} on X
              </a>
            </li>
            <li>
              <a
                href={SOCIAL_LINKS.billiondollarsolo.href}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent underline-offset-2 hover:underline"
              >
                @{SOCIAL_LINKS.billiondollarsolo.label} on X
              </a>
            </li>
          </ul>
        </section>

        <footer className="mt-14 border-t border-border-subtle pt-6 text-[12px] text-text-faint">
          <p>
            © {new Date().getFullYear()} Maximus contributors · MIT License
          </p>
          <p className="mt-1">
            Built with care by{" "}
            <a
              href={SOCIAL_LINKS.mjtechguy.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-text-muted no-underline hover:text-text-primary"
            >
              @{SOCIAL_LINKS.mjtechguy.label}
            </a>{" "}
            and{" "}
            <a
              href={SOCIAL_LINKS.billiondollarsolo.href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-text-muted no-underline hover:text-text-primary"
            >
              @{SOCIAL_LINKS.billiondollarsolo.label}
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
