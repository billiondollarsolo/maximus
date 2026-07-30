# Provider & model management plan

**Status:** draft for implementation  
**Date:** 2026-07-30  
**Context:** Maximus self-host chat; learn from OpenWebUI without copying marketplace/plugin sprawl.  
**Audience:** implementers (task-driven work packages)

---

## 1. Goals

1. **Chat picker shows only intentional offerings** — no demo placeholders, no auto-dump of every Ollama tag.
2. **Each offering is a full profile** — id, display name, capabilities, token limits, pricing, enable/visibility.
3. **Admin can discover then curate** — list tags / provider models in admin; register selected ones into chat.
4. **Older and newer models coexist** — per-model context / max output / Ollama `num_ctx` (and later sampling).
5. **Curated deploys** — hide raw bases, pin defaults, role allowlists (and later groups).
6. **Operable** — bulk actions, import/export, clear errors when context is exceeded.

### Non-goals (this plan)

- Community model marketplace  
- Fine-tuning / weight management  
- Multi-tenant superadmin platform catalog editor  
- Full OpenWebUI filter/plugin runtime  

---

## 2. Current state (baseline)

| Area | Today |
| --- | --- |
| Connection | BYOK: kind, baseUrl, encrypted secret, enable |
| Offering | modelId, displayName, modelRef, capabilities JSON, rates, enable |
| Capabilities | streaming, vision, imageGen, tools, **contextWindow**, **maxOutputTokens**, **numCtx** |
| Chat catalog | Platform models **only if keys**; org models **enabled** + allowlist; **no** auto Ollama dump |
| Admin add Ollama | Picker from `/api/tags` + custom id |
| Providers UI | Models always listed per connection; icon actions |
| Gateway | Passes max_tokens / num_predict / num_ctx from capabilities |
| Gaps | Pretty-name stripping tags; no `/api/show` prefill; no sampling; no agents; weak picker UX; embeddings not filtered |

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Connection (credentials + base URL)                        │
│    openai | anthropic | openai_compatible | ollama          │
└───────────────────────────┬─────────────────────────────────┘
                            │ discovers (admin only)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Provider model candidates (ephemeral or cached)            │
