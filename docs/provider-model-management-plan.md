# Provider & model management — implementation plan

**Status:** active implementation backlog  
**Date:** 2026-07-30 (rev 2 — task-driven, code-aware)  
**Audience:** implementers shipping Maximus self-host model ops  
**Related:** `docs/admin-providers-models-pricing-plan.md`, `docs/runbook.md`, `docs/api.md`

---

## 0. How to use this document

1. **One WP at a time** unless noted parallel-safe.  
2. Each task is **checkbox + concrete artifact** (file, API action, test name).  
3. Do not mark a WP done until **acceptance** and **verification** both pass.  
4. Prefer small PRs: domain → gateway → db/API → UI → docs.  
5. Never invent demo platform models; never auto-dump Ollama tags into chat.

### Definition of done (every WP)

- [ ] Code + unit/integration tests green  
- [ ] Typecheck clean for touched packages  
- [ ] Acceptance criteria checked against live or mock path  
- [ ] No secrets in logs/export  
- [ ] This doc’s WP checkboxes updated  

---

## 1. Goals

| # | Goal | User-visible signal |
| --- | --- | --- |
| G1 | **Intentional chat catalog** | Picker = enabled + visible offerings only (platform only with keys) |
| G2 | **Full offering profiles** | Each model has name, caps, limits, rates, enable/visibility |
| G3 | **Discover → curate** | Admin lists Ollama tags; chat only sees imported offerings |
| G4 | **Coexist old/new models** | Per-model `contextWindow` / `maxOutput` / `numCtx` / sampling |
| G5 | **Curated deploys** | Hide raw bases, pin defaults, allowlists, agent presets |
| G6 | **Operable** | Import/export, bulk ops, context refuse with clear errors |
| G7 | **Honest labels** | Stats footer and pickers show **full** model ids (`gemma3:4b`, never `4b`) |

### Non-goals

- Community marketplace / plugins  
- Fine-tuning / weight management  
- Superadmin multi-tenant platform catalog editor  
- Full OpenWebUI filter runtime  

---

## 2. Current codebase inventory (2026-07-30)

Use this to skip rework. Update as WPs land.

| Surface | Status | Key paths |
| --- | --- | --- |
| Full Ollama display names (`formatOllamaDisplayName`) | **Done** | `packages/domain/src/platform-catalog.ts` |
| Stats footer full model id (`modelIdFromRef`) | **Done** | `packages/domain/src/model-ref.ts`, `apps/web/src/features/chat/message-list.tsx` |
| Chat catalog composition (no auto tags) | **Done** | `packages/domain/src/models-for-user.ts`, `apps/web/src/server/build-model-catalog.ts` |
| Embed heuristic + filter | **Done** | `packages/domain/src/embed-heuristic.ts` |
| Capabilities parse/merge + sampling fields | **Mostly done** | `packages/domain/src/model-capabilities.ts` |
| Org model defaults | **Mostly done** | `packages/domain/src/model-defaults.ts`, `api/admin/model-defaults.ts` |
| Gateway body builder (limits + sampling) | **Mostly done** | `packages/provider-gateway/src/build-provider-body.ts` |
| Ollama `list_tags` / `show_model` / `import_tags` | **Mostly done** | `list-ollama-models.ts`, `show-ollama-model.ts`, `api/admin/providers.ts` |
| `is_visible` + agents schema | **Mostly done** | migration `003_model_visibility_agents.sql`, repos |
| Searchable model select | **Mostly done** | `apps/web/src/features/chat/model-select.tsx` |
| Context refuse | **Mostly done** | `packages/domain/src/context-budget.ts`, `stream-assistant.ts` |
| Catalog export/import | **Partial** | domain + `api/admin/catalog-export.ts` — UI polish TBD |
| Agents admin UI | **Partial** | API exists; UI depth TBD |
| Chat-level param overrides | **Partial** | `conversations.settings` column; composer sheet TBD |
| Docs / runbook for model ops | **Partial** | this plan; runbook gaps |
| End-to-end verification + scratch evidence | **Open** | suite ×2, typecheck logs |

