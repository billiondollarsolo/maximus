# Architecture

See product plan (session plan.md) for full design. Summary:

- **apps/web** — TanStack Start UI + server routes
- **packages/domain** — pure domain (no I/O)
- **packages/db** — Drizzle/Postgres
- **packages/auth** — Better Auth + org helpers
- **packages/provider-gateway** — multi-provider adapters
- **packages/storage** — S3/RustFS
- **packages/rate-limit** — Valkey
- **packages/config** — Zod env

Compose services: `postgres`, `valkey`, `rustfs`.
