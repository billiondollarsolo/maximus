import { createFileRoute, Link, redirect } from "@tanstack/react-router";

/**
 * Pricing is configured per model under Providers. Keep route for old
 * bookmarks; redirect to providers.
 */
export const Route = createFileRoute("/admin/pricing")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/providers" });
  },
  component: () => (
    <p className="p-8 text-sm text-text-muted">
      Pricing lives on each model under{" "}
      <Link to="/admin/providers" className="underline">
        Providers
      </Link>
      .
    </p>
  ),
});
