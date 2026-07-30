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

```bash
curl -fsS https://YOUR_DOMAIN/api/health
# {"status":"ok","checks":{"app":"ok","postgres":"ok","valkey":"ok"}}
```

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

## Logs

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod logs -f web caddy
```
