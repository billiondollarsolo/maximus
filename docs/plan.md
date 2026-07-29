# Maximus — Enterprise ChatGPT Clone

**Status:** Living plan — first-ship core (WP0–WP17) largely implemented; **next = polish + enterprise hardening (WP18+)**  
**Repo:** `/Users/mj/mjcode/billiondollarsolo/maximus`  
**Canonical path:** `docs/plan.md` (this file)  
**Product name:** Maximus  
**North star:** Looks, feels, and works like ChatGPT for daily chat; ships enterprise controls large companies expect; elite TypeScript engineering with small files, Postgres, and test-first delivery.

---

## Table of contents

1. [Locked product decisions](#1-locked-product-decisions) (D1–D17)
2. [Research: ChatGPT product surface](#2-research-chatgpt-product-surface)
3. [Research: OpenWebUI lessons](#3-research-openwebui-lessons)
4. [Research: TanStack stack fit](#4-research-tanstack-stack-fit)
5. [Goals, non-goals, success criteria](#5-goals-non-goals-success-criteria)
6. [Architecture](#6-architecture)
7. [Repository layout & file-size rules](#7-repository-layout--file-size-rules)
8. [Data model (Postgres)](#8-data-model-postgres)
9. [Auth, tenancy, RBAC](#9-auth-tenancy-rbac)
10. [Provider gateway](#10-provider-gateway)
11. [Chat domain: messages, trees, streaming](#11-chat-domain-messages-trees-streaming)
12. [API & server function contracts](#12-api--server-function-contracts)
13. [UI system & ChatGPT parity](#13-ui-system--chatgpt-parity)
14. [Attachments (RustFS)](#14-attachments-rustfs)
15. [Enterprise admin surfaces](#15-enterprise-admin-surfaces)
16. [Security, privacy, compliance posture](#16-security-privacy-compliance-posture)
17. [Observability & ops](#17-observability--ops)
18. [TDD methodology (mandatory)](#18-tdd-methodology-mandatory)
… first-ship WPs …
22. [Phase 3+ product backlog](#22-phase-3-backlog)
**23. [Shipped vs next (honest inventory)](#23-shipped-vs-next-honest-inventory)**  
**24. [Phase 4 — Enterprise polish program](#24-phase-4--enterprise-polish-program)**  
**25. [WP18+ work packages](#25-wp18-work-packages)**  
**26. [Security & encryption deep dive](#26-security--encryption-deep-dive)**  
**27. [Docker, TLS & production deploy](#27-docker-tls--production-deploy)**  
**28. [DRY / architecture hygiene](#28-dry--architecture-hygiene)**  
**29. [Elite UI polish bar](#29-elite-ui-polish-bar)**  
**30. [Enterprise quality gates & compliance track](#30-enterprise-quality-gates--compliance-track)**
19. [Test matrix](#19-test-matrix)
20. [Work packages (granular tasks)](#20-work-packages-granular-tasks)
21. [Definition of done (first ship)](#21-definition-of-done-first-ship)
22. [Phase 3+ backlog](#22-phase-3-backlog)
23. [Risks & mitigations](#23-risks--mitigations)
24. [Open discussion topics](#24-open-discussion-topics)
25. [Glossary](#25-glossary)

---

## 1. Locked product decisions

| # | Decision | Choice | Rationale |
| --- | --- | --- | --- |
| D1 | Tenancy | Multi-org **schema day 1**; simple single-org UX until admin | Avoid rewrite; admin lands in same ship |
| D2 | API keys | Platform env **+** org BYOK (encrypted) | Dev DX + enterprise self-host |
| D3 | UI fidelity | Near-pixel ChatGPT dark UI + Maximus brand | Muscle memory; legal-safe recreation |
| D4 | First ship | **Phase 0–2**: chat clone + enterprise admin | Explicitly requested |
| D5 | Auth | Better Auth + organization plugin | Self-hosted, invites, roles, TanStack Start support |
| D6 | Join model | **Invite-only** | Enterprise default |
| D7 | Deploy | Docker Compose first | On-prem / self-host path |
| D8 | SSO | Stub in v1; full OIDC in **2.1** | Don’t block chat/admin polish |
| D9 | Attachments | S3-compatible via **RustFS** (not MinIO) | User preference; same S3 SDK path as R2/S3 |
| D10 | Chat integrity | **Server-authoritative history** — rebuild branch from Postgres; client sends new user text + ids only | Prevent spoofing; enterprise integrity |
| D11 | Conversation creation | **On first message send** — “New chat” is empty UI only | No empty junk rows in sidebar |
| D12 | Admin chat access | **Privacy by default** — admins see usage/audit, **not** message bodies | Break-glass is Phase 3+ if ever |
| D13 | Rate limiting | **Valkey** (Redis-protocol, not Redis brand) for distributed limits | Multi-instance safe; open-source fork |
| D14 | Polish scope | Heuristic **+ LLM retitle**, **thumbs** feedback, **light + dark** themes | Full ChatGPT-class chrome in first ship |
| D15 | Cost tracking | Always store tokens; **seeded price table** → `cost_micros` when known | $ on dashboards; null when unknown (e.g. Ollama) |
| D16 | Valkey outage | **Fail closed by default**; org may set `rateLimitFailOpen: true` | Availability vs abuse tradeoff per tenant |
| D17 | UI architecture | **Global CSS only** + **framework/modules composition** + **Lucide icons** | No bespoke handcoded pages or ad-hoc per-page styles |

### Engineering defaults (assumed unless overridden)

| Topic | Default |
| --- | --- |
| Language | TypeScript strict |
| Runtime | Node 22 LTS |
| Package manager | pnpm workspaces |
| App | TanStack Start (React) |
| AI | TanStack AI + official adapters |
| DB | PostgreSQL 16+ |
| ORM | Drizzle + drizzle-kit |
| Validation | Zod at every boundary |
| Object storage | RustFS (S3 API); `@aws-sdk/client-s3` |
| Styling | **Global CSS** (tokens + Tailwind utilities); **no CSS Modules / styled-jsx / per-page CSS files** |
| Headless UI | Radix / Base UI primitives composed into reusable `components/ui/*` |
| Icons | **`lucide-react` only** — no inline SVGs, no mixed icon packs |
| Pages / routes | **Thin shells only** — compose features + UI modules; never one-off handcoded page layouts |
| Unit/integration tests | Vitest |
| E2E | Playwright |
| Process | **TDD for domain, gateway, repos, authz** (see §18) |
| Rate limit store | Valkey (compose service); ioredis/node-redis client |
| Themes | Dark default + light; CSS variables on `:root` / `[data-theme]` |

---

## 2. Research: ChatGPT product surface

ChatGPT is a **conversation OS**, not a single chat widget. Three persistent shells:

### 2.1 Sidebar (~260px, collapsible)

- **Primary actions:** New chat, Search chats
- **Secondary nav:** Projects (and GPTs / Library on some tiers — GPTs deferred)
- **Conversation inventory:** reverse chronological; date groups (Today / Yesterday / Previous 7 days / Older)
- **Row chrome:** title (truncated), hover actions — rename, archive/delete, move to project
- **Footer:** user menu → settings, help, logout
- **Responsive:** drawer on mobile; icon rail when collapsed on desktop
- **Keyboard:** focusable list; optional ⌘K global search

### 2.2 Main thread

| State | Behavior |
| --- | --- |
| Empty | Centered hero (“What can I help with?”), starter suggestion chips, model hint |
| Active | Scrollable message column; user vs assistant differentiation; sticky composer |
| Streaming | Token append; stop control; partial markdown; disable double-send (or queue — OpenWebUI pattern optional later) |
| Error | Inline error on assistant bubble; retry/regenerate |

**Message affordances (assistant):** copy, regenerate, edit branch (via editing prior user msg), thumbs (optional v1), share (phase 3).  
**Message affordances (user):** edit (fork), copy.  
**Content:** Markdown, GFM tables, fenced code + language + copy, lists, blockquotes; math optional later.

### 2.3 Composer (sticky bottom)

- Auto-growing textarea
- Enter = send; Shift+Enter = newline
- Attach control (files/images)
- Model selector (header or composer-adjacent)
- Send button (accent); becomes Stop while streaming
- Character/context soft limits (show when near limit — phase 1.5)

### 2.4 Conversation lifecycle

1. New chat → empty state (no DB row until first message **or** create draft on open — **decision: create conversation on first send** to avoid empty junk rows)
2. First user message → create conversation + user message + stream assistant
3. Auto-title from first exchange (async, non-blocking)
4. Rename / archive / delete
5. Edit past user message → new branch; `active_leaf_id` updates
6. Regenerate assistant → sibling assistant under same parent user message

### 2.5 Settings (consumer-shaped)

- General (theme, language later)
- Personalization (custom instructions)
- Data controls (export, delete chats)
- Account (email, password, sessions)
- **Enterprise overlay:** Admin section for owner/admin only

### 2.6 Enterprise ChatGPT-class expectations

- Workspace/org multi-user
- RBAC
- Model access control
- Usage & cost visibility
- Auditability of admin actions
- Data export / retention hooks
- SSO (2.1)
- Keys never exposed to browsers

---

## 3. Research: OpenWebUI lessons

### Steal for Maximus

| OpenWebUI capability | Maximus mapping |
| --- | --- |
| Multi-provider | Provider gateway (OpenAI, openai_compatible, Anthropic, Ollama) |
| Model presets | Phase 3 “Assistants” |
| Folders / pins | Projects + archive; pins optional phase 3 |
| Admin analytics | Usage dashboard (TanStack Table) |
| Postgres at scale | Postgres only (no SQLite path) |
| RBAC + per-model access | memberships + model_allowlists |
| Knowledge/RAG | Phase 3 PGVector |

### Explicitly do not copy into v1

- Channels / multiplayer chat
- Notes app
- Open Terminal / computer-use
- 13 vector DB backends
- Everything-in-one Python monolith patterns

---

## 4. Research: TanStack stack fit

| Package | Use |
| --- | --- |
| TanStack Start | Full-stack React, SSR, `createServerFn`, server routes |
| TanStack Router | File routes: `/`, `/c/$conversationId`, `/projects/$id`, `/settings/*`, `/admin/*`, `/api/*` |
| TanStack AI | `chat()`, adapters, tools, abort, middleware |
| `@tanstack/ai-react` | `useChat` + SSE connection |
| `@tanstack/ai-openai` | OpenAI + **OpenAI-compatible** base URLs |
| `@tanstack/ai-anthropic` | Claude |
| `@tanstack/ai-ollama` | Local Ollama |
| TanStack Query | Lists, admin data, optimistic mutations |
| TanStack Table | Admin tables |
| TanStack Virtual | Message list + sidebar history |
| TanStack Form | Settings / admin forms + Zod |

**Canonical streaming path:**

```
useChat({ connection: fetchServerSentEvents('/api/chat'), forwardedProps: { conversationId, modelRef } })
  → POST /api/chat
  → authz + gateway.resolveAdapter()
  → chat({ adapter, messages, systemPrompts, abortController })
  → toServerSentEventsResponse(stream)
  → onFinish: persist assistant message + usage_events
```

**Persistence rule:** Postgres is authoritative. Client `persistence` adapters are cache-only, never sole source of truth.

---

## 5. Goals, non-goals, success criteria

### Goals (first ship)

1. ChatGPT-faithful web UX for core chat loops
2. Multi-provider completions with streaming + stop
3. Durable history with branch/edit/regenerate
4. Org BYOK + platform keys
5. Invite-only multi-user orgs with RBAC
6. Admin: providers, models, members, usage, audit
7. Docker Compose deploy (web + postgres + rustfs)
8. Enterprise-grade code quality: small files, typed boundaries, TDD core

### Non-goals (first ship)

- Pixel theft of OpenAI assets / proprietary CSS
- RAG, canvas, voice, image gen, GPTs marketplace
- Public multi-tenant SaaS billing
- SAML/SCIM
- Mobile native apps

### Success criteria (measurable)

| Metric | Target |
| --- | --- |
| First-token latency (local mock adapter) | < 100ms overhead above provider |
| Conversation list load (500 chats) | < 200ms server p95 with pagination |
| Message thread open (200 msgs on active branch) | Virtualized; initial paint < 100ms after data |
| Unit test coverage on `domain` + `provider-gateway` + `repos` | ≥ 80% lines |
| E2E critical paths | 100% green in CI |
| Authz isolation | Cross-org access tests must fail closed |
| Max source file size (soft) | 250 LOC; hard review if > 350 |

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                      │
│  AppShell = Sidebar | Thread | Composer                       │
│  useChat · Query · Virtual · Table · Form                     │
└────────────────────────────┬─────────────────────────────────┘
                             │ cookie session · SSE · serverFns
┌────────────────────────────▼─────────────────────────────────┐
│  apps/web (TanStack Start)                                    │
│  routes (thin) → features/* → server/* → packages/*           │
│  /api/chat  /api/uploads  /api/auth/*                         │
└───────┬───────────────────────────────┬──────────────────────┘
        │                               │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│  PostgreSQL    │  │  RustFS (S3)   │  │  Valkey        │
│  auth + app    │  │  attachments   │  │  rate limits   │
└────────────────┘  └────────────────┘  └────────────────┘
```

### 6.1 Package boundaries

```
packages/
  domain/              # pure types, policies, message-tree, title heuristics — NO I/O
  db/                  # drizzle schema, migrations, db client, repositories
  auth/                # better-auth instance config, session helpers, role checks
  provider-gateway/    # model registry resolve, adapter factory, SSRF guards, crypto
  storage/             # S3 client wrapper (RustFS), presign, key layout
  rate-limit/          # Valkey client + sliding window helpers
  ai-tools/            # toolDefinition catalog (server impls) — phase 1.5+
  config/              # env schema (Zod), shared constants
```

**Dependency direction (enforced by eslint boundaries):**

```
domain ← db ← auth ← provider-gateway ← storage
                ↖___________ apps/web ___________↗
```

`domain` has zero deps on other workspace packages.  
`apps/web` may import all packages; packages must not import `apps/web`.

### 6.2 Request lifecycle (chat)

1. Client sends messages + `forwardedProps` (conversationId, modelRef, projectId?)
2. Server authenticates session; resolves active org
3. `requireOrgMember(orgId, userId)` 
4. Load conversation; verify `conversation.orgId === activeOrg` and access policy
5. Rate limit check
6. Persist user message (if new); create assistant placeholder `status=streaming`
7. Build system prompts (org defaults + project instructions + user custom instructions)
8. Resolve adapter via gateway
9. Stream chunks to client; optionally buffer for final write
10. Finalize assistant message; write `usage_events`; audit if needed
11. On abort: mark assistant `status=aborted`, keep partial content
12. On error: `status=error`, store safe error code (never raw provider secrets)

---

## 7. Repository layout & file-size rules

### 7.1 Target tree

```
maximus/
  apps/web/
    src/
      routes/                    # thin route files only
        __root.tsx
        index.tsx                # redirects to chat
        login.tsx
        invite.$id.tsx
        c.$conversationId.tsx
        settings.route.tsx
        settings/*.tsx
        admin.route.tsx
        admin/*.tsx
        api.chat.ts
        api.uploads.ts
        api.auth.$.ts
      features/
        chat/
          components/            # one component per file
          hooks/
          server/                # feature serverFns if needed
          model/                 # view-models / mappers
        sidebar/
        projects/
        settings/
        admin/
        auth/
      components/
        ui/                      # primitives only (Button, IconButton, Dialog…)
        markdown/
        layout/
      styles/
        tokens.css
        app.css
      test/                      # web-level tests
  packages/
    domain/src/
    db/src/
      schema/
      repos/
      migrations/
    auth/src/
    provider-gateway/src/
    storage/src/
    config/src/
  docker/
    docker-compose.yml
    rustfs/                      # init if needed
  docs/
    ui-parity-checklist.md
    architecture.md
    adr/                         # architecture decision records
  e2e/
  package.json
  pnpm-workspace.yaml
  turbo.json                     # optional
  vitest.workspace.ts
  eslint.config.js
  README.md
```

### 7.2 File size & modularity rules

| Rule | Detail |
| --- | --- |
| Soft max | ~250 LOC per file |
| Hard review | >350 LOC requires split or ADR exception |
| One export role | Prefer one primary export per file |
| No god hooks | `useChatPage` orchestrates; logic in pure functions |
| No business logic in routes | Routes wire loaders + feature modules only (D17) |
| No handcoded pages | Extract layout/feature modules; routes stay thin shells |
| Components | Design-system + feature modules; data via hooks; Lucide only |
| Styling | Global CSS tokens + Tailwind utilities only |
| Repos | One entity family per file (`conversations.ts`, `messages.ts`) |
| Tests colocated | `foo.ts` + `foo.test.ts` next to unit under test |

### 7.3 Coding standards

- `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (if viable)
- No `any` without `// rationalized:` comment + issue link
- Prefer `Result`-style or thrown typed errors at boundaries — pick one and stick (recommend: thrown `AppError` with code)
- All public functions documented with one-line purpose when non-obvious
- Conventional commits
- ADRs for decisions that change architecture

---

## 8. Data model (Postgres)

### 8.1 Design principles

- UUID primary keys (`uuidv7` preferred if available, else `uuid v4`)
- `created_at` / `updated_at` timestamptz everywhere relevant
- Soft delete where user recovery matters (`archived_at`, `deleted_at`)
- `org_id` on every tenant-owned row
- JSONB for structured message content and flexible settings
- Auth tables owned by Better Auth (generated/migrated per their schema); app tables in `public` with clear prefix or separate names

### 8.2 Core app tables

```text
organizations_ext          -- app settings beyond Better Auth org row
  org_id PK FK
  settings jsonb           -- { defaultModelRef, retentionDays, budgets... }
  created_at, updated_at

provider_connections
  id PK
  org_id FK
  kind text                -- openai | openai_compatible | anthropic | ollama
  name text
  base_url text null
  credentials_encrypted text  -- ciphertext
  credentials_meta jsonb   -- { kms: 'local', v: 1 } no secrets
  is_enabled boolean
  created_by FK users
  created_at, updated_at

models
  id PK
  org_id FK null           -- null = platform catalog entry
  connection_id FK null    -- null when using platform env
  provider_kind text
  model_id text            -- native id e.g. gpt-4.1, claude-sonnet-4
  display_name text
  capabilities jsonb       -- { vision, tools, streaming }
  is_enabled boolean
  sort_order int
  unique (org_id, provider_kind, model_id, connection_id)

model_allowlists           -- optional restriction; empty = all enabled models
  id PK
  org_id FK
  model_id FK
  role text null           -- if null, applies to all roles; else owner|admin|member
  unique (org_id, model_id, role)

projects
  id PK
  org_id FK
  owner_user_id FK
  name text
  instructions text null
  default_model_ref text null
  created_at, updated_at, archived_at

conversations
  id PK
  org_id FK
  user_id FK               -- creator/owner
  project_id FK null
  title text null
  title_source text null   -- heuristic | llm | user (user never overwritten)
  model_ref text null      -- last/default model for next turn
  active_leaf_id FK null   -- messages.id
  archived_at timestamptz null
  created_at, updated_at
  indexes: (org_id, user_id, updated_at desc), (org_id, project_id)

messages
  id PK
  conversation_id FK
  parent_message_id FK null
  role text                -- user | assistant | system | tool
  content jsonb            -- multimodal parts array
  status text              -- pending | streaming | complete | aborted | error
  model_ref text null
  token_usage jsonb null   -- { input, output, total }
  error jsonb null         -- { code, message } safe
  position int             -- sibling order under same parent
  created_at, updated_at
  indexes: (conversation_id, created_at), (parent_message_id)

attachments
  id PK
  org_id FK
  message_id FK null       -- null while uploading
  uploader_user_id FK
  storage_key text
  filename text
  mime text
  size_bytes bigint
  sha256 text null
  meta jsonb
  created_at

custom_instructions
  user_id PK FK
  org_id PK FK             -- per-org personalization
  about_user text null
  preferred_response text null
  updated_at

usage_events
  id PK
  org_id FK
  user_id FK
  conversation_id FK null
  message_id FK null
  model_ref text
  provider_kind text
  input_tokens int
  output_tokens int
  cost_micros bigint null  -- micro-USD; null if unpriced
  latency_ms int null
  status text              -- ok | error | aborted
  created_at
  indexes: (org_id, created_at), (org_id, user_id, created_at)

audit_events
  id PK
  org_id FK null
  actor_user_id FK null
  action text              -- e.g. provider.created, member.role_changed
  resource_type text
  resource_id text null
  meta jsonb
  ip text null
  user_agent text null
  created_at
  indexes: (org_id, created_at)

sso_configs                -- stub for 2.1
  id PK
  org_id FK unique
  provider text null
  issuer_url text null
  client_id text null
  client_secret_encrypted text null
  is_enabled boolean default false
  created_at, updated_at

message_feedback
  id PK
  message_id FK
  user_id FK
  rating text              -- up | down
  created_at
  unique (message_id, user_id)

model_prices
  id PK
  org_id FK null           -- null = platform seed
  provider_kind text
  model_id_pattern text
  input_usd_per_1m numeric
  output_usd_per_1m numeric
  currency text default 'USD'
  effective_from timestamptz
```

### 8.3 Better Auth tables

Managed by Better Auth (users, sessions, accounts, verifications, organizations, members, invitations).  
**App rule:** never write to auth tables except via Better Auth APIs.

### 8.4 Message `content` jsonb shape

```ts
type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; attachmentId: string; mime: string }
  | { type: 'file'; attachmentId: string; mime: string; filename: string }

// messages.content = ContentPart[]
```

### 8.5 Conversation tree invariants (domain tests)

1. Exactly one root path from `active_leaf_id` to root via `parent_message_id`
2. Regenerated assistants share the same `parent_message_id` (the user message)
3. Edited user message creates a **new** user node with parent = grandparent (or root), not mutate history
4. Deleting a conversation cascades messages/attachments metadata (storage GC async)

---

## 9. Auth, tenancy, RBAC

### 9.1 Better Auth configuration

- Email + password
- Organization plugin enabled
- `allowUserToCreateOrganization`: **false** for normal users; bootstrap script creates first owner+org
- Invitations required to join
- Disable public sign-up route (invite accept is the only registration path; optional local bootstrap CLI for first user)

### 9.2 Roles

| Role | Capabilities |
| --- | --- |
| **owner** | Full admin + transfer/delete org + manage billing later |
| **admin** | Manage members, invites, providers, models, view usage/audit |
| **member** | Chat, manage own conversations/projects, personal settings |

### 9.3 Authorization helpers (`packages/auth` or `domain` policies)

```ts
requireSession()
requireOrgMembership(orgId)
requireOrgRole(orgId, ['owner','admin'])
assertConversationAccess(conversation, userId, orgId)
assertModelAllowed(orgId, role, modelRef)
```

Every serverFn and API route calls these. **No client-trusted orgId without membership check.**

### 9.4 Bootstrap (first deploy)

1. `pnpm bootstrap` or compose init job
2. Creates first user from env (`BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD`)
3. Creates default org
4. Assigns owner
5. Seeds platform model catalog (no secrets)

### 9.5 Invite flow

1. Admin invites email + role
2. Email (SMTP) or dev console link
3. Accept invite page sets password if new user
4. Membership created; redirect to app
5. Audit: `member.invited`, `member.joined`

---

## 10. Provider gateway

### 10.1 Responsibilities

- Validate model ref
- Resolve connection + credentials
- Enforce allowlists & enabled flags
- Construct TanStack AI adapter
- SSRF-protect custom base URLs
- Normalize errors to safe codes
- Estimate/record token usage when provider returns it

### 10.2 Model ref format

```text
{providerKind}:{connectionId?}:{modelId}
// examples:
// platform:openai:gpt-4.1
// openai_compatible:conn_abc:llama-3.1-70b
// anthropic:conn_xyz:claude-sonnet-4
// ollama:conn_local:llama3.2
```

Canonical parsing in `domain` with tests.

### 10.3 Credential resolution order

1. Org connection referenced by model (BYOK)
2. Platform env for platform-catalog models
3. Else error `MODEL_UNAVAILABLE`

### 10.4 Encryption

- Algorithm: AES-256-GCM
- Key: `ENCRYPTION_KEY` (32 bytes base64)
- Payload: `iv || ciphertext || tag` encoded base64
- Rotate: version field in `credentials_meta`; dual-read later if needed

### 10.5 SSRF policy for `base_url`

Block:

- Non-http(s) schemes
- Localhost / loopback (configurable allow for Ollama in trusted self-host — **flag** `ALLOW_PRIVATE_BASE_URLS=true` for docker)
- Link-local, metadata IPs (`169.254.169.254`)
- Literal cloud metadata hostnames

Document that Ollama in compose requires private URL allow.

### 10.6 Adapters

| kind | Package | Notes |
| --- | --- | --- |
| openai | `@tanstack/ai-openai` | Platform OpenAI |
| openai_compatible | `@tanstack/ai-openai` + baseURL | Azure, OpenRouter, vLLM, LiteLLM… |
| anthropic | `@tanstack/ai-anthropic` | |
| ollama | `@tanstack/ai-ollama` | baseURL required |

### 10.7 Test doubles

- `FakeTextAdapter` in gateway tests: yields scripted chunks, supports abort mid-stream
- Never hit real providers in unit/CI (optional nightly integration job)

---

## 11. Chat domain: messages, trees, streaming

### 11.1 Pure domain modules (`packages/domain`)

| Module | Responsibility |
| --- | --- |
| `message-tree.ts` | Build path-to-root, list siblings, apply regenerate/edit ops |
| `active-branch.ts` | Resolve messages to render from `active_leaf_id` |
| `title.ts` | Derive provisional title from first user text |
| `model-ref.ts` | Parse/serialize/validate model refs |
| `content-parts.ts` | Normalize multimodal content |
| `errors.ts` | `AppError` codes |
| `policies/rbac.ts` | Pure permission checks |

### 11.2 Stream persistence strategy (v1)

**Chosen:** buffer tokens in memory; write final assistant content on finish/abort/error.  
**Why:** simpler, fewer DB writes; acceptable for v1.  
**Tradeoff:** crash mid-stream loses partial (acceptable; document).  
**Future:** optional chunk append every N chars for resume.

### 11.3 System prompt assembly order

1. Platform safety baseline (short, fixed)
2. Org default instructions (admin setting)
3. Project instructions (if any)
4. User custom instructions (about + preferred style)
5. Runtime context (date, user display name — optional)

### 11.4 Title generation (D14)

1. **Sync heuristic** on first message (first ~60 chars) — immediate sidebar title  
2. **Async LLM retitle** after first assistant completes — non-blocking; prefer small/cheap platform model; update `conversations.title` + invalidate list query  
3. Skip LLM retitle if no available model/keys; keep heuristic  
4. User rename always wins (set `title_source = user` and never overwrite)

---

## 12. API & server function contracts

### 12.1 HTTP routes

| Method | Path | Purpose |
| --- | --- | --- |
| ALL | `/api/auth/*` | Better Auth handler |
| POST | `/api/chat` | SSE chat completions |
| POST | `/api/uploads` | Create upload slot / presigned PUT |
| GET | `/api/uploads/:id` | Download (authz) via redirect or stream |

### 12.2 `POST /api/chat` body (locked: server-authoritative)

```ts
{
  // NOT full history — server rebuilds from DB
  input: {
    text: string
    attachmentIds?: string[]
  }
  forwardedProps: {
    conversationId?: string  // omit = create conversation on this first send
    modelRef: string
    projectId?: string       // only used when creating new conversation
    // branching:
    mode?: 'send' | 'regenerate' | 'edit'
    targetMessageId?: string // user msg to edit, or assistant msg to regenerate
  }
}
```

**Flow (locked):**
1. Authz + rate limit  
2. If no `conversationId` → create conversation (title provisional, project optional)  
3. Load active branch messages from Postgres  
4. Apply mode: append user | regenerate sibling | edit-fork user node  
5. Call provider with reconstructed ModelMessages  
6. Stream + finalize  

TDD must assert client cannot inject fake prior assistant turns (WP6).

### 12.3 Server functions (examples)

```
listConversations({ cursor, query, projectId? })
getConversation({ id })  // includes active branch messages
renameConversation({ id, title })
archiveConversation({ id })
deleteConversation({ id })
setConversationModel({ id, modelRef })
createProject / updateProject / listProjects
getCustomInstructions / setCustomInstructions
admin.listMembers / invite / setRole / remove
admin.listConnections / createConnection / deleteConnection / testConnection
admin.listModels / setModelEnabled / setAllowlist
admin.usageQuery / auditQuery
exportConversation({ id, format: 'json' | 'md' })
```

All validated with Zod. All authz-checked.

---

## 13. UI system & ChatGPT parity

### 13.0 UI architecture laws (D17) — non-negotiable

| Law | Rule |
| --- | --- |
| **Global CSS only** | All styling via `styles/tokens.css` + `styles/app.css` (imported once in root) and Tailwind utility classes. **Forbidden:** CSS Modules, styled-components, emotion, `style={{}}` except rare dynamic values (progress width), page-local `.css` files, one-off `<style>` tags. |
| **No handcoded pages** | Every route file is a **thin composition shell** (`<AppShell><FeatureX /></AppShell>`). Layout, chrome, forms, tables, dialogs come from **reusable modules**. If a pattern appears twice, extract a module before shipping. |
| **Framework-first** | Prefer TanStack Router layouts, TanStack Form, TanStack Table, TanStack Query, Radix primitives — do not reinvent. |
| **Lucide only** | Icons exclusively from `lucide-react`. Shared wrapper `components/ui/icon.tsx` for size/stroke defaults. No raw SVG blobs in features. |
| **Design system first** | Build `components/ui/*` (Button, IconButton, Input, Textarea, Dialog, DropdownMenu, ScrollArea, Tooltip, …) **before** feature chrome. Features import ui + compose; they do not invent new button styles. |

**Route file example (allowed):**
```tsx
// routes/c.$conversationId.tsx — thin only
export const Route = createFileRoute('/c/$conversationId')({
  component: ConversationPage,
})
function ConversationPage() {
  const { conversationId } = Route.useParams()
  return (
    <AppShell>
      <ChatFeature conversationId={conversationId} />
    </AppShell>
  )
}
```

**Forbidden:** 400-line route with custom sidebar markup, ad-hoc hex colors, inline SVG icons.

### 13.1 Design tokens (global CSS)

Single source of truth in `apps/web/src/styles/tokens.css` (global):

```css
:root, [data-theme="dark"] {
  --bg-app: #212121;
  --bg-sidebar: #171717;
  --bg-composer: #2f2f2f;
  --text-primary: #ececec;
  --text-muted: #b4b4b4;
  --border-subtle: #2e2e2e;
  --accent: #10a37f;
  --radius-composer: 24px;
  --sidebar-width: 260px;
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, monospace;
}
[data-theme="light"] {
  /* full light palette — same variable names */
}
```

`app.css` imports tokens + Tailwind. Mapped into Tailwind theme (`bg-app`, `text-primary`, etc.) so components use utilities, not raw hex.

Light theme: **in v1** (D14) — full second token palette; toggle sets `data-theme` on `<html>`.

### 13.2 Component inventory (reusable modules, one file each)

**UI primitives (`components/ui`, Lucide via `Icon`):**  
`Button`, `IconButton`, `Icon`, `Input`, `Textarea`, `Dialog`, `DropdownMenu`, `ScrollArea`, `Tooltip`, `Separator`, `Spinner`, `Toast`, `ConfirmDialog`, `ErrorBanner`, `Badge`, `Kbd`

**Layout modules:** `AppShell`, `SidebarFrame`, `MainFrame`, `MobileNavDrawer`, `SettingsShell`, `AdminShell`

**Sidebar feature modules:** `NewChatButton`, `SearchChatsButton`, `ConversationList`, `ConversationGroup`, `ConversationRow`, `ConversationRowMenu`, `ProjectsNav`, `UserMenu`

**Chat feature modules:** `EmptyState`, `SuggestionChips`, `MessageList`, `UserMessage`, `AssistantMessage`, `MessageActions`, `BranchSwitcher`, `StreamingIndicator`, `Composer`, `ComposerEditor`, `ComposerAttachButton`, `ComposerSendButton`, `ModelSelect`, `StopButton`

**Markdown modules:** `MarkdownRenderer`, `CodeBlock`, `CopyButton`

**Settings/Admin modules:** `SettingsNav`, `DataTable` (TanStack Table wrapper), form field modules (TanStack Form + ui Input)

**Icons (examples, all Lucide):** `Plus`, `Search`, `PanelLeft`, `MessageSquare`, `Folder`, `Settings`, `LogOut`, `Copy`, `RefreshCw`, `ThumbsUp`, `ThumbsDown`, `Paperclip`, `Square` (stop), `ChevronDown`, `Sun`, `Moon`, `Ellipsis`, `Trash2`, `Pencil`

### 13.3 UI parity acceptance checklist

See also `docs/ui-parity-checklist.md` (to create):

- [ ] Dark default + light theme parity; density matches ChatGPT (not airy marketing layout)
- [ ] Theme toggle persists
- [ ] Thumbs up/down on assistant messages
- [ ] Titles: heuristic then LLM retitle without clobbering user renames
- [ ] Sidebar collapse animation
- [ ] Date-grouped history
- [ ] Empty state centered
- [ ] Composer pill geometry
- [ ] Streaming without flicker/remount of whole list
- [ ] Code block copy
- [ ] Hover message actions
- [ ] Stop during generation
- [ ] Settings structure familiar
- [ ] Admin only for admin/owner
- [ ] Maximus wordmark (not OpenAI)

### 13.4 Accessibility bar

- Keyboard complete for primary flows
- Focus visible
- `aria-live` polite for streaming completion
- Dialog focus traps
- Contrast AA
- `prefers-reduced-motion`

---

## 14. Attachments (RustFS)

### 14.1 Compose

- Service `rustfs` ports 9000 (S3), 9001 (console)
- Bucket `maximus-uploads` created on init
- Path-style addressing

### 14.2 Upload flow

1. Client requests upload intent (filename, mime, size)
2. Server validates mime/size (caps: e.g. 25MB image, 50MB doc — configurable)
3. Server creates `attachments` row + storage key `org/{orgId}/att/{id}`
4. Server returns presigned PUT URL
5. Client uploads directly to RustFS
6. Client confirms; attachment ready to attach to next message
7. On send, content parts reference `attachmentId`
8. For vision models, server fetches object (or signed GET) and converts to provider multimodal format
9. For text/PDF: extract text server-side (start with plain text + pdf-parse; expand later)

### 14.3 Security

- Authz on every presign and download
- Virus scan: out of scope v1; document
- Block executable mimes
- Lifecycle: delete object when attachment row deleted (best-effort job)

---

## 15. Enterprise admin surfaces

| Screen | Capabilities | Table? |
| --- | --- | --- |
| Overview | User count, message volume 7d, token spend 7d | cards |
| Members | List, role change, remove, pending invites | TanStack Table |
| Invites | Create invite, revoke | Table |
| Providers | Add/edit/disable connections, test | forms + table |
| Models | Enable/disable, sort, allowlist by role | Table |
| Usage | Filter by user/model/date; CSV export | Table |
| Audit | Filter by action/actor/date | Table |
| SSO | Stub “Coming in 2.1” + disabled form | — |
| Org settings | Name, default model, budgets, retention | form |

---

## 16. Security, privacy, compliance posture

| Control | v1 requirement |
| --- | --- |
| Secrets | Server-only; encrypted BYOK; never in logs |
| Session | httpOnly secure cookies; CSRF strategy per Better Auth + Start |
| Authz | Fail closed; tests for cross-tenant |
| SSRF | Base URL policy |
| Rate limit | Per user + per org on `/api/chat` |
| Headers | CSP baseline, HSTS in prod compose/docs |
| PII | Audit log retains actor ids; export includes user content (owner only) |
| Training | Document: providers may process data per their terms; self-host Ollama stays local |
| Dependencies | pnpm audit in CI; lockfile committed |
| Migrations | Expand/contract; never edit applied |

---

## 17. Observability & ops

- Structured JSON logs: `requestId`, `orgId`, `userId`, `modelRef`, `latencyMs`, `errorCode`
- Health: `GET /api/health` → db ping + optional rustfs head
- Metrics (phase 2.1): OpenTelemetry hooks
- Backups: documented `pg_dump`; rustfs volume backup
- Compose profiles: `dev` (hot reload), `prod` (built image)

---

## 18. TDD methodology (mandatory)

### 18.1 Law

For **domain, gateway, repositories, authz, message-tree, model-ref, encryption, SSRF**:

1. **Red** — write a failing test that specifies behavior  
2. **Green** — write the minimal code to pass  
3. **Refactor** — clean structure; tests stay green  

UI chrome may use **characterization / component tests** after a thin vertical, but logic under the UI remains TDD.

### 18.2 Test pyramid

```
     E2E (Playwright)     few — critical journeys
   Integration (Vitest)   repos + serverFns + testcontainers Postgres
  Unit (Vitest)           domain + gateway + pure UI helpers — many
```

### 18.3 TDD workflow per work package

1. Write acceptance tests list in the WP (below)
2. Implement unit tests first for pure modules
3. Implement integration tests with real Postgres (testcontainers or compose service `postgres-test`)
4. Implement feature
5. Add Playwright only for user-visible critical path
6. PR cannot merge if coverage on touched core packages drops below threshold

### 18.4 Fakes & fixtures

| Fake | Use |
| --- | --- |
| `FakeChatAdapter` | Scripted stream chunks + abort |
| `memoryDb` | Optional for pure repo interface experiments; prefer real PG for repos |
| `createTestOrg()` | Fixture: org + owner + member + connection |
| `signInAs(role)` | E2E auth helper |

### 18.5 What “robust” means in tests

- Happy path
- Authn missing
- Authz cross-org
- Invalid model ref
- Provider mid-stream abort
- Provider 429/5xx mapped to safe error
- Empty message rejected
- Branch regenerate produces sibling, not overwrite
- Invite expired / already accepted
- Rate limit exceeded
- Attachment oversize
- SSRF blocked URL

---

## 19. Test matrix

### 19.1 Unit (`packages/domain`, `provider-gateway`)

| Area | Cases |
| --- | --- |
| model-ref | parse valid/invalid; roundtrip |
| message-tree | path to root; regenerate sibling; edit fork; active branch list |
| title | empty, long, multiline, emoji |
| rbac | role matrix for admin actions |
| encrypt/decrypt | roundtrip; tamper fails |
| ssrf | blocks metadata IP; allows public https; private only if flag |
| gateway resolve | platform key; byok; missing; disabled model; allowlist deny |

### 19.2 Integration (`packages/db`, server)

| Area | Cases |
| --- | --- |
| conversations repo | CRUD; list pagination; archive |
| messages repo | insert tree; fetch branch |
| chat API | create conversation on first message; persist complete stream |
| authz | member cannot admin; cannot read other org chat |
| usage | event written on complete |
| audit | written on provider create / role change |

### 19.3 E2E (Playwright)

| ID | Journey |
| --- | --- |
| E1 | Bootstrap owner login → new chat → stream (fake provider) → reload history |
| E2 | Edit message → branch switch |
| E3 | Admin invites member → member accepts → member chats |
| E4 | Member denied on `/admin` |
| E5 | Admin adds openai_compatible connection → model appears → chat uses it |
| E6 | Upload image attachment (mock storage) → send |
| E7 | Stop generation mid-stream |
| E8 | Export conversation markdown |

---

## 20. Work packages (granular tasks)

Each WP has: **goal**, **TDD tests first**, **implementation tasks**, **acceptance**.  
Estimate is relative (S/M/L), not calendar commitments.

---

### WP0 — Monorepo scaffold (M)

**Goal:** Empty repo becomes runnable skeleton with tooling.

**Tests first**
- [ ] `config` env schema: fails without `DATABASE_URL` in production mode
- [ ] workspace package exports resolve in vitest

**Tasks**
- [ ] pnpm workspace + `apps/web` TanStack Start app
- [ ] packages: `config`, `domain`, `db`, `auth`, `provider-gateway`, `storage`
- [ ] ESLint: strict TS + import boundaries between packages
- [ ] Prettier / oxfmt
- [ ] Vitest workspace
- [ ] Playwright scaffold
- [ ] `docker-compose.yml`: postgres, rustfs, **valkey**, web (dev)
- [ ] README: quickstart
- [ ] CI: lint, typecheck, unit tests
- [ ] `.env.example`

**Acceptance**
- `pnpm install && pnpm test && pnpm typecheck` green
- `docker compose up postgres rustfs` healthy

---

### WP1 — Global design system + AppShell modules (M→L with dual theme)

**Goal:** ChatGPT-faithful chrome with no backend; **global CSS**; **reusable ui modules first**; Lucide.

**Tests first**
- [ ] dark + light CSS variables present on `:root` / `[data-theme]` (smoke)
- [ ] theme toggle flips `data-theme` on root
- [ ] ui Button / IconButton render with Lucide icon
- [ ] no feature imports raw hex (lint optional later)

**Tasks**
- [ ] Global `styles/tokens.css` + `styles/app.css` only (import once in root)
- [ ] Tailwind theme maps to CSS variables
- [ ] `components/ui/*`: Button, IconButton, Input, Textarea, Icon (Lucide wrapper), Dialog, DropdownMenu, ScrollArea, Tooltip, Separator
- [ ] ThemeProvider + toggle control
- [ ] Layout modules: AppShell, SidebarFrame, MainFrame (compose ui only)
- [ ] Feature shell with **fake data**: EmptyState, ConversationList chrome, Composer chrome — all from modules
- [ ] Maximus wordmark component
- [ ] Responsive drawer module
- [ ] `docs/ui-parity-checklist.md` for both themes
- [ ] ESLint/doc rule: routes stay thin; no page-local CSS

**Acceptance**
- Visual review dark + light against checklist
- Zero page-local CSS files
- All icons Lucide via `Icon` wrapper
- Routes contain composition only

---

### WP2 — Database schema + migrations (M)

**Goal:** Full v1 schema migrates cleanly.

**Tests first**
- [ ] migration applies on empty DB
- [ ] migration idempotent on second run (kit)
- [ ] FK: message parent same conversation enforced (trigger or app-level test)

**Tasks**
- [ ] Drizzle schemas split by file (`conversations.ts`, `messages.ts`, …)
- [ ] Indexes as specified §8
- [ ] Seed script: platform model catalog
- [ ] `packages/db` client singleton pattern for server

**Acceptance**
- Fresh compose DB migrates
- Schema matches §8

---

### WP3 — Better Auth + invite-only org (L)

**Goal:** Secure multi-user foundation.

**Tests first**
- [ ] unauthenticated serverFn redirects/401
- [ ] public sign-up disabled
- [ ] bootstrap creates owner+org
- [ ] invite → accept → membership
- [ ] `requireOrgRole` matrix
- [ ] cross-org denied

**Tasks**
- [ ] Better Auth + TanStack Start integration
- [ ] Organization plugin; disable free org create
- [ ] Invite email adapter (SMTP + dev logger)
- [ ] Login / accept-invite pages (styled)
- [ ] Session in root `beforeLoad`
- [ ] Active organization context
- [ ] Audit events on invite/join/role change

**Acceptance**
- E2E E3 green with test mail catcher or link scrape
- No open registration

---

### WP4 — Domain: message tree + model ref (S) — pure TDD

**Goal:** Core algorithms bulletproof before UI.

**Tests first (exhaustive)**
- [ ] All §8.5 invariants
- [ ] model-ref parse/serialize edge cases
- [ ] title heuristic cases

**Tasks**
- [ ] Implement pure modules only
- [ ] Export from `packages/domain`

**Acceptance**
- ≥ 90% coverage on these modules
- No I/O imports

---

### WP5 — Provider gateway (L) — TDD

**Goal:** Multi-provider resolve + safety.

**Tests first**
- [ ] platform openai resolve
- [ ] anthropic resolve
- [ ] ollama resolve with base URL
- [ ] openai_compatible custom base
- [ ] missing credentials → typed error
- [ ] disabled model → error
- [ ] allowlist deny
- [ ] SSRF block list
- [ ] private URL allow flag
- [ ] encrypt/decrypt credentials
- [ ] Fake adapter abort mid-stream

**Tasks**
- [ ] `resolveAdapter(input)`
- [ ] `encryptSecret` / `decryptSecret`
- [ ] `assertSafeBaseUrl`
- [ ] Error normalization map
- [ ] Catalog helpers

**Acceptance**
- All gateway unit tests green
- No network in unit tests

---

### WP6 — Chat API + persistence (L) — TDD + integration

**Goal:** End-to-end stream with durable history (server-authoritative).

**Tests first**
- [ ] first message creates conversation + 2 messages
- [ ] second turn appends on active branch
- [ ] finalize writes complete status + usage
- [ ] abort → aborted status + partial optional
- [ ] error → error status safe message
- [ ] cannot chat with other org’s conversationId
- [ ] rate limit (unit with fake clock)

**Tasks**
- [ ] `POST /api/chat` SSE
- [ ] Server rebuilds history from DB
- [ ] Integrate gateway + domain tree ops
- [ ] System prompt assembly
- [ ] Usage event writer
- [ ] Wire `useChat` in UI with real endpoint
- [ ] Fake provider mode for E2E (`PROVIDER_MODE=fake`)

**Acceptance**
- E1, E7 green
- Reload restores messages

---

### WP7 — Sidebar history & conversation CRUD (M)

**Goal:** ChatGPT history UX.

**Tests first**
- [ ] list pagination
- [ ] rename
- [ ] archive filters out of default list
- [ ] delete cascade
- [ ] search by title
- [ ] date grouping pure function tests

**Tasks**
- [ ] serverFns + Query hooks
- [ ] ConversationList virtualized
- [ ] Row menus
- [ ] New chat navigation
- [ ] Auto-title update in sidebar

**Acceptance**
- Manual UX matches parity checklist sidebar items

---

### WP8 — Branching: edit + regenerate (M) — TDD

**Goal:** ChatGPT-class forks.

**Tests first**
- [ ] regenerate creates sibling assistant
- [ ] edit user creates new user node + new assistant path
- [ ] active_leaf updates
- [ ] branch switcher lists siblings

**Tasks**
- [ ] Domain ops already in WP4 — wire API + UI
- [ ] MessageActions
- [ ] BranchSwitcher control

**Acceptance**
- E2 green

---

### WP9 — Markdown, code blocks, thumbs, titles polish (M)

**Goal:** Assistant output quality + feedback + titles.

**Tests first**
- [ ] markdown renders code fence
- [ ] copy button writes clipboard (component test)
- [ ] feedback upsert up/down
- [ ] heuristic title
- [ ] LLM retitle does not overwrite `title_source=user`
- [ ] retitle skip when no model

**Tasks**
- [ ] Streaming-safe markdown renderer
- [ ] Shiki or lightweight highlighter
- [ ] Message hover actions + thumbs UI
- [ ] `message_feedback` repo
- [ ] Heuristic + async LLM retitle worker/path
- [ ] Error/empty/loading states
- [ ] Stop button UX

**Acceptance**
- Streamed code block usable; copy works; thumbs persist; titles upgrade without clobber

---

### WP10 — Model picker & capabilities (S)

**Goal:** Select allowed models per org.

**Tests first**
- [ ] listModelsForUser filters disabled + allowlist
- [ ] capability badges derived from capabilities jsonb

**Tasks**
- [ ] ModelSelect component
- [ ] Persist conversation.model_ref
- [ ] Forward modelRef on send

**Acceptance**
- Switching model affects next turn only (documented)

---

### WP11 — Projects + custom instructions (M)

**Goal:** Personalization layer.

**Tests first**
- [ ] project instructions included in system prompts
- [ ] custom instructions included
- [ ] order of assembly stable (unit)

**Tasks**
- [ ] Projects CRUD UI
- [ ] Move conversation to project
- [ ] Settings → Personalization form
- [ ] Prompt assembly integration

**Acceptance**
- New chat in project uses instructions (assert via fake adapter captured system prompts)

---

### WP12 — Attachments + RustFS (L)

**Goal:** File/image inputs.

**Tests first**
- [ ] reject oversize
- [ ] reject bad mime
- [ ] presign only for member of org
- [ ] message content parts with attachmentId
- [ ] storage key format

**Tasks**
- [ ] `packages/storage` S3 client for RustFS
- [ ] compose init bucket
- [ ] upload API + composer attach UI
- [ ] vision path for image models
- [ ] text file inline extract

**Acceptance**
- E6 green; object visible in RustFS

---

### WP13 — Admin: providers & models (L)

**Goal:** BYOK enterprise config.

**Tests first**
- [ ] create connection encrypts secret (DB not plaintext)
- [ ] testConnection success/fail
- [ ] member cannot create connection
- [ ] enable/disable model
- [ ] allowlist enforcement on chat

**Tasks**
- [ ] Admin nav + layout
- [ ] Providers UI
- [ ] Models UI + allowlists
- [ ] Audit events
- [ ] TanStack Table lists

**Acceptance**
- E4, E5 green

---

### WP14 — Admin: members & invites UI (M)

**Goal:** Team management.

**Tests first**
- [ ] role change owner-only for demoting owner
- [ ] cannot remove last owner
- [ ] invite revoke

**Tasks**
- [ ] Members table
- [ ] Invite modal
- [ ] Pending invites

**Acceptance**
- Admin can full lifecycle a member

---

### WP15 — Usage + audit dashboards (M)

**Goal:** Visibility.

**Tests first**
- [ ] usage aggregation query correctness
- [ ] CSV export format
- [ ] audit filter by action

**Tasks**
- [ ] Usage page + charts (simple)
- [ ] Audit page
- [ ] Indexes verified with explain in docs if needed

**Acceptance**
- After N chats, usage rows match; CSV downloads

---

### WP16 — Governance: Valkey rate limits, budgets, export, cost (M)

**Goal:** Guardrails + usage economics.

**Tests first**
- [ ] rate limit trip via Valkey keys
- [ ] concurrent increments don’t under-count
- [ ] Valkey down + fail-closed rejects chat
- [ ] budget exceeded blocks chat
- [ ] cost_micros computed from seed prices
- [ ] cost_micros null when no price (Ollama)
- [ ] export md/json structure
- [ ] export authz: conversation owner only (not admin reading others)

**Tasks**
- [ ] Valkey client module in `packages/config` or `packages/rate-limit`
- [ ] Sliding/fixed window limiter — defaults 60/user/min, 600/org/min
- [ ] Org budget fields + enforcement
- [ ] Seed `model_prices`; compute `cost_micros` on usage write
- [ ] Export endpoints + UI (own chats)
- [ ] Data controls settings

**Acceptance**
- E8 green; limits multi-instance-safe via Valkey; $ shows when priced

---

### WP17 — Hardening, a11y, docs, release (L)

**Goal:** Ship quality.

**Tests first**
- [ ] full E2E suite green in CI
- [ ] security checklist manual + automated where possible

**Tasks**
- [ ] CSP headers
- [ ] healthcheck
- [ ] production Dockerfile
- [ ] compose prod example
- [ ] README ops runbook
- [ ] ADR set finalized
- [ ] Performance pass on virtual lists
- [ ] UI parity final review
- [ ] Load test smoke (optional k6 script)

**Acceptance**
- Definition of Done §21 complete

---

## 21. Definition of done (first ship)

- [ ] All WP0–WP17 acceptance criteria met
- [ ] Phase 0–2 features from product checklist live
- [ ] Invite-only org with 3 roles works
- [ ] OpenAI + Anthropic + Ollama + openai_compatible verified (manual or integration with recorded fixtures)
- [ ] RustFS attachments work in compose
- [ ] No plaintext API keys in DB
- [ ] Cross-tenant isolation tests green
- [ ] UI parity checklist signed off
- [ ] CI green on main
- [ ] Runbook: deploy, backup, bootstrap, rotate encryption key (document limitations)
- [ ] Known issues list for 2.1 (OIDC, etc.)

---

## 22. Phase 3+ product backlog

Product depth beyond first-ship chat OS (can interleave with Phase 4 polish).

| Item | Priority | Notes |
| --- | --- | --- |
| OIDC SSO | P0 enterprise | Google/Okta/Entra; complete `sso_configs`; SCIM later |
| Dynamic model catalog UI | P0 | Load ModelSelect from org-enabled models + allowlist (not hardcoded) |
| Login / invite / settings pages | P0 | Elite ChatGPT-class auth + settings UX (not API-only) |
| Full admin SPA | P0 | Members, providers, models, usage charts, audit tables (TanStack Table) |
| Projects + custom instructions UI | P1 | Already in schema/prompt assembly |
| LLM retitle job | P1 | Non-blocking; respect `title_source=user` |
| Vision: real multimodal to providers | P1 | Fetch attachment bytes; map to OpenAI/Anthropic image parts |
| PDF/text extraction pipeline | P1 | OCR optional; virus scan hook |
| RAG / knowledge bases | P2 | PGVector in same Postgres; cite sources in markdown |
| Assistants / GPTs presets | P2 | System prompt + tools + model + knowledge |
| Canvas / artifacts side panel | P2 | |
| Shared conversation links | P2 | Org-scoped, expiring, audit |
| Web search tool | P2 | Pluggable provider |
| OpenAI-compatible proxy API | P2 | Org API keys; rate limits; audit |
| Voice STT/TTS | P3 | |
| Image generation | P3 | |
| Memory (cross-chat facts) | P3 | |
| SCIM / SAML | P3 | Large IdP estates |
| Horizontal multi-region | P3 | Stateless web + Valkey + S3 |

---

## 23. Shipped vs next (honest inventory)

### 23.1 Shipped (first-ship core)

- Monorepo, AGENTS.md, global CSS + Lucide, ChatGPT-class shell (dark/light)
- Postgres schema + migrate, repos, server-authoritative `runChatTurn`
- Invite-only auth (session tables), roles, D12 privacy
- Multi-provider resolve + fake/live HTTP streaming (OpenAI-compat, Anthropic, Ollama)
- BYOK AES-GCM, SSRF guards, Valkey rate limits, usage + cost_micros
- Uploads API + paperclip UI → attachmentIds; export MD/JSON; feedback
- Admin **APIs**: providers, models/allowlist, members, usage, audit
- Integration tests (authz, allowlist, BYOK, branch, attach-only, export)

### 23.2 Immediate next (product completeness)

1. Dynamic model picker (API-driven)  
2. Login / bootstrap / accept-invite **pages**  
3. Admin **UI** (not just APIs)  
4. Settings: personalization, data export/delete, theme in settings nav  
5. Projects UI + move chat to project  
6. Message virtualization + sidebar virtualization at scale  
7. Playwright E1–E8 against compose stack  
8. Production Docker + TLS reverse proxy (Caddy/Traefik/nginx)

### 23.3 Enterprise polish themes (Phase 4)

Security · Encryption · TLS/Docker · DRY · Elite UI · Observability · Compliance · DR

---

## 24. Phase 4 — Enterprise polish program

**Goal:** Make Maximus deployable and defensible for a security-conscious enterprise (50–5k seats), without changing the ChatGPT muscle-memory UX.

### 24.1 Principles

| Principle | Rule |
| --- | --- |
| **Secure by default** | Fail closed (rate limit, authz, TLS, cookies); opt-in looseness only via org settings |
| **Encrypt everything sensitive** | BYOK keys, SSO secrets, optional field-level for PII exports; TLS in transit |
| **DRY contracts** | One pure validator per concern (`assertChatTurnInput` pattern); no dual UI/server rules |
| **Elite UI** | ChatGPT density + motion + a11y AA; design system only; no one-off pages |
| **Operable** | Health, metrics, logs, backups, runbooks, zero-downtime migrate path |
| **Auditable** | Every admin mutation + auth anomaly → `audit_events` |
| **Testable** | Security properties have tests (authz matrix, SSRF, crypto, rate limit, TLS config smoke) |

### 24.2 Outcomes (definition of “enterprise ready”)

- [ ] Deploy with `docker compose -f docker-compose.prod.yml` + TLS certificates  
- [ ] A+ security headers (CSP, HSTS, Referrer-Policy, Permissions-Policy)  
- [ ] Session cookies Secure + HttpOnly + SameSite; CSRF on non-GET mutations  
- [ ] Encryption key management documented (generate, backup, rotate, re-enter BYOK)  
- [ ] Admin UI + member UX complete for daily ops without curl  
- [ ] Model catalog fully dynamic; no hardcoded model list in production builds  
- [ ] OpenTelemetry traces on chat path; structured JSON logs; no secret leakage  
- [ ] Playwright E1–E8 green in CI against compose  
- [ ] Load smoke: 50 concurrent fake streams without OOM  
- [ ] Threat model ADR signed; dependency audit clean (or accepted exceptions)

---

## 25. WP18+ work packages

### WP18 — Auth UX + session hardening (L)

**Goal:** Elite login/invite/settings; cookie/CSRF hardened.

- [ ] Pages: `/login`, `/invite/$id`, `/settings/*` (General, Personalization, Data, Account)  
- [ ] Bootstrap first-run wizard when no users exist  
- [ ] Session: Secure cookies in prod; rotate session on login; logout all sessions  
- [ ] CSRF middleware (TanStack Start) for POST/PATCH/DELETE  
- [ ] Password policy (length, breach check optional); lockout after N failures (Valkey)  
- [ ] Tests: invite flow E2E; CSRF rejects missing token; lockout trips  

**Acceptance:** Member can join via invite UI only; no open signup; cookies secure in prod compose.

### WP19 — Dynamic models + elite chat polish (L)

**Goal:** ModelSelect from server; ChatGPT-grade thread UX.

- [ ] `GET /api/models` — enabled + allowlisted for role  
- [ ] ModelSelect loads live; capability badges (vision/tools)  
- [ ] Persist `conversation.model_ref`; mid-chat switch = next turn only  
- [ ] Virtualized message list + conversation list (TanStack Virtual)  
- [ ] Streaming markdown stable (no full remount)  
- [ ] Branch switcher UI when siblings > 1  
- [ ] Empty state chips + keyboard shortcuts from Appendix D  
- [ ] Attachment chips: preview images; remove before send; size/mime errors toast  

**Acceptance:** No hardcoded models in prod; 500-chat sidebar smooth; regen/edit/branch all polished.

### WP20 — Admin SPA (L)

**Goal:** Enterprise admin without leaving the product.

- [ ] `/admin` shell (owner/admin only; 403 UI for members)  
- [ ] Overview cards: users, messages 7d, tokens, estimated $  
- [ ] Members table (TanStack Table): invite, role change, remove, pending invites  
- [ ] Providers: add/edit/disable, test connection, never show plaintext secrets  
- [ ] Models: enable/disable, allowlist by role, sort  
- [ ] Usage: filters, CSV export, cost when priced  
- [ ] Audit: filter by action/actor/date  
- [ ] Org settings: name, budgets, retention, rateLimitFailOpen, default model  
- [ ] SSO stub page “Coming 2.1”  

**Acceptance:** All admin APIs have UI; member cannot see admin nav.

### WP21 — Security hardening pack (L)

**Goal:** Defense-in-depth for enterprise review.

- [ ] Security headers middleware (CSP, HSTS, X-Content-Type-Options, frame-ancestors none)  
- [ ] Request body size limits; upload MIME allowlist (already partial) + magic-byte check  
- [ ] Path traversal / zip-bomb guards on extract  
- [ ] SSRF: extend to redirect following blocks; optional DNS rebinding guard  
- [ ] Secret redaction in logs (Authorization, cookies, ciphertext never logged)  
- [ ] Dependency: `pnpm audit` CI gate; Renovate/Dependabot  
- [ ] Rate limit: login, invite, upload, chat (separate buckets)  
- [ ] Content Security: no inline scripts; nonces if needed  
- [ ] Penetration checklist doc + automated smoke for authz matrix  
- [ ] Optional: WAF notes (Cloudflare) for SaaS deploy  

**Acceptance:** Header smoke test; authz matrix CI job; audit log on security-sensitive events.

### WP22 — Encryption & secrets management (M)

**Goal:** Enterprise-grade key handling.

- [ ] Document envelope encryption: `ENCRYPTION_KEY` = KEK; version in `credentials_meta`  
- [ ] Key rotation runbook: dual-read old/new; re-encrypt job; re-enter BYOK if lost  
- [ ] Optional: external KMS (AWS KMS / GCP KMS / Vault) adapter interface  
- [ ] Encrypt SSO client secrets (same primitive)  
- [ ] At-rest: Postgres volume encryption note (LUKS/cloud disk); S3 SSE if cloud  
- [ ] Generate keys: `pnpm secrets:generate` CLI  
- [ ] Tests: rotate path; wrong version fails closed  

**Acceptance:** No plaintext secrets in DB/logs; rotation documented and tested.

### WP23 — Docker, TLS, production compose (L)

**Goal:** One-command secure self-host.

```
services:
  caddy|traefik   # TLS termination, HTTP→HTTPS, HSTS
  web             # Start production image (non-root)
  postgres        # healthcheck, volume, no public port in prod
  valkey          # no public port; password/ACL
  rustfs          # internal only; bucket bootstrap job
  migrate         # one-shot job before web
```

- [ ] Multi-stage `Dockerfile` (build + distroless/node-slim runtime, non-root user)  
- [ ] `docker-compose.prod.yml`: internal network; only 443 published  
- [ ] TLS: Caddy automatic HTTPS or Traefik + Let’s Encrypt; local mkcert profile for dev  
- [ ] Env: secrets via files/Docker secrets; never bake keys into image  
- [ ] Health: `/api/health` (db + valkey + optional storage) for orchestrators  
- [ ] Resource limits, restart policies, log driver  
- [ ] Backup scripts: `pg_dump` + rustfs volume; restore drill doc  
- [ ] Optional: Kubernetes/Helm chart (later)  

**Acceptance:** Fresh machine: clone → compose up → HTTPS login → chat works.

### WP24 — DRY architecture sweep (M)

**Goal:** Eliminate dual contracts and copy-paste.

- [ ] Inventory pure contracts: chat input ✅, export ✅, model-ref, authz, pricing  
- [ ] Extract shared `requireApiAuth` + error mapper for all `/api/*` routes  
- [ ] Shared pagination cursor helper  
- [ ] Shared SSE writer utility  
- [ ] ESLint: ban direct `fetch` to provider hosts outside gateway  
- [ ] ESLint: ban page-local CSS; ban non-Lucide icons  
- [ ] Boundary tests: domain cannot import db  
- [ ] Route handlers thin: max ~80 LOC; logic in packages  

**Acceptance:** No duplicated validation between UI and server for chat/export/authz.

### WP25 — Elite UI system (L)

**Goal:** Pixel-and-feel enterprise ChatGPT clone.

- [ ] Design tokens audit: spacing scale, radii, elevation, focus rings  
- [ ] Motion: sidebar collapse, message appear, reduced-motion respect  
- [ ] Toasts, command palette (⌘K search), confirm dialogs  
- [ ] Skeleton loaders for history/thread  
- [ ] Empty/error/offline states  
- [ ] Mobile drawer polish; safe-area insets  
- [ ] A11y: axe CI, keyboard map from Appendix D, live region for streaming  
- [ ] Visual regression (Playwright screenshots) dark + light  
- [ ] Wordmark, favicon, PWA manifest optional  

**Acceptance:** UI parity checklist 100%; axe critical = 0.

### WP26 — Observability & SRE (M)

- [ ] Structured JSON logs (pino/consola) with requestId  
- [ ] OpenTelemetry traces on `/api/chat` + DB  
- [ ] Metrics: chat_requests, tokens, errors, rate_limit_trips  
- [ ] `/api/health` deep vs shallow  
- [ ] Error tracking hook (Sentry-compatible, optional)  
- [ ] Admin “system status” page  

### WP27 — Compliance & data governance (M)

- [ ] Retention jobs: purge archived chats after N days (org setting)  
- [ ] GDPR-style user export + hard delete (own data)  
- [ ] Org data export (owner only)  
- [ ] DPA-ready docs: subprocessors (LLM providers), data flows diagram  
- [ ] Break-glass admin read (optional, audited, time-boxed) — product decision  
- [ ] Legal: no-training disclaimer for BYOK/self-host  

### WP28 — E2E & quality automation (M)

- [ ] Playwright: E1–E8 from plan §19.3  
- [ ] CI job: compose up → migrate → e2e → tear down  
- [ ] Contract tests for OpenAI-compat stream parser  
- [ ] Chaos: Valkey down + fail-closed / fail-open org  
- [ ] Load: k6 fake chat 50 VUs  

### WP29 — OIDC SSO (2.1) (L)

- [ ] Enable OIDC for org; map claims → users/memberships  
- [ ] JIT provisioning; disable password for SSO users (policy)  
- [ ] Admin SSO config UI (secrets encrypted)  
- [ ] Tests with mock IdP  

### Suggested order after first ship

```
WP18 Auth UX/session → WP19 Models + chat polish → WP20 Admin SPA
  → WP21 Security headers/CSRF → WP22 Encryption ops → WP23 Docker/TLS
  → WP24 DRY → WP25 Elite UI → WP26 OTel → WP27 Governance
  → WP28 E2E CI → WP29 OIDC
```

Parallelize WP21/22/23 once WP18–20 unblocked product.

---

## 26. Security & encryption deep dive

### 26.1 Trust boundaries (refresh)

1. Browser ↔ TLS terminator ↔ web  
2. Web ↔ Postgres (private network)  
3. Web ↔ Valkey (private, password)  
4. Web ↔ RustFS (private)  
5. Web ↔ external LLM APIs (egress allowlist optional)  
6. Admin actions ↔ audit log  

### 26.2 Controls matrix

| Control | Status first-ship | Phase 4 target |
| --- | --- | --- |
| Authn invite-only | Done | + SSO, lockout, MFA optional |
| Authz org+role+owner | Done | SCIM groups |
| BYOK AES-GCM | Done | KMS envelope, rotation job |
| SSRF base URL | Done | Redirect/DNS hardening |
| Rate limit Valkey | Done | Per-route buckets + login |
| Server-authoritative history | Done | Keep |
| TLS | Dev HTTP | Prod HTTPS mandatory |
| CSP/HSTS | Partial | Full middleware |
| CSRF | Open | Required non-GET |
| Secret logging | Careful | Redaction middleware + tests |
| Dependency audit | Manual | CI gate |

### 26.3 Encryption standards

- **Algorithm:** AES-256-GCM only for app-level secrets  
- **KEK:** 32-byte key from env/secret manager; never in git  
- **Versioning:** `credentials_meta.v` for multi-key read  
- **Transit:** TLS 1.2+ only; disable weak ciphers at proxy  
- **At rest:** cloud disk encryption + optional S3 SSE  
- **Backups:** encrypt dumps; restrict access  

### 26.4 Authn best practices

- Argon2id or scrypt (current) with strong params  
- Session tokens: high entropy, server-side revoke  
- Cookie: `Secure; HttpOnly; SameSite=Lax` (Strict if feasible)  
- MFA TOTP optional for owners (later)  
- Device/session list in Account settings  

---

## 27. Docker, TLS & production deploy

### 27.1 Environments

| Env | Compose | TLS | Notes |
| --- | --- | --- | --- |
| dev | `docker/docker-compose.yml` | optional mkcert | hot reload web on host |
| prod | `docker-compose.prod.yml` | Caddy/Traefik | published 443 only |
| ci | compose + health waits | internal | e2e |

### 27.2 Production checklist

- [ ] Non-root containers  
- [ ] Read-only root FS where possible  
- [ ] No Postgres/Valkey/RustFS ports on host  
- [ ] Secrets via env files with 600 perms or Docker secrets  
- [ ] Migrate job before web starts (`depends_on` + completion)  
- [ ] Healthchecks on all services  
- [ ] Log rotation  
- [ ] Automatic HTTPS + redirect  
- [ ] Backup cron documented  
- [ ] Image pin digests (not only `:latest`)  

### 27.3 Reverse proxy requirements for SSE

- Disable response buffering for `/api/chat`  
- Long `proxy_read_timeout` / Caddy flush intervals  
- Document nginx `proxy_buffering off`  

### 27.4 Network diagram

```
Internet
   │ HTTPS :443
   ▼
 TLS proxy (Caddy)
   │
   ▼
 web :3000 (internal)
   ├── postgres :5432
   ├── valkey :6379
   └── rustfs :9000
        └── egress → OpenAI / Anthropic / Ollama (optional host network)
```

---

## 28. DRY / architecture hygiene

### 28.1 Contract pattern (mandatory going forward)

Any rule enforced by both UI and server **must** live in `@maximus/domain` (or shared package) with unit tests.

| Domain | Module | Consumers |
| --- | --- | --- |
| Chat send/edit/regen | `assertChatTurnInput` ✅ | UI, `runChatTurn` |
| Export access | `exportConversation` ✅ | `/api/export`, tests |
| Titles | `heuristicTitle` + `conversationTitleFromInput` ✅ | create conversation |
| Model refs | `parseModelRef` ✅ | gateway, UI |
| RBAC | `policies/rbac` ✅ | auth, admin |
| Pricing | `computeCostMicros` ✅ | usage write |
| Upload limits | **TODO** `assertUploadIntent` | uploads API + composer |

### 28.2 Shared server utilities (WP24)

```
packages/server-kit/   # or apps/web/src/server/
  auth.ts              # requireApiSession
  errors.ts            # toJsonError(AppError)
  sse.ts               # writeSseEvent
  pagination.ts
  request-id.ts
```

### 28.3 File size & module laws (reaffirm)

- Soft max ~250 LOC; route files thin shells  
- One concern per file  
- No business logic in React components beyond view state  
- Gateway is the only place that talks to LLM HTTP  

---

## 29. Elite UI polish bar

### 29.1 Visual

- ChatGPT-adjacent density (not marketing whitespace)  
- Perfect dark + light parity  
- Composer pill geometry; sticky bottom; model chip  
- Sidebar date groups; hover actions; collapse animation  
- Message actions on hover; branch `‹ 1/N ›`  
- Code blocks: lang label + copy + syntax highlight  

### 29.2 Interaction

- Keyboard: ⌘N new chat, ⌘K search, Enter/Shift+Enter, Esc, ⌘. stop  
- Optimistic UI where safe; always reconcile from server on reload  
- Toasts for errors (rate limit, upload fail, network)  
- Disabled states + spinners consistent  

### 29.3 Accessibility

- WCAG AA contrast  
- Focus visible; trap in dialogs  
- `aria-live` for streaming completion  
- Icons decorative `aria-hidden` via `Icon` wrapper  
- Reduced motion  

### 29.4 Performance UX

- Virtualize long threads  
- Paginate history  
- Prefetch conversation on row hover (optional)  
- Avoid layout thrash during stream  

### 29.5 Admin UI elite bar

- Dense tables, filters, empty states  
- Confirm destructive actions  
- Never display secrets; show “•••• set” + rotate  
- Usage charts (simple, readable)  

---

## 30. Enterprise quality gates & compliance track

### 30.1 CI pipeline (target)

```
lint → typecheck → unit → integration (postgres+valkey services)
  → build → e2e (playwright) → pnpm audit → image build
```

### 30.2 Security gates

- [ ] Authz matrix tests required for any new resource  
- [ ] No high/critical npm vulns without ADR exception  
- [ ] Secret scan (gitleaks) on PR  
- [ ] Container scan (trivy) on release images  

### 30.3 Release checklist

- [ ] CHANGELOG  
- [ ] Migrate forward tested on copy of prod data shape  
- [ ] Rollback note  
- [ ] Encryption key backup verified  
- [ ] Runbook updated  

### 30.4 Compliance artifacts (docs/)

- [ ] `docs/security/threat-model.md`  
- [ ] `docs/security/data-flow.md`  
- [ ] `docs/ops/backup-restore.md`  
- [ ] `docs/ops/tls-and-proxy.md`  
- [ ] `docs/compliance/subprocessors.md`  

---

## 31. Risks & mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scope of Phase 0–2 too large | Slip / quality drop | Vertical slices; WP order; fake provider for UI velocity |
| TanStack AI adapter quirks per provider | Broken streams | Fake + contract tests; normalize errors |
| ChatGPT UI churn | Parity thrash | Freeze parity checklist; brand Maximus lightly |
| Better Auth org schema coupling | Migration pain | Keep app settings in `organizations_ext` |
| RustFS maturity | Storage bugs | S3 abstraction; can swap endpoint to MinIO/R2 without app rewrite |
| SSE + reverse proxies | Stream buffering | Document `X-Accel-Buffering`, proxy timeouts |
| Secret encryption key loss | Permanent BYOK loss | Runbook: re-enter keys; key backup |
| Server-authoritative history vs useChat client state | Sync bugs | Single writer; reload from server on conversation open |
| Rate limits multi-instance | Weak if in-memory | **Valkey** shared store (D13) |
| Admin privacy vs compliance | Conflict | D12: no message bodies; break-glass later |
| Light theme QA surface | Visual regressions | Dual-theme tokens + Playwright smoke both themes |
| LLM retitle cost/latency | Extra calls | Non-blocking; cheap model; skip if no platform key |

---

## 32. Discussion topics

### 32.1 Locked in discussion

| Topic | Decision |
| --- | --- |
| History source | Server-authoritative (D10) |
| When conversation row is created | First message send (D11) |
| Admin can read member chats | No — privacy by default (D12) |
| Rate limiting | **Valkey** (Redis protocol; not Redis product) (D13) |
| Polish | Heuristic + **LLM retitle**, **thumbs**, **light + dark** (D14) |
| Cost | Tokens always + seeded price table → `cost_micros` (D15) |

### 24.2 Detail: Valkey rate limiting (D13)

Compose service: `valkey/valkey:8` (or current stable), port 6379, volume optional (limits are ephemeral — AOF optional).

**Use cases for Valkey in v1:**
1. Rate limits for `/api/chat` (primary)
2. Optional short TTL cache for model catalog (secondary)
3. **Not** session store (Better Auth stays cookie + Postgres)

**Algorithm:** sliding window or token bucket via Lua / `INCR` + `PEXPIRE`
- Keys: `rl:user:{userId}:{minute}` and `rl:org:{orgId}:{minute}`
- Defaults: **60 / user / min**, **600 / org / min** (org settings override)
- Fail policy (**D16**):
  - Global default: **fail closed** (`RATE_LIMIT_FAIL_OPEN=false`)
  - Per-org override: `organizations_ext.settings.rateLimitFailOpen === true` → allow chat when Valkey unreachable
  - Always log `rate_limit.degraded` audit/metric when failing open
  - Local dev may set env fail-open for convenience

**Client:** `ioredis` or official `node-redis` pointed at Valkey (protocol-compatible).

**TDD:** unit tests with `ioredis-mock` or miniredis-equivalent; integration test against compose Valkey.

**Why Valkey not Redis:** same protocol/API ecosystem; open governance; user preference (mirrors RustFS over MinIO).

### 24.3 Detail: Polish (D14)

| Feature | v1 behavior |
| --- | --- |
| Heuristic title | Immediate on first send (~60 chars) |
| LLM retitle | After first assistant completes; non-blocking job; uses cheap/small platform model or same model with short prompt; update sidebar via Query invalidation |
| Thumbs | `message_feedback` table; up/down on assistant messages; only owner of conversation; visible in usage/eval export later |
| Dark theme | Default; ChatGPT-adjacent tokens |
| Light theme | Full token set; toggle in Settings → General + `localStorage` / user preference row; system preference optional |

**QA impact:** Playwright visual smoke for both themes on shell + empty state + message thread.

### 24.4 Detail: Cost (D15)

```text
model_prices
  id PK
  org_id null          -- null = platform seed
  provider_kind text
  model_id_pattern text  -- exact or prefix
  input_usd_per_1m numeric
  output_usd_per_1m numeric
  currency text default 'USD'
  effective_from timestamptz
```

On usage write:
1. Read token counts from provider response (or null)
2. Lookup best matching price row (org override > platform seed)
3. `cost_micros = round((in/1e6)*inPrice + (out/1e6)*outPrice) * 1_000_000`
4. If no price or no tokens → `cost_micros` null

Admin UI v1: show $ aggregates; editing price book can be read-only seed + simple JSON/admin form (minimal). Full price-book CRUD can be thin.

### 24.5 Still open (later)

- PDF parsing library choice
- Multi-org switcher UX depth
- Message retention auto-purge vs manual only
- i18n (English only v1 assumed)
- Break-glass admin chat access design (post-v1)
- Valkey persistence/AOF policy for prod

---

## 25. Glossary

| Term | Meaning |
| --- | --- |
| Model ref | Canonical string identifying provider + model + connection |
| Active leaf | Message id at tip of branch currently displayed |
| BYOK | Bring your own key — org-stored credentials |
| Platform keys | Env-configured credentials for default catalog |
| Gateway | Server module mapping model ref → adapter + credentials |
| openai_compatible | Any OpenAI Chat Completions-compatible HTTP API |
| WP | Work package |
| Valkey | Open-source Redis-protocol data store (rate limits) |
| cost_micros | Integer micro-USD cost on a usage event |

---

## Appendix A — Suggested env surface

```bash
# App
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgres://maximus:maximus@localhost:5432/maximus
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
ENCRYPTION_KEY= # 32-byte base64
BOOTSTRAP_EMAIL=admin@localhost
BOOTSTRAP_PASSWORD=

# Platform providers (optional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_BASE_URL=http://host.docker.internal:11434
ALLOW_PRIVATE_BASE_URLS=true
PROVIDER_MODE=live # or fake for e2e

# S3 / RustFS
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=maximus-uploads
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Maximus <noreply@localhost>

# Valkey (rate limits)
VALKEY_URL=redis://localhost:6379
RATE_LIMIT_USER_PER_MIN=60
RATE_LIMIT_ORG_PER_MIN=600
RATE_LIMIT_FAIL_OPEN=false
```

---

## Appendix B — First vertical path (to demo early)

Even with large first ship, **demo path after WP6**:

1. Compose up  
2. Bootstrap admin  
3. Set `OPENAI_API_KEY` or use fake provider  
4. Chat streams; history reloads  
5. Continue WPs for parity + admin  

---

## Appendix C — File-level module map (`domain` + `provider-gateway`)

Target: every file ≤ ~200 LOC; one responsibility; tests colocated `*.test.ts`.

### C.1 `packages/domain/src/`

| File | Public API | Responsibility |
| --- | --- | --- |
| `index.ts` | re-exports | Package barrel only |
| `errors.ts` | `AppError`, `ErrorCode`, `isAppError` | Typed error codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `MODEL_UNAVAILABLE`, `VALIDATION`, `PROVIDER_ERROR`, `ABORTED` |
| `ids.ts` | `ConversationId`, brand helpers | Branded string types (optional) |
| `model-ref.ts` | `parseModelRef`, `serializeModelRef`, `isModelRef` | Canonical model ref codec |
| `model-ref.test.ts` | | |
| `content-parts.ts` | `normalizeContentParts`, `textFromParts`, `assertContentParts` | Multimodal content validation |
| `content-parts.test.ts` | | |
| `message-tree.ts` | `pathToRoot`, `listActiveBranch`, `listSiblings`, `planRegenerate`, `planEditFork` | Pure tree ops; return **plans** (new nodes), no I/O |
| `message-tree.test.ts` | | Exhaustive branch cases |
| `active-branch.ts` | `resolveActiveMessages(messages, leafId)` | Linearize branch for UI/provider |
| `active-branch.test.ts` | | |
| `title.ts` | `heuristicTitle(text)`, `shouldRetitle(source)` | Title rules; respects `user` source |
| `title.test.ts` | | |
| `system-prompt.ts` | `assembleSystemPrompts({ org, project, user, platform })` | Ordered system prompt list |
| `system-prompt.test.ts` | | Order + empty segments |
| `policies/rbac.ts` | `canAdminOrg`, `canManageMembers`, `canManageProviders`, `canChat`, `canExportConversation` | Pure role checks |
| `policies/rbac.test.ts` | | Full role matrix |
| `policies/conversation-access.ts` | `canReadConversation`, `canWriteConversation` | Owner-only content (D12: admin cannot read others) |
| `policies/conversation-access.test.ts` | | |
| `pricing.ts` | `computeCostMicros({ inputTokens, outputTokens, price })` | Integer micro-USD math |
| `pricing.test.ts` | | Rounding edge cases |
| `date-groups.ts` | `groupConversationsByDate(items, now)` | Today/Yesterday/Previous 7 days/Older |
| `date-groups.test.ts` | | Timezone-fixed tests |

### C.2 `packages/provider-gateway/src/`

| File | Public API | Responsibility |
| --- | --- | --- |
| `index.ts` | re-exports | |
| `types.ts` | `ResolveInput`, `ResolvedAdapter`, `ProviderKind` | Gateway DTOs |
| `crypto/secrets.ts` | `encryptSecret`, `decryptSecret` | AES-256-GCM |
| `crypto/secrets.test.ts` | | Roundtrip + tamper |
| `ssrf.ts` | `assertSafeBaseUrl(url, opts)` | Block metadata/link-local; private allow flag |
| `ssrf.test.ts` | | |
| `catalog.ts` | `platformModelCatalog()` | Static seed definitions |
| `resolve-connection.ts` | `resolveCredentials(input)` | BYOK vs platform env |
| `resolve-connection.test.ts` | | |
| `adapters/create-adapter.ts` | `createTextAdapter(resolved)` | Switch on kind → TanStack adapter |
| `adapters/fake-adapter.ts` | `createFakeTextAdapter(script)` | Test/E2E scripted chunks + abort |
| `adapters/fake-adapter.test.ts` | | |
| `resolve-adapter.ts` | `resolveAdapter(input)` | Orchestrates allowlist + credentials + create |
| `resolve-adapter.test.ts` | | Main integration of pure pieces |
| `allowlist.ts` | `isModelAllowed(role, model, rules)` | |
| `allowlist.test.ts` | | |
| `errors.ts` | `toProviderAppError(err)` | Map provider throws → AppError |
| `errors.test.ts` | | |
| `usage.ts` | `extractTokenUsage(result)` | Normalize usage from stream finish |
| `usage.test.ts` | | |

### C.3 Dependency rule

`provider-gateway` may import `domain` + `config`.  
It must **not** import `db`, `auth`, or `apps/web`.  
Orchestration that loads DB rows lives in `apps/web` server layer calling gateway with already-fetched DTOs.

---

## Appendix D — ChatGPT UI interaction matrix

### D.1 Global keyboard

| Shortcut | Context | Action |
| --- | --- | --- |
| `⌘/Ctrl + Shift + O` | App | New chat (empty UI state) |
| `⌘/Ctrl + K` or `⌘/Ctrl + /` | App | Focus search chats |
| `Esc` | Search / dialog / sidebar mobile | Close |
| `Enter` | Composer (no shift) | Send message |
| `Shift + Enter` | Composer | Newline |
| `↑` | Composer empty, prior user msg exists | Edit last user message (optional v1 nice-to-have; else skip) |
| `⌘/Ctrl + Shift + Backspace` | Thread | Delete chat (with confirm) — optional |
| `⌘/Ctrl + .` | Streaming | Stop generation |
| Tab | Composer toolbar | Cycle attach / model / send |

### D.2 Sidebar

| Element | Click | Hover | Keyboard |
| --- | --- | --- | --- |
| New chat | Clear thread → `/` empty | — | Focusable button |
| Search | Open search panel/modal | — | ⌘K |
| Conversation row | Navigate `/c/:id` | Show ⋯ menu | Enter opens; menu via context |
| ⋯ Rename | Inline edit title | — | |
| ⋯ Archive / Delete | Confirm then mutate | — | |
| ⋯ Move to project | Submenu projects | — | |
| Project item | Filter/list project chats | — | |
| Collapse control | Toggle rail | — | |
| User menu | Settings / Admin (if role) / Theme / Logout | — | |

**Empty sidebar:** still show New chat + user menu; “No chats yet” subtle text.

### D.3 Empty state (no conversation / new chat)

| Element | Behavior |
| --- | --- |
| Hero copy | “What can I help with?” (or Maximus equivalent — keep familiar) |
| Suggestion chips | 4 starters; click → fill composer or send immediately (**send immediately**) |
| Model selector | Visible near top or composer |
| Composer | Focused on land |

### D.4 Thread / messages

| Element | Behavior |
| --- | --- |
| User bubble | Align end/right; markdown plain; hover: edit, copy |
| Assistant | Avatar/mark; markdown; hover: copy, regenerate, thumbs up/down |
| Streaming | Caret or pulse on last assistant; Stop in composer |
| Branch switcher | If siblings > 1 under same parent: `‹ 1 / N ›` |
| Error bubble | Safe message + Retry |
| Scroll | Stick to bottom while streaming if user was at bottom; break stick on scroll-up |
| Virtualization | Windowed list; preserve scroll anchor on prepend (rare) |

### D.5 Composer

| State | Send | Attach | Model | Stop |
| --- | --- | --- | --- | --- |
| Idle empty | Disabled | Enabled | Enabled | Hidden |
| Idle with text | Enabled | Enabled | Enabled | Hidden |
| Streaming | Hidden/disabled | Disabled | Disabled | **Visible** |
| Error | Enabled | Enabled | Enabled | Hidden |
| Uploading attach | Disabled until done | Progress | — | — |

### D.6 Settings & admin nav

| Route | Member | Admin/Owner |
| --- | --- | --- |
| `/settings/general` | Theme, language(en) | same |
| `/settings/personalization` | Custom instructions | same |
| `/settings/data` | Export/delete own | same |
| `/settings/account` | Password/sessions | same |
| `/admin/*` | **403 / hide nav** | Full |

### D.7 Responsive

| Breakpoint | Sidebar | Composer |
| --- | --- | --- |
| `< md` | Drawer overlay | Full width |
| `≥ md` | Collapsible docked | Centered max-width ~48rem content |

### D.8 Theme

| Action | Behavior |
| --- | --- |
| Toggle | Instant CSS variable swap; persist user pref |
| Default | Dark |
| System | Optional third mode if time; else dark/light only |

---

## Appendix E — Threat model & authz matrix

### E.1 Assets

| Asset | Sensitivity |
| --- | --- |
| Message content | High (PII/confidential) |
| Provider API keys | Critical |
| Session cookies | High |
| Attachments in RustFS | High |
| Usage/audit metadata | Medium |
| Org membership/roles | High |

### E.2 Trust boundaries

1. Browser ↔ TLS → web app  
2. Web app ↔ Postgres  
3. Web app ↔ Valkey  
4. Web app ↔ RustFS  
5. Web app ↔ external LLM providers  
6. Web app ↔ Ollama/base URLs (SSRF risk)

### E.3 STRIDE-style top threats

| Threat | Mitigation |
| --- | --- |
| Cross-tenant conversation read | `org_id` + ownership checks; tests; D12 |
| API key exfiltration via XSS | CSP; httpOnly cookies; no keys to client |
| SSRF via openai_compatible URL | `assertSafeBaseUrl`; private only if allow flag |
| Prompt injection via uploaded files | Treat content as untrusted data; no server code exec in v1 |
| Abuse / cost DoS | Valkey rate limits + org budgets |
| Privilege escalation invite | Only admin/owner invite; role assign limits (cannot grant owner except owner) |
| Session fixation | Better Auth defaults; rotate on login |
| Insecure direct object ref | UUID ids + authz every call |
| Log leakage of secrets | Structured logs redact Authorization / decrypted keys |
| Valkey down → unlimited | D16 fail closed default |

### E.4 Role × action matrix

Legend: **Y** allowed · **N** denied · **Own** only own resources · **—** N/A

| Action | Member | Admin | Owner |
| --- | --- | --- | --- |
| Chat with allowed models | Y | Y | Y |
| Read own conversations | Y | Y | Y |
| Read others’ conversations | N | N | N |
| Export own conversation | Y | Y | Y |
| Export others’ conversations | N | N | N |
| Manage own custom instructions | Y | Y | Y |
| Create/manage own projects | Y | Y | Y |
| Invite members | N | Y | Y |
| Change roles | N | Y* | Y |
| Remove members | N | Y* | Y |
| Add/edit provider connections | N | Y | Y |
| Enable/disable models / allowlists | N | Y | Y |
| View usage aggregates | N | Y | Y |
| View audit log | N | Y | Y |
| Org settings / budgets | N | Y | Y |
| Delete organization | N | N | Y |
| Transfer ownership | N | N | Y |
| Bootstrap SSO stub view | N | Y | Y |

\*Admin cannot demote/remove the last owner or change owner role (owner-only).

### E.5 Endpoint authz checklist (every handler)

```
1. session? → else 401
2. resolve active org membership → else 403
3. load resource by id
4. resource.orgId === activeOrgId → else 404 (no leak)
5. action policy (E.4) → else 403
6. rate limit if chat/upload
7. perform mutation
8. audit if admin-grade action
```

Use **404** for cross-tenant IDs (don’t reveal existence).

---

## Appendix F — WP0 hour-sized TDD steps

Execute in order. Each step: **Red → Green → Refactor**. Do not skip tests.

### F.0 Preconditions (0.5h)

- [ ] Node 22, pnpm, Docker available
- [ ] Empty git repo initialized in `maximus/`

### F.1 Workspace skeleton (1h)

- [ ] **Test:** `pnpm -w exec node -e "require('./package.json')"` workspace valid  
- [ ] Create `pnpm-workspace.yaml` with `apps/*`, `packages/*`  
- [ ] Root `package.json` scripts: `test`, `typecheck`, `lint`  
- [ ] `.gitignore`, `.nvmrc` / `engines`

### F.2 `packages/config` (1h)

- [ ] **Test:** `parseEnv` fails when `DATABASE_URL` missing in `NODE_ENV=production`  
- [ ] **Test:** `parseEnv` succeeds with full fixture in test env  
- [ ] Implement Zod env schema (subset: `DATABASE_URL`, `NODE_ENV`, `APP_URL`)  
- [ ] Export `Env` type

### F.3 `packages/domain` stub (1h)

- [ ] **Test:** `heuristicTitle('hello world')` returns expected  
- [ ] **Test:** `parseModelRef('openai:platform:gpt-4.1')` shape (or agreed format)  
- [ ] Implement minimal `title.ts` + `model-ref.ts`  
- [ ] Vitest runs in package

### F.4 ESLint boundaries (1h)

- [ ] **Test/CI:** lint fails if `domain` imports `db` (add forbidden pattern test or eslint rule)  
- [ ] Configure eslint-plugin-boundaries or import/no-restricted-paths  
- [ ] `pnpm lint` green on skeleton

### F.5 Docker compose infra (1.5h)

- [ ] **Test:** `docker compose up -d postgres valkey rustfs` healthchecks pass (script)  
- [ ] `docker-compose.yml` services + volumes  
- [ ] `.env.example` aligned with Appendix A  
- [ ] Document ports in README

### F.6 `apps/web` Start app (2h)

- [ ] Scaffold TanStack Start app  
- [ ] **Test:** vitest or playwright hits `/` 200 (smoke)  
- [ ] Placeholder page “Maximus”  
- [ ] Wire Tailwind + empty `tokens.css`

### F.7 CI (1h)

- [ ] GitHub Actions or local `act`-friendly workflow: install, lint, typecheck, unit  
- [ ] **Test:** CI config present; scripts exit 0  

### F.8 Package stubs (1h)

- [ ] Create empty `db`, `auth`, `provider-gateway`, `storage`, `rate-limit` packages with `package.json` + `src/index.ts` exporting `{}`  
- [ ] **Test:** workspace typecheck includes all packages  

### F.9 WP0 acceptance gate

- [ ] `pnpm install`  
- [ ] `pnpm test` green  
- [ ] `pnpm typecheck` green  
- [ ] `pnpm lint` green  
- [ ] Compose infra healthy  
- [ ] README quickstart works on clean machine checklist  

**Exit WP0 → begin WP1 (tokens/shell) and WP2 (schema) in parallel if staffing allows; solo: WP1 then WP2.**

---

## Appendix G — Decisions register (quick view)

| ID | Decision |
| --- | --- |
| D1 | Multi-org schema day 1 |
| D2 | Platform keys + org BYOK |
| D3 | Near-pixel ChatGPT dark UI + Maximus brand |
| D4 | First ship = Phase 0–2 |
| D5 | Better Auth + org plugin |
| D6 | Invite-only |
| D7 | Docker Compose first |
| D8 | OIDC stub; full in 2.1 |
| D9 | RustFS for S3 |
| D10 | Server-authoritative history |
| D11 | Conversation created on first send |
| D12 | Admins cannot read others’ message bodies |
| D13 | Valkey for rate limits |
| D14 | LLM retitle + thumbs + light/dark |
| D15 | Tokens + seeded prices → cost_micros |
| D16 | Valkey outage: fail closed default; org may fail open |
| D17 | Global CSS + module composition only + Lucide icons (no handcoded pages) |

---

## Appendix H — UI module rules (D17 quick card)

```
styles/
  tokens.css      # ONLY design tokens (CSS variables)
  app.css         # @import tokens + tailwind entry — imported ONCE in root

components/ui/    # design system — no feature knowledge
components/layout/# AppShell, frames — compose ui/*
features/*/       # domain UI — compose ui/* + layout/* + hooks
routes/           # thin: params → feature component only

icons: lucide-react via components/ui/icon.tsx only
```

**PR reject criteria**
- New `.module.css` / page-scoped stylesheet
- Route file > ~40 LOC of JSX structure without extracting a feature module
- Inline SVG icon or non-Lucide icon pack
- Hardcoded `#hex` in feature components (use tokens / Tailwind semantic classes)

---

## Appendix I — `AGENTS.md` contract (enterprise quality)

**Purpose:** Root `AGENTS.md` is the standing order for every human and coding agent. Keep it **short, imperative, non-inferable**. Deep docs live in `docs/` and are linked, not pasted.

**Placement**
```
AGENTS.md                 # root — always loaded
packages/domain/AGENTS.md # optional nested: pure domain only
packages/db/AGENTS.md     # optional: migrations + repo rules
apps/web/AGENTS.md        # optional: UI laws + route thinness
```

### I.1 What belongs in root `AGENTS.md` (must ship in WP0)

| Section | Why (enterprise) |
| --- | --- |
| **One-line product + mission** | Prevents agents building the wrong product |
| **Hard non-negotiables** | Security, multi-tenancy, TDD, UI laws — fail closed |
| **Stack & package map** | Stops inventing parallel stacks |
| **Commands** | Exact install/test/lint/typecheck/dev/migrate |
| **Architecture boundaries** | Import graph; who may talk to whom |
| **TDD law** | When tests are required before code |
| **Security / secrets / authz** | Keys never client-side; every id authz-checked |
| **Data & multi-tenancy** | `org_id` everywhere; D10–D12 |
| **UI laws (D17)** | Global CSS, modules, Lucide |
| **File size & module rules** | Prevent god files |
| **Definition of done for a change** | Lint + typecheck + tests + no secrets |
| **Forbidden** | Explicit anti-patterns list |
| **Pointers** | Link to plan, ADRs, ui-parity, runbook — progressive disclosure |

### I.2 What does **not** belong in root `AGENTS.md`

- Full schema DDL (→ `docs/` or Drizzle)
- Entire ChatGPT UI matrix (→ `docs/ui-parity-checklist.md`)
- Long tutorials / marketing copy
- Secrets, real keys, customer data
- Duplicating README install essays (one command block is enough)
- Unstable API laundry lists that churn weekly

### I.3 Draft content outline (what we will write)

```markdown
# AGENTS.md — Maximus

## Mission
Enterprise ChatGPT-class workspace: multi-provider chat, Postgres, invite-only orgs.
Looks like ChatGPT; behaves like enterprise software.

## Non-negotiables
1. TDD for domain, gateway, repos, authz, crypto, SSRF, rate-limit (Red→Green→Refactor).
2. Server-authoritative chat history; never trust client prior messages.
3. Every server mutation/query: session → org membership → resource org match → role policy.
4. Secrets server-only; BYOK encrypted at rest; never log decrypted keys.
5. Cross-tenant: return 404 not 403 when id is foreign (no existence leak).
6. Admins do not read others’ message bodies (usage/audit only).
7. UI: global CSS + Tailwind tokens only; thin routes; reusable modules; lucide-react only.
8. Files soft-max ~250 LOC; split before growing gods.
9. No open registration; invite-only.
10. Do not add dependencies without justification; prefer stdlib / existing stack.

## Stack
- pnpm monorepo; Node 22+
- apps/web: TanStack Start, Router, Query, Table, Form, Virtual, AI
- packages: domain, db (Drizzle/Postgres), auth (Better Auth), provider-gateway,
  storage (S3/RustFS), rate-limit (Valkey), config (Zod env)
- Providers: OpenAI, openai_compatible, Anthropic, Ollama via TanStack AI adapters

## Commands
- pnpm install
- pnpm test | pnpm typecheck | pnpm lint
- pnpm dev
- pnpm db:migrate | pnpm db:studio
- docker compose up -d postgres valkey rustfs

## Boundaries
- domain: pure, no I/O, no other package imports
- provider-gateway: may use domain + config; no db/auth/ui
- db: schema + repos only; no React
- apps/web: composition root; thin routes; serverFns call repos/gateway/auth
- Forbidden: circular imports; features importing other features’ internals deeply

## TDD
- New pure function → test first
- New repo method → integration test with Postgres
- New authz path → positive + negative (cross-org) tests
- Chat/stream → fake adapter; no live provider in unit CI
- Never claim “done” without green relevant tests

## Security checklist (every PR touching server)
- [ ] Zod validate inputs
- [ ] Authz on every id
- [ ] No secret in client bundle / logs / error messages
- [ ] SSRF check on user-supplied URLs
- [ ] Rate limit chat/upload paths
- [ ] Audit admin mutations

## UI checklist (every PR touching UI)
- [ ] No new page-local CSS / CSS modules
- [ ] Uses components/ui + layout modules
- [ ] Icons from lucide via Icon wrapper
- [ ] Route stays thin shell
- [ ] Works in dark + light tokens
- [ ] Keyboard + focus not broken

## Multi-tenancy
- All tenant rows carry org_id
- Conversation content: owner-only (D12)
- Active org from session; never trust client orgId alone

## Definition of done (agent)
1. Implement with tests
2. pnpm test && pnpm typecheck && pnpm lint
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
- force-push main; commit .env secrets

## Where to read more
- docs/architecture.md
- docs/ui-parity-checklist.md
- docs/adr/
- plan / product decisions D1–D17 (product plan)
```

### I.4 Nested package `AGENTS.md` extras (enterprise depth)

| Path | Add when package exists |
| --- | --- |
| `packages/domain/AGENTS.md` | “No I/O. Tree ops return plans. Export only via index. Coverage ≥ 90% on tree/model-ref.” |
| `packages/db/AGENTS.md` | “Expand/contract migrations. One entity family per repo file. Never write Better Auth tables directly.” |
| `packages/provider-gateway/AGENTS.md` | “Fake adapter for tests. Encrypt before return to callers that persist. SSRF on every baseUrl.” |
| `packages/auth/AGENTS.md` | “Invite-only. Role matrix in domain policies. Session via Better Auth only.” |
| `apps/web/AGENTS.md` | “D17 UI laws. Server rebuild history. No business logic in routes.” |

### I.5 Operational quality gates agents must respect

| Gate | Rule |
| --- | --- |
| **Verification before “done”** | Run tests/typecheck; paste evidence; no aspirational “should work” |
| **Small diffs** | One WP concern per PR; no unrelated cleanup |
| **ADRs** | New cross-cutting decision → `docs/adr/NNNN-title.md` |
| **Logging** | Structured; include requestId/orgId/userId; redact secrets |
| **Errors** | `AppError` codes to clients; never raw provider payloads |
| **Feature flags** | Risky behavior behind env/org settings (e.g. rateLimitFailOpen) |
| **Accessibility** | Interactive controls keyboard reachable; icons decorative get `aria-hidden` |
| **i18n** | English strings OK v1; no hardcoded user-facing strings buried in utils (centralize later) |
| **Performance** | Virtualize long lists; paginate server lists; no N+1 repo loops |
| **Dependencies** | Pin versions; justify new deps in PR; prefer existing TanStack/Radix/Lucide |
| **Commits** | Conventional commits; no secrets; message explains why |

### I.6 Anti-patterns to ban by name in `AGENTS.md`

1. God route / god hook / god component  
2. `any` without rationalized comment  
3. Catch-all `try/catch` that swallows errors  
4. `select *` huge message trees for sidebar  
5. Dual sources of truth (client cache as authority)  
6. Copy-paste provider SDK calls outside gateway  
7. Second CSS system (modules, styled-components)  
8. Icon packs other than Lucide  
9. Skipping authz “because it’s admin UI only”  
10. Writing tests after claiming complete  

### I.7 Locked format

| Choice | Decision |
| --- | --- |
| Density | **~100–150 lines** root imperative contract |
| Scope | **Appendix I is complete** — no extra PR templates / incident runbooks / library banlists in root (those live in docs/runbook or eslint) |
| Nested | Package-level AGENTS.md as packages land (short) |

### I.8 WP0 deliverable

- [ ] Author root `AGENTS.md` from §I.3 (tighten to ~100–150 lines)  
- [ ] Stub nested AGENTS.md in packages as packages are created  
- [ ] Link from README: “Agents and humans: read AGENTS.md first”  
- [ ] CI optional: fail if `AGENTS.md` missing  

### I.9 Maintenance rule

When an agent (or human) violates a rule and it was ambiguous: **update AGENTS.md in the same PR** that fixes the violation. Living contract, not a one-time doc.

---

*Living plan. First-ship core largely implemented. Next: WP18–WP29 (enterprise polish — security, Docker/TLS, encryption, DRY, elite UI, admin SPA, E2E). See §23–§30.*


