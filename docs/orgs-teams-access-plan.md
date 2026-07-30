# Orgs, Teams & Access — Architecture Plan

**Status:** Approved — implement in phases P0→P1→P2  
**Date:** 2026-07-30  
**Repo target after approval:** `docs/orgs-teams-access-plan.md`  
**Product:** Maximus (greenfield multi-tenant-capable, single-org self-host default)  
**Related:** existing `organizations` / `members` / `model_allowlists`, `docs/provider-model-management-plan.md`, RBAC in `packages/domain/src/policies/rbac.ts`

---

## 1. Purpose

Define how Maximus scopes identity, tenancy, groups, and resource access so that:

- **Today:** single-org self-host feels simple (no switcher noise, open catalog by default).
- **Later:** multi-org membership, teams, and fine-grained model access do not require a rewrite.

This plan locks vocabulary, tenancy rules, grant resolution, session context, UI placement, and a **phased** delivery path.

---

## 2. Decisions locked (interview)

| # | Topic | Decision |
| --- | --- | --- |
| D1 | Hard tenant boundary | **Org only** — chats, providers, secrets, usage never cross orgs |
| D2 | Multi-org for one user | **Supported in data**; session `activeOrgId`; switcher **only if** memberships ≥ 2 |
| D3 | Team purpose (v1) | **Resource grants only** (models; agents via base model) — not data isolation |
| D4 | New org access mode | **`open`** by default (empty grants ⇒ all enabled+visible models) |
| D5 | Create second org | **No product create-org** — bootstrap + invite into existing org only (ops may seed) |
| D6 | Capability roles | **Fixed** `owner` \| `admin` \| `member` only (no custom roles in v1) |
| D7 | `activeTeamId` | **Optional** — grants match **any** of the user’s teams in the active org |
| D8 | Grant subjects | **`org` \| `role` \| `team` \| `user`** |
| D9 | Agents | Allow if user can use **base modelRef**; no separate agent grants in v1 |
| D10 | UI | Admin **Members** (people + teams) + **Access** (grants); Providers stays connections/models |
| D11 | Delivery | **Phased:** P0 foundation → P1 Teams+Access UI → P2 org switcher polish |
| D12 | Plan location | **`docs/orgs-teams-access-plan.md`** |

### Explicit non-goals (v1)

- Team-private chats / projects / providers  
- Custom RBAC roles  
- User self-serve “create organization”  
- Nested teams  
- Deny-lists (allow-only)  
- Cross-org resource sharing  

---

## 3. Vocabulary

| Term | Meaning |
| --- | --- |
| **Deployment** | One Maximus install |
| **User** | Global identity (`users`) |
| **Org** | Hard tenant (`organizations`) — data + secrets boundary |
| **Member** | User in an org with capability role (`members`) |
| **Team** | Named group inside an org for **grants** (`teams`) |
| **Team member** | User in a team (`team_members`) |
| **Grant** | Allow rule for a resource to a subject (`access_grants`) |
| **Active context** | `activeOrgId` (required) + `activeTeamId` (optional, preference only in v1) |
| **Access mode** | `open` \| `allowlist` per org |

**Members ≠ Users:** Admin “Members” = org roster. Global user directory is not a product surface.

---

## 4. Architecture

### 4.1 Tenancy

```
Deployment
  └── Org*  (hard boundary)
        ├── Members (user + role)
        ├── Teams
        │     └── Team members
        ├── Providers, models, agents, chats, projects, usage, audit  (all orgId)
        └── Access grants
```

- Every product row that is tenant-owned **must** carry `org_id` and be queried with active org.  
- Platform env keys (OpenAI/Anthropic) are deployment-level credentials but **usage** still goes through org catalog + grants.

### 4.2 Capability RBAC vs resource grants

| Concern | Mechanism | Examples |
| --- | --- | --- |
| What you can **do** | Org **role** | Admin UI, invites, providers, view audit |
| What you can **use** | **Grants** (+ accessMode) | Models in picker, agent if base allowed |

Do **not** invent roles like “sales” for model access — use **teams** + grants.

### 4.3 Session context

```
Session {
  userId
  activeOrgId      // always set after login (bootstrap/default membership)
  activeTeamId?    // optional; v1 does not require for grant match
}
```

- Login: choose default org = sole membership, or last-used, or primary flag.  
- `GET /api/auth/me` returns: user, `orgs[]`, `activeOrg`, `teamsInActiveOrg[]`, role in active org.  
- `POST /api/context` `{ orgId, teamId?: string | null }` switches context (must be a membership).  
- Org switcher UI: only if `orgs.length >= 2` (P2 polish; data path in P0).

### 4.4 Grant resolution (models)

Inputs: `userId`, `activeOrgId`, `orgRole`, `teamIds[]` (all teams user belongs to in org), `accessMode`, candidate offerings (enabled ∧ visible ∧ ¬embed).