---

## 3. Target architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Connection (BYOK: kind, baseUrl, secret, enable)            │
│    openai | anthropic | openai_compatible | ollama           │
└────────────────────────────┬─────────────────────────────────┘
                             │ admin-only discover
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Provider candidates (ephemeral list_tags / remote list)     │
│  NEVER auto-injected into chat catalog                       │
└────────────────────────────┬─────────────────────────────────┘
                             │ import_tags / create model
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Org offering (models row)                                   │
│  modelRef, displayName, capabilities, rates,                 │
│  isEnabled, isVisible, sortOrder                             │
└────────────────────────────┬─────────────────────────────────┘
                             │ optional
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Agent preset                                                │
│  baseModelRef + systemPrompt + param overrides + access      │
└────────────────────────────┬─────────────────────────────────┘
                             ▼
                      Chat model picker
                 (enabled ∧ visible ∧ allowlist ∧ ¬embed)
```

### Inference param resolve order (hard rule)

```
effective = merge(
  CODE_DEFAULTS,                    // e.g. Anthropic max_tokens 4096
  org.settings.modelDefaults,       // org-wide
  offering.capabilities,            // per-model (wins over org)
  agent.params,                     // if agent selected
  conversation.settings.modelParams // chat override (wins)
)
```

Later layers win for defined keys only (null/undefined = inherit).

### Model ref contract

```
{providerKind}:{connectionId}:{modelId}
```

- `modelId` **may contain colons** (Ollama tags: `gemma3:4b`, `library/llama3.2:latest`).  
- **Never** label UI with `ref.split(":").pop()` — that shows `4b`.  
- Always use `parseModelRef` / `modelIdFromRef` / `formatOllamaDisplayName`.

---

## 4. Work packages (task-driven)

Sizes: **S** ≤ 0.5 day · **M** 0.5–2 days · **L** 2–4 days.

---

### WP-M0 — Full model names everywhere

**Outcome:** No surface shows only the size/quant suffix for Ollama (or any multi-colon model id).

**Why:** `ollama:conn:gemma3:4b` + naive `.pop()` → `4b`. Operators and users cannot tell variants apart.

#### Tasks

- [x] **M0.1** `formatOllamaDisplayName(name)` returns full trimmed tag.  
  File: `packages/domain/src/platform-catalog.ts`  
  Tests: `platform-catalog.test.ts` (`gemma3:4b`, `qwen2.5:1.5b`, `llama3.2:latest`).

- [x] **M0.2** `modelIdFromRef(ref)` returns full `modelId` after second colon.  
  File: `packages/domain/src/model-ref.ts`  
  Export from `packages/domain/src/index.ts`  
  Tests: `model-ref.test.ts`.

- [x] **M0.3** Generation stats footer uses `modelIdFromRef` + `title={modelRef}`.  
  File: `apps/web/src/features/chat/message-list.tsx`  
  Accept: footer shows `gemma3:4b` not `4b`.

- [x] **M0.4** Model select secondary line uses `modelIdFromRef`.  
  File: `apps/web/src/features/chat/model-select.tsx`.

- [ ] **M0.5** Grep guard — no remaining `.split(":").pop()` for model labels.  
  ```bash
  rg 'split\(":"\)\.pop\(\)' apps packages --glob '*.{ts,tsx}'
  ```
  Fix any hits used for display.

- [ ] **M0.6** Admin Ollama picker / import list primary label = full tag; default `displayName` = full tag.  
  File: `apps/web/src/features/admin/providers-admin.tsx` (`formatOllamaLabel`).

- [ ] **M0.7** Optional note in runbook: existing bad `displayName` values can be renamed in Edit.

#### Acceptance

- Stats footer for `ollama:*:gemma3:4b` shows `gemma3:4b`.  
- Two size variants remain distinguishable in picker and stats.  
- Unit tests green for M0.1–M0.2.

#### Verification

```bash
pnpm --filter @maximus/domain exec vitest run src/model-ref.test.ts src/platform-catalog.test.ts
rg 'split\(":"\)\.pop\(\)' apps/web packages --glob '*.{ts,tsx}'
```

**Depends on:** nothing · **Size:** S

---

### WP-M1 — Ollama `/api/show` prefill + exclude non-chat models

**Outcome:** Adding Ollama models suggests real limits; embeddings never land in chat by default.

#### Tasks

- [x] **M1.1** Gateway `showOllamaModel({ baseUrl, name })` → context / family / parameterSize / isEmbed.  
  Files: `packages/provider-gateway/src/show-ollama-model.ts` + tests.

- [x] **M1.2** `listOllamaModels` returns metadata (`parameterSize`, family, embed heuristic).  
  Files: `list-ollama-models.ts` + tests.

- [x] **M1.3** Domain embed heuristic (`isEmbeddingModelName`, capability `embedding` / modality).  
  Files: `embed-heuristic.ts`, `model-capabilities.ts`.

- [x] **M1.4** Admin API `list_tags` / `show_model` actions.  
  File: `apps/web/src/routes/api/admin/providers.ts`.

- [ ] **M1.5** Add-model dialog: hide embeds by default; toggle “Show embedding models”.  
  On pick: call `show_model` (or use tag metadata) to prefill `contextWindow` / `numCtx` / `maxOutputTokens` (fallback 8192 / 8192 / 2048).  
  File: `providers-admin.tsx`.

- [x] **M1.6** Chat catalog excludes embeddings.  
  File: `models-for-user.ts` / `compose-catalog` path.

- [ ] **M1.7** Integration: mock show + form prefill path covered by test or documented manual checklist.

#### Acceptance

- Embedding tags not in chat dropdown unless explicitly allowed.  
- New Ollama offering gets non-empty context when Ollama reports it.  
- `show_model` failure degrades gracefully (empty prefill, no crash).

#### Verification

```bash
pnpm --filter @maximus/provider-gateway exec vitest run src/show-ollama-model.test.ts src/list-ollama-models.test.ts
pnpm --filter @maximus/domain exec vitest run src/embed-heuristic.test.ts src/models-for-user.test.ts
```

**Depends on:** M0 · **Size:** M

---

### WP-M2 — Searchable chat model picker + grouping

**Outcome:** Chat model control scales past ~10 offerings with keyboard a11y.

#### Tasks

- [x] **M2.1** Combobox: search, keyboard nav, listbox roles.  
  File: `model-select.tsx`.

- [x] **M2.2** Group by connection name / platform.  
- [x] **M2.3** Secondary line when `displayName !== modelId`.  
- [ ] **M2.4** Empty state copy: “No models configured — Admin → Providers”.  
- [x] **M2.5** Capability badges (vision / image) near control.  
- [ ] **M2.6** A11y pass: `aria-activedescendant`, typeahead, focus trap on open.  
- [ ] **M2.7** Mobile: dropdown min width / full-width on small screens.  
- [ ] **M2.8** Manual script: filter “gemma”, arrow keys, Enter selects.

#### Acceptance

- Keyboard-only pick of `gemma3:4b`.  
- Groups clear with multiple connections.  
- Empty org shows actionable empty state.

**Depends on:** M0 · **Size:** M

---

### WP-M3 — Org-wide model defaults

**Outcome:** Admins set defaults once; new offerings inherit; explicit per-model still wins.

#### Tasks

- [x] **M3.1** Schema/settings shape: `org.settings.modelDefaults`  
  `{ contextWindow?, maxOutputTokens?, numCtx?, temperature?, topP?, topK?, stop? }`.  
  Files: `model-defaults.ts` + tests.

- [x] **M3.2** API `GET/PATCH` model-defaults (admin).  
  File: `apps/web/src/routes/api/admin/model-defaults.ts`.

- [ ] **M3.3** Admin UI: “Default model params” panel (Providers or Settings).  
- [x] **M3.4** Create / import merges defaults under explicit form values.  
- [x] **M3.5** Runtime resolve in `stream-assistant.ts` (org → offering).  
- [ ] **M3.6** Optional bulk: “Apply defaults to all Ollama offerings”.  
- [ ] **M3.7** Audit: `org.model_defaults_updated`.

#### Acceptance

- New Ollama model without filled context inherits org default.  
- Explicit per-model value still wins at stream time.

#### Verification

```bash
pnpm --filter @maximus/domain exec vitest run src/model-defaults.test.ts src/model-capabilities.test.ts
```

**Depends on:** M1 (nice) · **Size:** M

---

### WP-M4 — Sampling & stop sequences

**Outcome:** Per-model (then chat) temperature / top_p / stop flow to providers.

#### Tasks

- [x] **M4.1** Capabilities/params: `temperature`, `topP`, `topK`, `stop[]`, penalties.  
  File: `model-capabilities.ts` + `validateSamplingParams`.

- [ ] **M4.2** Admin Add/Edit: collapsed “Advanced sampling” fields + validation errors.  
  File: `providers-admin.tsx`.

- [x] **M4.3** Gateway maps into OpenAI / Anthropic / Ollama shapes.  
  File: `build-provider-body.ts` + tests.

- [ ] **M4.4** Document which params each provider honors (`docs/api.md` or runbook).  
- [ ] **M4.5** Mock-fetch test: temperature `0` appears on outbound body for each kind.

#### Acceptance

- Setting temperature 0 on an offering is visible in outbound request.  
- Invalid ranges rejected at API with clear error.

**Depends on:** M3 optional · **Size:** M

---

### WP-M5 — Chat-level param overrides

**Outcome:** User tweaks temp/max tokens for one conversation without changing org defaults.

#### Tasks

- [x] **M5.1** DB: `conversations.settings` jsonb (migration 003).  
- [ ] **M5.2** Composer “⋯ → Model params” sheet (temp, max out, reset).  
- [ ] **M5.3** Persist via conversation patch API; null fields = inherit.  
- [ ] **M5.4** Merge into `stream-assistant` resolve order (top layer).  
- [ ] **M5.5** UI badge: “Custom params” when override active.  
- [ ] **M5.6** Tests: two chats same model, different max output → different payloads.

#### Acceptance

- Overrides local to chat; reset restores model defaults.  
- Members can override (org lock deferred).

**Depends on:** M4 · **Size:** M

---

### WP-M6 — Import selected Ollama tags as offerings

**Outcome:** Admin multi-selects tags → bulk create with defaults; chat stays intentional.

#### Tasks

- [x] **M6.1** API `import_tags` `{ id, names[], defaults? }` → `{ created, skipped }`.  
  Idempotent on modelRef.  
  File: `providers.ts` route.

- [x] **M6.2** Skip embeds by default (`isVisible: !isEmbed` or skip create).  
- [ ] **M6.3** UI: “Import from Ollama…” multi-select, search, exclude already-added, exclude embeds toggle.  
  File: `providers-admin.tsx` (partial — harden).

- [ ] **M6.4** After import, toast with counts; refresh models list.  
- [x] **M6.5** Audit `provider.import_tags` with counts (not full tag spam).  
- [ ] **M6.6** Integration test: import 5 → re-import 0 created / 5 skipped.

#### Acceptance

- Import 5 tags → 5 offerings; re-import → 0 created.  
- Chat only shows imported enabled visible offerings.

**Depends on:** M1, M3 · **Size:** M

---

### WP-M7 — Visibility vs enable + defaults / pins

**Outcome:** Curate picker without deleting offerings.

#### Tasks

- [x] **M7.1** Schema `is_visible` (default true) ≠ `is_enabled`.  
  Migration: `003_model_visibility_agents.sql`.

- [x] **M7.2** Chat catalog: `isEnabled && isVisible` (+ allowlist, −embed).  
  File: `models-for-user.ts`.

- [ ] **M7.3** Policy for old chats on hidden models: **allow continue if enabled**, hide from picker only. Document.  
- [ ] **M7.4** Org settings: `defaultModelRefs[]`, `pinnedModelRefs[]`.  
- [ ] **M7.5** New chat: first accessible default → else first catalog entry.  
- [x] **M7.6** Admin toggle Visible (partial in providers UI).  
- [ ] **M7.7** Admin Default / Pin toggles + sort pins to top of picker.  
- [ ] **M7.8** Docs: curated deploy pattern (hide raw base, friendly displayName).

#### Acceptance

- Hidden model not in picker; disable blocks **new** runs.  
- Default model pre-selected on empty composer.

**Depends on:** M2 · **Size:** M

---

### WP-M8 — Agent presets (“workspace models”)

**Outcome:** Personas wrap a base offering (system prompt + params + access).

#### Tasks

- [x] **M8.1** Table/repo `agent_presets` (orgId, name, slug, baseModelRef, systemPrompt, params, flags).  
  Migration 003 + `packages/db/src/repos/agents.ts`.

- [x] **M8.2** Resolve: inject system prompt + merge params; error if base disabled.  
  File: `agents.resolve.test.ts`.

- [x] **M8.3** Admin API CRUD.  
  File: `apps/web/src/routes/api/admin/agents.ts`.

- [ ] **M8.4** Admin UI page or Providers sub-tab for agents.  
- [ ] **M8.5** Chat picker: list agents (config: agents-only / both / models-only).  
- [ ] **M8.6** Access: reuse model allowlist on baseModelRef (never bypass).  
- [ ] **M8.7** Tests: prompt assembly + param merge + disabled base error message.

#### Acceptance

- “Support bot” agent uses `gemma3:4b` + fixed system prompt.  
- Disabled base → clear error, no silent fallback to another model.

**Depends on:** M4, M7 · **Size:** L

---

### WP-M9 — Context budget & soft limits

**Outcome:** Fewer provider 400s; honest UX near limits.

#### Tasks

- [x] **M9.1** Token estimate (char/4 fallback).  
  File: `context-budget.ts` + tests.

- [x] **M9.2** Before stream: if estimate > `contextWindow - maxOutput - headroom` → **refuse**.  
  File: `stream-assistant.ts`.

- [ ] **M9.3** Error copy: model full name, estimated tokens, “start new chat or raise context”.  
- [ ] **M9.4** Org setting later: trim opt-in (v1 refuse only — keep).  
- [ ] **M9.5** UI “context high” when > 70% of window (composer hint).  
- [ ] **M9.6** Audit/meta on refuse only (`modelRef`, estimated tokens).  
- [ ] **M9.7** Synthetic long-history unit test through stream path (mock).

#### Acceptance

- Oversized history never silently drops.  
- Error includes full model name (not `4b`) and suggested fix.

**Depends on:** M1 (context populated) · **Size:** L

---

### WP-M10 — Bulk ops + import/export

**Outcome:** Backup and mass-edit offerings without secrets.

#### Tasks

- [x] **M10.1** Domain export shape (connections metadata, models, allowlist, prices — **no secrets**).  
  Files: `catalog-export.ts` + tests.

- [x] **M10.2** API export/import endpoints.  
  File: `api/admin/catalog-export.ts`, `repos/catalog-export.ts`.

- [ ] **M10.3** UI: Export JSON download; Import dry-run + apply (skip/overwrite).  
- [ ] **M10.4** Bulk: enable/disable, set context defaults, delete w/ confirm.  
- [ ] **M10.5** Admin filters: enabled/disabled, kind, missing `contextWindow`.  
- [ ] **M10.6** Audit bulk with counts.  
- [ ] **M10.7** Security test: export fixture never contains `apiKey` / ciphertext blobs.

#### Acceptance

- Round-trip on empty org restores model list.  
- Secrets never appear in export.

**Depends on:** M3, M7 · **Size:** M

---

### WP-M11 — Access control polish

**Outcome:** Allowlists usable at scale.

#### Tasks

- [ ] **M11.1** Allowlist UI: searchable pick from full offering list (not free-typed refs only).  
  File: access-admin (Input path).

- [ ] **M11.2** Show effective access matrix (role × model) read-only view.  
- [ ] **M11.3** Document: empty allowlist = all enabled+visible models.  
  File: `docs/api.md` or runbook.  
- [ ] **M11.4** Design note only: project/group-scoped models (no code).

#### Acceptance

- Admin can allowlist `gemma3:4b` for members without typing full modelRef.

**Depends on:** M2 · **Size:** S–M

---

### WP-M12 — Observability & docs

**Outcome:** Operators understand model config and failures.

#### Tasks

- [ ] **M12.1** Runbook section: private Ollama URLs, `num_ctx` cold start, context refuse, full model names in stats.  
  File: `docs/runbook.md`.

- [ ] **M12.2** Overview attention: “N offerings missing contextWindow”.  
  Files: overview domain/API if not already.

- [ ] **M12.3** API docs: capabilities shape + resolve order.  
  File: `docs/api.md`.

- [ ] **M12.4** Security note: params cannot smuggle secrets; SSRF allowlist unchanged.  
  Cross-link `docs/security-self-host.md`.

- [ ] **M12.5** Update this plan’s inventory table after each release.

#### Acceptance

- New operator can configure Ollama → import → chat using docs only.  
- No undocumented admin-only actions for core path.

**Depends on:** M9 partial · **Size:** S

---

## 5. Implementation phases (recommended)

```
Phase A — Labels & catalog truth (ship first)
  M0 full names ──► M1 show + embed ──► M2 picker polish

