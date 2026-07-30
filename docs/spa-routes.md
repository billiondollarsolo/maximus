# SPA deep links

Every product surface is a **real URL** (bookmarkable, shareable, open-in-new-tab). Prefer `<Link>` / `navigate({ to })` over onClick-only state.

## Map

| URL | Auth | Notes |
| --- | --- | --- |
| `/` | session | New chat |
| `/c/$conversationId` | session | Thread; id is DB `conv_<uuid>` |
| `/login` | public | Login / bootstrap |
| `/invite/$inviteId` | public | Accept invite |
| `/settings` | session | → `/settings/general` |
| `/settings/general` | session | Appearance |
| `/settings/personalization` | session | Custom instructions |
| `/settings/data` | session | Archived chats, unarchive, bulk delete |
| `/settings/account` | session | Profile / logout / delete account |
| `/projects` | session | List/create/delete projects |
| `/admin` | admin | Overview (live) |
| `/admin/members` | admin | Team + invite links `/invite/$id` |
| `/admin/providers` | admin | BYOK / models / pricing |
| `/admin/models` | admin | Access allowlist |
| `/admin/usage` | admin | Usage |
| `/admin/audit` | admin | Audit log |
| `/admin/pricing` | admin | Redirect → providers |

## Chat rules

- Sidebar rows are **`<Link to="/c/$conversationId">`**, not buttons only.
- New chat is **`<Link to="/">`**.
- First message on `/` updates the address bar to `/c/{id}`.

## API

HTTP APIs remain under `/api/*` (see [api.md](./api.md)). SPA routes never replace them.