```
if accessMode == "open" AND no grants for resource_type=model in org:
  → all candidates

if accessMode == "open" AND some grants exist:
  → candidates matching ANY grant  ∪  (optional: still all? LOCK: when any model grant exists, switch to allowlist semantics for models)
  
REVISED LOCK (clearer):
  accessMode open  → ignore grants for inclusion (all enabled visible); grants unused for catalog
  accessMode allowlist → candidate must match ≥1 grant

if accessMode == "allowlist":
  allowed if ANY grant matches:
    subject_type=org
    OR subject_type=role AND subject_id == orgRole
    OR subject_type=team AND subject_id ∈ teamIds
    OR subject_type=user AND subject_id == userId
```

**Open vs grants coexistence:** Prefer the revised lock:

- **`open`:** catalog = enabled+visible; grants may exist for future/analytics but **do not filter**.  
- **`allowlist`:** catalog filtered by grants only.

Admins flip `accessMode` when ready for team-based lockdown. Avoids “I added one team grant and everyone else lost models.”

**Agents:** include agent in picker iff user may use `baseModelRef` under the same rules.

### 4.5 Default / pinned models

Keep org settings:

- `defaultModelRefs[]`, `pinnedModelRefs[]`  
- Resolve against **post-grant** catalog (user must still be allowed the model).

---

## 5. Data model

### 5.1 Existing (keep)

- `users`, `organizations`, `members (organization_id, user_id, role)`  
- `models`, `provider_connections`, `agent_presets` — already `org_id`  
- `model_allowlists` — **migrate → access_grants**, then drop or view-compat

### 5.2 New tables

**`teams`**

| Column | Notes |
| --- | --- |
| id, org_id, name, slug | unique (org_id, slug) |
| created_at, updated_at | |

**`team_members`**

| Column | Notes |
| --- | --- |
| id, team_id, user_id | unique (team_id, user_id) |
| role | optional text; v1 unused or `member` only |
| created_at | |

**`access_grants`**

| Column | Notes |
| --- | --- |
| id, org_id | |
| resource_type | `model` \| `agent` (agent unused v1) |
| resource_ref | modelRef string |
| subject_type | `org` \| `role` \| `team` \| `user` |
| subject_id | null for org; role name; team id; user id |
| effect | `allow` only in v1 |
| created_at, created_by | |

Unique: `(org_id, resource_type, resource_ref, subject_type, subject_id)`.

**`organizations_ext.settings` additions**

```json
{
  "accessMode": "open",
  "defaultModelRefs": [],
  "pinnedModelRefs": [],
  "modelDefaults": {}
}
```

**Session / user prefs (pick one in P0)**

- Prefer session payload + `user_settings` / `members` column `last_active_at`  
- Store `lastActiveOrgId` on user or membership for re-login

### 5.3 Migration from `model_allowlists`

| Old | New |
| --- | --- |
| `(org, modelRef, role=null)` | grant `subject_type=org` or treat null role as all-roles → **one grant per role** *or* `subject_type=org` |
| `(org, modelRef, role=admin)` | `subject_type=role`, `subject_id=admin` |

Migration SQL + domain dual-read for one release if needed; then API writes only grants.

**Semantic note:** Old empty allowlist = open. Map org with zero grant rows + default `accessMode=open`. Orgs that had any allowlist row → set `accessMode=allowlist` and migrate rows.

---

## 6. Domain API (pure functions)

```ts
// packages/domain
type AccessMode = "open" | "allowlist";
type GrantSubjectType = "org" | "role" | "team" | "user";

type AccessGrant = {
  resourceType: "model" | "agent";
  resourceRef: string;
  subjectType: GrantSubjectType;
  subjectId: string | null;
  effect: "allow";
};

function isResourceAllowed(input: {
  accessMode: AccessMode;
  grants: AccessGrant[];
  resourceType: "model" | "agent";
  resourceRef: string;
  orgRole: OrgRole;
  userId: string;
  teamIds: string[];
}): boolean;

function filterCatalogByAccess<T extends { modelRef: string }>(...): T[];
```

Replace/extend `isModelAllowed` / `modelsForUser` to take grants + accessMode + teamIds.

---

## 7. HTTP API (additive)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/auth/me` | Extend: orgs, activeOrg, teamsInActiveOrg, accessMode |
| POST | `/api/context` | Switch activeOrgId / activeTeamId |
| GET/POST/PATCH/DELETE | `/api/admin/teams` | Teams CRUD + membership |
| GET/POST/DELETE | `/api/admin/access-grants` | List/create/delete grants |
| GET/PATCH | `/api/admin/org-settings` or extend model-defaults | `accessMode` |
| GET | `/api/models` | Already catalog; use new filter |

All admin routes: `requireOrgRole(admin)` **in active org**.

