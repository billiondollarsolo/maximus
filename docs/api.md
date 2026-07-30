# Maximus HTTP API

The product is **API-first**: the SPA is a thin client over JSON + SSE. There are no server actions / RPC that skip these routes for product data.

## Auth

| Mechanism | How |
| --- | --- |
| Browser | `maximus_session` HttpOnly cookie (set on login/bootstrap) |
| API client | `Authorization: Bearer <sessionToken>` **or** `X-Session-Token: <sessionToken>` |
| Obtain token | `POST /api/auth/login` → body includes `sessionToken` (+ `Set-Cookie`) |

Mutations (`POST`/`PATCH`/`PUT`/`DELETE`) use same-origin CSRF guard (`Origin` / `Referer`). In non-production, clients without Origin (curl) are allowed.

```bash
# Login
TOKEN=$(curl -sS -X POST "$APP/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"…","password":"…"}' | jq -r .sessionToken)

# Authenticated call
curl -sS -H "Authorization: Bearer $TOKEN" "$APP/api/auth/me"
```

## Catalog

`GET /api` — machine-readable list of routes (no auth).

## Surface map

### Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api` | Catalog |
| GET | `/api/health` | Shallow health (app/pg/valkey) |
| GET | `/api/auth/status` | Bootstrap needed? |
| POST | `/api/auth/bootstrap` | First owner |
| POST | `/api/auth/login` | Session |
| POST | `/api/auth/invite` | Accept invite |

### Member (session)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/auth/me` | User + org + role |
| POST | `/api/auth/logout` | |
| DELETE | `/api/auth/account` | Hard-delete account (`confirm: "DELETE"`) |
| GET/PUT | `/api/me/instructions` | Personalization → chat system prompt |
| GET/POST/PATCH/DELETE | `/api/projects` | Projects; PATCH can assign `conversationId` |
| GET | `/api/models` | Allowed models + agents + `defaultModelRef` (platform keys only + enabled visible org offerings; no auto Ollama dump) |
| GET | `/api/conversations` | List / `?id=` / `?q=` / `?scope=` / `?projectId=` |
| SPA | `/` · `/c/{conversationId}` · `/projects` | Deep links |
| PATCH | `/api/conversations` | Title, archive/unarchive (`archive: true\|false`), activeLeafId |
| DELETE | `/api/conversations` | `{ id }` or bulk `{ bulk: "all"\|"archived", confirm: "DELETE" }` |
| POST | `/api/chat` | **SSE** turns; `done.metrics` includes latency / tokens / tok/s |
| POST | `/api/uploads` | Presign attachment |
| GET | `/api/attachments/$id` | Fetch attachment bytes |
| GET | `/api/export` | `?id=&format=md\|json` |
| POST | `/api/feedback` | Message rating |

### Admin (`requireOrgRole(admin)`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/overview` | Deep health snapshot |
| GET | `/api/admin/overview/stream` | **SSE** live snapshot |
| GET/PATCH | `/api/admin/overview/settings` | Probe settings |
| POST | `/api/admin/overview/probe` | Manual probes |
| CRUD | `/api/admin/providers` | BYOK + test; actions `list_tags`, `show_model`, `import_tags` (Ollama) |
| CRUD | `/api/admin/models` | Models + allowlist (`isEnabled`, `isVisible`, capabilities) |
| GET/PATCH | `/api/admin/model-defaults` | Org `modelDefaults`, `defaultModelRefs`, `pinnedModelRefs` |
| CRUD | `/api/admin/agents` | Agent presets; `action: resolve` for disabled-base checks |
| GET | `/api/admin/catalog-export` | Secret-free catalog export (connections metadata, models, allowlist, agents) |
| POST | `/api/admin/catalog-export` | Import catalog `{ catalog, dryRun?, conflict?: "skip"\|"overwrite" }` — never restores secrets |
| CRUD | `/api/admin/prices` | Pricing rows |
| GET/POST | `/api/admin/members` | Members + invites |
| GET | `/api/admin/usage` | Usage events |
| GET | `/api/admin/audit` | Audit log (`?action=` `?since=` `?limit=`) |

### Model capabilities (`models.capabilities` jsonb)

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

**Resolve order (runtime):** code defaults → `org.settings.modelDefaults` → offering capabilities (+ agent params) → `conversation.settings.modelParams`.

**Gateway mapping:** OpenAI-compat `max_tokens` / sampling; Anthropic `max_tokens`; Ollama `options.num_ctx` / `num_predict` / sampling.

**Agent picker refs:** `agent:{presetId}` — stream resolves to base model; allowlist enforced on base.

## Live / SSE

Prefer SSE for streaming surfaces:

- `POST /api/chat` — turn stream (`data: {type,…}`)
- `GET /api/admin/overview/stream` — named `event: snapshot`

## Not API (client-only, intentional)

| Surface | Why |
| --- | --- |
| Theme light/dark | `localStorage` preference only |
| Marketing/shell chrome | Pure UI |

## Gaps / future

- OpenAPI 3 YAML export (catalog is v1 JSON today)
- Org-level settings API beyond overview probes
- Service accounts / long-lived API keys (use sessions for now)
- Audit filters + pagination

See also: [runbook.md](./runbook.md), [architecture.md](./architecture.md).
