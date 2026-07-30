# Vision Models & Image Generation — Implementation Plan

**Status:** Implemented (WP-S through G3 core; live vendor optional)  
**Date:** 2026-07-30  
**Canonical path:** `docs/vision-and-image-gen-plan.md`  
**Related:** `docs/plan.md` §14 (attachments), §10 (provider gateway), §13 (UI), §43 (RAG — **out of scope**), platform catalog capabilities; admin model `capabilities.vision`  
**Depends on (shipped):** attachments table + presigned PUT, content parts (`text` | `image` | `file`), composer attach, model picker Vision badge, live HTTP adapters (text-only today)

---

## 0. Executive summary

| Capability | User goal | Today | Target after this plan |
| --- | --- | --- | --- |
| **Vision** | Attach image → model *sees* pixels and answers | Upload + `image` content part; provider gets text stub | Real multimodal chat payloads for vision-capable models; UI gate + thumbnails |
| **Image generation** | Prompt → model *creates* image in thread | None | Models with `imageGen` call image APIs; result stored as attachment; rendered in UI |

**Not this plan:** RAG, PDF OCR pipelines, video, canvas/edit history, fine-tuning, client-side API keys.

**Review goal:** Lock product decisions (§1), architecture (§2–4), work packages (§10), and acceptance criteria (§11) before any code.

---

## 1. Locked product decisions (approve / amend)

| ID | Decision | Proposed default | Reasoning |
| --- | --- | --- | --- |
| **V1** | Vision only when model has `capabilities.vision === true` | **Hard gate** server + UI | Soft-fail (text stub) confuses users (“model ignored my image”) |
| **V2** | Non-vision model + image attachment | **Reject send** with clear error | Better than silent degradation |
| **V3** | Vision media types (MVP) | `image/png`, `image/jpeg`, `image/webp`, `image/gif` only | Matches uploads allowlist; PDF as file stays non-vision |
| **V4** | How images are sent to providers | Prefer **base64** for small images; optional **signed GET URL** if `VISION_IMAGE_TRANSPORT=url` and provider supports public/signed fetch | Base64 works offline/private Ollama; URL saves tokens on large files when network allows |
| **V5** | Max vision payload | **10 MB** per image for vision path (stricter than general 25 MB upload) | Provider limits + latency |
| **V6** | History re-send | Each turn, **re-resolve** attachments on the active branch from DB/S3 when building multimodal history | Correctness over cache complexity for MVP |
| **V7** | Fake / CI mode | Fake adapter accepts multimodal messages; returns scripted text without decoding images | E2E without live vision APIs |
| **G1** | Image gen product shape | **Capability-gated chat models** with `imageGen: true` — same composer; server routes to image API when model is gen-only **or** when client sends `mode: "image_gen"` | Cleaner than separate app surface; avoids premature tools platform |
| **G2** | First-class gen models vs dual-mode | MVP: models may be **chat**, **vision-chat**, or **image_gen** (not both gen + chat in one call). Dual-mode (chat that tools gen) is Phase 2 | Simpler routing |
| **G3** | Gen result storage | Always write **attachment** + assistant message content part | Consistent with privacy, export, multi-device |
| **G4** | Default gen size | `1024x1024` (or provider default); optional body `size` later | Match common APIs |
| **G5** | Fake gen | Write a tiny valid PNG to storage + attachment row | Full path testable |
| **U1** | UI: vision | Thumbnails in composer + user bubble; Vision badge; block send if mismatch | ChatGPT muscle memory |
| **U2** | UI: image gen | **Image** badge on models; assistant bubble renders generated images; optional “Download” | No separate studio app for MVP |
| **U3** | Attachment download | Auth’d `GET /api/attachments/:id` (stream from S3) | Previews + export without public buckets |

**Open questions (answer before coding):**

