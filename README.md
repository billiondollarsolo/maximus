# Maximus

Enterprise ChatGPT-class workspace: multi-provider AI chat (OpenAI-compatible, Anthropic, Ollama), Postgres, invite-only orgs, TanStack-native stack.

**Agents and humans: read [`AGENTS.md`](./AGENTS.md) first.**

## Status

WP0 scaffold — monorepo, domain/config packages with TDD, Docker infra. Chat UI and auth land in later work packages.

## Prerequisites

- Node 22+
- pnpm 9+
- Docker (Postgres, Valkey, RustFS)

## Quick start

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint

# Infra
docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs

# App (when Start scaffold is fully wired)
pnpm dev
```

Copy `.env.example` → `.env` and fill secrets before running services that need them.

## Packages

| Package | Role |
| --- | --- |
| `apps/web` | TanStack Start web app |
| `packages/domain` | Pure domain (titles, model refs, trees, policies) |
| `packages/config` | Zod env parsing |
| `packages/db` | Drizzle + Postgres (stub) |
| `packages/auth` | Better Auth (stub) |
| `packages/provider-gateway` | Multi-provider resolve (stub) |
| `packages/storage` | S3/RustFS (stub) |
| `packages/rate-limit` | Valkey rate limits (stub) |

## License

Private — all rights reserved.
