-- Model visibility (hide from picker without disable)
ALTER TABLE models ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

-- Conversation-level model param overrides
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Agent presets (workspace models wrapping a base offering)
CREATE TABLE IF NOT EXISTS agent_presets (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  base_model_ref text NOT NULL,
  system_prompt text,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_presets_org_slug_uidx
  ON agent_presets(org_id, slug);
