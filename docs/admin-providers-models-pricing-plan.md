# Admin: Providers, Models, Pricing & Catalog — Implementation Plan

**Status:** Implemented — Providers-centric IA (models + rates under connections; Access = allowlist; Pricing page redirects)  
**Date:** 2026-07-30  
**Canonical path:** `docs/admin-providers-models-pricing-plan.md`  
**Scope:** Enterprise admin configuration for LLM providers (BYOK), model catalog, allowlists, pricing, and the chat model picker that depends on them  
**Related:** `docs/plan.md` §10, §15, WP13, WP15, D2, D15; existing shells at `/admin/providers`, `/admin/models`, `/admin/usage`  
**Out of scope for this plan:** SSO, org budgets UI, MFA step-up, TanStack Table polish-only, usage CSV export (noted as follow-on)

### Locked answers to §17 (approved defaults)

| # | Decision |
| --- | --- |
| 1 | **Merge** platform + org catalog (A1) |
| 2 | **Block hard delete** of connection while models reference it; soft-disable always allowed; hard delete when model count = 0 |
| 3 | Test connection uses **models/tags list** probes (not 1-token completion) |
| 4 | Pricing lives at **`/admin/pricing`** (dedicated route) |
| 5 | Platform model disable via **override row** only |
| 6 | Import Ollama tags = **follow-on**, not WP-D |

---

## 1. Purpose

Maximus can already:

- encrypt BYOK secrets (AES-256-GCM),
- resolve `modelRef` → credentials → live/fake adapter,
- enforce role allowlists on chat,
- compute `cost_micros` from seeded `model_prices`.

What is missing is a **complete, correct admin product surface** so an owner/admin can configure all of that without SQL or hand-crafted API calls.

This document specifies **every element** of that surface: data, domain rules, APIs, UI, security, audits, tests, and phased delivery. Implementation must not invent behavior not locked here.

---

## 2. Current state (ground truth)

### 2.1 What exists and works

| Layer | Status |
| --- | --- |
| Schema: `provider_connections`, `models`, `model_allowlists`, `model_prices`, `usage_events`, `audit_events` | Present in `001_init.sql` + Drizzle |
| BYOK encrypt/decrypt | `encryptSecret` / `decryptSecret`; never returned to client |
| Provider create API | `POST /api/admin/providers` — encrypts key, optional one model |
| Models list + allowlist upsert API | `GET/POST /api/admin/models` |
| Chat catalog API | `GET /api/models` → `modelsForUser(catalog, role, allowlist)` |
| Resolve path | `parseModelRef` → connection decrypt or platform env → adapter |
| Pricing math | `findPrice` + `computeCostMicros` on stream complete |
| Platform price seed | `openai/*` and `anthropic/*` wildcards (`org_id` null) |
| Admin RBAC | `requireOrgRole(ctx, "admin")` (owner+admin); members 403 |
| Audit | `provider.created`, `model.created`, `model.allowlist_set` |
| UI shells | Providers create form (OpenAI-only); Models list + allowlist paste; Usage flat table |

### 2.2 Gaps (honest)

| Gap | Detail |
| --- | --- |
| Provider UI | Hardcoded `kind: "openai"`, hardcoded `modelId: "gpt-4.1"`; no baseUrl, edit, disable, rotate, delete, test |
| Model UI | No create form; no enable/disable; no sort; no capabilities edit; no delete |
| Allowlist UI | No role selector; no delete; free-text ref only |
| Pricing | **No admin API or UI**; only migration seed |
| Repo mutations | Create/list only — no update/disable/delete for connections, models, prices, allowlist |
| Catalog merge | If org has **any** `models` row, platform catalog is **fully replaced** (not merged) — easy to lock users out of platform models |
| Credentials NOT NULL | Schema requires `credentials_encrypted` even for Ollama (no key) |
| Test connection | Not implemented (WP13 checkbox open) |
| Org price specificity | `findPrice` prefers org rows then pattern match; no admin path to insert org rows |
| Usage admin | List only; no filters (noted follow-on) |

