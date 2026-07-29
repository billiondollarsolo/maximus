-- Maximus first-ship schema

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active_organization_id text
);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata text
);

CREATE TABLE IF NOT EXISTS members (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS members_org_user_uidx ON members(organization_id, user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text,
  status text NOT NULL,
  expires_at timestamptz NOT NULL,
  inviter_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizations_ext (
  org_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  base_url text,
  credentials_encrypted text NOT NULL,
  credentials_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS models (
  id text PRIMARY KEY,
  org_id text REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id text REFERENCES provider_connections(id) ON DELETE SET NULL,
  provider_kind text NOT NULL,
  model_id text NOT NULL,
  display_name text NOT NULL,
  model_ref text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '{"streaming":true}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS models_org_ref_uidx ON models(org_id, model_ref);

CREATE TABLE IF NOT EXISTS model_allowlists (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  model_ref text NOT NULL,
  role text
);

CREATE UNIQUE INDEX IF NOT EXISTS model_allowlists_uidx ON model_allowlists(org_id, model_ref, role);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  instructions text,
  default_model_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id text REFERENCES projects(id) ON DELETE SET NULL,
  title text,
  title_source text,
  model_ref text,
  active_leaf_id text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_org_user_updated_idx
  ON conversations(org_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_message_id text,
  role text NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL,
  model_ref text,
  token_usage jsonb,
  error jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS attachments (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  message_id text REFERENCES messages(id) ON DELETE SET NULL,
  uploader_user_id text NOT NULL REFERENCES users(id),
  storage_key text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes bigint NOT NULL,
  sha256 text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_instructions (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  about_user text,
  preferred_response text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS usage_events (
  id text PRIMARY KEY,
  org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id),
  conversation_id text,
  message_id text,
  model_ref text NOT NULL,
  provider_kind text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_micros bigint,
  latency_ms integer,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_org_created_idx ON usage_events(org_id, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id text PRIMARY KEY,
  org_id text REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_org_created_idx ON audit_events(org_id, created_at);

CREATE TABLE IF NOT EXISTS message_feedback (
  id text PRIMARY KEY,
  message_id text NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_feedback_uidx ON message_feedback(message_id, user_id);

CREATE TABLE IF NOT EXISTS model_prices (
  id text PRIMARY KEY,
  org_id text REFERENCES organizations(id) ON DELETE CASCADE,
  provider_kind text NOT NULL,
  model_id_pattern text NOT NULL,
  input_usd_per_1m numeric(12,6) NOT NULL,
  output_usd_per_1m numeric(12,6) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  effective_from timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sso_configs (
  id text PRIMARY KEY,
  org_id text NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  provider text,
  issuer_url text,
  client_id text,
  client_secret_encrypted text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed platform prices (idempotent)
INSERT INTO model_prices (id, org_id, provider_kind, model_id_pattern, input_usd_per_1m, output_usd_per_1m)
SELECT * FROM (VALUES
  ('price_openai_default', NULL::text, 'openai', '*', 2.5::numeric, 10::numeric),
  ('price_anthropic_default', NULL::text, 'anthropic', '*', 3::numeric, 15::numeric)
) AS v(id, org_id, provider_kind, model_id_pattern, input_usd_per_1m, output_usd_per_1m)
WHERE NOT EXISTS (SELECT 1 FROM model_prices WHERE id = v.id);
