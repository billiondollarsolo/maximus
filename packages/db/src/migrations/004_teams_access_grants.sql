-- Teams (resource-grant groups inside an org)
CREATE TABLE IF NOT EXISTS teams (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS teams_org_slug_uidx ON teams(org_id, slug);

CREATE TABLE IF NOT EXISTS team_members (
  id text PRIMARY KEY,
  team_id text NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_members_team_user_uidx ON team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members(user_id);

-- Access grants (allow-only in v1)
CREATE TABLE IF NOT EXISTS access_grants (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_ref text NOT NULL,
  subject_type text NOT NULL,
  subject_id text,
  effect text NOT NULL DEFAULT 'allow',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS access_grants_uidx
  ON access_grants(org_id, resource_type, resource_ref, subject_type, COALESCE(subject_id, ''));

CREATE INDEX IF NOT EXISTS access_grants_org_idx ON access_grants(org_id);

-- Migrate legacy model_allowlists → access_grants + accessMode
-- role NULL → subject_type org; else subject_type role
INSERT INTO access_grants (id, org_id, resource_type, resource_ref, subject_type, subject_id, effect, created_at)
SELECT
  'grant_mig_' || md5(mal.org_id || '|' || mal.model_ref || '|' || COALESCE(mal.role, '')),
  mal.org_id,
  'model',
  mal.model_ref,
  CASE WHEN mal.role IS NULL THEN 'org' ELSE 'role' END,
  mal.role,
  'allow',
  now()
FROM model_allowlists mal
WHERE NOT EXISTS (
  SELECT 1 FROM access_grants ag
  WHERE ag.org_id = mal.org_id
    AND ag.resource_type = 'model'
    AND ag.resource_ref = mal.model_ref
    AND ag.subject_type = CASE WHEN mal.role IS NULL THEN 'org' ELSE 'role' END
    AND COALESCE(ag.subject_id, '') = COALESCE(mal.role, '')
);

-- Orgs with any legacy allowlist row → accessMode allowlist
UPDATE organizations_ext oe
SET settings = COALESCE(oe.settings, '{}'::jsonb) || jsonb_build_object('accessMode', 'allowlist'),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM model_allowlists m WHERE m.org_id = oe.org_id
)
AND COALESCE(oe.settings->>'accessMode', '') = '';

-- Ensure settings key defaults to open for others (implicit; no write needed)