### 2.3 Code map (touch points)

```
packages/domain/
  model-ref.ts          # PROVIDER_KINDS, parse/serialize
  model-allow.ts        # empty = all allowed
  models-for-user.ts    # enabled + allowlist filter
  platform-catalog.ts   # default platform models
  pricing.ts            # computeCostMicros

packages/provider-gateway/
  crypto/secrets.ts     # AES-GCM
  resolve-adapter.ts    # BYOK vs platform
  ssrf.ts               # baseUrl safety
  adapters/live-http.ts # openai / anthropic / ollama / openai_compatible

packages/db/
  schema/app-tables.ts
  repos/providers.ts    # create/list only today
  repos/usage.ts        # findPrice, insertUsage, audit

apps/web/src/routes/
  admin.providers.tsx / admin.models.tsx / admin.usage.tsx
  api/admin/providers.ts / models.ts / usage.ts
  api/models.ts         # member-facing catalog
```

---

## 3. Goals & non-goals

### 3.1 Goals

1. **Admin can fully lifecycle** provider connections and org models from the UI.
2. **Admin can set org-level pricing** that overrides platform seeds for cost estimation.
3. **Allowlists** are manageable (add/remove, optional role scope) and match chat enforcement.
4. **Chat model picker** reflects the same truth as admin (enabled + allowlist + role).
5. **Secrets never leave the server** after write; rotate replaces ciphertext without reveal.
6. **Every admin mutation is audited** with safe meta (no API keys, no full ciphertexts).
7. **Test connection** validates credentials/baseUrl without persisting side effects beyond audit.
8. **TDD**: pure domain + repo integration + API authz + minimal UI smoke paths.

### 3.2 Non-goals (this plan)

- Platform-global model catalog editor (code/env seed only; not multi-tenant superadmin).
- Budget caps / hard spend limits (schema may come later; not in this UI).
- Provider marketplace / auto-discover model lists from vendor APIs (optional later: “import from Ollama tags”).
- Per-user model allowlists (org-role only, as today).
- Changing AES-GCM envelope or KMS (existing crypto stays; rotation of KEK is WP22).
- Redesign of whole AdminShell visual system (reuse current shell + denser forms).

---

## 4. Locked product decisions (must confirm before code)

These extend D2/D15. **Approve or amend before implement.**

| ID | Decision | Proposed default | Rationale |
| --- | --- | --- | --- |
| A1 | **Catalog composition** | **Merge**: member catalog = enabled **platform defaults** ∪ enabled **org models**, then allowlist filter. | Avoids “add one BYOK model, lose GPT” footgun |
| A1b | **Platform model visibility** | Platform models always from `defaultPlatformCatalog()` unless org has an override row with same `modelRef` (org `models` row with `connection_id` null and matching `model_ref`). Override can set `is_enabled=false` or rename display. | Controlled hide without deleting platform code seed |
| A2 | **BYOK model refs** | `serializeModelRef({ kind, connectionId: conn.id, modelId })` | Already implemented; keep |
| A3 | **Platform model refs** | `connectionId = "platform"` | Already implemented; keep |
| A4 | **Provider kinds in admin** | All four: `openai`, `anthropic`, `openai_compatible`, `ollama` | Match gateway |
| A5 | **Ollama credentials** | Allow empty API key; store encrypted empty string so NOT NULL holds | Schema constraint |
| A6 | **Disable vs delete connection** | Soft disable default (`is_enabled=false`); hard delete only if no models reference it **or** cascade set models disabled + null connection with confirm | Safer for history |
| A7 | **Disable model** | `is_enabled=false` — hidden from picker; historical messages keep old `model_ref` | Chat integrity |
| A8 | **Allowlist semantics** | Unchanged: empty rules = all enabled models allowed; non-empty = must match rule (role null = all roles) | Domain already tested |
| A9 | **Price resolution** | Unchanged algorithm base in `findPrice`: org rows before platform; pattern match | Document + tighten with A9b |
| A9b | **Pattern match order** | Prefer **exact** `model_id_pattern === modelId`, then longest substring pattern, then `*`; within tier prefer org over platform | Fixes ambiguous wildcard ordering |
| A10 | **Price currency** | USD only in v1 (`currency` column default) | D15 |
| A11 | **Test connection** | Admin-only; decrypt key in memory; one short probe; timeout ≤ 10s; never log key | WP13 |
| A12 | **Who can admin** | owner + admin (existing `requireOrgRole(..., "admin")`) | E.4 matrix |
| A13 | **ENCRYPTION_KEY** | Required for create/rotate/test BYOK; if missing → clear VALIDATION/500 with ops message | Already partial |
| A14 | **Create model without connection** | Allowed for platform-style org override rows; chat still needs platform env or connection for live | Flexible catalog |
| A15 | **Multiple models per connection** | Yes — connection is credentials; models are rows pointing at `connection_id` | Correct enterprise model |

