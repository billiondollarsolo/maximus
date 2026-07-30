# Maximus runbook

## Local stack

```bash
docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs
cp .env.example .env
# set ENCRYPTION_KEY to 32-byte base64, e.g.:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
pnpm install
DATABASE_URL=postgres://maximus:maximus@localhost:5432/maximus pnpm db:migrate
pnpm dev
```

## Production compose (TLS)

```bash
export ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export DOMAIN=maximus.example.com
# optional: POSTGRES_PASSWORD, OPENAI_API_KEY, etc.
docker compose -f docker/docker-compose.prod.yml up -d --build
```

- Only Caddy publishes 80/443; Postgres/Valkey/RustFS stay on the internal network.
- SSE: Caddy `flush_interval -1` so chat streams are not buffered.
- Health: `GET /api/health` (postgres + valkey checks).

## Encryption key rotation

1. Generate a new `ENCRYPTION_KEY` and keep the old value offline.
2. Re-enter all org BYOK API keys in Admin → Providers (ciphertexts cannot be re-read without the old key).
3. Update SSO secrets the same way when enabled.
4. Never commit keys; store in a secret manager for multi-node deploys.

## Bootstrap first owner

```bash
curl -X POST http://localhost:3000/api/auth/bootstrap \
  -H 'content-type: application/json' \
  -d '{"email":"admin@localhost","password":"change-me-now","orgName":"Maximus"}'
```

## Chat (fake provider)

```bash
export PROVIDER_MODE=fake
# after login cookie is set, POST /api/chat with JSON body:
# { "input": { "text": "hello" }, "forwardedProps": { "modelRef": "openai:platform:gpt-4.1" } }
```

## Quality gates

```bash
pnpm test && pnpm typecheck && pnpm lint
```

## Backup

- Postgres: `pg_dump $DATABASE_URL > backup.sql`
- RustFS: back up the Docker volume

## Encryption key rotation

Re-enter BYOK API keys after rotating `ENCRYPTION_KEY` (ciphertexts cannot be decrypted with a new key).
