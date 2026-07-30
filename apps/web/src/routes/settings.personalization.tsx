import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Textarea } from "#/components/ui";
import {
  SettingsSection,
  SettingsShell,
} from "#/features/settings/settings-shell";

export const Route = createFileRoute("/settings/personalization")({
  component: PersonalizationSettings,
});

function PersonalizationSettings() {
  const [about, setAbout] = useState("");
  const [style, setStyle] = useState("");
  return (
    <SettingsShell title="Personalization" active="/settings/personalization">
      <SettingsSection
        title="Custom instructions"
        description="Stored for your account in this workspace (wired to prompt assembly)."
      >
        <label className="mb-3 flex flex-col gap-1 text-xs text-text-muted">
          What should Maximus know about you?
          <Textarea
            className="min-h-[88px] rounded-lg border border-border-subtle bg-bg-composer p-3"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          How should Maximus respond?
          <Textarea
            className="min-h-[88px] rounded-lg border border-border-subtle bg-bg-composer p-3"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
        </label>
        <Button className="mt-4" type="button">
          Save (local preview)
        </Button>
      </SettingsSection>
    </SettingsShell>
  );
}