**If A1 is rejected** (keep replace semantics): document that first org model must bulk-import platform models — worse UX; not recommended.

---

## 5. Domain model

### 5.1 Entities (conceptual)

```
Organization
  ├── ProviderConnection*   # BYOK credentials envelope
  │     └── Model*          # model_id + display + capabilities → model_ref
  ├── Model*                # may also be org override of platform (connection null)
  ├── ModelAllowlistRule*   # (model_ref, role?)
  ├── ModelPrice*           # org overrides; platform rows org_id null
  └── UsageEvent*           # read-only for this plan (cost from prices)
```

### 5.2 Canonical `modelRef`

```
{providerKind}:{connectionId}:{modelId}
```

| Field | Values |
| --- | --- |
| `providerKind` | `openai` \| `anthropic` \| `openai_compatible` \| `ollama` |
| `connectionId` | `platform` **or** `conn_…` id |
| `modelId` | Vendor id; may contain `:` (Ollama tags) |

Rules:

- Parse only via `parseModelRef` / `isModelRef`.
- UI never invents free-form refs when connection+modelId known — server serializes.
- Allowlist stores full `modelRef` string.

### 5.3 Provider connection fields

| Field | Admin write | Client read | Notes |
| --- | --- | --- | --- |
| `id` | — | yes | `conn_…` |
| `kind` | create only | yes | Immutable after create (avoids orphan model refs) |
| `name` | create/update | yes | Human label |
| `baseUrl` | create/update | yes | Required for `openai_compatible` and typically `ollama`; SSRF-checked on resolve/test |
| `apiKey` | create/rotate only | **never** | Encrypted at rest |
| `hasCredentials` | — | yes | Boolean derived (`true` if non-empty decrypted secret) |
| `isEnabled` | update | yes | Disabled → resolve fails MODEL_UNAVAILABLE |
| `createdAt` / `updatedAt` | — | yes | |

**Kind-specific validation (create/update):**

| Kind | API key | baseUrl |
| --- | --- | --- |
| `openai` | required (non-empty) | optional (default vendor) |
| `anthropic` | required | optional |
| `openai_compatible` | required | **required** + SSRF-safe |
| `ollama` | optional (empty OK) | **required** + private URLs only if `ALLOW_PRIVATE_BASE_URLS` / env flag matches resolve path |

### 5.4 Model fields

| Field | Admin write | Notes |
| --- | --- | --- |
| `connectionId` | create (optional) | null = platform-style / override |
| `providerKind` | create | Must match connection.kind if connection set |
| `modelId` | create | Immutable preferred (ref stability); display can change |
| `displayName` | create/update | Shown in picker |
| `modelRef` | server-derived | Never free-typed on create when connection known |
| `capabilities` | create/update | `{ streaming, vision, tools }` booleans; default `{ streaming: true }` |
| `isEnabled` | update | Soft hide |
| `sortOrder` | update | Ascending in picker |