Phase B — Params pipeline
  M3 org defaults ──► M4 sampling ──► M5 chat overrides

Phase C — Curation at scale
  M6 import tags ──► M7 visibility/pins ──► M11 allowlist UX

Phase D — Product surface
  M8 agents

Phase E — Ops hardness
  M9 context budget ──► M10 export/import ──► M12 docs
```

**MVP “feels like OpenWebUI without bloat”:**  
**M0 → M1 → M2 → M3 → M6 → M4** then M7/M9 for quality.

Parallel-safe after Phase A domain stabilizes: M11 UI with M6; M12 docs anytime.

---

## 6. Data / API contracts

### 6.1 `models.capabilities` (jsonb)

```json
{
  "streaming": true,
  "vision": false,
  "tools": false,
  "imageGen": false,
  "embedding": false,
  "contextWindow": 8192,
  "maxOutputTokens": 2048,
  "numCtx": 8192,
  "temperature": 0.7,
  "topP": 0.9,
  "topK": 40,
  "stop": ["User:"],
  "frequencyPenalty": 0,
  "presencePenalty": 0
}
```

Unknown keys ignored (forward compatible). Parser: `parseCapabilities` / `buildCapabilities`.

### 6.2 Admin provider actions (additive)

| Action | Body | Result |
| --- | --- | --- |
| `list_tags` | `{ id }` | `{ tags: [{ name, parameterSize?, family?, isEmbed? }] }` |
| `show_model` | `{ id, modelName }` | show payload + parsed limits |
| `import_tags` | `{ id, names: string[] }` | `{ created, skipped }` |

### 6.3 Other admin routes

| Route | Purpose |
| --- | --- |
| `GET/PATCH /api/admin/model-defaults` | Org defaults |
| `CRUD /api/admin/agents` | Agent presets |
| `GET/POST /api/admin/catalog-export` | Secret-free export/import |
| `PATCH /api/admin/models` | caps, rates, enable, visible |

### 6.4 Chat catalog rules (non-negotiable)

1. Platform models only when corresponding keys exist.  
2. Org offerings: `isEnabled && isVisible && !embedding`.  
3. Allowlist: empty = all pass; non-empty = intersection.  
4. Never merge live Ollama `/api/tags` into chat catalog.  
5. Display: full tag / full modelId via domain helpers.

---

## 7. Testing strategy

| Layer | What to cover | Commands |
| --- | --- | --- |
| Domain | names, caps merge, embed, defaults, budget, catalog filter | `pnpm --filter @maximus/domain test` |
| Gateway | body shapes for openai/anthropic/ollama; show/list parsers | `pnpm --filter @maximus/provider-gateway test` |
| DB | visibility, agents resolve, import idempotency | `pnpm --filter @maximus/db test` |
| Web unit | catalog build, route handlers where unit-tested | `pnpm --filter @maximus/web test` |
| Typecheck | monorepo | `pnpm -r typecheck` (or package filters) |
| Manual E2E | Ollama connect → import one tag → chat lists only that → stats show full name | browser / compose |

### Evidence (for goal/completion runs)

Write under scratch implementer dir (or CI artifacts):

| Log | Contents |
| --- | --- |
| `provider-model-tests.log` | domain + gateway + db unit results |
| `gateway-payloads.log` | build-provider-body test output |
| `admin-ops.log` | import_tags / show_model / export dry notes |
| `typecheck.log` | typecheck |
| `tests-run1.log` / `tests-run2.log` | full suite twice |

### Regression greps (M0 forever)

```bash
# Forbidden pattern for model labels
rg 'split\(":"\)\.pop\(\)' apps packages --glob '*.{ts,tsx}'

