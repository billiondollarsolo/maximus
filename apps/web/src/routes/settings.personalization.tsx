import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button, Textarea } from "#/components/ui";
import { AdminAlert } from "#/features/admin/admin-alert";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/me/instructions", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json() as Promise<{
          instructions?: { aboutUser?: string; preferredResponse?: string };
        }>;
      })
      .then((data) => {
        setAbout(data.instructions?.aboutUser ?? "");
        setStyle(data.instructions?.preferredResponse ?? "");
      })
      .catch(() => setError("Could not load instructions"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/me/instructions", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          aboutUser: about,
          preferredResponse: style,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Save failed");
        return;
      }
      setMsg("Saved — applied on the next chat turn");
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsShell title="Personalization" active="/settings/personalization">
      <SettingsSection
        title="Custom instructions"
        description="Stored for your account in this workspace and applied via the chat API system prompt."
      >
        {error ? <AdminAlert tone="error">{error}</AdminAlert> : null}
        {msg ? <AdminAlert tone="success">{msg}</AdminAlert> : null}
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <>
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
            <Button
              className="mt-4"
              type="button"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </SettingsSection>
    </SettingsShell>
  );
}