### 5.5 Allowlist fields

| Field | Notes |
| --- | --- |
| `modelRef` | Must be `isModelRef` |
| `role` | `null` \| `owner` \| `admin` \| `member` |

Delete = remove rule. Empty table = unrestricted (among enabled models).

### 5.6 Price fields

| Field | Notes |
| --- | --- |
| `orgId` | null = platform seed; set = org override |
| `providerKind` | Match usage |
| `modelIdPattern` | Exact model id, substring, or `*` |
| `inputUsdPer1m` / `outputUsdPer1m` | numeric ≥ 0 |
| `currency` | `USD` only v1 |
| `effectiveFrom` | For future time travel; **v1: update in place allowed for org rows only**; platform seed rows **read-only** in admin |

### 5.7 Price resolution algorithm (A9b — implement in domain)

```
findPrice(orgId, providerKind, modelId):
  candidates = rows where provider_kind match
               AND (org_id = orgId OR org_id IS NULL)
  score(row):
    scope = org_id == orgId ? 2 : 1
    if pattern == modelId: specificity = 3
    else if pattern != "*" AND modelId includes pattern: specificity = 2
    else if pattern == "*": specificity = 1
    else: skip
  return max by (specificity, scope); null if none
```

Move matching logic from ad-hoc repo loop into **pure domain** `matchPriceRow` with unit tests; repo only loads candidates.

---

## 6. Catalog composition (member-facing)

### 6.1 Target algorithm (A1 + A1b)

```
platform = defaultPlatformCatalog()
orgRows  = listModels(orgId)  // includes overrides + BYOK models

// Index org rows by modelRef
for each platform model P:
  if org has row O with same modelRef:
    use O (enabled/display/capabilities from O)
  else:
    use P

append org rows whose modelRef not in platform set

filter: isEnabled
filter: modelsForUser(role, allowlist)
sort: sortOrder asc, displayName asc
```

### 6.2 Implications

- First BYOK model **does not** hide GPT/Claude/Ollama platform entries.
- Admin “disable GPT for org” = create org override model row with platform ref + `is_enabled=false`, **or** use allowlist that only lists allowed refs (if allowlist non-empty, unlisted models blocked).
- Prefer documenting both mechanisms; allowlist is coarser.

### 6.3 Migration note for existing orgs

If an org already created a single BYOK model under replace semantics, after merge they regain platform models automatically — **desired**. No data migration required.

---

## 7. API contracts

All admin routes: session + `requireOrgRole(admin)` + `guardMutation` on writes.  
JSON via `jsonOk` / `jsonError`. Never return `credentialsEncrypted` or plaintext keys.

### 7.1 Providers — `/api/admin/providers`

| Method | Body / query | Behavior |
| --- | --- | --- |
| `GET` | — | List connections (safe fields + `hasCredentials`, `modelCount`) |
| `POST` | create | Create connection; optional `models[]` batch; audit `provider.created` |
| `PATCH` | `{ id, name?, baseUrl?, isEnabled? }` | Update metadata/enable; **not** key; audit `provider.updated` |
| `POST` action rotate | `{ id, action: "rotate", apiKey }` | Re-encrypt; audit `provider.rotated` (no key in meta) |
| `POST` action test | `{ id, action: "test" }` **or** unsaved `{ action: "test", kind, baseUrl?, apiKey? }` | Probe; audit `provider.tested` with `{ ok, errorCode? }` |
| `DELETE` | `{ id }` | Soft-disable if models exist (default) **or** hard delete when unused; audit |

**Create body (Zod):**

```ts
{
  kind: ProviderKind,
  name: string.min(1).max(120),
  baseUrl?: string.url().optional(),
  apiKey?: string, // required unless ollama
  models?: Array<{
    modelId: string,
    displayName?: string,
    capabilities?: { streaming?: boolean, vision?: boolean, tools?: boolean },
    sortOrder?: number,
  }>,
}
```

