# Architecture

See product plan (session plan.md) for full design. Summary:

- **apps/web** — TanStack Start UI + **HTTP API** server routes (`/api/*`)
- **packages/domain** — pure domain (no I/O)
- **packages/db** — Drizzle/Postgres
- **packages/auth** — sessions + org helpers
- **packages/provider-gateway** — multi-provider adapters
- **packages/storage** — S3/RustFS
- **packages/rate-limit** — Valkey
- **packages/config** — Zod env

Compose services: `postgres`, `valkey`, `rustfs`.

## API-first rule

Product behavior is exposed as **JSON/SSE under `/api/*`**. The SPA is a client; do not put business logic only in React. Catalog: `GET /api` · human doc: [api.md](./api.md).

Auth: session cookie **or** `Authorization: Bearer` / `X-Session-Token` (token from login/bootstrap body).

## Deep-link rule

Every user-facing page has a stable URL (chat threads, settings, admin). Do not hide product state only in React memory. Map: [spa-routes.md](./spa-routes.md).

## Deploy surfaces

| Path | Location |
| --- | --- |
| Compose (bundled or external PG/S3/Valkey) | `docker/docker-compose.prod.yml` · [deploy.md](./deploy.md) · [deploy-external.md](./deploy-external.md) |
| Helm | `deploy/helm/maximus` · [deploy-helm.md](./deploy-helm.md) |

Infrastructure URLs are **env/secrets only** (not Admin UI forms). Overview reports connectivity.
