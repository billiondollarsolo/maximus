<p align="center">
  <strong>Maximus</strong><br/>
  <em>Self-hosted ChatGPT-class workspace for teams that care about control.</em>
</p>

<p align="center">
  Multi-provider AI chat · Invite-only orgs · Postgres · Docker Compose · TLS out of the box
</p>

<p align="center">
  <a href="./docs/quickstart.md">Quickstart</a> ·
  <a href="./docs/deploy.md">Deploy</a> ·
  <a href="./docs/tls.md">TLS & DNS ACME</a> ·
  <a href="./docs/security-self-host.md">Security</a> ·
  <a href="./docs/plan.md">Roadmap</a>
</p>

---

## Why Maximus?

**Own the stack.** Run a familiar chat UX on **your** servers, with **your** keys, without handing conversation history to a black-box SaaS.

| | |
| --- | --- |
| **ChatGPT-class UX** | Streaming chat, model picker, branches, search, dark/light |
| **Multi-provider** | OpenAI, Anthropic, Ollama, OpenAI-compatible endpoints |
| **Enterprise-shaped** | Invite-only, roles, admin, usage, audit, BYOK encryption |
| **Self-host first** | Docker Compose, Caddy proxy, Let’s Encrypt (HTTP-01 & DNS-01) |
| **Builder-friendly** | pnpm monorepo, TypeScript, TDD domain core, clear packages |

Built for **solo operators and small teams** who want production-minded defaults without a 50-person platform crew.

> **Status:** open-source **beta** (v0.x). Great for private self-host. Not a drop-in multi-tenant public SaaS yet. See [security notes](./docs/security-self-host.md).

---

## Features

- **Streaming chat** with server-authoritative history (no client spoofing of prior turns)
- **Model catalog** filtered by org allowlists and roles
- **Branching** — edit / regenerate with `‹ n / m ›` navigation
- **Attachments** via S3-compatible storage (RustFS in compose)
- **Admin** — members, providers (encrypted BYOK), models, usage, audit
- **Rate limits** on Valkey (fail closed by default)
- **Security headers** + same-origin mutation guards
- **TLS** — Caddy with auto-renew; Cloudflare & Route 53 DNS challenges supported

---

## Quickstart (local)

```bash
git clone https://github.com/YOUR_ORG/maximus.git && cd maximus
pnpm install
cp .env.example .env
./scripts/generate-secrets.sh --write .env

./scripts/up-dev.sh          # Postgres + Valkey + RustFS
pnpm db:migrate
pnpm dev                     # http://localhost:3000
```

First visit **Create workspace** → you’re the owner. Everything after that is **invite-only**.

Default `PROVIDER_MODE=fake` needs no API keys. For real models:

```bash
# .env
PROVIDER_MODE=live
OPENAI_API_KEY=sk-...
# and/or ANTHROPIC_API_KEY, OLLAMA_BASE_URL
```

Full walkthrough: **[docs/quickstart.md](./docs/quickstart.md)**

---

## Production in one path

```bash
cp .env.prod.example .env.prod
./scripts/generate-secrets.sh --write .env.prod
# set DOMAIN, ACME_EMAIL, TLS_MODE=http01|cloudflare|route53
./scripts/up-prod.sh
```

Open `https://YOUR_DOMAIN` → bootstrap owner → invite your team.

| TLS mode | Use when |
| --- | --- |
| **http01** | Public VPS, ports 80/443 open |
| **cloudflare** | DNS in Cloudflare (works with proxy / no open 80) |
| **route53** | DNS in AWS Route 53 |
| **local** | LAN / laptop smoke (internal CA) |

Deep dive: **[docs/deploy.md](./docs/deploy.md)** · **[docs/tls.md](./docs/tls.md)**

```
                    ┌─────────────┐
   Internet ──────► │    Caddy    │  TLS + HSTS + SSE
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Maximus    │
                    │  web :3000  │
                    └──┬───┬───┬──┘
              Postgres │   │   │ RustFS
                       │   │ Valkey
```

---

## Stack

| Layer | Choice |
| --- | --- |
| App | TanStack Start / Router, React 19, Tailwind |
| Data | Postgres 16, Drizzle |
| Limits | Valkey |
| Files | S3 API (RustFS in compose) |
| Proxy | Caddy 2 (optional DNS plugins) |
| Language | TypeScript monorepo (pnpm) |

Agents and contributors: start with **[AGENTS.md](./AGENTS.md)**.

---

## Project layout

```
apps/web                 # UI + API routes
packages/domain          # Pure domain (trees, RBAC, pricing)
packages/db              # Schema, repos, chat turn
packages/auth            # Sessions, invite-only bootstrap
packages/provider-gateway
packages/rate-limit
packages/storage
docker/                  # Compose, Dockerfile, Caddyfiles
scripts/                 # secrets, up-dev, up-prod, backup
docs/                    # quickstart, deploy, tls, security, plan
```

---

## Development

```bash
pnpm test            # unit + integration
pnpm typecheck
pnpm lint
pnpm --filter @maximus/web build
pnpm test:e2e        # Playwright smoke (login → chat → branch)
```

---

## Security (summary)

- Invite-only after first bootstrap  
- BYOK secrets encrypted with `ENCRYPTION_KEY`  
- Mutation requests same-origin checked  
- Prod cookies `Secure` + `HttpOnly`  
- Non-root container; private data-plane ports  

Read **[docs/security-self-host.md](./docs/security-self-host.md)** before exposing a host to the internet.

---

## Roadmap

Product plan and work packages: **[docs/plan.md](./docs/plan.md)**  
(SSO/OIDC, MFA, RAG, org API proxy, virtualization, …)

---

## Contributing

1. Read `AGENTS.md`  
2. Keep packages small; domain stays pure  
3. Tests for domain, authz, crypto, SSRF, rate-limit  
4. No secrets in git  

---

## License

[MIT](./LICENSE) © 2026 mjtechguy and Maximus contributors

---

<p align="center">
  Built for people who want ChatGPT muscle memory with server-side honesty.
</p>