1. Ship **Vision only** first, then Gen, or one combined release? (Recommend: **V then G** with shared WP-S foundation.)  
2. Live providers for first vision ship: OpenAI-compat only, or Anthropic too? (Recommend: **OpenAI-compat first**, Anthropic second, Ollama third.)  
3. Image gen first live provider: OpenAI Images API only? (Recommend: **yes**; openai_compatible base URL optional.)  
4. Should user messages with images render full-size or thumbnail only? (Recommend: **thumbnail + click to expand**.)

---

## 2. Current state (ground truth)

### 2.1 What works

| Layer | Behavior | Path |
| --- | --- | --- |
| Upload intent | MIME allowlist, 25MB, attachment row, presigned PUT | `apps/web/src/routes/api/uploads.ts` |
| Object storage | S3 put/get presign, key layout | `packages/storage` |
| Chat attach | Composer `attachmentIds` on send | `composer.tsx`, `api/chat.ts` |
| Content parts | `text` \| `image` \| `file` | `packages/domain/src/content-parts.ts` |
| Build user content | Maps image/* → image part, else file | `build-user-content.ts` |
| Catalog | `capabilities.vision` on platform GPT/Claude | `platform-catalog.ts` |
| UI badge | “Vision” if selected model has vision | `model-select.tsx` |

### 2.2 Gaps (why vision/gen don’t work)

| Gap | Detail |
| --- | --- |
| Provider history | `buildProviderMessages` turns images into **text stubs** (`[image attachment:…]`) |
| Live adapters | `streamOpenAICompat` / Anthropic / Ollama only accept `content: string` |
| No attachment GET | UI cannot reliably display stored images without new auth’d download |
| No vision gate | User can attach image + pick text-only model |
| No image gen API | No adapter, no content part for model-generated images, no UI mode |
| Gateway types | Message type is string-only end-to-end |

### 2.3 Mental model after this plan

```
User attach image
  → S3 + attachments row (existing)
  → message content: [{text}, {image, attachmentId}]
  → if model.vision:
       load bytes → multimodal ProviderMessage[]
       → chat/completions stream (existing SSE shape)
     else:
       reject

User selects imageGen model + prompt
  → image generations API
  → bytes → S3 + attachments (source: model)
  → assistant message: [{image or generated_image, attachmentId}]
  → UI <img src="/api/attachments/:id">
```

---

## 3. Domain model changes

### 3.1 Content parts

**Keep** existing:

```ts
{ type: "text"; text: string }
{ type: "image"; attachmentId: string; mime: string }
{ type: "file"; attachmentId: string; mime: string; filename: string }
```

**Add** (image gen / provenance):

```ts
{
  type: "image";
  attachmentId: string;
  mime: string;
  /** optional provenance — default "user" for uploads */
  source?: "user" | "model";
  prompt?: string;          // gen only
  revisedPrompt?: string;   // if provider rewrites
}
```

**Alternative (cleaner type discrimination):**

```ts
{ type: "generated_image"; attachmentId: string; mime: string; prompt?: string; revisedPrompt?: string }
```

**Recommendation:** extend `image` with optional `source` to avoid dual render paths; normalize old rows as `source: "user"`.

Update `normalizeContentParts` + tests.

### 3.2 Model capabilities (catalog contract)

Documented shape (JSON on `models.capabilities` and platform catalog):

```ts
type ModelCapabilities = {
  streaming?: boolean;   // default true
  vision?: boolean;      // chat multimodal input
  imageGen?: boolean;    // image generations API
  tools?: boolean;       // future
};
```

**Rules:**

| vision | imageGen | Client behavior | Server routing |
| --- | --- | --- | --- |
| false | false | Chat text (+ non-image files as text note only / reject images) | Chat completions, text history |
| true | false | Chat + images | Multimodal chat completions |
| false | true | Prompt-focused; attach optional later | Image generations (no chat stream of tokens; or short status then image) |
| true | true | Phase 2 — **out of MVP** | N/A |

Platform seed updates:

- GPT-4.1 / Claude Sonnet: `vision: true` (already)  
- Add example platform gen model only if env supports it, e.g. `openai:platform:gpt-image-1` or `dall-e-3` with `imageGen: true` — **feature-flagged** so empty env doesn’t list broken models.

### 3.3 Provider message type (gateway)

```ts
// packages/provider-gateway or domain
export type ProviderTextPart = { type: "text"; text: string };
export type ProviderImagePart = {
  type: "image";
  mime: string;
  /** base64 without data: prefix, or full data URL — pick one and stick */
  dataBase64?: string;
  url?: string;
};
export type ProviderContent = string | Array<ProviderTextPart | ProviderImagePart>;