**Test success criteria (kind-specific):**

| Kind | Probe |
| --- | --- |
| `openai` / `openai_compatible` | Prefer **models list** `GET {base}/v1/models` (cheaper than completion) |
| `anthropic` | Lightweight authenticated request (models or messages with max_tokens=1) |
| `ollama` | `GET {base}/api/tags` |
| fake mode | Always ok if connection decrypts |

Timeout 10s; map network/SSRF failures to safe client messages.

### 7.2 Models — `/api/admin/models`

| Method | Behavior |
| --- | --- |
| `GET` | `{ models, allowlist, connections: [{id,name,kind,isEnabled}] }` for form dropdowns |
| `POST` create | Server builds `modelRef`; validates connection ownership + kind match |
| `PATCH` | `{ id, displayName?, capabilities?, isEnabled?, sortOrder? }` |
| `DELETE` | **v1: hard delete org model row OK**; messages keep historical `model_ref` string |
| `POST` allowlist | `{ action: "allowlist_upsert", modelRef, role }` |
| `DELETE` allowlist | `{ action: "allowlist_delete", id }` or modelRef+role |

### 7.3 Prices — `/api/admin/prices` **(new)**

| Method | Behavior |
| --- | --- |
| `GET` | Platform seeds (read-only flag) + org prices |
| `POST` | Create org price |
| `PATCH` | Update org price only |
| `DELETE` | Delete org price only |

Reject mutate when `org_id IS NULL` (platform seed).

### 7.4 Member catalog — `/api/models` **(change)**

Apply §6 merge algorithm. Response unchanged shape:

```ts
{ models: Array<{ modelRef, displayName, providerKind, capabilities? }> }
```

(Only enabled + allowlisted.)

### 7.5 Error codes

| Code | When |
| --- | --- |
| `UNAUTHORIZED` | No session |
| `FORBIDDEN` | Not admin/owner |
| `VALIDATION` | Zod / kind rules / bad modelRef |
| `NOT_FOUND` | Wrong org or missing id (404, no leak) |
| `MODEL_UNAVAILABLE` | Resolve/test path |
| `CONFLICT` | Unique model_ref collision |

---

## 8. Repository layer (`packages/db`)

Extend `providerRepo` (or split `pricesRepo`) with:

| Function | Notes |
| --- | --- |
| `updateProviderConnection` | name, baseUrl, isEnabled, updatedAt |
| `rotateProviderCredentials` | set ciphertext + meta |
| `deleteProviderConnection` | only if policy allows |
| `countModelsForConnection` | for UI + delete guard |
| `updateModel` | fields above |
| `deleteModel` | by id + org |
| `deleteAllowlist` | by id + org |
| `listPrices(orgId)` | org + platform |
| `createOrgPrice` / `updateOrgPrice` / `deleteOrgPrice` | org_id forced |
| `listModels` | add orderBy sortOrder |
| `getModelById` | org-scoped |

**Pricing:** implement `matchPriceRow` in domain; `findPrice` loads candidates and calls it.

---

## 9. UI specification

### 9.1 Nav (existing + one)

Overview · Members · **Providers** · **Models** · **Pricing** (new) · Usage · Audit

### 9.2 Providers page `/admin/providers`

**List table**

| Column | Content |
| --- | --- |
| Name | connection name |
| Kind | badge |
| Base URL | truncated or — |
| Models | count |
| Secrets | •••• set / empty |
| Status | Enabled / Disabled |
| Actions | Edit · Rotate key · Test · Enable/Disable · Delete |

**Create / Edit panel (form)**

1. Kind select (locked after create)
2. Name
3. Base URL (shown/required per kind)
4. API key (create only; rotate in modal)
5. Optional initial models: repeatable rows (modelId, displayName, capability checkboxes)
6. Submit → toast success / error

**Test:** button shows spinner → “OK (N ms)” or safe error.

**Empty state:** “Add a provider connection for BYOK. Platform env keys still power `*:platform:*` models.”

