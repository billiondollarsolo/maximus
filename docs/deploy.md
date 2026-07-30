# Production deploy (Docker Compose)

Maximus is designed for **self-host first**: one VPS or home server, invite-only org, Caddy TLS, private Postgres/Valkey/RustFS.

## Architecture

```
Internet → :80/:443 Caddy (TLS, HSTS, SSE flush)
              ↓
           web :3000 (Node, non-root)
              ├── postgres (private)
              ├── valkey (private, password)
              └── rustfs  (private, S3 API)
```

Only **Caddy** publishes host ports. Data services stay on the Compose network.

## Prerequisites

- Linux host (or macOS for smoke) with Docker Compose v2  
- DNS **A/AAAA** (HTTP-01) **or** Cloudflare/Route53 API token (DNS-01)  
- Open ports **80 + 443** for HTTP-01 (not required for DNS-01)

## 1. Configure environment

```bash
cp .env.prod.example .env.prod
./scripts/generate-secrets.sh --write .env.prod
```

Edit `.env.prod`:

| Variable | Purpose |
| --- | --- |
| `DOMAIN` | Public hostname, e.g. `chat.example.com` |
| `APP_URL` | `https://chat.example.com` |
| `ACME_EMAIL` | Let’s Encrypt account email |
| `TLS_MODE` | `http01` \| `cloudflare` \| `route53` \| `local` |
| `POSTGRES_PASSWORD` | Strong DB password |
| `VALKEY_PASSWORD` | Strong Valkey password |
| `ENCRYPTION_KEY` | 32-byte base64 — **back up offline** |
| `S3_SECRET_KEY` | Object storage secret |
| `OPENAI_API_KEY` / … | Optional platform keys |

**Never commit `.env.prod`.** Keep `ENCRYPTION_KEY` offline; losing it means re-entering all BYOK API keys.

## 2. Launch

```bash
./scripts/up-prod.sh
```

This:

1. Selects the right **Caddyfile** for `TLS_MODE`  
2. Builds Caddy with DNS plugins when needed  
3. Builds the web image, runs **migrate**, starts the stack  
4. Probes `/api/health`

Manual equivalent:

```bash
export CADDYFILE=./Caddyfile   # or Caddyfile.cloudflare / .route53 / .local
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build
```

## 3. Bootstrap the first owner

Open `https://YOUR_DOMAIN/login` and complete **Create workspace**.

Or:

```bash
curl -X POST "https://YOUR_DOMAIN/api/auth/bootstrap" \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"your-long-password","orgName":"My Team","name":"You"}'
```

Password minimum: **10 characters**. Bootstrap is **disabled** after the first user exists.

## 4. Invite teammates

Admin → Members → invite email → share `/invite/<id>` link.

## 5. Operations

```bash
# Logs
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod logs -f

# Health
curl -fsS "https://YOUR_DOMAIN/api/health"

# Backup
./scripts/backup.sh ./backups
```

See [runbook.md](./runbook.md) for key rotation and [security-self-host.md](./security-self-host.md) for hardening.

## Service reference

| Service | Image | Role |
| --- | --- | --- |
| `caddy` | `caddy:2.9` or `maximus-caddy:local` | TLS reverse proxy, ACME auto-renew |
| `web` | build `docker/Dockerfile` | Maximus app (non-root) |
| `migrate` | same image, one-shot | SQL migrations before web |
| `postgres` | `postgres:16-alpine` | Primary data |
| `valkey` | `valkey/valkey:8-alpine` | Rate limits |
| `rustfs` | `rustfs/rustfs` | S3-compatible uploads |

## SSE / streaming notes

Caddy is configured with `flush_interval -1` and long read/write timeouts so chat SSE is not buffered. If you put another proxy in front, disable buffering for `/api/chat`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cert fails (HTTP-01) | DNS points to this host; 80/443 open; `ACME_EMAIL` set |
| Cert fails (DNS-01) | Token permissions; built `Dockerfile.caddy`; correct `CADDYFILE` |
| Web unhealthy | `docker compose ... logs web migrate`; `ENCRYPTION_KEY` set; DB up |
| Login cookie issues | `APP_URL` must match public HTTPS origin; `COOKIE_SECURE=true` |
| Streams stall | Proxy buffering; use provided Caddyfile |

## Updating

```bash
git pull
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod up -d --build
# migrate job runs automatically on deploy
```