# Ensure helpers stay exported
rg 'modelIdFromRef|formatOllamaDisplayName' packages/domain/src/index.ts
```

---

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Large `num_ctx` makes Ollama feel “down” | UI warning; default 8k; runbook cold-start note |
| Wrong context from `/api/show` | Prefill only; admin can edit; never hard-fail |
| Agents bypass allowlists | Always enforce on `baseModelRef` |
| Param sprawl | Advanced collapsed; org defaults reduce form fatigue |
| Silent truncation | Refuse-only v1; trim opt-in later |
| Truncated model labels (`4b`) | `modelIdFromRef` + grep guard |
| Secrets in export | Schema denylist + unit test fixture |
| Migration 003 missing on old DBs | Document migrate path; Helm post-install job |

---

## 9. Success metrics

- Chat picker count equals **enabled ∧ visible ∧ non-embed** offerings (manual audit).  
- Zero demo platform models without keys.  
- Empty Ollama → 1 registered model → successful chat in **&lt; 2 minutes**.  
- Context-exceeded errors include **full** model name + suggested fix.  
- Generation stats show `gemma3:4b` not `4b`.  
- No embedding models in default chat picker.  
- Export contains zero secret material.

---

## 10. Task board (copy for session todos)

Use as sprint checklist; mark in this file when done.

**Phase A**

- [ ] M0.5–M0.7 remaining greps + admin labels + runbook note  
- [ ] M1.5, M1.7 prefill UI + checklist  
- [ ] M2.4, M2.6–M2.8 empty state + a11y + mobile  

**Phase B**

- [ ] M3.3, M3.6–M3.7 defaults UI + bulk + audit  
- [ ] M4.2, M4.4–M4.5 sampling UI + docs + mock payload  
- [ ] M5.2–M5.6 chat override sheet  

**Phase C**

- [ ] M6.3–M6.4, M6.6 import UI polish + test  
- [ ] M7.3–M7.5, M7.7–M7.8 pins/defaults policy  
- [ ] M11.1–M11.3 allowlist pick + docs  

**Phase D**

- [ ] M8.4–M8.7 agents UI + picker + tests  

**Phase E**

- [ ] M9.3–M9.7 refuse copy + high-water UI + audit  
- [ ] M10.3–M10.7 export UI + bulk + secret test  
- [ ] M12.1–M12.5 runbook/api/overview  

**Verify**

- [ ] Suite ×2 + typecheck + evidence logs  

---

## 11. Immediate next steps

1. **Ship M0 remaining greps** (confirm no other truncated labels).  
2. **Close M1.5** (show prefill in add dialog).  
3. **M2 empty state + a11y** for chat picker.  
4. Run verification suite and attach evidence if this is a completion goal.  

This document is the backlog source of truth for provider/model work. Update inventory (§2) and checkboxes when tasks land.