export type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: ProviderContent;
};
```

Chat adapters change from `messages: { role, content: string }[]` to `ProviderMessage[]`.

### 3.4 Attachments schema (optional columns)

MVP can work without migration if we encode provenance only on message parts.

**Optional migration `003_attachments_source.sql`:**

```sql
ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'user', -- user | model
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}';
```

Use for admin cleanup and “generated by model” UI. **Recommend include** — small, useful.

---

## 4. Architecture

### 4.1 Shared foundation (WP-S) — ship before vision/gen features

```
GET /api/attachments/:id
  auth → org-scoped attachment row → stream S3 object
  headers: Content-Type, Content-Disposition, Cache-Control: private

packages/storage
  getObject(key) → { body: ReadableStream | Buffer, contentType }
  (presignGet already exists — use for provider URL mode)
```

```
packages/db or domain
  loadAttachmentForOrg(db, orgId, id)
  resolveImageForProvider(attachment, { maxBytes, transport })
    → { mime, base64 } | { mime, url }
```

```
UI MessageParts
  render text via MarkdownRenderer
  render image via <img src={`/api/attachments/${id}`}> with auth cookies
```

### 4.2 Vision path

```
runChatTurn
  → buildUserContentParts (existing)
  → assertVisionAllowed(modelCapabilities, contentParts)
  → history = buildProviderMessagesMultimodal(allMsgs, leafId, {
        resolveImage: (attId) => load + encode
     })
  → streamAssistant(history as ProviderMessage[])
  → live adapter maps ProviderMessage → vendor JSON
```

**Vendor mapping examples**

OpenAI-compatible chat:

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What’s in this photo?" },
    {
      "type": "image_url",
      "image_url": { "url": "data:image/png;base64,...." }
    }
  ]
}
```

Anthropic messages:

```json
{
  "role": "user",
  "content": [
    {
      "type": "image",
      "source": {
        "type": "base64",
        "media_type": "image/png",
        "data": "...."
      }
    },
    { "type": "text", "text": "What’s in this photo?" }
  ]
}
```

Ollama (when enabled):

```json
{
  "role": "user",
  "content": "What’s in this photo?",
  "images": ["<base64>"]
}
```

### 4.3 Image gen path

```
POST /api/chat (or dedicated /api/images — prefer chat for fewer clients)
  body: { modelRef, input: { text }, mode?: "image_gen" }

runChatTurn or runImageGenTurn
  → assert model.capabilities.imageGen
  → resolve credentials (same as chat)
  → generateImage({ modelId, prompt: text, size, apiKey, baseUrl })
  → putObject(storageKey, bytes, mime)
  → insert attachments (source: model)
  → insert user message (text)
  → insert assistant message content: [{ type: "image", source: "model", attachmentId, mime, prompt }]
  → SSE: optional status events, then { type: "done", ... } or new { type: "image", attachmentId }
```

**Client SSE:** extend event types carefully so existing text stream clients don’t break:

```ts
// existing: text, usage, error, done
// add: image { attachmentId, mime }  — client appends to assistant message parts
// or: done includes final content parts array (already has content string — evolve)
```

**Recommendation for MVP SSE:**

1. Stream nothing (or a single “Generating image…” as text delta).  
2. On completion, `done` carries `contentParts: ContentPart[]` **and** legacy `content` text summary (`""` or prompt echo).  
3. Client prefers `contentParts` if present.

### 4.4 Capability resolution

```
getModelCapabilities(modelRef, orgId):
  org models row capabilities if present
  else platform catalog entry
  else { streaming: true }
```

