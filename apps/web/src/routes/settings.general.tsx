import { createFileRoute } from "@tanstack/react-router";
import { Button } from "#/components/ui";
import {
  SettingsSection,
  SettingsShell,
} from "#/features/settings/settings-shell";
import { useTheme } from "#/features/theme/theme-provider";

export const Route = createFileRoute("/settings/general")({
  component: GeneralSettings,
});

function GeneralSettings() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsShell title="General" active="/settings/general">
      <SettingsSection
        title="Appearance"
        description="Maximus supports dark and light themes with shared design tokens."
      >
        <div className="flex gap-2">
          <Button
            variant={theme === "dark" ? "primary" : "secondary"}
            onClick={() => setTheme("dark")}
          >
            Dark
          </Button>
          <Button
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => setTheme("light")}
          >
            Light
          </Button>
        </div>
      </SettingsSection>
    </SettingsShell>
  );
}