│    tags / remote list — NOT automatically in chat           │
└───────────────────────────┬─────────────────────────────────┘
                            │ admin imports / creates
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Org offering (models row)                                  │
│    modelRef, displayName, capabilities, params, pricing,    │
│    isEnabled, isVisible, sortOrder                          │
└───────────────────────────┬─────────────────────────────────┘
                            │ optional later
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Agent preset (workspace model)                             │
│    base modelRef + system prompt + tools + defaults         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                     Chat model picker
```

**Precedence for inference params**

1. Chat/session override (future)  
2. Offering `capabilities` / `params`  
3. Org global defaults (`org.settings.modelDefaults`)  
4. Code defaults (e.g. Anthropic max_tokens 4096)

---

## 4. Work packages (task-driven)

Each WP has: outcome, tasks, acceptance criteria, dependencies, estimate (S/M/L).

---

### WP-M0 — Full Ollama names (hotfix)

**Outcome:** UI never shows only the size tag (e.g. `4b`); always the full Ollama name/tag.

**Tasks**

1. [ ] `formatOllamaDisplayName` returns the full tag string (no strip-to-size, no drop of `:4b`).  
2. [ ] Admin Ollama picker primary label = full tag (`gemma3:4b`).  
3. [ ] Default `displayName` on pick = full tag (user can still rename).  
4. [ ] Chat model select: wider max-width + `title` tooltip with full name.  
5. [ ] Optional migration note: existing bad displayNames can be fixed in Edit or re-added.  
6. [ ] Unit test: `gemma3:4b` → `gemma3:4b`; `qwen2.5:1.5b` → `qwen2.5:1.5b`; `llama3.2:latest` → `llama3.2:latest`.

**Acceptance**

- Picker and admin list show full tags.  
- Two size variants of the same family remain distinguishable.

**Depends on:** nothing  
**Size:** S  

---

### WP-M1 — Prefill from Ollama `/api/show` + exclude non-chat models

**Outcome:** Adding an Ollama model suggests real limits and never offers embeddings as chat models by default.

**Tasks**

1. [ ] Gateway: `showOllamaModel({ baseUrl, name })` → parse `model_info` / `details` / `parameters` for context length when present.  
2. [ ] Admin `list_tags` response optionally include `{ name, family?, parameterSize?, isEmbed? }`.  
3. [ ] Heuristic: mark embeddings (`embed`, `nomic-embed`, `mxbai-embed`, `bge-`, capability flags).  
4. [ ] Add-model picker: hide embeds by default; toggle “Show embedding models”.  
5. [ ] On pick: prefill `contextWindow` / `numCtx` / `maxOutputTokens` (sensible defaults if unknown: 8192 / 2048).  
6. [ ] Chat catalog: exclude offerings with `capabilities.embedding === true` or `modality: "embed"`.  
7. [ ] Tests for show parser + embed filter.

**Acceptance**

- Embedding models not in chat dropdown unless explicitly allowed.  
- New Ollama offerings get non-empty context defaults when Ollama reports them.

**Depends on:** M0  
**Size:** M  

---

### WP-M2 — Searchable chat model picker + grouping

**Outcome:** Chat model control scales past ~10 offerings.

**Tasks**

1. [ ] Replace native `<select>` with accessible combobox (search + keyboard).  
2. [ ] Group options by connection name / platform.  
3. [ ] Show secondary line: full modelId if displayName differs.  
4. [ ] Empty state: “No models configured — Admin → Providers”.  
5. [ ] Keep capability badges (vision / image).  
6. [ ] A11y: listbox, aria-activedescendant, typeahead.  
7. [ ] Mobile: full-width sheet or sufficient max-width.

**Acceptance**

- Can filter “gemma” and pick `gemma3:4b` with keyboard only.  
- Groups clear when multiple connections exist.

**Depends on:** M0  
**Size:** M  

---

### WP-M3 — Org-wide model defaults

**Outcome:** Admins set once, apply to new offerings (and optionally bulk-update).

**Tasks**

1. [ ] Schema/settings: `org.settings.modelDefaults`  
   `{ contextWindow?, maxOutputTokens?, numCtx?, temperature?, topP? }`.  
2. [ ] Admin UI: Providers or Settings → “Default model params”.  
3. [ ] Create model: merge defaults under explicit form values.  
4. [ ] Runtime resolve: offering caps → org defaults → code defaults.  
5. [ ] Optional: “Apply defaults to all Ollama offerings” bulk action.  
6. [ ] Audit: `org.model_defaults_updated`.

**Acceptance**

- New Ollama model without filled context inherits org default.  
- Explicit per-model value still wins.

**Depends on:** M1 (nice), current capabilities  
**Size:** M  

---

### WP-M4 — Sampling & stop sequences

**Outcome:** Per-model (then chat) temperature / top_p / stop.

**Tasks**

1. [ ] Extend capabilities or sibling `params` jsonb:  
   `temperature`, `topP`, `topK`, `stop: string[]`, `frequencyPenalty`, `presencePenalty`.  
2. [ ] Admin Add/Edit form fields (collapsed “Advanced”).  
3. [ ] Gateway: map into OpenAI / Anthropic / Ollama option shapes.  
4. [ ] Validate ranges (temp 0–2, top_p 0–1).  
5. [ ] Tests per provider payload.  
6. [ ] Docs: which params each provider honors.

**Acceptance**

- Setting temperature 0 on an offering is visible in outbound request (test with mock fetch).  
- Invalid values rejected at API with clear error.

**Depends on:** M3 optional  
**Size:** M  

---

### WP-M5 — Chat-level param overrides

**Outcome:** User can tweak temp/max tokens for one conversation without changing org defaults.

**Tasks**

1. [ ] Conversation settings or composer “⋯ → Model params” sheet.  
2. [ ] Store on conversation: `settings.modelParams` jsonb (nullable = inherit).  
3. [ ] Merge into streamAssistant resolve order.  
4. [ ] Reset to model defaults control.  
5. [ ] RBAC: all members can override for their chats (org can lock later).

**Acceptance**

- Two chats same model, different max output, different provider payloads.  
- Clear UI that overrides are local to the chat.

**Depends on:** M4  
**Size:** M  

---

### WP-M6 — Import selected Ollama tags as offerings

**Outcome:** Admin multi-selects tags → bulk create models with defaults.

**Tasks**

1. [ ] UI: “Import from Ollama…” multi-select list (search, exclude embeds, exclude already-added).  
2. [ ] API: `POST /api/admin/providers` `action: import_tags` `{ id, names: string[], defaults? }`.  
3. [ ] Idempotent: skip existing modelRefs; return `{ created, skipped }`.  
4. [ ] Apply org defaults + optional shared rates.  
5. [ ] Audit event with counts (not full tag spam).  
6. [ ] Integration test.

**Acceptance**

- Import 5 tags → 5 offerings; re-import → 0 created, 5 skipped.  
- Chat only shows imported enabled offerings.

**Depends on:** M1, M3  
**Size:** M  

---

### WP-M7 — Visibility vs enable + defaults / pins

**Outcome:** Curated picker without deleting offerings.

**Tasks**

1. [ ] Schema: `is_visible` (default true) separate from `is_enabled`.  
2. [ ] Chat catalog: `isEnabled && isVisible` (+ allowlist).  
3. [ ] Runtime may still resolve enabled-but-hidden if already selected on old chat (define policy: allow continue vs force switch).  
4. [ ] Org settings: `defaultModelRefs[]`, `pinnedModelRefs[]`.  
5. [ ] New chat uses first accessible default, else first catalog entry.  
6. [ ] Admin toggles: Visible, Default, Pin.  
7. [ ] Docs: curated deploy pattern (hide raw base, show friendly name).

**Acceptance**

- Hidden model not in picker; disable hides and blocks new runs.  
- Default model pre-selected on empty composer.

**Depends on:** M2  
**Size:** M  

---

### WP-M8 — Agent presets (“workspace models”)

**Outcome:** Product surface = persona wrapping a base offering.

**Tasks**

1. [ ] Table `agent_presets`: orgId, name, slug, baseModelRef, systemPrompt, params jsonb, isEnabled, isVisible, access.  
2. [ ] Admin CRUD under Providers or new Agents page.  
3. [ ] Chat picker: list agents and/or base models (config flag).  
4. [ ] Runtime: inject system prompt + merge params on top of base offering.  
5. [ ] Access: reuse allowlist or agent-specific role rules.  
6. [ ] Fallback if base model disabled (clear error).  
7. [ ] Tests: prompt assembly + param merge.

**Acceptance**

- “Support bot” agent uses `gemma3:4b` with fixed system prompt.  
- Changing base offering params affects agent unless agent overrides.

**Depends on:** M4, M7  
**Size:** L  

---

### WP-M9 — Context budget & soft limits

**Outcome:** Fewer provider 400s; honest UX near limits.

**Tasks**

1. [ ] Estimate tokens (char/4 fallback; optional tiktoken later for OpenAI).  
2. [ ] Before stream: if estimate > `contextWindow - maxOutput - headroom`, either:  
   - **refuse** with actionable error, or  
   - **trim** oldest non-system messages (org setting).  
3. [ ] Default policy: refuse in v1 (safest); trim opt-in.  
4. [ ] UI: subtle “context high” when > 70% of window.  
5. [ ] Log/audit only on refuse (meta: modelRef, estimated tokens).  
6. [ ] Tests with synthetic long history.

**Acceptance**

- Oversized history never silently drops without policy.  
- Error text tells user to start a new chat or raise context.

**Depends on:** M1 (contextWindow populated)  
**Size:** L  

---

### WP-M10 — Bulk ops + import/export

**Outcome:** Backup and mass-edit offerings.

**Tasks**

1. [ ] Export JSON: connections metadata (no secrets) + models + allowlist + prices.  
2. [ ] Import JSON with dry-run + apply; conflict strategy (skip/overwrite).  
3. [ ] Bulk: enable/disable, set context defaults, delete (with confirm).  
4. [ ] Admin filters: enabled/disabled, kind, missing contextWindow.  
5. [ ] Audit bulk actions with counts.

**Acceptance**

- Round-trip export/import on empty org restores model list.  
- Secrets never appear in export.

**Depends on:** M3, M7  
**Size:** M  

---

### WP-M11 — Access control polish

**Outcome:** Allowlists usable at scale; path to groups.

**Tasks**

1. [ ] Allowlist UI: pick from full offering list (searchable), not free-typed refs only.  
2. [ ] Show effective access matrix (role × model).  
3. [ ] Document empty allowlist = all enabled.  
4. [ ] Design only (no code): project/group-scoped models for later WP.

**Acceptance**

- Admin can allowlist `gemma3:4b` for members without typing modelRef.

**Depends on:** M2  
**Size:** S–M  

---

### WP-M12 — Observability & docs

**Outcome:** Operators understand model config and failures.

**Tasks**

1. [ ] Runbook: Ollama private URLs, `num_ctx` cold start, context errors.  
2. [ ] Overview attention: “N offerings missing contextWindow”.  
3. [ ] API docs: capabilities shape + resolve order.  
4. [ ] Security review: params cannot smuggle secrets; SSRF unchanged.

**Depends on:** M9 partial  
**Size:** S  

---

## 5. Suggested implementation order

```
M0  Full names                          ──┐
M1  /api/show + embed filter            ──┼─► M2 Searchable picker
M3  Org defaults                        ──┤
M4  Sampling params                     ──┼─► M5 Chat overrides
M6  Bulk import tags                    ──┘
M7  Visibility + pins                  ──► M8 Agents
M9  Context budget
M10 Bulk export/import
M11 Allowlist UX
M12 Docs / ops
```

**MVP slice for “feels like OpenWebUI without the bloat”:**  
**M0 → M1 → M2 → M3 → M6 → M4** (then M7/M9 as quality).

---

## 6. Data / API contracts (target)

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
  "stop": ["User:"]
}
```

