import { createFileRoute } from "@tanstack/react-router";
import { Button } from "#/components/ui";
import {
  SettingsSection,
  SettingsShell,
} from "#/features/settings/settings-shell";

export const Route = createFileRoute("/settings/data")({
  component: DataSettings,
});

function DataSettings() {
  return (
    <SettingsShell title="Data controls" active="/settings/data">
      <SettingsSection
        title="Export"
        description="Export an individual conversation via the thread export API (own chats only)."
      >
        <p className="text-sm text-text-muted">
          Open a chat and use export, or call{" "}
          <code className="text-xs">/api/export?id=…&format=md</code>.
        </p>
      </SettingsSection>
      <SettingsSection
        title="Delete"
        description="Archive or delete conversations from the sidebar. Account hard-delete lands with governance WP."
      >
        <Button variant="danger" type="button" disabled>
          Delete account (coming soon)
        </Button>
      </SettingsSection>
    </SettingsShell>
  );
}
