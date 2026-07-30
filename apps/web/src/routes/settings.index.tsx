import { createFileRoute, redirect } from "@tanstack/react-router";

/** `/settings` → first settings page (bookmark-friendly). */
export const Route = createFileRoute("/settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/general" });
  },
});