### 9.3 Models page `/admin/models`

**Sections**

1. **Org & override models** — table: Display, Ref, Kind, Connection, Enabled, Vision/Tools badges, sort, actions (Edit, Enable, Delete)
2. **Add model** — connection select (or “Platform override / no connection”), modelId, displayName, capabilities
3. **Platform catalog (read-only info)** — list default platform models with note “always available unless disabled by override or allowlist”
4. **Allowlist** — table + form: model select (from full catalog, not free text only), role select (All / owner / admin / member), Add; row delete

### 9.4 Pricing page `/admin/pricing` **(new route)**

**Sections**

1. **Platform defaults** (read-only table)
2. **Org overrides** — CRUD form: providerKind, pattern, input $/1M, output $/1M
3. **Help text:** “Org rows win over platform. Exact model id beats wildcards. Ollama typically has no price (cost null).”

### 9.5 Usage page (minimal touch)

Show cost formatted as `$X.XXXX` when `costMicros` present (`costMicros / 1e6`), not raw µ$ only — small fix while in area. Filters deferred.

### 9.6 UI engineering rules

- Thin routes; logic in `features/admin/*`
- Reuse `AdminShell`, `AdminTable`, `AdminGateFrame`, `Input`, `Button`
- Confirm dialogs for disable/delete/rotate
- No secrets in React state after successful submit (clear input)
- Accessible labels; errors `role="alert"`

---

## 10. Security & compliance

| Control | Requirement |
| --- | --- |
| Encryption | Existing AES-GCM; create/rotate require `ENCRYPTION_KEY` |
| Secret display | Never; only `hasCredentials` |
| Logs / audit meta | No apiKey, no ciphertext, no Authorization headers from probes |
| SSRF | All baseUrl through `assertSafeBaseUrl` on save + test + resolve |
| CSRF | `guardMutation` on all writes |
| RBAC | admin+owner; members cannot list connections (403) |
| Timing | Test connection errors generic where possible |
| Admin chat privacy | Unchanged — no message bodies in admin |

---

## 11. Audit events (complete list)

| Action | Resource | Meta (safe) |
| --- | --- |
| `provider.created` | provider_connection | kind, name |
| `provider.updated` | provider_connection | fields changed |
| `provider.rotated` | provider_connection | — |
| `provider.tested` | provider_connection | ok, latencyMs?, errorCode? |
| `provider.disabled` / `provider.enabled` | provider_connection | — |
| `provider.deleted` | provider_connection | kind, name |
| `model.created` | model | modelRef |
| `model.updated` | model | fields |
| `model.deleted` | model | modelRef |
| `model.allowlist_set` | model_allowlist | modelRef, role |
| `model.allowlist_deleted` | model_allowlist | modelRef, role |
| `price.created` / `updated` / `deleted` | model_price | providerKind, pattern, rates |

---

## 12. Test matrix (mandatory before “done”)

### 12.1 Unit (`packages/domain`)

- [ ] `matchPriceRow` exact > substring > `*`; org > platform
- [ ] Catalog merge: org BYOK + platform; override disables platform
- [ ] Allowlist unchanged cases
- [ ] Kind validation helpers (key/baseUrl required matrix)

### 12.2 Unit (`provider-gateway`)

- [ ] SSRF reject on save-path URLs used by test
- [ ] encrypt rotate decrypt roundtrip

### 12.3 Integration (`packages/db` / web handlers)

- [ ] Member cannot POST providers/models/prices
- [ ] Create connection stores non-plaintext
- [ ] Rotate changes ciphertext
- [ ] Disable connection → chat resolve fails for its models
- [ ] Allowlist enforcement on chat (existing + delete rule restores access when empty)
- [ ] Org price overrides platform for `cost_micros`
- [ ] Ollama connection with empty key allowed
- [ ] Unique model_ref conflict → CONFLICT
- [ ] Platform price rows cannot be deleted via org API

