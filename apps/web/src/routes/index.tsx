import { createFileRoute } from "@tanstack/react-router";
import { HomePlaceholder } from "#/features/shell/home-placeholder";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/** Thin route shell — compose feature modules only (D17). */
function HomePage() {
  return <HomePlaceholder />;
}
