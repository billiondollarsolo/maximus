# Maximus runbook

Operational procedures for self-host and local development.

## Local development

```bash
./scripts/up-dev.sh
cp .env.example .env   # if needed
./scripts/generate-secrets.sh --write .env
pnpm install
pnpm db:migrate
pnpm dev
# http://localhost:3000
```

Infra only:

```bash
docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs
```

## Production

```bash
cp .env.prod.example .env.prod
./scripts/generate-secrets.sh --write .env.prod
# edit DOMAIN, ACME_EMAIL, TLS_MODE, provider keys
./scripts/up-prod.sh
```

Details: [deploy.md](./deploy.md) · [tls.md](./tls.md)

## Health

Public (load-balancer safe — shallow only):

```bash
curl -fsS https://YOUR_DOMAIN/api/health
# {"status":"ok","checks":{"app":"ok","postgres":"ok","valkey":"ok"},"version":"..."}
```

Admin deep overview (session cookie required, **admin** role):

```bash
# One-shot JSON
curl -fsS -b cookies.txt https://YOUR_DOMAIN/api/admin/overview | jq .overall,.components

# Live SSE (immediate snapshot, then ~5s recompute; OVERVIEW_SSE_INTERVAL_MS)
curl -Ns -b cookies.txt https://YOUR_DOMAIN/api/admin/overview/stream
```

### Demo mode

Overview shows a **Demo mode** banner when `PROVIDER_MODE=fake`, or when live mode has no platform keys (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OLLAMA_BASE_URL`) and no enabled BYOK connection. Chat still works via the fake provider.

### Provider probes (optional)

- **Off by default.** Admin → Overview → Configure probes.
- Interval clamped **5–1440 minutes** (default **15** when enabled).
- Cheap checks only (`testProviderConnection` — models/tags list, not completions).
- MVP: automatic probes run **only while** an admin has Overview SSE open; use **Probe all now** anytime (rate-limited 1/min per org).
- Last results stored on each connection’s `credentials_meta.probe` (no secrets).

### Ops env (optional)

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_VERSION` | — | Shown on Overview + shallow health |
| `GIT_SHA` | — | Short build identity |
| `OVERVIEW_SSE_INTERVAL_MS` | `5000` | Admin overview recompute cadence |

### External Postgres / S3 / Valkey

Infrastructure is configured via **env** (`DATABASE_URL`, `VALKEY_URL`, `S3_*`), not the Admin UI.  
Compose: `DEPLOY_MODE=external` · Helm: `postgresql.enabled=false` + external URLs.  
See [deploy-external.md](./deploy-external.md) and [deploy-helm.md](./deploy-helm.md).

### Local 1601x stack (isolated ports)

When Postgres/Valkey/RustFS are on host ports **16011–16014** (e.g. e2e-smoke) and the app on **16010**:

```bash
# .env must point S3_ENDPOINT at RustFS (not the default :9000)
# DATABASE_URL → :16011 · VALKEY_URL → :16012 · S3_ENDPOINT → :16013
node scripts/ensure-s3-bucket.mjs   # creates maximus-uploads if missing
./scripts/ready-local-16010.sh      # optional: wait + migrate + seed
```

Overview **Down** almost always means the object-store probe failed (wrong `S3_ENDPOINT` or missing bucket). Public `/api/health` will still look fine because it does not check storage.

## Bootstrap first owner

Browser: `/login` when no users exist.

```bash
curl -X POST https://YOUR_DOMAIN/api/auth/bootstrap \
  -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"change-me-now","name":"Admin","orgName":"Maximus"}'
```

After the first user, bootstrap returns **FORBIDDEN** — use invites.

## Encryption key rotation

1. Generate a new `ENCRYPTION_KEY`; keep the old value offline.  
2. Re-enter all org **BYOK** API keys (Admin → Providers). Ciphertexts cannot be re-read with a new key.  
3. Update any SSO client secrets the same way when enabled.  
4. Never commit keys; use a secret manager for multi-node.

## Provider & model ops (Ollama + offerings)

### Intentional chat catalog

- Chat picker lists **enabled + visible + non-embedding** org offerings, plus platform cloud models **only when** platform API keys are set.
- Ollama `/api/tags` is **never** auto-dumped into chat. Admin must **Import tags** or **Add model** under Providers.
- Labels always keep the **full Ollama tag** (e.g. `gemma3:4b`, not `4b`). Generation stats use the same full model id.

### Discover → curate

1. Admin → Providers → add Ollama connection (`baseUrl`, e.g. `http://host.docker.internal:11434`).  
2. **Import tags** (skips embeddings by default) or **Add model** and pick a tag.  
3. On pick, Maximus calls Ollama `/api/show` when possible to prefill `contextWindow` / `numCtx`.  
4. Toggle **Visible** / **Enabled** per offering; set org defaults + default/pinned model refs on the Providers page.  
5. **Export catalog** downloads secret-free JSON (no API keys / ciphertext).

### Inference param resolve order

```
code defaults → org modelDefaults → offering capabilities (+ agent params) → conversation modelParams
```

### Ollama `num_ctx` cold start

Raising `num_ctx` (or first load of a large context) can make Ollama feel “down” for minutes while weights/KV cache allocate. Prefer modest defaults (e.g. 8192) unless the operator has GPU headroom. This is expected provider behavior, not a Maximus hang.

### Context refuse

When an offering has `contextWindow` set and the estimated prompt exceeds  
`contextWindow - maxOutput - headroom`, the stream **refuses** with an actionable error naming the model (full tag) and suggesting a new chat or higher context. Silent truncation is not the default.

### Agent presets

Admin API: `/api/admin/agents`. Chat refs use `agent:{presetId}`; the stream resolves to the base offering, injects the agent system prompt, merges agent params, and **fails clearly** if the base model is disabled/missing. Allowlists apply to the **base** model ref.

See [provider-model-management-plan.md](./provider-model-management-plan.md) and [api.md](./api.md).

## Backup

```bash
./scripts/backup.sh ./backups
```

Also snapshot Docker volumes (`maximus_pg`, `maximus_rustfs`, `caddy_data`).  
Store `ENCRYPTION_KEY` separately from SQL dumps.

## Restore (sketch)

1. Fresh compose up (or stop web).  
2. Restore SQL: `gunzip -c backups/pg-....sql.gz | docker compose ... exec -T postgres psql -U maximus maximus`  
3. Restore object volume if needed.  
4. Inject same `ENCRYPTION_KEY`.  
5. Start stack; verify login + chat.

## Quality gates

```bash
pnpm test && pnpm typecheck && pnpm lint
pnpm --filter @maximus/web build
pnpm test:e2e
```

## Chat smoke (fake provider)

```bash
export PROVIDER_MODE=fake
# After browser login, chat in UI or POST /api/chat with session cookie
```

## API client smoke (no browser)

```bash
APP=http://127.0.0.1:16010
TOKEN=$(curl -sS -X POST "$APP/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"maximus-e2e@test.local","password":"E2eTestPass99!"}' | jq -r .sessionToken)
curl -sS -H "Authorization: Bearer $TOKEN" "$APP/api" | jq .apiVersion
curl -sS -H "Authorization: Bearer $TOKEN" "$APP/api/auth/me" | jq .
curl -sS -H "Authorization: Bearer $TOKEN" "$APP/api/admin/overview" | jq .overall
```

Full surface: [api.md](./api.md).

## Logs

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod logs -f web caddy
```