Unknown keys ignored by parser (forward compatible).

### 6.2 Resolve order (runtime)

```
effectiveParams = merge(
  CODE_DEFAULTS,
  org.settings.modelDefaults,
  offering.capabilities,
  conversation.settings.modelParams  // future
)
```

### 6.3 Admin APIs (additive)

| Action | Purpose |
| --- | --- |
| `list_tags` | Exists — extend with metadata |
| `show_model` | Ollama `/api/show` detail |
| `import_tags` | Bulk create offerings |
| `GET/PATCH model-defaults` | Org defaults |

---

## 7. Testing strategy

| Layer | Coverage |
| --- | --- |
| Domain | parse/merge capabilities; embed filter; name formatting |
| Gateway | request body includes max_tokens / num_ctx / temperature (mock fetch) |
| DB/API | create/patch capabilities; import idempotency; catalog membership |
| UI | add from picker; edit limits; models always visible on providers page |
| E2E | Ollama connection → import one tag → chat lists only that tag |

---

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Large `num_ctx` makes Ollama feel “broken” (slow) | UI warning; default 8k; document cold start |
| Wrong context from `/api/show` | Prefer admin edit; never hard-fail on missing |
| Agents bypass allowlists | Always enforce on base modelRef |
| Param sprawl | Keep advanced collapsed; org defaults reduce form fatigue |
| Truncation policy wars | Start with refuse + clear error; trim opt-in |

---

## 9. Success metrics

- Chat picker count equals **enabled visible offerings** (manual audit).  
- Zero “demo” platform models without keys.  
- Admin can go from empty Ollama → 1 registered model → successful chat in &lt; 2 minutes.  
- Context-exceeded errors include model name and suggested fix.  
- No embedding models in default chat picker.

---

## 10. Immediate next step

Implement **WP-M0** (full names) if not already merged, then **WP-M1** (show + embed filter) and **WP-M2** (searchable picker) as the next stack.

This document is the backlog source of truth for provider/model work; update WP checkboxes as tasks land.
