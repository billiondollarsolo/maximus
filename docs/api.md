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
| GET/PUT | `/api/me/instructions` | Personalization → chat system prompt |
| GET | `/api/models` | Allowed models (gated platform + Ollama `/api/tags` discovery + org BYOK) |
| GET | `/api/conversations` | List / `?id=` detail+messages / `?q=` search |
| SPA | `/` · `/c/{conversationId}` | ChatGPT-style deep links; ids are `conv_<uuid>` in DB |
| PATCH | `/api/conversations` | Title, archive/unarchive (`archive: true\|false`), activeLeafId |
| DELETE | `/api/conversations` | `{ id }` or bulk `{ bulk: "all"\|"archived", confirm: "DELETE" }` |
| GET | `/api/conversations?scope=archived` | Archived list for settings |
| POST | `/api/chat` | **SSE** chat/image-gen turns |
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
| CRUD | `/api/admin/providers` | BYOK + test |
| CRUD | `/api/admin/models` | Models + allowlist |
| CRUD | `/api/admin/prices` | Pricing rows |
| GET/POST | `/api/admin/members` | Members + invites |
| GET | `/api/admin/usage` | Usage events |
| GET | `/api/admin/audit` | Audit log |

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