Used by: `GET /api/models` (already returns capabilities), chat gate, UI.

### 4.5 Security

| Risk | Mitigation |
| --- | --- |
| IDOR on attachment download | Always `orgId` + membership check; no public S3 |
| Huge base64 DoS | Vision max bytes; reject over limit |
| SSRF via image URL transport | Only our signed URLs or base64 — never user-supplied fetch URL for vision |
| Prompt injection via image | Document residual risk; no special MVP fix |
| Gen cost abuse | Existing rate limits; optional stricter limit on imageGen later |
| MIME spoofing | Magic-byte check on vision path (recommended WP-S) |

---

## 5. API contracts

### 5.1 `GET /api/attachments/:id` (new)

**Auth:** session required  
**Authz:** attachment.orgId === ctx.orgId (and optionally uploader or conversation member — **MVP: org membership sufficient**)

**200:** binary body, `Content-Type: <mime>`  
**404:** not found / wrong org (no leak)  
**401/403:** as usual

### 5.2 `GET /api/models` (extend)

Already returns `capabilities`. Ensure:

- `imageGen` present when set  
- Client can filter/badge  

Optional query: `?for=chat|vision|image_gen` — **not required** if client filters.

### 5.3 `POST /api/chat` (extend)

```ts
// input
{
  modelRef: string;
  input: { text?: string; attachmentIds?: string[] };
  mode?: "chat" | "image_gen"; // default chat
  // existing: conversationId, regenerate, etc.
}
```

**Validation matrix:**

| mode | text | attachments | model caps |
| --- | --- | --- | --- |
| chat | optional if attachments | optional | if any image part → need vision |
| image_gen | required non-empty | reject images MVP | need imageGen |

### 5.4 Error codes (reuse AppError)

| Code | When |
| --- | --- |
| `VALIDATION` | Image on non-vision model; gen without prompt; oversize vision image |
| `MODEL_UNAVAILABLE` | Missing caps / wrong kind |
| `NOT_FOUND` | Attachment id |
| `PROVIDER_ERROR` | Upstream vision/gen failure (sanitized message) |

---

## 6. UI specification

### 6.1 Composer

- Keep attach control.  
- Pending attachments: **thumbnail** for images, filename chip for files.  
- If pending has image and `!vision` on selected model:  
  - Show inline warning: “This model can’t see images. Switch to a Vision model.”  
  - **Disable send** (V2).  
- If selected model has `imageGen` and not vision-chat:  
  - Placeholder: “Describe an image to generate…”  
  - Hide attach **or** disable attach with tooltip “Not supported for image models yet”.  
- Badges next to model: **Vision** / **Image** (same compact style as today).

### 6.2 Message list

- User message: text + image grid (max width, rounded).  
- Assistant: markdown text; for `image` parts with `source: "model"` (or any image part on assistant), render image via attachment URL.  
- Actions: copy still on text; download icon on images.  
- Streaming: gen shows spinner/status until image part arrives.

### 6.3 Empty / errors

- Toast or composer `role="alert"` for gate failures.  
- Provider failures: existing error bubble path.

### 6.4 Admin (light touch)

- Model create/edit: checkboxes Vision / Image gen (capabilities already partially editable).  
- Document that gen models need live image API access.

---

## 7. Implementation details by package

### 7.1 `packages/domain`

| File | Work |
| --- | --- |
| `content-parts.ts` | Optional `source`, `prompt`, `revisedPrompt` on image; normalize |
| `content-parts.test.ts` | Round-trip + legacy without source |
| `platform-catalog.ts` | imageGen models if any; document caps |
| `model-capabilities.ts` (**new**) | `parseCapabilities`, `modelAcceptsImages`, `modelCanGenerateImages` |
| `model-capabilities.test.ts` | Matrix tests |
| `chat-input.ts` | Optionally accept `mode` |

### 7.2 `packages/storage`

| File | Work |
| --- | --- |
| `s3.ts` | `getObjectBuffer(key)` for vision encode |
| tests | Mock or localstack if present; else unit with interface |