### 12.4 API / e2e (later Playwright)

- [ ] Admin happy path: create openai_compatible + model → appears in `/api/models` for admin
- [ ] Member sees allowlisted subset only
- [ ] Test connection ok/fail without crashing

### 12.5 Manual checklist

- [ ] UI: add Ollama + model → chat with local Ollama
- [ ] UI: set price → usage shows cost
- [ ] UI: secrets never in network response JSON

---

## 13. Work packages (implementation order)

### WP-A — Domain & price matching (S)

1. `matchPriceRow` + tests  
2. Catalog merge pure function `composeCatalog({ platform, orgModels })` + tests  
3. Provider kind validation pure helpers + tests  

**DoD:** unit green; no UI yet.

### WP-B — Repos (S–M)

1. Update/delete/rotate providers  
2. Update/delete models; ordered list  
3. Allowlist delete  
4. Prices CRUD org-scoped  
5. Wire `findPrice` to domain matcher  

**DoD:** integration tests green.

### WP-C — Admin APIs (M)

1. Expand providers handlers (PATCH, rotate, test, delete)  
2. Expand models handlers  
3. New `/api/admin/prices`  
4. Fix `GET /api/models` merge  
5. Zod validation modules under `apps/web/src/server/admin/` or `packages/domain`  

**DoD:** API integration / handler tests; member 403.

### WP-D — Admin UI Providers (M)

1. Full form + table actions  
2. Test/rotate/disable flows  
3. Clear errors / empty states  

### WP-E — Admin UI Models + Allowlist (M)

1. CRUD models  
2. Allowlist with selects + delete  
3. Platform catalog info panel  

### WP-F — Admin UI Pricing (S)

1. Route + nav link  
2. Platform RO + org CRUD  

### WP-G — Polish & docs (S)

1. Usage cost formatting  
2. `docs/plan.md` residual notes / WP13 checkboxes  
3. Runbook snippet: ENCRYPTION_KEY, BYOK, Ollama private URLs  
4. Copy this plan into `docs/admin-providers-models-pricing-plan.md`  
5. Optional Playwright stub  

**Recommended ship gates:** WP-A→C before UI; UI can land WP-D/E/F in parallel after C.

---

## 14. File-level change list (expected)

| Path | Change |
| --- | --- |
| `packages/domain/src/pricing.ts` | export matcher types; keep computeCostMicros |
| `packages/domain/src/pricing.test.ts` | matchPriceRow cases |
| `packages/domain/src/compose-catalog.ts` | **new** merge |
| `packages/domain/src/compose-catalog.test.ts` | **new** |
| `packages/domain/src/provider-connection-rules.ts` | **new** kind validation |
| `packages/domain/src/index.ts` | exports |
| `packages/db/src/repos/providers.ts` | update/delete/rotate/count |
| `packages/db/src/repos/prices.ts` | **new** or extend usage repo |
| `packages/db/src/repos/usage.ts` | findPrice uses matcher |
| `packages/provider-gateway/src/test-connection.ts` | **new** probe helpers |
| `apps/web/src/routes/api/admin/providers.ts` | full surface |
| `apps/web/src/routes/api/admin/models.ts` | full surface |
| `apps/web/src/routes/api/admin/prices.ts` | **new** |
| `apps/web/src/routes/api/models.ts` | merge catalog |
| `apps/web/src/routes/admin.providers.tsx` | real UI |
| `apps/web/src/routes/admin.models.tsx` | real UI |
| `apps/web/src/routes/admin.pricing.tsx` | **new** |
| `apps/web/src/features/admin/*` | forms, hooks, tables |
| `apps/web/src/features/admin/admin-shell.tsx` | Pricing nav |
| `docs/plan.md` | cross-link + mark WP13 depth |
| `docs/runbook.md` | short admin BYOK section |
| `docs/admin-providers-models-pricing-plan.md` | this plan (canonical in repo) |

