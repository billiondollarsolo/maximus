# Maximus — Enterprise ChatGPT Clone

**Status:** Living plan — first-ship core (WP0–WP17) largely implemented; Phase 4 polish (WP18–WP40) in progress; **next product depth = Phase 5 ChatGPT + enterprise (WP41–WP55, §41–§48)**  
**Repo:** `/Users/mj/mjcode/billiondollarsolo/maximus`  
**Canonical path:** `docs/plan.md` (this file)  
**Product name:** Maximus  
**North star:** Looks, feels, and works like ChatGPT for daily chat; ships enterprise controls large companies expect; elite TypeScript engineering with small files, Postgres, and test-first delivery.

**Elite when all three are true:**  
1. A **power user** can live in Maximus all day without missing ChatGPT muscle memory.  
2. A **security team** can approve it (SSO, encryption, audit, isolation, headers, DR).  
3. An **engineering team** can extend it without dual contracts or god files (DRY + TDD + package boundaries).

**Enterprise bar:** Secure-by-default · Encrypt sensitive data · TLS everywhere in prod · DRY pure contracts · ChatGPT-class UI · Operable (health/logs/backups) · Auditable · Tested security properties

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
19. [Test matrix](#19-test-matrix)
20. [Work packages WP0–WP17](#20-work-packages-granular-tasks)
21. [Definition of done (first ship)](#21-definition-of-done-first-ship)
22. [Phase 3+ product backlog](#22-phase-3-product-backlog)
23. [Shipped vs next (honest inventory)](#23-shipped-vs-next-honest-inventory)
24. [Phase 4 — Enterprise polish program](#24-phase-4--enterprise-polish-program)
25. [WP18–WP40 work packages](#25-wp18-work-packages)
26. [Security & encryption deep dive](#26-security--encryption-deep-dive)
27. [Docker, TLS & production deploy](#27-docker-tls--production-deploy)
28. [DRY / architecture hygiene](#28-dry--architecture-hygiene)
29. [Elite UI polish bar](#29-elite-ui-polish-bar)
30. [Enterprise quality gates & compliance](#30-enterprise-quality-gates--compliance-track)
31. [Risks & mitigations](#31-risks--mitigations)
32. [Discussion topics](#32-discussion-topics)
33. [Glossary](#33-glossary)
34. [Phase 5 — Platform maturity](#34-phase-5--platform-maturity)
35. [Engineering best-practices catalog](#35-engineering-best-practices-catalog)
36. [Supply chain, SBOM & dependency hygiene](#36-supply-chain-sbom--dependency-hygiene)
37. [HA, backup, disaster recovery](#37-ha-backup-disaster-recovery)
38. [Session, MFA & identity hardening](#38-session-mfa--identity-hardening)
39. [Input validation, errors & API excellence](#39-input-validation-errors--api-excellence)
40. [Performance, capacity & cost controls](#40-performance-capacity--cost-controls)
41. [ChatGPT product parity matrix](#41-chatgpt-product-parity-matrix)
42. [Tools, agents & assistants architecture](#42-tools-agents--assistants-architecture)
43. [Knowledge / RAG design](#43-knowledge--rag-design)
44. [Sharing, collaboration & temporary chats](#44-sharing-collaboration--temporary-chats)
45. [Enterprise GRC pack](#45-enterprise-grc-pack)
46. [Org developer platform](#46-org-developer-platform)
47. [Elite UX release gates](#47-elite-ux-release-gates)
48. [WP41–WP55 work packages](#48-wp41wp55-work-packages)

Appendices: A env · B demo path · C module map · D UI matrix · E threat model · F WP0 TDD · G decisions · H UI rules · I AGENTS.md · **J security checklist** · **K prod go-live** · **L elite UI scorecard** · **M parity scorecard**

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

**Product routes (Phase 4):** `/admin` (overview), `/admin/members`, `/admin/providers`, `/admin/models`, `/admin/usage`, `/admin/audit`, plus org settings. Member role: hide nav + API 403. Owner/admin: full matrix E.4.

| Screen | Capabilities | UI |
| --- | --- | --- |
| Overview | Users, 7d messages, tokens, est. $; system health | cards |
| Members | Invite, role change, remove, pending invites | TanStack Table |
| Providers | BYOK add/edit/disable, test connection; secrets never shown | forms + table |
| Models | Enable/disable, sort, allowlist by role, default model | table |
| Usage | Filter user/model/date; CSV; budget status | table |
| Audit | Filter action/actor/date | table |
| Org settings | Name, default model, budgets, retention, rateLimitFailOpen | form |
| SSO | Stub “Coming in 2.1” until WP29 | disabled form |

**UI law:** dense enterprise tables, confirm destructive ops, empty states — not marketing dashboards. See WP20 + §29.5.

---

## 16. Security, privacy, compliance posture

| Control | v1 / Phase 4 requirement |
| --- | --- |
| Secrets | Server-only; AES-GCM BYOK; never in logs/client bundle |
| Session | HttpOnly + Secure (prod) + SameSite; rotate on login; revoke UI |
| CSRF | Same-origin guard minimum; token if needed |
| Authz | Fail closed; E.4 matrix tests; 404 cross-tenant |
| SSRF | Base URL policy; no cloud metadata; private only if allow flag |
| Rate limit | Per user + org on chat; separate login/upload buckets |
| Headers | CSP, HSTS (prod), nosniff, frame deny, Referrer-Policy, Permissions-Policy |
| Encryption | KEK versioning; rotation runbook; optional KMS |
| TLS | Mandatory in prod compose (Caddy); HTTP→HTTPS |
| PII | Audit retains actor ids; export owner-only content (D12) |
| Training | Document provider terms; Ollama stays local |
| Dependencies | pnpm audit CI; lockfile; Renovate |
| Containers | Non-root, scanned, pinned digests |
| Migrations | Expand/contract; never edit applied |
| Disclosure | security.txt + process (WP30) |

Deep dive: §26 · Docker/TLS: §27 · Checklists: Appendix J–K

---

## 17. Observability & ops

- Structured JSON logs: `requestId`, `orgId`, `userId`, `modelRef`, `latencyMs`, `errorCode` — **redact secrets**
- Health: `GET /api/health` → db + valkey (+ deep: storage); include `version`/`gitSha` when set
- Metrics (WP26): OpenTelemetry on chat path; rate_limit_trips; token counters
- Error tracking: optional Sentry-compatible DSN
- Backups: `pg_dump` + rustfs volume; encrypted archives; restore drill (§37)
- Compose: `dev` hot reload · `prod` TLS image stack
- Admin system status page (WP26)
- Alerts (self-host doc): health failing, disk, error rate — customer-owned

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

**Audit note (2026-07-29):** Core backend + shell + tests shipped. Phase 4 product UI, security headers, health, and prod compose are **in progress** on main working tree; Playwright E2E and full elite UI remain open.

### 21.1 First-ship core (closed)

- [x] Core WP0–WP17 backend + shell + integration tests (see §23.1)
- [x] Invite-only org with 3 roles (package/API)
- [x] OpenAI + Anthropic + Ollama + openai_compatible (fake + live HTTP adapters)
- [x] Attachments schema + upload API + paperclip → attachmentIds
- [x] No plaintext API keys in DB (AES-GCM BYOK tests)
- [x] Cross-tenant isolation tests green
- [x] CI quality scripts (`pnpm test/typecheck/lint`) green on main
- [x] Runbook present (`docs/runbook.md`) with key rotation notes
- [~] UI parity checklist — shell/chrome strong; full ChatGPT polish → §29 / WP25

### 21.2 Phase 4 gate (enterprise-ready product)

- [x] Login/invite/settings/admin **pages** — WP18/WP20 (member 403 UI)
- [x] Dynamic model catalog UI — `modelsForUser` + `/api/models` + ModelSelect WP19
- [x] Security headers + same-origin guard + Secure cookies + session revoke WP21
- [x] `/api/health` (postgres + valkey)
- [x] `docker/Dockerfile` + `docker-compose.prod.yml` + Caddy TLS scaffold WP23
- [ ] Playwright E1–E8 WP28
- [ ] Encryption rotation CLI + dual-key read WP22
- [ ] OTel + structured logs WP26
- [ ] Known issues list for 2.1 (OIDC) WP29
- [ ] Appendix K prod go-live signed

---

## 22. Phase 3+ product backlog

Product depth beyond first-ship chat OS. **Canonical detail:** §41–§48 and WP41–WP55. Phase 4 polish (WP18–WP40) remains the security/ops foundation.

### 22.1 Wave order (do not scramble)

| Wave | Theme | Packages |
| --- | --- | --- |
| **Now — credibility** | E2E, crypto ops, OTel, virtualization, branch UI, search/⌘K, projects UI, personalization persist | residual WP22–28, WP35, WP41–43 |
| **Next — daily driver** | Vision, retitle, assistants, tools/search, canvas, share, temp chats | WP44–49 |
| **Then — enterprise sale** | OIDC/SCIM, MFA/KMS, budgets, org API proxy, RAG ACLs, retention/eDiscovery, DLP | WP29, WP34, WP50–52, WP55 |
| **Later — wow** | Memory, voice, image gen, multi-region | WP52–54, Phase 5 scale |

### 22.2 Compact backlog table

| Item | Priority | Plan ref |
| --- | --- | --- |
| Search + ⌘K + virtualization | P0 product | WP41, §41 |
| Branch UI + message actions + stop/retry | P0 product | WP42, §41 |
| Projects + custom instructions UI | P0 product | WP43 |
| Multimodal vision + PDF extract | P1 | WP44 |
| LLM retitle + stream polish | P1 | WP45 |
| Assistants / custom GPTs | P1 | WP46, §42 |
| Tools + web search | P1 | WP47, §42 |
| Canvas / artifacts | P1 | WP48 |
| Share links + temporary chats | P1 | WP49, §44 |
| Org API keys + OpenAI-compat proxy | P1 enterprise | WP50, §46 |
| RAG knowledge bases | P2 | WP51, §43 |
| Memory (org-gated) | P2 | WP52 |
| Voice STT/TTS | P3 | WP53 |
| Image generation | P3 | WP54 |
| GRC: DLP, retention, eDiscovery, KMS | P1 enterprise | WP55, §45 |
| OIDC SSO | P0 enterprise | WP29 |
| MFA TOTP + step-up | P1 | WP34, §38 |
| SCIM / SAML | P2–P3 | Phase 5 |
| Horizontal multi-region | P3 | Phase 5 |
| Mobile native shell | P3 | Optional; web-first |

---

## 23. Shipped vs next (honest inventory)

### 23.1 Shipped (first-ship core) — verified against repo

- Monorepo, AGENTS.md, global CSS + Lucide, ChatGPT-class shell (dark/light)
- Postgres schema + migrate, repos, server-authoritative `runChatTurn` + `assertChatTurnInput`
- Invite-only auth (session tables), roles, D12 privacy
- Multi-provider resolve + fake/live HTTP streaming
- BYOK AES-GCM, SSRF guards, Valkey rate limits, usage + cost_micros
- Uploads API + paperclip UI → attachmentIds; export MD/JSON; feedback
- Admin **APIs**: providers, models/allowlist, members, usage, audit
- Integration tests (authz, allowlist, BYOK, branch, attach-only, export)

### 23.2 Shipped in Phase 4 (product completeness + security posture)

| Area | Shipped | Residual polish |
| --- | --- | --- |
| Auth UX | Login/bootstrap/invite pages; status API; session revoke on logout; bootstrap **FORBIDDEN whenever any users exist** (no passwordless re-bootstrap for known emails) | Valkey login lockout; multi-session list |
| Settings | general / personalization / data / account | persist personalization to prompt assembly |
| Admin SPA | overview, members, providers, models, usage, audit + **403 for members** | denser tables, charts, confirm dialogs |
| Models | `modelsForUser`, `GET /api/models`, dynamic ModelSelect + vision badge | full capability badges, mid-chat model persist UX |
| Security | headers on API helpers, same-origin `guardMutation`, Secure cookies, admin APIs on `jsonOk` | CSP nonces, body limits, magic-byte upload, login RL |
| Deploy | Dockerfile (non-root user), prod compose, Caddyfile, `/api/health` | migrate one-shot, pin digests, Valkey password, backup scripts |
| DRY | domain contracts + shared server helpers on auth/admin | remaining chat routes, ESLint boundary bans |
| E2E | 105 unit/integration tests green | Playwright E1–E8, visual regression |

### 23.3 Immediate next (finish then expand)

1. Finish auth/settings/admin pages → quality bar + deny paths  
2. Wire security headers on **every** API response; CSRF on mutations  
3. Prod compose smoke (TLS path or mkcert local)  
4. DRY sweep: all routes via `jsonOk`/`guardMutation`  
5. Elite UI: toasts, skeletons, branch switcher, virtualization  
6. WP22 encryption ops + WP26 observability  
7. WP28 Playwright + CI compose  
8. WP30–WP40 maturity (supply chain, DR, MFA, perf)

### 23.4 Enterprise polish themes

| Theme | Sections | WP |
| --- | --- | --- |
| Security | §16, §26, App J | WP21, WP30 |
| Encryption | §26.3, §38 | WP22 |
| Docker / TLS | §27, App K | WP23 |
| DRY | §28, §35 | WP24 |
| Elite UI | §29, App L | WP25, WP31 |
| Observability | §17, §26.6 | WP26 |
| Compliance / DR | §30, §37 | WP27, WP32 |
| Supply chain | §36 | WP33 |
| Identity | §38 | WP18, WP29, WP34 |
| Performance / cost | §40 | WP35 |

---

## 24. Phase 4 — Enterprise polish program

**Goal:** Make Maximus deployable and defensible for a security-conscious enterprise (50–5k seats), without changing the ChatGPT muscle-memory UX.

### 24.1 Principles

| Principle | Rule |
| --- | --- |
| **Secure by default** | Fail closed (rate limit, authz, TLS, cookies); opt-in looseness only via org settings |
| **Encrypt everything sensitive** | BYOK keys, SSO secrets; TLS in transit; encrypted backups |
| **Least privilege** | Role matrix E.4; no admin message read (D12); scoped cookies |
| **DRY contracts** | One pure validator per concern (`assertChatTurnInput` pattern); no dual UI/server rules |
| **Elite UI** | ChatGPT density + motion + a11y AA; design system only; no one-off pages |
| **Operable** | Health, metrics, logs, backups, runbooks, zero-downtime migrate path |
| **Auditable** | Every admin mutation + auth anomaly → `audit_events` |
| **Testable** | Security properties have tests (authz matrix, SSRF, crypto, rate limit, headers) |
| **Reproducible deploys** | Pinned images, multi-stage builds, no secrets in layers |
| **Observable** | requestId everywhere; no silent failures; SLO-oriented metrics |

### 24.2 Outcomes (definition of “enterprise ready”)

- [ ] Deploy with `docker compose -f docker/docker-compose.prod.yml` + TLS  
- [ ] A+ security headers (CSP, HSTS, Referrer-Policy, Permissions-Policy)  
- [ ] Session cookies Secure + HttpOnly + SameSite; CSRF/same-origin on non-GET  
- [ ] Encryption key management documented (generate, backup, rotate, re-enter BYOK)  
- [ ] Admin UI + member UX complete for daily ops without curl  
- [ ] Model catalog fully dynamic; no hardcoded models in prod builds  
- [ ] OpenTelemetry traces on chat path; structured JSON logs; secret redaction  
- [ ] Playwright E1–E8 green in CI against compose  
- [ ] Load smoke: 50 concurrent fake streams without OOM  
- [ ] Threat model + Appendix J checklist signed; `pnpm audit` clean or ADR exceptions  
- [ ] Backup/restore drill documented and run once  
- [ ] SBOM generated for release images  

### 24.3 Non-goals for Phase 4 (defer to Phase 5 / product backlog)

- Full multi-region active-active  
- SCIM provisioning  
- SOC2 Type II audit engagement (docs only)  
- Custom WAF product (document Cloudflare/nginx patterns only)  
- Mobile native apps  

### 24.4 Success metrics

| Metric | Target |
| --- | --- |
| Authz matrix coverage | 100% of E.4 rows tested |
| Critical a11y (axe) | 0 on shell + chat + admin |
| Mean chat first-token (fake) | < 100ms local |
| Prod cold start (compose) | < 90s healthy |
| Secret scan false-negatives | 0 known plaintext keys in git |
| Dual validation bugs | 0 (single domain contract) |

---

## 25. WP18–WP40 work packages

### WP18 — Auth UX + session hardening (L)

**Goal:** Elite login/invite/settings; cookie/CSRF hardened.

- [~] Pages: `/login`, `/invite/$id`, `/settings/*` (General, Personalization, Data, Account)  
- [~] Bootstrap first-run path when no users (`/api/auth/status` + login page)  
- [~] Session: Secure cookies in prod (`COOKIE_SECURE`); HttpOnly session  
- [ ] Rotate session id on login; logout-all-sessions  
- [~] Same-origin guard for mutations (`guardMutation`)  
- [ ] Full CSRF double-submit or origin+token if cookie SameSite insufficient for cross-site  
- [ ] Password policy (min length 10, optional complexity); lockout after N failures (Valkey)  
- [ ] Account: list/revoke sessions  
- [ ] Tests: invite flow; CSRF/origin rejects; lockout trips; member cannot hit admin  

**Acceptance:** Member joins via invite UI only; no open signup; cookies secure in prod compose.

### WP19 — Dynamic models + elite chat polish (L)

**Goal:** ModelSelect from server; ChatGPT-grade thread UX.

- [~] `GET /api/models` — enabled + allowlisted for role (`modelsForUser`)  
- [~] ModelSelect loads live  
- [ ] Capability badges (vision/tools)  
- [ ] Persist `conversation.model_ref`; mid-chat switch = next turn only  
- [ ] Virtualized message list + conversation list (TanStack Virtual)  
- [ ] Streaming markdown stable (no full remount)  
- [ ] Branch switcher UI when siblings > 1  
- [ ] Empty state chips + keyboard shortcuts (Appendix D)  
- [ ] Attachment chips: preview; remove before send; size/mime toasts  
- [ ] Stop generation UX polish; error bubble + retry  

**Acceptance:** No hardcoded models in prod; 500-chat sidebar smooth; regen/edit/branch polished.

### WP20 — Admin SPA (L)

**Goal:** Enterprise admin without leaving the product.

- [~] `/admin` shell (owner/admin only; 403 UI for members)  
- [~] Overview, members, providers, models, usage, audit route shells  
- [ ] Overview cards: users, messages 7d, tokens, estimated $  
- [ ] Members table (TanStack Table): invite, role change, remove, pending  
- [ ] Providers: add/edit/disable, test connection, never show plaintext secrets  
- [ ] Models: enable/disable, allowlist by role, sort  
- [ ] Usage: filters, CSV export, cost when priced  
- [ ] Audit: filter by action/actor/date  
- [ ] Org settings: name, budgets, retention, rateLimitFailOpen, default model  
- [ ] SSO stub page “Coming 2.1”  
- [ ] Confirm dialogs for destructive actions  

**Acceptance:** All admin APIs have UI; member cannot see admin nav; secrets never rendered.

### WP21 — Security hardening pack (L)

**Goal:** Defense-in-depth for enterprise review.

- [~] Security headers helper (CSP, HSTS, X-Content-Type-Options, frame deny)  
- [ ] Apply headers on **all** responses (HTML + API); tighten CSP (nonces if needed)  
- [ ] Request body size limits; upload MIME allowlist + magic-byte check  
- [ ] Path traversal / zip-bomb guards on extract  
- [ ] SSRF: redirect following blocks; optional DNS rebinding guard  
- [ ] Secret redaction in logs (Authorization, cookies, ciphertext)  
- [ ] Rate limit: login, invite, upload, chat (separate Valkey buckets)  
- [ ] `pnpm audit` CI gate; Renovate/Dependabot  
- [ ] Penetration checklist (Appendix J) + authz matrix CI job  
- [ ] Optional: WAF notes (Cloudflare) for SaaS deploy  
- [ ] Security.txt + contact for responsible disclosure  

**Acceptance:** Header smoke test; authz matrix CI; audit on security-sensitive events.

### WP22 — Encryption & secrets management (M)

**Goal:** Enterprise-grade key handling.

- [x] AES-256-GCM BYOK encrypt/decrypt + tests  
- [ ] Document envelope encryption: `ENCRYPTION_KEY` = KEK; version in meta  
- [ ] Dual-read old/new key; re-encrypt job; re-enter BYOK if lost  
- [ ] `pnpm secrets:generate` CLI  
- [ ] Optional KMS adapter interface (AWS KMS / GCP KMS / Vault)  
- [ ] Encrypt SSO client secrets with same primitive  
- [ ] At-rest: Postgres volume encryption note; S3 SSE when cloud  
- [ ] Tests: rotate path; wrong version fails closed  
- [ ] Never log ciphertext or KEK  

**Acceptance:** No plaintext secrets in DB/logs; rotation documented and tested.

### WP23 — Docker, TLS, production compose (L)

**Goal:** One-command secure self-host.

```
services:
  caddy            # TLS termination, HTTP→HTTPS, HSTS, SSE flush
  web              # production image (non-root target)
  postgres         # healthcheck, volume, no public port
  valkey           # no public port; password/ACL later
  rustfs           # internal only
  migrate          # one-shot before web (target)
```

- [~] Multi-stage `docker/Dockerfile`  
- [~] `docker/docker-compose.prod.yml` + `Caddyfile`  
- [ ] Non-root user in image; read-only root FS where possible  
- [ ] Migrate one-shot job + `depends_on` condition  
- [ ] Valkey requirepass / ACL in prod  
- [ ] Secrets via env files (600) or Docker secrets — never bake into image  
- [~] Health: `/api/health` (db + valkey)  
- [ ] Resource limits, restart policies, log rotation  
- [ ] Image pin digests (not only tags)  
- [ ] Backup scripts + restore drill doc  
- [ ] mkcert local TLS profile for prod-compose on laptop  
- [ ] Optional later: Helm chart  

**Acceptance:** Fresh machine: clone → compose up → HTTPS login → chat works.

### WP24 — DRY architecture sweep (M)

**Goal:** Eliminate dual contracts and copy-paste.

- [x] Chat input, export, model-ref, RBAC, pricing, modelsForUser pure contracts  
- [~] Shared `jsonOk` / `jsonError` / `guardMutation`  
- [ ] Migrate **all** `/api/*` to shared helpers + security headers  
- [ ] Shared pagination cursor helper  
- [ ] Shared SSE writer utility  
- [ ] `assertUploadIntent` domain contract  
- [ ] ESLint: ban direct provider `fetch` outside gateway  
- [ ] ESLint: ban page-local CSS; ban non-Lucide icons  
- [ ] Boundary tests: domain cannot import db  
- [ ] Route handlers thin: max ~80 LOC; logic in packages  
- [ ] Single error → HTTP status map  

**Acceptance:** No duplicated validation between UI and server for chat/export/authz/models.

### WP25 — Elite UI system (L)

**Goal:** Pixel-and-feel enterprise ChatGPT clone.

- [ ] Design tokens audit: spacing, radii, elevation, focus rings  
- [ ] Motion: sidebar collapse, message appear, `prefers-reduced-motion`  
- [ ] Toasts, command palette (⌘K), confirm dialogs  
- [ ] Skeleton loaders for history/thread  
- [ ] Empty / error / offline states  
- [ ] Mobile drawer polish; safe-area insets  
- [ ] A11y: axe CI, keyboard map Appendix D, `aria-live` streaming  
- [ ] Visual regression (Playwright screenshots) dark + light  
- [ ] Wordmark, favicon, optional PWA manifest  
- [ ] Score ≥ 95 on Appendix L elite UI scorecard  

**Acceptance:** UI parity checklist 100%; axe critical = 0; both themes.

### WP26 — Observability & SRE (M)

- [~] `/api/health` shallow (db + valkey)  
- [ ] Deep health: storage head, optional provider ping (admin-only)  
- [ ] Structured JSON logs (pino) with requestId / orgId / userId  
- [ ] OpenTelemetry traces on `/api/chat` + DB queries  
- [ ] Metrics: chat_requests, tokens, errors, rate_limit_trips, latency histograms  
- [ ] Error tracking hook (Sentry-compatible, optional env)  
- [ ] Admin “system status” page  
- [ ] No secrets in log fields (redaction middleware tests)  

### WP27 — Compliance & data governance (M)

- [ ] Retention jobs: purge archived chats after N days (org setting)  
- [ ] GDPR-style user export + hard delete (own data)  
- [ ] Org data export (owner only)  
- [ ] DPA-ready docs: subprocessors, data-flow diagram  
- [ ] Break-glass admin read (optional, audited, time-boxed) — product decision  
- [ ] Legal: no-training disclaimer for BYOK/self-host  
- [ ] Cookie/privacy notice stub for SaaS mode  

### WP28 — E2E & quality automation (M)

- [ ] Playwright: E1–E8 from §19.3  
- [ ] CI: compose up → migrate → e2e → tear down  
- [ ] Contract tests for OpenAI-compat stream parser  
- [ ] Chaos: Valkey down + fail-closed / fail-open org  
- [ ] Load: k6 fake chat 50 VUs  
- [ ] Visual smoke dark + light  

### WP29 — OIDC SSO (2.1) (L)

- [ ] Enable OIDC for org; map claims → users/memberships  
- [ ] JIT provisioning; password policy for SSO users  
- [ ] Admin SSO config UI (secrets encrypted)  
- [ ] Tests with mock IdP  

### WP30 — Application security program (M)

- [ ] Formal threat model doc (`docs/security/threat-model.md` from App E)  
- [ ] STRIDE review of upload + BYOK + admin paths  
- [ ] Authz matrix automated suite (every E.4 cell)  
- [ ] Security regression pack: SSRF cases, path traversal, XSS smoke  
- [ ] `security.txt`, vulnerability disclosure process  
- [ ] Optional annual pen-test checklist for customers  

### WP31 — Design system completion (M)

- [ ] Radix dialogs, dropdowns, tabs fully tokenized  
- [ ] Form field patterns (label, error, hint) shared  
- [ ] Data table primitive (TanStack Table + density)  
- [ ] EmptyState / ErrorState / OfflineBanner modules  
- [ ] Story-less but **fixture-driven** visual tests  
- [ ] Icon-only button a11y name rule  

### WP32 — Backup, restore & DR drills (M)

- [ ] `scripts/backup.sh` (pg_dump + rustfs volume)  
- [ ] `scripts/restore.sh` with dry-run  
- [ ] Document RPO/RTO targets (self-host defaults)  
- [ ] Quarterly restore drill checkbox in runbook  
- [ ] Encrypt backup artifacts at rest  
- [ ] Postgres PITR notes for advanced ops  

### WP33 — Supply chain & container hardening (M)

- [ ] SBOM (Syft/Trivy) on release  
- [ ] Trivy scan CI gate for Dockerfile  
- [ ] Pin base image digests  
- [ ] Dependabot/Renovate config  
- [ ] gitleaks / secret scan pre-commit or CI  
- [ ] Provenance attestation optional (cosign)  

### WP34 — MFA, device trust & session UX (M)

- [ ] TOTP MFA optional for owner/admin  
- [ ] Recovery codes (hashed at rest)  
- [ ] Session list + revoke in Account settings  
- [ ] “New login” audit event  
- [ ] Optional step-up auth for BYOK reveal/rotate  

### WP35 — Performance, virtualization & cost guardrails (M)

- [ ] TanStack Virtual for messages + sidebar  
- [ ] Server pagination defaults (conversations, audit, usage)  
- [ ] Org budget hard-stop when `cost_micros` exceeds cap  
- [ ] Per-model token estimates in ModelSelect  
- [ ] Stream backpressure / max concurrent streams per user  
- [ ] Bundle analysis; route-level code split admin  

### WP36 — API excellence & versioning (S)

- [ ] Consistent error JSON: `{ code, message, requestId }`  
- [ ] OpenAPI stub for public-ish routes (health, future proxy)  
- [ ] Idempotency-Key for invite create (optional)  
- [ ] Deprecation headers policy for future breaking changes  

### WP37 — Multi-instance & sticky-less chat (M)

- [ ] Stateless web: no local stream state required after reconnect  
- [ ] Valkey optional stream cancel pub/sub (nice-to-have)  
- [ ] Document horizontal scale: N web behind Caddy  
- [ ] Connection pool sizing guide (Postgres)  

### WP38 — Developer experience enterprise (S)

- [ ] `pnpm secrets:generate`  
- [ ] `pnpm doctor` (env + docker health)  
- [ ] Dev seed script (demo org + fake chats)  
- [ ] VS Code / launch configs optional  
- [ ] CONTRIBUTING.md short path  

### WP39 — Documentation enterprise pack (S)

- [ ] `docs/security/*` (threat model, data flow, headers)  
- [ ] `docs/ops/*` (TLS, backup, capacity)  
- [ ] `docs/compliance/subprocessors.md`  
- [ ] Architecture decision records for KMS, SSO, budgets  
- [ ] Customer-facing security one-pager  

### WP40 — Release engineering (S)

- [ ] Semver + CHANGELOG  
- [ ] GitHub Release with image tags  
- [ ] Migration compatibility matrix  
- [ ] Rollback runbook  
- [ ] Version endpoint (`/api/health` includes `version` + git sha)  

### Suggested order

```
WP18 Auth UX → WP19 Models/chat → WP20 Admin SPA
  → WP21 Security → WP22 Encryption → WP23 Docker/TLS
  → WP24 DRY → WP25 Elite UI → WP26 OTel → WP27 Governance
  → WP28 E2E → WP30 AppSec → WP31 Design system
  → WP32 DR → WP33 Supply chain → WP34 MFA
  → WP35 Perf/cost → WP36 API → WP37 Scale
  → WP38 DX → WP39 Docs → WP40 Release
  → WP29 OIDC (2.1)
```

Parallelize freely after WP18–20: security/deploy/DRY/UI tracks are independent.

---

## 26. Security & encryption deep dive

### 26.1 Trust boundaries

1. Browser ↔ TLS terminator ↔ web  
2. Web ↔ Postgres (private network)  
3. Web ↔ Valkey (private, password in prod)  
4. Web ↔ RustFS (private)  
5. Web ↔ external LLM APIs (egress allowlist optional)  
6. Admin actions ↔ audit log  
7. CI/CD ↔ registry (supply chain boundary)

### 26.2 Controls matrix

| Control | First-ship | Phase 4 target |
| --- | --- | --- |
| Authn invite-only | Done | + lockout, session revoke, MFA (WP34) |
| Authz org+role+owner | Done | Full E.4 automation + SCIM later |
| BYOK AES-GCM | Done | Versioned KEK, rotation job, optional KMS |
| SSRF base URL | Done | Redirect + DNS hardening |
| Rate limit Valkey | Done | Per-route buckets (login/upload/chat) |
| Server-authoritative history | Done | Keep forever |
| TLS | Dev HTTP | Prod HTTPS mandatory via Caddy |
| CSP/HSTS | Helpers present | All responses + CSP tighten |
| CSRF / same-origin | Guard helper | Universal on mutations |
| Secret logging | Careful | Redaction middleware + tests |
| Dependency audit | Manual | CI gate + Renovate |
| Container harden | Scaffold | Non-root, scan, pin digests |
| Backup encryption | Doc only | Scripts + drill |

### 26.3 Encryption standards

| Layer | Standard |
| --- | --- |
| App secrets (BYOK, SSO) | AES-256-GCM; 12-byte IV; auth tag; version byte |
| KEK | 32-byte key from env / secret manager; never git |
| Password | scrypt (current) or Argon2id upgrade path |
| Transit | TLS 1.2+ at proxy; prefer TLS 1.3; HSTS |
| At rest | Cloud disk / LUKS for volumes; optional S3 SSE |
| Backups | Encrypted archives; restricted access |
| Sessions | Opaque high-entropy tokens; server-side store |

**Forbidden:** ECB, custom crypto, client-side storage of provider keys, logging decrypted secrets.

### 26.4 Encryption operational lifecycle

```
generate KEK → store in secret manager → app encrypts DEK material
  → credentials_meta.v tags ciphertext
  → rotation: introduce KEK_n+1 → dual-read → re-encrypt job
  → retire KEK_n after audit complete
  → if KEK lost: re-enter all BYOK (irrecoverable ciphertexts)
```

### 26.5 Authn best practices

- Min password length 10 (owner bootstrap enforced)  
- Session tokens: high entropy, revoke on logout  
- Cookie: `Secure; HttpOnly; SameSite=Lax` (Strict when SPA+API same-site allows)  
- Rotate session on privilege elevation  
- MFA TOTP for owners (WP34)  
- Device/session list in Account settings  
- Login rate limit + progressive delay  

### 26.6 Logging & secret redaction

Redact keys matching: `authorization`, `cookie`, `password`, `api_key`, `apiKey`, `ciphertext`, `ENCRYPTION_KEY`, `token`.  
Tests must assert redaction on sample log lines.

### 26.7 Network security

- Prod: only 80/443 published  
- Internal DNS names only for postgres/valkey/rustfs  
- Optional egress proxy for LLM calls  
- Document Cloudflare / external WAF in front of Caddy for SaaS  

### 26.8 XSS / injection posture

- React default escaping; no `dangerouslySetInnerHTML` except sanitised markdown pipeline  
- Markdown: allowlist tags; no raw HTML script  
- CSP as second line of defense  
- SQL via Drizzle parameterized only  

---

## 27. Docker, TLS & production deploy

### 27.1 Environments

| Env | Compose | TLS | Notes |
| --- | --- | --- | --- |
| dev | `docker/docker-compose.yml` | optional mkcert | hot reload web on host |
| prod | `docker/docker-compose.prod.yml` | Caddy auto HTTPS | publish 80/443 only |
| ci | compose + health waits | internal HTTP | e2e |
| laptop-prod | prod compose + mkcert | local TLS | validate headers/HSTS path |

### 27.2 Production checklist

- [ ] Non-root containers  
- [ ] Read-only root FS where possible  
- [ ] No Postgres/Valkey/RustFS ports on host  
- [ ] Secrets via env files with 600 perms or Docker secrets  
- [ ] Migrate job before web starts  
- [ ] Healthchecks on all services  
- [ ] Log rotation / json logs  
- [ ] Automatic HTTPS + HTTP→HTTPS redirect  
- [ ] HSTS at proxy and/or app  
- [ ] SSE: disable buffering / flush_interval -1  
- [ ] Backup cron documented  
- [ ] Image pin digests  
- [ ] Resource limits (CPU/mem)  
- [ ] `restart: unless-stopped`  
- [ ] Version label on image  

### 27.3 Reverse proxy requirements for SSE

- Disable response buffering for `/api/chat`  
- Long read timeouts (10m+)  
- Caddy: `flush_interval -1`  
- nginx: `proxy_buffering off;` + `proxy_read_timeout`  
- WebSockets not required for v1 chat (SSE only)

### 27.4 Network diagram

```
Internet
   │ HTTPS :443
   ▼
 TLS proxy (Caddy)
   │  security headers, HSTS, HTTP redirect
   ▼
 web :3000 (internal, non-root)
   ├── postgres :5432   (volume encrypted at host)
   ├── valkey :6379     (password)
   └── rustfs :9000     (internal)
         └── egress → OpenAI / Anthropic / Ollama
```

### 27.5 Dockerfile standards

- Multi-stage: deps → build → runtime  
- Runtime: node-slim or distroless; `USER` non-root  
- No devDependencies in final image  
- `NODE_ENV=production`  
- HEALTHCHECK → `/api/health`  
- Never `COPY .env`  

### 27.6 Compose service contracts

| Service | Publishes ports? | Volume | Health |
| --- | --- | --- | --- |
| caddy | 80, 443 | certs | caddy |
| web | no | no (stateless) | `/api/health` |
| postgres | no | pgdata | `pg_isready` |
| valkey | no | optional | `valkey-cli ping` |
| rustfs | no | data | HTTP ready |
| migrate | no | no | exit 0 |

### 27.7 TLS certificate strategy

| Mode | How |
| --- | --- |
| Public prod | Caddy + Let’s Encrypt (DOMAIN + open 80/443) |
| Private/corp | Caddy + internal CA or mounted certs |
| Laptop | mkcert + Caddy local_certs or host TLS terminate |
| CI | HTTP internal only |

---

## 28. DRY / architecture hygiene

### 28.1 Contract pattern (mandatory)

Any rule enforced by both UI and server **must** live in `@maximus/domain` with unit tests.

| Domain | Module | Status |
| --- | --- | --- |
| Chat send/edit/regen | `assertChatTurnInput` | ✅ |
| Export access | export builders + policies | ✅ |
| Titles | `heuristicTitle` + helpers | ✅ |
| Model refs | `parseModelRef` | ✅ |
| RBAC | `policies/rbac` | ✅ |
| Pricing | `computeCostMicros` | ✅ |
| Model catalog filter | `modelsForUser` | ✅ |
| Allowlist | `isModelAllowed` | ✅ |
| Upload limits | `assertUploadIntent` | TODO |
| Org settings parse | pure parse/validate | TODO |

### 28.2 Shared server utilities (WP24)

```
apps/web/src/server/   # or packages/server-kit later
  api.ts               # jsonOk, jsonError, guardMutation
  security.ts          # withSecurityHeaders, assertSameOrigin
  cookies.ts           # session cookie options
  env.ts               # appUrl, cookieSecure
  # future:
  auth.ts              # requireApiSession
  sse.ts               # writeSseEvent
  pagination.ts
  request-id.ts
  log.ts               # redacting logger
```

### 28.3 File size & module laws

- Soft max ~250 LOC; route files thin shells  
- One concern per file  
- No business logic in React beyond view state  
- Gateway is the only place that talks to LLM HTTP  
- No second CSS system; Lucide only via `Icon`  

### 28.4 DRY anti-patterns (ban)

1. Validating the same Zod shape in UI and server without shared schema  
2. Copy-pasting authz checks instead of `canAdminOrg` etc.  
3. Per-route security header sets  
4. Inline fetch to OpenAI from a feature component  
5. Hardcoded model lists in UI  
6. Ad-hoc `Response.json` without `AppError` mapping  

### 28.5 Import graph (reaffirm)

```
domain ← (pure)
config ← env only
provider-gateway ← domain, config
db ← domain, (gateway types only if needed)
auth ← domain, db, config
rate-limit ← domain
storage ← config
apps/web ← everything (composition root)
```

---

## 29. Elite UI polish bar

### 29.1 Visual

- ChatGPT-adjacent density (not marketing whitespace)  
- Perfect dark + light parity  
- Composer pill geometry; sticky bottom; model chip  
- Sidebar date groups; hover actions; collapse animation  
- Message actions on hover; branch `‹ 1/N ›`  
- Code blocks: lang label + copy + syntax highlight  
- Consistent elevation / border tokens; no random grays  

### 29.2 Interaction

- Keyboard: Appendix D map fully wired  
- Optimistic UI where safe; reconcile from server on reload  
- Toasts for errors (rate limit, upload fail, network)  
- Disabled states + spinners consistent  
- Focus restoration after dialogs  

### 29.3 Accessibility

- WCAG AA contrast both themes  
- Focus visible; trap in dialogs  
- `aria-live` for streaming completion  
- Icons decorative `aria-hidden` via `Icon`  
- Reduced motion  
- Form labels associated; errors announced  

### 29.4 Performance UX

- Virtualize long threads and long sidebars  
- Paginate history  
- Prefetch conversation on row hover (optional)  
- Avoid layout thrash during stream  
- Skeleton placeholders, not empty flashes  

### 29.5 Admin UI elite bar

- Dense tables, filters, empty states  
- Confirm destructive actions  
- Never display secrets; show “•••• set” + rotate  
- Usage charts simple and readable  
- Sticky table headers; keyboard row nav where practical  

### 29.6 Motion & micro-interactions

- 150–200ms ease for sidebar / menus  
- Message fade/slide subtle  
- Streaming caret  
- Respect `prefers-reduced-motion: reduce` → instant  

### 29.7 Content design

- Error copy: human, actionable, no stack traces  
- Empty states teach next action  
- Confirm copy names the resource  

---

## 30. Enterprise quality gates & compliance track

### 30.1 CI pipeline (target)

```
lint → typecheck → unit → integration (postgres+valkey)
  → build → e2e (playwright) → pnpm audit → image build → trivy
```

### 30.2 Security gates

- [ ] Authz matrix tests for any new resource  
- [ ] No high/critical npm vulns without ADR exception  
- [ ] Secret scan (gitleaks) on PR  
- [ ] Container scan (trivy) on release images  
- [ ] Header smoke on `/` and `/api/health`  

### 30.3 Release checklist

- [ ] CHANGELOG  
- [ ] Migrate forward tested on copy of prod data shape  
- [ ] Rollback note  
- [ ] Encryption key backup verified  
- [ ] Runbook updated  
- [ ] Appendix K go-live signed  

### 30.4 Compliance artifacts (docs/)

- [ ] `docs/security/threat-model.md`  
- [ ] `docs/security/data-flow.md`  
- [ ] `docs/security/headers.md`  
- [ ] `docs/ops/backup-restore.md`  
- [ ] `docs/ops/tls-and-proxy.md`  
- [ ] `docs/ops/capacity.md`  
- [ ] `docs/compliance/subprocessors.md`  

### 30.5 Policy defaults (org settings)

| Setting | Default | Notes |
| --- | --- | --- |
| rateLimitFailOpen | false | D16 |
| retentionDays | null (keep) | purge job when set |
| allowPrivateBaseUrls | env-driven | SSRF |
| budgetMicros | null | hard-stop when set |
| defaultModelRef | platform default | picker |

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
| Prod TLS misconfig | Cookies/mixed content | Caddy defaults + Appendix K |
| KEK loss | Permanent BYOK loss | Secret manager + re-enter runbook |
| Scope creep WP18–40 | Never ship | Ordered WPs; Phase 4 exit metrics |
| Supply-chain vuln | Compromised dep | audit + Renovate + pin digests |
| SSE buffering in corp proxy | Broken streams | §27.3 docs; health/stream smoke |
| Dual validation regressions | Authz/UX bugs | DRY contracts + boundary lint |
| Elite UI unfinished | “Almost ChatGPT” feel | Appendix L scorecard gate |

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

## 33. Glossary

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
| KEK | Key encryption key (`ENCRYPTION_KEY`) for BYOK envelope |
| SBOM | Software bill of materials for release artifacts |
| Same-origin guard | Reject mutations whose Origin/Referer host ≠ app host |
| Assistant / custom GPT | Org-scoped preset: system prompt + model + tools + knowledge |
| Artifact / canvas | Side-panel durable output (usually code) versioned per chat |
| Ephemeral chat | Temporary conversation with TTL hard-delete; not shared |
| Org API key | Hashed secret for OpenAI-compat proxy (`mk_…`) |
| Knowledge base | RAG corpus with ACL + embeddings (PGVector) |
| GRC | Governance, risk, compliance controls pack |
| DLP | Data loss prevention (pattern detect/block/redact on outbound) |
| Legal hold | Suppress retention purge for a user/org matter |
| eDiscovery | Structured export of a user’s chats for legal review |

---

## 34. Phase 5 — Platform maturity

Beyond Phase 4 “enterprise ready.” Entry: Appendix K signed; WP18–WP28 green; zero open critical security findings. Detail for product depth: **§41–§48**.

| Track | Items | WPs |
| --- | --- | --- |
| Identity | OIDC, SCIM, SAML bridge, directory sync | WP29, Phase 5+ |
| ChatGPT parity | Search, branch UI, projects, vision, assistants, tools, canvas, share | WP41–49 |
| Data plane | RAG/PGVector, memory, org API proxy | WP50–52 |
| Trust / GRC | DLP, retention, eDiscovery, KMS, SOC2 pack | WP55 |
| Scale | Multi-region, Valkey cluster, object CDN | later |
| Delight | Voice, image gen | WP53–54 |
| Mobile | Responsive complete first; native shells later | optional |

---

## 35. Engineering best-practices catalog

### 35.1 TypeScript & correctness

- `strict` TS everywhere; no ambient `any` without comment  
- Branded ids optional; never confuse userId/orgId/conversationId  
- Exhaustive `switch` on discriminated unions  
- Prefer pure functions + thin I/O shells  

### 35.2 API design

- JSON errors: `{ code, message, requestId }`  
- 401 unauthenticated · 403 forbidden · 404 cross-tenant  
- Idempotent GETs; mutations audited when admin-grade  
- SSE for chat only; no long-poll dual path  

### 35.3 Database

- Expand/contract migrations; never edit applied SQL  
- Every tenant table has `org_id` (+ index)  
- Transactions for multi-row chat writes  
- No N+1 in list endpoints; explicit column selects  

### 35.4 Testing

- Red→Green→Refactor for domain/gateway/authz/crypto  
- Integration tests against real Postgres in CI  
- Fake provider default; live adapters gated  
- Negative tests mandatory for authz  

### 35.5 Code review bar

- Security: authz + secrets + SSRF touched?  
- DRY: new dual validation?  
- UI: D17 laws?  
- Size: files under soft max?  
- Tests: evidence of green run  

### 35.6 Git & releases

- Conventional commits  
- No secrets in history  
- Small PRs per WP concern  
- CHANGELOG for user-visible changes  

---

## 36. Supply chain, SBOM & dependency hygiene

### 36.1 Principles

- Lockfile committed; `pnpm` only  
- Justify every new dependency in PR  
- Prefer stdlib / existing TanStack/Radix/Lucide  
- Pin Docker base digests for prod  

### 36.2 Automation (WP33)

| Tool | When |
| --- | --- |
| `pnpm audit` | CI every PR |
| Renovate/Dependabot | weekly PRs |
| gitleaks | CI + optional pre-commit |
| Trivy/Grype | image build |
| Syft SBOM | release artifact |

### 36.3 Accepting risk

High/critical vuln → either upgrade, replace, or ADR exception with expiry date. No silent ignore.

### 36.4 Build reproducibility

- Multi-stage Docker; no `npm install` at runtime  
- CI builds the same Dockerfile as prod  
- Record `git sha` in `/api/health`  

---

## 37. HA, backup, disaster recovery

### 37.1 Default self-host posture

| Component | HA v1 | Notes |
| --- | --- | --- |
| web | scale horizontally | stateless |
| postgres | single primary | backups critical |
| valkey | single | fail-closed chat if down (D16) |
| rustfs | single volume | backup volume |
| caddy | single | or external LB |

### 37.2 RPO / RTO targets (defaults for docs)

| | Target (self-host default) |
| --- | --- |
| RPO | ≤ 24h (daily dump) — improve with PITR |
| RTO | ≤ 4h restore to known-good compose |

Customers may tighten; Maximus documents how, not a SLA in OSS mode.

### 37.3 Backup contents

1. Postgres logical dump (or volume snapshot)  
2. RustFS/object volume  
3. Encryption key materials (secret manager — **not** in dump)  
4. `.env` / compose secrets inventory (offline)  
5. Caddy/cert note (Let’s Encrypt re-issues)

### 37.4 Restore drill (quarterly)

1. Fresh VM  
2. Restore DB + object volume  
3. Inject KEK  
4. `compose up`  
5. Login + open known conversation + send fake chat  
6. Record time-to-green in runbook log  

### 37.5 Failure modes

| Failure | User impact | Mitigation |
| --- | --- | --- |
| Postgres down | full outage | restart; restore |
| Valkey down | chat 429/fail closed | fix Valkey; or org fail-open |
| RustFS down | uploads fail; chat text ok | restore volume |
| LLM provider down | provider errors | multi-provider; clear UX |
| KEK lost | cannot decrypt BYOK | re-enter keys |

---

## 38. Session, MFA & identity hardening

### 38.1 Session model (current → target)

| Aspect | Current | Target |
| --- | --- | --- |
| Store | Postgres session table | keep |
| Cookie | HttpOnly; Secure in prod | + __Host- prefix if path allows |
| Rotation | on login path | + on password change / MFA enable |
| List/revoke | partial | Account settings UI |
| Absolute TTL | configure | e.g. 30d idle 7d |

### 38.2 MFA (WP34)

- TOTP (RFC 6238) for owner/admin first  
- Recovery codes hashed (scrypt)  
- Step-up for: rotate BYOK, change SSO, delete org  
- Audit: `mfa.enabled`, `mfa.challenge_failed`  

### 38.3 Invite hardening

- Single-use tokens; expiry  
- Rate limit accept + create  
- Email enumeration: generic errors  
- Role assignment cannot mint owner except owner  

### 38.4 Bootstrap hardening

- Only when zero users  
- Strong password required  
- Audit `org.bootstrap`  
- Disable bootstrap permanently after first user (already)  

---

## 39. Input validation, errors & API excellence

### 39.1 Validation law

1. Parse with Zod (or domain assert) at boundary  
2. Never trust client for history, orgId, role, prices  
3. Cap string lengths (title, message text, custom instructions)  
4. Cap array lengths (attachmentIds, batch ops)  

### 39.2 Standard error envelope

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Try again shortly.",
    "requestId": "…"
  }
}
```

Map `AppError` codes → HTTP status once (shared helper).

### 39.3 Idempotency (selective)

- Invite create: optional `Idempotency-Key`  
- Chat: not idempotent (streams); client retries only on network fail before stream starts  

### 39.4 Pagination

- Cursor-based for conversations, audit, usage  
- Default limits; max cap enforced server-side  

---

## 40. Performance, capacity & cost controls

### 40.1 Client performance

- Virtualize messages + sidebar  
- Code-split `/admin/*`  
- Avoid re-rendering full markdown tree every token (append-friendly)  
- Image attachments: thumbnail, lazy load  

### 40.2 Server performance

- Connection pool size guide (web replicas × pool < postgres max)  
- Index: `(org_id, updated_at)` conversations; usage time ranges  
- Stream: write assistant message incrementally or finalize once (document choice)  
- Rate limits protect shared capacity  

### 40.3 Cost controls

| Control | Mechanism |
| --- | --- |
| Per-user RPM | Valkey |
| Per-org RPM | Valkey |
| Budget | `budgetMicros` vs sum `cost_micros` |
| Model allowlist | role rules |
| Provider disable | admin toggle |
| Fake mode | CI/e2e zero $ |

### 40.4 Capacity planning sketch (self-host)

| Seats | Web replicas | Postgres | Notes |
| --- | --- | --- | --- |
| ≤ 50 | 1 | 1 small | compose default |
| ≤ 500 | 2–3 | 1 medium | pool + Valkey |
| ≤ 5k | 4+ behind LB | primary + backup | consider managed PG |

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
# VALKEY_PASSWORD=  # prod compose should set requirepass
RATE_LIMIT_USER_PER_MIN=60
RATE_LIMIT_ORG_PER_MIN=600
RATE_LIMIT_FAIL_OPEN=false
RATE_LIMIT_LOGIN_PER_MIN=10
RATE_LIMIT_UPLOAD_PER_MIN=30

# Security / cookies
COOKIE_SECURE=false          # true in prod compose
# CSRF_SECRET=               # if double-submit token path enabled
# TRUST_PROXY=true           # when behind Caddy

# Observability (Phase 4)
# LOG_LEVEL=info
# OTEL_EXPORTER_OTLP_ENDPOINT=
# SENTRY_DSN=
# APP_VERSION=               # injected at image build

# Production compose
# DOMAIN=maximus.example.com
# POSTGRES_PASSWORD=
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

## Appendix J — Security hardening checklist (executable)

Use before calling a release “enterprise ready.” Check only with evidence.

### J.1 Authn / session

- [ ] No open registration; bootstrap only when user count = 0  
- [ ] Invite required for new members; expired/used invites rejected  
- [ ] Passwords hashed (scrypt/Argon2); never logged  
- [ ] Session cookie HttpOnly; Secure in prod; SameSite set  
- [ ] Logout clears server session + cookie  
- [ ] Login rate limited  
- [ ] Optional: MFA for owners (WP34)

### J.2 Authz

- [ ] Every resource id checked for org membership  
- [ ] Cross-tenant id → **404** not 403  
- [ ] Member cannot access `/admin/*` APIs or UI  
- [ ] Admin cannot read others’ message bodies (D12)  
- [ ] Owner-only: delete org / transfer ownership  
- [ ] E.4 matrix automated tests green  

### J.3 Injection / XSS / SSRF

- [ ] Drizzle/parameterized SQL only  
- [ ] Markdown sanitised; no arbitrary HTML script  
- [ ] CSP present on HTML responses  
- [ ] `assertSafeBaseUrl` on all user base URLs  
- [ ] Upload MIME + size limits; no path traversal in keys  

### J.4 Crypto / secrets

- [ ] BYOK ciphertext only in DB  
- [ ] ENCRYPTION_KEY not in git / image layers  
- [ ] Rotation runbook tested or tabletop  
- [ ] Logs redaction tests green  

### J.5 Transport / deploy

- [ ] Prod: HTTPS only; HSTS  
- [ ] Internal services not published  
- [ ] Non-root container user  
- [ ] Health endpoint used by orchestrator  

### J.6 Abuse

- [ ] Chat rate limits  
- [ ] Upload rate limits  
- [ ] Org budget hard-stop when configured  
- [ ] Valkey down → fail closed by default  

---

## Appendix K — Production go-live checklist

### K.1 Pre-flight

- [ ] `ENCRYPTION_KEY` generated and backed up offline / secret manager  
- [ ] `BETTER_AUTH_SECRET` (or session secret) set  
- [ ] `DOMAIN` DNS points to host  
- [ ] Postgres password not default in real prod  
- [ ] Platform provider keys set **or** BYOK planned  
- [ ] `COOKIE_SECURE=true`  
- [ ] `RATE_LIMIT_FAIL_OPEN=false` unless consciously overridden  

### K.2 Deploy

- [ ] `docker compose -f docker/docker-compose.prod.yml up -d --build`  
- [ ] Migrate completed successfully  
- [ ] `GET https://$DOMAIN/api/health` → ok  
- [ ] Security headers present (CSP, HSTS)  
- [ ] Bootstrap first owner via UI or API  
- [ ] Login works over HTTPS  
- [ ] Fake or live chat completes  
- [ ] Admin can invite a member  

### K.3 Post-flight

- [ ] Backup job scheduled  
- [ ] Log shipping / disk monitoring noted  
- [ ] Runbook link shared with ops  
- [ ] Version recorded in CHANGELOG  
- [ ] Appendix J signed for this release  

### K.4 Rollback

- [ ] Previous image tag known  
- [ ] DB migrate rollback/forward strategy understood  
- [ ] KEK unchanged during app-only rollback  

---

## Appendix L — Elite UI scorecard

Score each 0–5. Target **≥ 95 / 100** for Phase 4 UI exit (WP25).

| # | Criterion | Pts |
| --- | --- | --- |
| 1 | Dark theme parity with ChatGPT density | /5 |
| 2 | Light theme complete (no unstyled flashes) | /5 |
| 3 | Sidebar: date groups, hover actions, collapse | /5 |
| 4 | Composer geometry + model chip + attach | /5 |
| 5 | Streaming UX stable (no full remount jank) | /5 |
| 6 | Branch switcher when siblings > 1 | /5 |
| 7 | Markdown + code copy works | /5 |
| 8 | Empty state + suggestion chips | /5 |
| 9 | Toasts / error copy human | /5 |
| 10 | Keyboard map Appendix D (core set) | /5 |
| 11 | Focus rings + dialog trap | /5 |
| 12 | axe critical issues = 0 | /5 |
| 13 | Mobile drawer + safe areas | /5 |
| 14 | Settings pages complete | /5 |
| 15 | Login / invite elite, not “bootstrap form” | /5 |
| 16 | Admin tables dense + empty states | /5 |
| 17 | Secrets never shown in admin | /5 |
| 18 | Skeletons / loading consistency | /5 |
| 19 | Reduced motion respected | /5 |
| 20 | No page-local CSS; Lucide only; thin routes | /5 |
| | **Total** | **/100** |

---

## 41. ChatGPT product parity matrix

**Goal:** A power user can live in Maximus all day without missing ChatGPT muscle memory. Status is honest against the repo — do not flip to done without UI + tests.

### 41.1 Matrix

Legend: **Shipped** · **Partial** · **Open** · Wave: Now / Next / Then / Later

| Feature | Status | Wave | WP | Acceptance sketch |
| --- | --- | --- | --- | --- |
| Dark + light shell | Partial | Now | WP25 | Appendix L ≥ 95 |
| Sidebar history + new chat | Partial | Now | WP7/41 | Virtualized; date groups |
| Composer + model chip | Partial | Now | WP19 | Dynamic models only |
| Stream assistant + stop | Partial | Now | WP42 | Abort works; retry bubble |
| Edit / regenerate (server) | Shipped | — | WP8 | Branch plans pure |
| Branch switcher `‹ 1/N ›` | Open | Now | WP42 | When siblings > 1 |
| Thumbs up/down | Partial | Now | WP9 | API + UI polish |
| Markdown + code copy | Partial | Now | WP9/25 | Stable stream render |
| Attachments paperclip | Partial | Next | WP44 | Preview chips; vision bytes |
| ⌘K command palette | Open | Now | WP41 | Search + nav actions |
| Full-text chat search | Open | Now | WP41 | Title + body (tsvector v1) |
| Keyboard map (App D) | Partial | Now | WP25/41 | Core shortcuts wired |
| Projects folders UI | Open | Now | WP43 | Schema exists |
| Custom instructions persist | Partial | Now | WP43 | Settings → prompt assembly |
| LLM auto-title | Open | Next | WP45 | Non-blocking; respect user title |
| Real multimodal vision | Open | Next | WP44 | Provider image parts |
| PDF / text extract | Open | Next | WP44 | Virus-scan hook optional |
| Assistants / custom GPTs | Open | Next | WP46 | §42 |
| Tool calling + web search | Open | Next | WP47 | §42 |
| Canvas / artifacts panel | Open | Next | WP48 | Versioned side panel |
| Shared conversation links | Open | Next | WP49 | Org + expiry + audit |
| Temporary / incognito chat | Open | Next | WP49 | Org policy gate |
| Drag-drop + paste images | Open | Next | WP44 | Composer UX |
| Memory (cross-chat) | Open | Later | WP52 | Org-gated, deletable |
| Voice STT/TTS | Open | Later | WP53 | Browser STT first |
| Image generation | Open | Later | WP54 | Tool or dedicated model |
| Org OpenAI-compat proxy | Open | Then | WP50 | §46 |
| RAG knowledge bases | Open | Then | WP51 | §43 |
| OIDC SSO | Open | Then | WP29 | |
| MFA / step-up | Open | Then | WP34 | |
| GRC (DLP, retention…) | Open | Then | WP55 | §45 |

### 41.2 “Daily driver” exit criteria

- [ ] Search finds chats by content in < 300ms p95 local  
- [ ] Branch switcher works after edit + regen  
- [ ] Projects + custom instructions affect next turn  
- [ ] Appendix L ≥ 95; axe critical = 0 on shell + thread  
- [ ] No hardcoded model list in prod builds (already path)  
- [ ] Stream stop + error retry feel ChatGPT-grade  

### 41.3 Anti-goals for parity work

- Pixel-theft of OpenAI brand assets  
- Shipping RAG before ACL model is designed (§43)  
- Memory without user-visible list + delete  
- Public unauthenticated share links  

---

## 42. Tools, agents & assistants architecture

### 42.1 Principles

| Principle | Rule |
| --- | --- |
| **Server-authoritative** | Tools run only on server; client never holds tool secrets |
| **Pure tool defs in domain** | Name, JSON schema, risk level; no I/O in domain |
| **Gateway executes** | HTTP tools / provider tool-calling behind gateway |
| **Org policy** | Admin enable/disable tools; role allowlists |
| **Auditable** | Every tool call → usage/audit with args redacted |
| **Untrusted inputs** | File/URL content labeled untrusted; no code exec v1 |

### 42.2 Assistants (custom GPTs)

```
assistant
  id, org_id, owner_user_id
  name, description, avatar_key?
  system_prompt
  model_ref_default
  tools[]              -- enabled tool ids
  knowledge_ids[]      -- RAG corpora (WP51)
  visibility           -- private | org
  created_at, updated_at
```

**UX:** Gallery (org) + “Create assistant” + start chat with assistant_id → system prompt assembly injects assistant layer (order: platform → org → project → assistant → user).

### 42.3 Tool interface (sketch)

```ts
// packages/domain — pure
type ToolDef = {
  id: string;
  displayName: string;
  description: string;
  parametersSchema: unknown; // JSON Schema
  risk: "low" | "medium" | "high";
};

// packages/provider-gateway or tools package — I/O
type ToolRuntime = {
  execute(toolId: string, args: unknown, ctx: ToolCtx): AsyncIterable<ToolEvent>;
};
```

**v1 tools:** `web_search` (pluggable provider), `fetch_url` (SSRF-guarded), optional `code_interpreter` **out of scope** until sandbox design.

### 42.4 Provider tool-calling

- Prefer native OpenAI/Anthropic tools when model supports  
- Normalize to domain tool events for UI (tool call chips)  
- Capability badge on ModelSelect: `tools: true`  

### 42.5 Security

- High-risk tools require admin enable + optional step-up  
- Arg/result size caps; timeout; rate limit per tool  
- Never log full web page bodies  

---

## 43. Knowledge / RAG design

### 43.1 Goals

- Org knowledge bases with **document ACL** (not “all org sees all”)  
- Cite sources in assistant markdown  
- Same Postgres (PGVector) for ops simplicity  

### 43.2 Data model sketch

```
knowledge_bases: id, org_id, name, embedding_model, created_by
knowledge_docs: id, kb_id, title, source_uri, status, checksum
knowledge_chunks: id, doc_id, ordinal, content, embedding vector
knowledge_acl: kb_id, subject_type (user|role|org), subject_id, perm
```

### 43.3 Ingestion pipeline

1. Upload to RustFS  
2. Extract text (PDF/plain; OCR optional job)  
3. Chunk (token-aware)  
4. Embed via platform/BYOK embedding model  
5. Store vectors; mark doc ready  
6. Virus-scan hook optional between 1–2  

### 43.4 Retrieval at chat time

1. Authz: user can read KB?  
2. Embed query  
3. Top-k similarity + optional hybrid keyword  
4. Inject as system/context block with citations  
5. Budget tokens: cap retrieved context  

### 43.5 Non-goals v1

- Cross-org sharing  
- Real-time crawl of entire intranet  
- Fine-tuning on customer docs  

---

## 44. Sharing, collaboration & temporary chats

### 44.1 Shared links

| Property | Rule |
| --- | --- |
| Scope | Org members only (default); optional public **off** until product decision |
| Expiry | Required (e.g. 7d / 30d / custom) |
| Snapshot | Share freezes branch at leaf **or** live view — **prefer snapshot** for integrity |
| Authz | Link token + session membership check |
| Audit | `share.created`, `share.viewed`, `share.revoked` |
| D12 | Never expand admin rights via share |

### 44.2 Temporary / incognito chats

- Client shows “Temporary chat” badge  
- Server: `conversations.ephemeral = true` → hard-delete on session end or TTL (e.g. 24h)  
- Org setting: `allowEphemeralChats` default true  
- Ephemeral excluded from search index optional  
- No share links from ephemeral  

### 44.3 Collaboration (later)

- Multi-user same thread: **out of v1** (conflict with tree model)  
- @mention teammates: Phase 6+  

---

## 45. Enterprise GRC pack

Governance, risk, compliance — what security/legal review.

### 45.1 Controls catalog

| Control | Mechanism | WP |
| --- | --- | --- |
| SSO | OIDC (then SAML) | WP29 |
| MFA / step-up | TOTP; step-up for BYOK rotate | WP34 |
| Encryption | AES-GCM BYOK; optional KMS envelope | WP22, WP55 |
| Retention | Org `retentionDays`; purge job | WP27, WP55 |
| Legal hold | Flag user/org; suppress purge | WP55 |
| eDiscovery | Owner export by user + date range | WP55 |
| DLP | Optional outbound pattern redaction | WP55 |
| Audit | Immutable-ish `audit_events` | shipped partial |
| Data residency | Label + egress allowlist docs | WP55 docs |
| Break-glass | Time-boxed, dual-admin, audited | product decision |
| Subprocessors | LLM providers list | docs |
| Training disclaimer | BYOK/self-host no-training claim | docs |

### 45.2 DLP sketch (optional org enable)

1. Before provider call, run allowlisted detectors (regex: SSN, card)  
2. On match: block **or** redact + audit `dlp.blocked`  
3. Never send raw match to third-party DLP without ADR  

### 45.3 Retention job

- Nightly: archive or delete conversations older than N days unless legal hold  
- Attachments cascade delete best-effort  
- Audit `retention.purged` counts only (no bodies)  

### 45.4 SOC2-oriented evidence (docs, not product)

- Access review export (members + roles)  
- Change management = git + release notes  
- Logging completeness checklist  
- Pen-test remediation tracker  

---

## 46. Org developer platform

### 46.1 OpenAI-compatible proxy

Expose `POST /v1/chat/completions` (subset) for Cursor/CI/scripts:

| Concern | Rule |
| --- | --- |
| Auth | Org API key (`mk_…`) hashed at rest |
| Scopes | models allowlist, RPM, daily budget |
| Audit | Every call: actor key, model, tokens, IP |
| No BYOK leak | Proxy uses resolved credentials server-side |
| Streaming | SSE compatible with OpenAI stream shape |

### 46.2 API keys admin UI

- Create / revoke / last-used  
- Show prefix only (`mk_live_abc…`)  
- Never show full secret after create dialog  

### 46.3 Webhooks (later)

- `message.completed`, `budget.exceeded` — Phase 6  

---

## 47. Elite UX release gates

Ship UI-facing work only if gates pass (CI or documented exception).

### 47.1 Gates

| Gate | Bar |
| --- | --- |
| Appendix L scorecard | ≥ 95 / 100 for shell + thread releases |
| Appendix M parity | Wave “Now” items all Partial→Shipped |
| axe | 0 critical on login, shell, thread, admin, settings |
| Keyboard | Appendix D core map works |
| Themes | Dark + light screenshot smoke |
| Performance | Sidebar 500 rows virtualized; no main-thread > 50ms long tasks on stream tick (target) |
| Copy | Errors human; no stack traces to UI |
| D17 | No page CSS modules; Lucide only; thin routes |

### 47.2 Product voice

- Empty states teach next action  
- Rate limit: “You’ve hit a limit — try again in a minute”  
- Auth: never reveal whether email exists on login failure  

### 47.3 Motion

- 150–200ms easings; `prefers-reduced-motion: reduce` → instant  

---

## 48. WP41–WP55 work packages

### WP41 — Search, ⌘K, virtualization (L)

**Goal:** Find anything fast; long lists smooth.

- [ ] Conversation search API (title + message body; `tsvector` or ILIKE v1)  
- [ ] Sidebar search UI + empty states  
- [ ] Command palette ⌘K: new chat, search, settings, admin (if role), theme  
- [ ] TanStack Virtual for conversation list + message list  
- [ ] Tests: search isolation (no cross-user hits)  

**Acceptance:** 500-chat sidebar smooth; search never returns other users’ chats.

### WP42 — Branch UI, message actions, stream reliability (M)

- [ ] Branch switcher `‹ 1 / N ›` when siblings > 1  
- [ ] Hover actions: copy, regen, edit, thumbs  
- [ ] Stop generation wired to abort  
- [ ] Error bubble + Retry  
- [ ] Streaming markdown without full remount jank  

**Acceptance:** Edit → sibling branch navigable; stop cancels provider stream.

### WP43 — Projects + custom instructions product UI (M)

- [ ] Projects list in sidebar; create/rename/archive  
- [ ] Project-scoped chat filter  
- [ ] Custom instructions settings **persisted** → `assembleSystemPrompts`  
- [ ] Move conversation to project  

**Acceptance:** Instructions change next turn content (integration test with fake provider).

### WP44 — Multimodal vision + PDF/text extract (L)

- [ ] Fetch attachment bytes server-side for vision models  
- [ ] Map to OpenAI/Anthropic image content parts  
- [ ] Composer: drag-drop, paste, preview chips, remove before send  
- [ ] PDF/plain text extraction pipeline (async job ok)  
- [ ] Capability gating: vision models only for image attach  
- [ ] Virus-scan hook interface (noop default)  

**Acceptance:** PNG attach → model receives image part (contract test); non-vision model rejects with clear error.

### WP45 — LLM retitle + stream polish (S)

- [ ] Non-blocking retitle after first assistant complete  
- [ ] Respect `title_source=user`  
- [ ] Cheap model preference; skip if no platform key  
- [ ] Sidebar invalidation  

**Acceptance:** Heuristic immediate; LLM title lands without blocking stream.

### WP46 — Assistants / custom GPTs (L)

- [ ] Schema + repos for assistants  
- [ ] CRUD UI (owner) + org gallery  
- [ ] Start chat with assistant; prompt assembly order  
- [ ] Attach tools/knowledge ids (stubs ok until WP47/51)  

**Acceptance:** Org member can use shared assistant; private assistant not listed to others.

### WP47 — Tools framework + web search (L)

- [ ] Domain `ToolDef` + org enablement  
- [ ] Runtime execute + audit  
- [ ] `web_search` + SSRF-safe `fetch_url`  
- [ ] UI tool-call chips in thread  
- [ ] Admin tools page  

**Acceptance:** Search tool results cited; disabled tool cannot be invoked.

### WP48 — Canvas / artifacts side panel (L)

- [ ] Detect fenced code / artifact blocks  
- [ ] Side panel with version history per conversation  
- [ ] Copy / download  
- [ ] Optional: iterate artifact via follow-up prompt  

**Acceptance:** Long code readable without crushing chat column.

### WP49 — Share links + temporary chats (M)

- [ ] Create/revoke share; expiry; snapshot  
- [ ] View path for org members; audit views  
- [ ] Ephemeral conversations + TTL purge  
- [ ] Org settings toggles  

**Acceptance:** Expired link 404; ephemeral not in default search after purge.

### WP50 — Org API keys + OpenAI-compat proxy (L)

- [ ] API key create/revoke (hashed secrets)  
- [ ] `POST /v1/chat/completions` subset + stream  
- [ ] Rate limit + budget per key  
- [ ] Admin UI; audit  
- [ ] Contract tests against OpenAI stream shape  

**Acceptance:** curl with org key streams fake provider; revoked key 401.

### WP51 — RAG knowledge bases (L)

- [ ] KB + docs + chunks + PGVector  
- [ ] Ingest pipeline + status UI  
- [ ] ACL + retrieval inject + citations  
- [ ] Token budget for context  

**Acceptance:** Doc in KB answers with citation; user without ACL gets no chunks.

### WP52 — Memory (org-gated) (M)

- [ ] Memory facts table; user-visible list + delete  
- [ ] Org enable flag default **off**  
- [ ] Inject into system prompt with clear labeling  
- [ ] Audit memory writes  

**Acceptance:** User can delete a fact and it never reappears.

### WP53 — Voice STT/TTS (M)

- [ ] Browser speech recognition → composer (v1)  
- [ ] Optional server STT later  
- [ ] TTS play for assistant (browser speechSynthesis v1)  

**Acceptance:** Dictation fills composer; works in Chromium.

### WP54 — Image generation (M)

- [ ] Tool or dedicated gen model path  
- [ ] Store image in RustFS; render in thread  
- [ ] Org enable + cost tracking  

**Acceptance:** Generated image persists and reloads with conversation.

### WP55 — GRC pack: DLP, retention, eDiscovery, KMS (L)

- [ ] Retention job + legal hold  
- [ ] Owner eDiscovery export (user + date)  
- [ ] Optional DLP detectors  
- [ ] KMS adapter interface (AWS/GCP/Vault) dual-read  
- [ ] Docs: subprocessors, residency, break-glass ADR  

**Acceptance:** Retention purges old chats; hold suppresses; eDiscovery zip owner-only.

### Suggested order (Phase 5 product)

```
Finish residual Phase 4 (WP22–28, WP35 elite/virtualize)
  → WP41 Search/⌘K/virtual
  → WP42 Branch/actions/stream
  → WP43 Projects/instructions
  → WP44 Vision/PDF
  → WP45 Retitle
  → WP46 Assistants
  → WP47 Tools/search
  → WP48 Canvas
  → WP49 Share/temp
  → WP29 OIDC ∥ WP34 MFA ∥ WP50 API proxy
  → WP51 RAG
  → WP55 GRC
  → WP52 Memory → WP53 Voice → WP54 Image gen
```

Parallel tracks after WP43: **product** (44–49) · **identity** (29/34) · **platform** (50/51/55).

---

## Appendix M — ChatGPT parity scorecard (wave gates)

Score each shipped wave. Target: **Now ≥ 18/20**, **Next ≥ 16/20** before “daily driver” claim.

### M.1 Wave Now (credibility + muscle memory)

| # | Item | Done? |
| --- | --- | --- |
| 1 | Virtualized sidebar | |
| 2 | Virtualized messages | |
| 3 | Full-text or strong title+snippet search | |
| 4 | ⌘K palette | |
| 5 | Branch switcher | |
| 6 | Message hover actions complete | |
| 7 | Stop + retry polished | |
| 8 | Projects UI | |
| 9 | Custom instructions persisted | |
| 10 | Keyboard core map | |
| 11 | Toasts + skeletons | |
| 12 | Appendix L ≥ 90 | |
| 13 | axe critical 0 (shell) | |
| 14 | Dynamic models only | |
| 15 | Member denied admin | |
| 16 | Security headers + mutation guard | |
| 17 | Health + prod compose docs | |
| 18 | Playwright smoke (login + chat fake) | |
| 19 | Dark + light OK | |
| 20 | No dual chat-input validation | |
| | **/20** | |

### M.2 Wave Next (daily driver)

| # | Item | Done? |
| --- | --- | --- |
| 1 | Real vision path | |
| 2 | PDF/text extract | |
| 3 | LLM retitle | |
| 4 | Assistants | |
| 5 | At least one tool (search) | |
| 6 | Canvas panel | |
| 7 | Share links | |
| 8 | Temporary chats | |
| 9 | Drag-drop/paste attach | |
| 10 | Stream markdown stable | |
| 11 | Capability badges | |
| 12 | Empty/error/offline states | |
| 13 | Appendix L ≥ 95 | |
| 14 | Visual regression smoke | |
| 15 | Budget hard-stop optional | |
| 16 | Audit on admin + share | |
| 17 | Attach-only send still works | |
| 18 | Export MD/JSON | |
| 19 | Rate-limit UX copy | |
| 20 | Feature flags for risky tools | |
| | **/20** | |

---

*Living plan. First-ship core implemented. Phase 4 (WP18–WP40): security, Docker/TLS, admin SPA, elite foundation. Phase 5 product depth: **§41–§48 · WP41–WP55** — ChatGPT parity, tools/assistants, RAG, sharing, GRC, org API platform. Elite = power-user daily driver + security approval + extendable engineering.*