### 7.3 `packages/db`

| File | Work |
| --- | --- |
| `build-provider-messages.ts` | Split: text fallback vs multimodal builder |
| `build-provider-messages-multimodal.ts` (**new**) | Async resolve images on branch |
| `assert-vision.ts` (**new**) | Pure gate given caps + parts |
| `run-chat-turn.ts` | Call gate; choose multimodal path; optional branch to image gen |
| `run-image-gen-turn.ts` (**new**) | Gen orchestration |
| `stream-assistant.ts` | Accept `ProviderMessage[]` |
| `repos/attachments.ts` (**new**) | get by id+org, create for model output |
| migration `003_…` | optional source column |
| integration tests | Vision gate; multimodal fake; gen fake |

### 7.4 `packages/provider-gateway`

| File | Work |
| --- | --- |
| `types.ts` | ProviderMessage / ProviderContent |
| `adapters/live-http.ts` | Multimodal body for openai_compatible + anthropic; ollama images array |
| `adapters/image-gen.ts` (**new**) | `generateImageOpenAICompat`, fake |
| `adapters/fake-adapter.ts` | Accept multimodal; ignore images |
| `live-http.test.ts` | Snapshot request body includes image_url |
| `image-gen.test.ts` | Fake returns PNG bytes |

### 7.5 `apps/web`

| File | Work |
| --- | --- |
| `routes/api/attachments.$id.ts` (**new**) | GET stream |
| `routes/api/chat.ts` | mode + pass-through |
| `features/chat/composer.tsx` | thumbnails, gates, placeholders |
| `features/chat/model-select.tsx` | Image badge |
| `features/chat/message-list.tsx` | Render image parts |
| `features/chat/attachment-image.tsx` (**new**) | img + download |
| `features/chat/use-chat-workspace.ts` | SSE contentParts / image events |
| `consume-chat-sse.ts` | Parse new events |
| markdown | Leave text path; images outside markdown |

---

## 8. Example flows (review scenarios)

### 8.1 Vision happy path

1. User selects `openai:platform:gpt-4.1` (vision).  
2. Attaches `photo.png` (2 MB).  
3. Types “What brand is the logo?”  
4. Server loads object, base64, OpenAI multimodal request.  
5. Stream: “The logo appears to be…”  
6. UI shows user thumbnail + assistant markdown.

### 8.2 Vision rejection

1. User selects Ollama llama without vision.  
2. Attaches image.  
3. Send disabled + message; if forced API: `VALIDATION` “Model does not support images”.

### 8.3 Image gen happy path

1. User selects `openai:platform:dall-e-3` (`imageGen: true`).  
2. Types “A red cube on a glass table, product photo”.  
3. Server calls images API, stores PNG, assistant message shows image.  
4. Usage: record tokens null; optional cost null or fixed cost later.

### 8.4 Fake CI

1. `PROVIDER_MODE=fake`, attach image, vision model.  
2. Stream completes with fixed text; no network to OpenAI.  
3. Gen fake writes 1×1 PNG attachment.

---

## 9. Reasoning appendix (why these choices)

| Choice | Why | Alternatives rejected |
| --- | --- | --- |
| Hard vision gate | Trust | Silent text stub (current) |
| Base64 default | Works with private Ollama / no public URL | URL-only (SSRF + private net issues) |
| Re-resolve history | Correct after attach | Cache base64 in DB (bloat) |
| imageGen as capability not separate app | Reuse composer/SSE/session | Full “studio” route (scope) |
| Store gen to S3 | Same ACL/export as uploads | Ephemeral data URLs in message (lost on reload) |
| Shared attachment GET | One preview path | Inline base64 in JSON history (huge payloads to client) |
| Not RAG | Different problem (retrieve corpus) | Pretending files = knowledge base |

---

## 10. Work packages (granular tasks)

### WP-S — Shared foundation (M) — **do first**

**Goal:** Auth’d image delivery + content part rendering + capability helpers.

**Tasks**