No migration **required** if empty-string credentials OK for Ollama.  
**Optional migration:** `credentials_encrypted` nullable — only if we refuse empty ciphertext; prefer empty encrypted blob to avoid migration.

---

## 15. Acceptance criteria (product)

1. Admin adds OpenAI BYOK + multiple models → members with allowlist access see them; secrets never reappear.  
2. Admin adds `openai_compatible` with base URL + key → test passes → chat works.  
3. Admin adds Ollama base URL without key → test lists tags (if up) → model selectable.  
4. Admin disables a connection → its models fail resolve with safe error; other models work.  
5. Admin disables one model → hidden from picker; old threads still render.  
6. Empty allowlist → all enabled models; non-empty → subset; delete last rule → open again.  
7. Org price for exact modelId changes subsequent `cost_micros`; platform seed remains for others.  
8. Member hitting any admin provider/model/price API gets 403.  
9. Catalog merge: org with one BYOK model still sees platform models (unless allowlist/override says otherwise).  
10. Unit + integration suites for new code pass in CI.

---

## 16. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Test connection costs money / rate limits | Prefer models-list endpoints; short timeout; no automatic test on save |
| SSRF via baseUrl | Existing assertSafeBaseUrl; never disable for test path |
| Kind change would break modelRefs | kind immutable after create |
| Replace→merge surprises admins who relied on isolation | Document; allowlist can restrict to BYOK-only set |
| Empty Ollama credentials | Encrypt `""`; hasCredentials false if decrypted empty |
| Ambiguous price wildcards | A9b deterministic matcher + tests |
| Scope creep (budgets, SSO) | Explicit non-goals |

---

## 17. Open questions (resolve before / during WP-A)

Answer these in a short “Decisions” amendment when locked:

1. **A1 catalog merge** — approve merge (recommended) or keep replace?  
2. **Hard delete connections** — allow when models exist (null FKs) or block until models removed?  
3. **Test connection** — models list vs 1-token completion for OpenAI-class?  
4. **Pricing page path** — `/admin/pricing` vs tab under Models? (recommend dedicated route)  
5. **Platform model disable** — override row only, or explicit `hidden_platform_models` table? (recommend override row)  
6. **Import Ollama tags** — in scope for WP-D or follow-on? (recommend follow-on)

---

## 18. Approval checklist

- [x] Decisions A1–A15 accepted (proposed defaults)  
- [x] Open questions §17 answered (see locked table at top)  
- [x] WP order A→G accepted  
- [x] Non-goals confirmed (no budgets/SSO in this work)  
- [x] Ready to implement WP-A  
- [x] Plan copied to `docs/admin-providers-models-pricing-plan.md`

---

## 19. Implementation notes for the agent (after approval)

1. Do **not** start UI before domain matcher + merge + repos.  
2. Prefer small pure modules (<200 lines) per repo file-size rules.  
3. Every new endpoint: Zod + `guardMutation` + audit + org scope.  
4. Update this doc’s Status to `Approved` / `In progress` / `Done` as work proceeds.  
5. Cross-link from `docs/plan.md` §15 and WP13 when landing.  
6. First post-approval step: write the approved plan into `docs/admin-providers-models-pricing-plan.md`.

---

## 20. Summary for reviewers

| Layer | Depth after this plan ships |
| --- | --- |
| Schema | Already sufficient; optional Ollama empty-key convention only |
| Domain | Merge catalog + deterministic price match + kind rules |
| Repos | Full CRUD for connections, models, allowlist, org prices |
| APIs | Complete admin surface + fixed member catalog |
| UI | Real providers / models / pricing admin (not shells) |
| Security | Same crypto; test probe; SSRF; audits; no secret leakage |

**Correctness hotspots to challenge before coding:** A1 (merge), A9b (price order), A6 (delete policy), A5 (Ollama empty credentials), A11 (test probe shape).

---

*End of plan. Status = Approved; §17 locked. Next: WP-A (domain matcher + composeCatalog + kind rules).*
