import { createFileRoute } from "@tanstack/react-router";

/** New chat — deep link `/`. UI lives in pathless `_chat` layout. */
export const Route = createFileRoute("/_chat/")({
  component: () => null,
});