- [ ] **S1** Domain: `model-capabilities.ts` + unit tests (`modelAcceptsImages`, `modelCanGenerateImages`)  
- [ ] **S2** Domain: extend image content part optional fields + `normalizeContentParts` tests  
- [ ] **S3** Storage: `getObjectBuffer` (or stream→buffer) + error mapping  
- [ ] **S4** DB: `attachments` repo `getForOrg`, `create` helpers  
- [ ] **S5** Optional migration `source` + `meta` on attachments  
- [ ] **S6** API: `GET /api/attachments/$id` with org check + security headers  
- [ ] **S7** Integration test: create attachment row + object (or skip object with mock) + GET 200/404  
- [ ] **S8** UI: `AttachmentImage` component (img + loading + error)  
- [ ] **S9** Message list: render image parts for user/assistant (not markdown)  
- [ ] **S10** Composer: thumbnail previews for pending image attachments  

**Acceptance**

- Given an attachment id in a message part, authenticated user in same org sees the image in the thread.  
- Wrong org → 404.  
- Unit tests green for capabilities + content parts.

---

### WP-V1 — Vision gate + multimodal domain (S)

**Goal:** Impossible to send images to non-vision models; pure logic ready.

**Tasks**

- [ ] **V1.1** `assertVisionAllowed(caps, parts)` pure function + tests  
- [ ] **V1.2** Wire into `runChatTurn` before provider call  
- [ ] **V1.3** Map AppError to client-visible message  
- [ ] **V1.4** Composer: disable send + alert when mismatch  
- [ ] **V1.5** Integration: chat with image + non-vision model → 400  

**Acceptance**

- API and UI both block non-vision + image.  
- Text-only messages still work on all models.

---

### WP-V2 — Multimodal provider messages (M)

**Goal:** History built with real image payloads for vision models.

**Tasks**

- [ ] **V2.1** Define `ProviderMessage` types in gateway (or domain)  
- [ ] **V2.2** `resolveAttachmentImage(db, storage, orgId, id, limits)` → base64/url  
- [ ] **V2.3** Magic-byte / MIME verify (recommended)  
- [ ] **V2.4** Enforce vision max size (10MB)  
- [ ] **V2.5** `buildProviderMessagesMultimodal(...)` async; keep text-only function for non-vision  
- [ ] **V2.6** Unit tests with fixture small PNG  
- [ ] **V2.7** File parts (pdf/txt): keep as text note only for MVP (no full extract)  

**Acceptance**

- Multimodal builder produces text+image parts for user messages with attachments.  
- Oversized images rejected before provider call.

---

### WP-V3 — Live + fake adapters multimodal (M)

**Goal:** Adapters send vendor-correct bodies.

**Tasks**

- [ ] **V3.1** Fake adapter: accept `ProviderMessage[]`; stream unchanged script  
- [ ] **V3.2** OpenAI-compat: map image parts → `image_url` data URLs  
- [ ] **V3.3** Unit test: capture fetch body contains `image_url`  
- [ ] **V3.4** Anthropic: base64 source block + tests  
- [ ] **V3.5** Ollama: `images: []` when kind ollama (allowPrivate as today)  
- [ ] **V3.6** `stream-assistant` / `runChatTurn` pass multimodal history when vision  
- [ ] **V3.7** Integration: fake mode full turn with image attachment  

**Acceptance**

- Fake e2e green with image attach.  
- Live manual: one OpenAI-compat vision call with real key (document in runbook; not required in CI).

---

### WP-V4 — Vision UX polish (S)

**Tasks**

- [ ] **V4.1** Model select: keep Vision badge; ensure capabilities from API  
- [ ] **V4.2** User bubble image layout (1–4 thumbs)  
- [ ] **V4.3** Optional lightbox  
- [ ] **V4.4** Docs: runbook “Vision models & limits”  

**Acceptance**

- Reviewer can complete scenario 8.1 without confusion.

---

### WP-G1 — Image generation gateway (S–M)

**Goal:** Generate bytes behind gateway.

**Tasks**

