# Quickstart

Get Maximus running in under 10 minutes (developer machine).

## Prerequisites

- **Node.js 22+** and **pnpm 9+**
- **Docker** + Docker Compose v2
- Optional: OpenAI / Anthropic API keys, or Ollama on the host

## 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/maximus.git
cd maximus
pnpm install
cp .env.example .env
./scripts/generate-secrets.sh --write .env
```

## 2. Start infrastructure

```bash
./scripts/up-dev.sh
# postgres :5432 · valkey :6379 · rustfs :9000
```

## 3. Migrate and run the app

```bash
pnpm db:migrate
pnpm dev
```

Open **http://localhost:3000** → **Create your workspace** (first-run bootstrap).  
After that, join is **invite-only**.

## 4. Chat

- Default `PROVIDER_MODE=fake` streams demo replies (no API key).
- For real models, set `PROVIDER_MODE=live` and `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` in `.env`, or add **BYOK** under Admin → Providers.

## 5. Quality checks

```bash
pnpm test && pnpm typecheck && pnpm lint
pnpm test:e2e   # Playwright smoke (needs infra + seed)
```

## Production / HTTPS

See **[deploy.md](./deploy.md)** and **[tls.md](./tls.md)** for Docker Compose + Caddy + Let’s Encrypt (HTTP-01, Cloudflare DNS, Route 53 DNS).

## Next steps

| Goal | Doc |
| --- | --- |
| Self-host on a VPS | [deploy.md](./deploy.md) |
| TLS & DNS ACME | [tls.md](./tls.md) |
| Security checklist | [security-self-host.md](./security-self-host.md) |
| Ops (backup, keys) | [runbook.md](./runbook.md) |
| Architecture | [architecture.md](./architecture.md) |
