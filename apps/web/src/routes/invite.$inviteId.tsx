import { createFileRoute } from "@tanstack/react-router";
import { InvitePage } from "#/features/auth/invite-page";

export const Route = createFileRoute("/invite/$inviteId")({
  component: InviteRoute,
});

function InviteRoute() {
  const { inviteId } = Route.useParams();
  return <InvitePage inviteId={inviteId} />;
}