- [ ] **G1.1** `generateImage` interface + fake PNG  
- [ ] **G1.2** OpenAI Images API implementation (`/v1/images/generations`)  
- [ ] **G1.3** Map errors to AppError  
- [ ] **G1.4** Unit tests with mocked fetch  
- [ ] **G1.5** Platform catalog entry for gen model (env-gated)  

**Acceptance**

- Fake returns valid PNG buffer.  
- Live path tested manually once.

---

### WP-G2 — Image gen turn + persistence (M)

**Tasks**

- [ ] **G2.1** `runImageGenTurn` or branch in `runChatTurn` on `mode` / caps  
- [ ] **G2.2** Create user + assistant messages with gen image part  
- [ ] **G2.3** Write attachment `source: model`  
- [ ] **G2.4** SSE done includes contentParts  
- [ ] **G2.5** Usage event status ok; cost null unless priced  
- [ ] **G2.6** Integration test fake gen end-to-end  

**Acceptance**

- Reload conversation still shows generated image via attachment GET.

---

### WP-G3 — Image gen UI (S–M)

**Tasks**

- [ ] **G3.1** Image badge on models with `imageGen`  
- [ ] **G3.2** Composer placeholder + attach policy for gen models  
- [ ] **G3.3** Pass `mode: "image_gen"` when selected model is gen-only  
- [ ] **G3.4** Client handles contentParts / image on done  
- [ ] **G3.5** Download control on generated images  
- [ ] **G3.6** Loading state “Generating image…”  

**Acceptance**

- Scenario 8.3 works in UI with fake or live.

---

### WP-X — Cross-cutting (S)

**Tasks**

- [ ] **X1** Rate limit consideration for gen (document; optional separate limit)  
- [ ] **X2** Update `docs/plan.md` cross-links; mark vision/gen depth  
- [ ] **X3** Update `docs/runbook.md`: ENCRYPTION_KEY, vision size, gen models  
- [ ] **X4** Structural tests for new routes  
- [ ] **X5** Security headers on attachment GET  

---

## 11. Acceptance criteria (product review checklist)

### Vision

1. Vision model + image + question → coherent answer that depends on image content (live manual).  
2. Non-vision model + image → cannot send; API rejects if forced.  
3. Image appears in UI after reload (attachment GET).  
4. Fake mode CI covers attach + stream without live keys.  
5. No plaintext secrets in logs; attachment IDs not cross-org accessible.

### Image gen

6. Gen model + prompt → image in thread + persisted attachment.  
7. Reload still shows image.  
8. Chat-only model cannot invoke gen path.  
9. Fake gen works in integration tests.

### Non-regression

10. Text-only chat, branch switch, markdown, admin providers unchanged.  
11. File attach of `.txt`/`.pdf` still stores; not claimed as vision OCR.

---

## 12. Test matrix (granular)

| ID | Type | Case |
| --- | --- | --- |
| T1 | unit | modelAcceptsImages true/false |
| T2 | unit | assertVisionAllowed rejects image on text model |
| T3 | unit | normalizeContentParts with source model |
| T4 | unit | OpenAI body mapper includes image_url data URL |
| T5 | unit | Anthropic body mapper includes base64 source |
| T6 | unit | prepareStreamingMarkdown unaffected (markdown) |
| T7 | unit | fake generateImage returns PNG signature bytes |
| T8 | integration | attachment GET 200 same org / 404 other org |
| T9 | integration | chat image + vision fake adapter completes |
| T10 | integration | chat image + non-vision fails |
| T11 | integration | image gen turn creates attachment source model |
| T12 | structural | route `/api/attachments/$id` exists |
| T13 | manual | live OpenAI vision photo |
| T14 | manual | live DALL·E or Images API |

---

## 13. Rollout / flags

| Flag / env | Purpose |
| --- | --- |
| `PROVIDER_MODE=fake\|live` | Existing |
| `VISION_IMAGE_TRANSPORT=base64\|url` | Default base64 |
| `VISION_MAX_BYTES=10485760` | Override 10MB |
| `ENABLE_PLATFORM_IMAGE_GEN=true` | List platform gen models in catalog |
| Feature flag later | Gradual UI exposure if needed |

