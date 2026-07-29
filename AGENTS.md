# AGENTS.md — Maximus

## Mission

Enterprise ChatGPT-class workspace: multi-provider chat, Postgres, invite-only orgs. Looks like ChatGPT; behaves like enterprise software.

## Non-negotiables

1. TDD for domain, gateway, repos, authz, crypto, SSRF, rate-limit (Red → Green → Refactor).
2. Server-authoritative chat history; never trust client prior messages.
3. Every server mutation/query: session → org membership → resource org match → role policy.
4. Secrets server-only; BYOK encrypted at rest; never log decrypted keys.
5. Cross-tenant: return **404** (not 403) when id is foreign (no existence leak).
6. Admins do not read others’ message bodies (usage/audit only).
7. UI: global CSS + Tailwind tokens only; thin routes; reusable modules; **lucide-react only**.
8. Files soft-max ~250 LOC; split before growing gods.
9. No open registration; invite-only.
10. Do not add dependencies without justification; prefer existing stack.

## Stack

- pnpm monorepo; Node 22+
- `apps/web`: TanStack Start, Router, Query, Table, Form, Virtual, AI
- `packages`: domain, db (Drizzle/Postgres), auth (Better Auth), provider-gateway, storage (S3/RustFS), rate-limit (Valkey), config (Zod env)
- Providers: OpenAI, openai_compatible, Anthropic, Ollama via TanStack AI adapters

## Commands

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm dev
pnpm db:migrate
docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs
```

## Boundaries

- `domain`: pure, no I/O, no other workspace package imports
- `provider-gateway`: may use `domain` + `config`; no db/auth/ui
- `db`: schema + repos only; no React
- `apps/web`: composition root; thin routes; serverFns call repos/gateway/auth
- Forbidden: circular imports; deep cross-feature internals

## TDD

- New pure function → test first
- New repo method → integration test with Postgres
- New authz path → positive + negative (cross-org) tests
- Chat/stream → fake adapter; no live provider in unit CI
- Never claim done without green relevant tests

## Security checklist (server PRs)

- [ ] Zod validate inputs
- [ ] Authz on every id
- [ ] No secret in client bundle / logs / error messages
- [ ] SSRF check on user-supplied URLs
- [ ] Rate limit chat/upload paths
- [ ] Audit admin mutations

## UI checklist (UI PRs)

- [ ] No page-local CSS / CSS modules
- [ ] Uses `components/ui` + layout modules
- [ ] Icons from lucide via `Icon` wrapper
- [ ] Route stays thin shell
- [ ] Works in dark + light tokens
- [ ] Keyboard + focus not broken

## Multi-tenancy

- All tenant rows carry `org_id`
- Conversation content: owner-only
- Active org from session; never trust client `orgId` alone

## Definition of done

1. Implement with tests
2. `pnpm test && pnpm typecheck && pnpm lint`
3. No drive-by refactors outside task
4. Update docs/ADR if architecture decision changed
5. Summarize what/why; list residual risks

## Forbidden

- SQLite “just for now”
- Client-side provider API keys
- Trusting client message history for model calls
- Admin break-glass chat read without explicit product decision
- Handcoded one-off pages / inline SVG icons / hex colors in features
- Editing applied migrations
- Force-push main; commit `.env` secrets

## Read more

- `docs/plan.md` — product/architecture plan (D1–D17, WPs, TDD)
- `docs/architecture.md`
- `docs/ui-parity-checklist.md`
- `docs/adr/`