Invites: remain org-scoped; optional `defaultTeamIds[]` on invite (P1 nice-to-have).

---

## 8. UI

### 8.1 Admin → Members

- Roster + invites (existing)  
- **Teams** subsection or tab: create team, add/remove members  
- No custom roles UI  

### 8.2 Admin → Access (evolve `/admin/models` allowlist)

- Org **access mode** toggle: Open / Allowlist  
- Grants table: model (searchable offering pick) × subject (org / role / team / user)  
- Empty state copy: “Open mode: everyone with chat can use enabled models. Switch to Allowlist to restrict.”  

### 8.3 Admin → Providers

- Unchanged focus: connections + offerings + caps  
- Link: “Manage who can use models → Access”  

### 8.4 Chat / shell

- P0: session always has activeOrgId (invisible if one org)  
- P2: org switcher in user menu if ≥2 orgs  
- Team switcher: **not required** in v1; optional later for defaults only  

---

## 9. Security

- Never resolve models/providers without `activeOrgId`.  
- Switching org reloads catalog; no cross-org cache keys without org prefix.  
- Team membership changes audit: `team.member_added`, `access_grant.created`, etc.  
- Grants cannot reference `modelRef` outside org.  
- `subject_type=user` only users who are org members.  

---

## 10. Phased delivery

### P0 — Foundation (ship first)

**Outcome:** Correct resolve path; no broken single-org UX.

1. Migration: `teams`, `team_members`, `access_grants`; settings `accessMode`  
2. Migrate `model_allowlists` → grants + set accessMode  
3. Domain: `isResourceAllowed`, wire `modelsForUser` / `buildModelCatalog`  
4. Session: persist/load `activeOrgId` (default sole membership)  
5. Extend `/api/auth/me` with orgs + activeOrg (even if length 1)  
6. `POST /api/context` (org only required)  
7. Tests: open mode; allowlist by role/team/user/org; agent via base; isolation by orgId  

**Exit:** Single-org deploy behaves as today when `accessMode=open`.

### P1 — Teams + Access UI

1. Admin Teams CRUD + membership  
2. Access page: mode toggle + grants UI (searchable models, subject pickers)  
3. Deprecate free-typed allowlist-only flow  
4. Audit events  
5. Docs/runbook: open vs allowlist, teams for model access  

### P2 — Org switcher polish

1. User menu org switcher if ≥2 memberships  
2. Last-active org memory  
3. Clear errors when invite adds second org  
4. Optional: activeTeamId preference for future defaults (still optional for grants)  

### Later (out of this plan’s implement phases)

- Create-org product surface / SaaS onboarding  
- Custom roles  
- Team-scoped data  
- Per-agent grants  
- Deny rules  

---

## 11. Testing strategy

| Layer | Cases |
| --- | --- |
| Domain | Matrix accessMode × subject types; empty grants; multi-team union |
| DB | Migrate allowlist fixtures; grant unique constraints |
| API | Admin grant CRUD RBAC; context switch forbidden across non-membership |
| Catalog | Member vs admin under allowlist; agent hidden if base denied |
| Regression | `accessMode=open` matches pre-change empty allowlist behavior |

---

## 12. Implementation map (code touch points)

```
packages/domain/
  policies/rbac.ts          # unchanged roles
  model-allow.ts            # replace/extend → access-grants.ts
  models-for-user.ts        # teamIds + accessMode

packages/db/
  migrations/00x_teams_access.sql
  schema/ + repos/teams.ts, access-grants.ts
  migrate model_allowlists

packages/auth/
  session + me payload, context switch

apps/web/
  routes/api/auth/me, context
  routes/api/admin/teams, access-grants
  features/admin/members-admin (teams)
  features/admin/access-admin (grants + mode)
  sidebar-user-menu (P2 switcher)
```

---

## 13. Success criteria

1. Fresh self-host: one org, open mode, no switcher, full enabled catalog — **zero extra clicks**.  
2. Admin can create teams, attach models to a team, set allowlist mode, and non-members of that team **do not** see those models.  
3. User invited to second org can switch (P2 UI) and never sees first org’s chats/providers.  
4. No custom roles; no team-private chat data; no create-org button.  

---

## 14. Open items (non-blocking)

- Exact default-org selection when memberships ≥ 2 (last-active vs primary flag).  
- Whether `subject_type=org` grant is needed when mode is allowlist (yes — “whole company may use this model”).  
- Invite payload `teamIds[]` in P1 or P1.1.  

---

## 15. Approval checklist

- [x] D1–D12 accepted as written  
- [x] Open vs allowlist semantics accepted (grants only filter in allowlist mode)  
- [x] Phased P0→P1→P2 accepted  
- [x] Written to docs/orgs-teams-access-plan.md; implement P0 when scheduled  

---

*End of plan.*