---

## 14. File-level change list (expected)

```
packages/domain/src/content-parts.ts
packages/domain/src/content-parts.test.ts
packages/domain/src/model-capabilities.ts          # new
packages/domain/src/model-capabilities.test.ts     # new
packages/domain/src/platform-catalog.ts
packages/domain/src/index.ts

packages/storage/src/s3.ts
packages/storage/src/*.test.ts

packages/db/src/migrations/003_attachments_source.sql   # optional
packages/db/src/schema/app-tables.ts
packages/db/src/repos/attachments.ts                    # new
packages/db/src/chat/assert-vision.ts                   # new
packages/db/src/chat/build-provider-messages.ts         # split/refactor
packages/db/src/chat/build-provider-messages-multimodal.ts  # new
packages/db/src/chat/run-chat-turn.ts
packages/db/src/chat/run-image-gen-turn.ts               # new
packages/db/src/chat/stream-assistant.ts
packages/db/src/chat/*.test.ts

packages/provider-gateway/src/types.ts
packages/provider-gateway/src/adapters/live-http.ts
packages/provider-gateway/src/adapters/image-gen.ts     # new
packages/provider-gateway/src/adapters/fake-adapter.ts
packages/provider-gateway/src/index.ts
packages/provider-gateway/src/**/*.test.ts

apps/web/src/routes/api/attachments.$id.ts              # new
apps/web/src/routes/api/chat.ts
apps/web/src/features/chat/composer.tsx
apps/web/src/features/chat/model-select.tsx
apps/web/src/features/chat/message-list.tsx
apps/web/src/features/chat/attachment-image.tsx         # new
apps/web/src/features/chat/use-chat-workspace.ts
apps/web/src/features/chat/consume-chat-sse.ts
apps/web/src/features/chat/consume-chat-sse.test.ts

docs/plan.md                                            # cross-link
docs/runbook.md
docs/vision-and-image-gen-plan.md                       # this file
```

---

## 15. Estimated sequencing

```
WP-S  → WP-V1 → WP-V2 → WP-V3 → WP-V4
                ↘
                 WP-G1 → WP-G2 → WP-G3
WP-X continuous
```

**Rough size:** S (M), V1 (S), V2 (M), V3 (M), V4 (S), G1 (S–M), G2 (M), G3 (S–M), X (S).  
**Critical path:** S → V1 → V2 → V3 for vision; S → G1 → G2 → G3 for gen (G can start after S+V1 in parallel with V2).

---

## 16. Approval checklist

- [ ] Decisions V1–V7, G1–G5, U1–U3 accepted or amended  
- [ ] Open questions §1 answered  
- [ ] Content part design (`source` on image vs `generated_image`) chosen  
- [ ] First live vision provider chosen (OpenAI-compat / Anthropic / both)  
- [ ] First live gen provider chosen  
- [ ] SSE contract for gen approved (`contentParts` on done)  
- [ ] WP order approved  
- [ ] Ready to implement WP-S  

---

## 17. Implementation notes for the agent (after approval)

1. Do **not** start adapter work before S6 attachment GET and V1 gate.  
2. Keep fake provider path green in CI; live is manual.  
3. Prefer small pure modules; no secrets in tests.  
4. Update this doc Status → `Approved` / `In progress` / `Done` per WP.  
5. Do not implement RAG or PDF OCR under this plan.  
6. Cross-link from `docs/plan.md` when landing.

---

## 18. Appendix — current stub to replace

`build-provider-messages.ts` today:

```ts
else if (p.type === "image")
  bits.push(`[image attachment:${p.attachmentId} mime:${p.mime}]`);
```

This is the primary reason “Vision” badge does not mean vision works. Multimodal builder + adapter mapping is the fix.

---

*End of plan. Correctness review should challenge hard-gate (V2), base64 vs URL (V4), gen routing (G1/G2), and SSE shape before any code.*
