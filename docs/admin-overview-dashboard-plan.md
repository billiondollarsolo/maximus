# Admin Overview Dashboard — Implementation Plan

**Status:** Shipped (WP-O1–O5) — 2026-07-30  
**Date:** 2026-07-30  
**Canonical path:** `docs/admin-overview-dashboard-plan.md`  
**Related:** `docs/plan.md` §15 Overview, §17 Observability; `GET /api/health`; admin SPA; D12 (no message bodies)  
**Depends on (shipped):** shallow public health (app/postgres/valkey); usage events; providers list; members; admin shell UI system  

---

## 0. Executive summary

Turn **Admin → Overview** from four static counts into a **live control plane** for a **single-tenant self-host**:

1. **Health first** — overall status + dependency tiles (app, Postgres, Valkey, object storage)  
2. **Connectivity** — provider mode, encryption, platform keys, BYOK, allowlist posture  
3. **Live by default** — **SSE** pushes overview snapshots so the page feels instant (not poll-only)  
4. **Optional provider pings** — user-configured interval; never force paid probes  
5. **Demo mode** — clear banner when nothing is configured for live LLM use  

Usage/cost/sparklines are **phase O3+**, after health/connectivity are solid.

---

## 1. Locked product decisions (from product owner)

| ID | Decision | Locked choice | Reasoning |
| --- | --- | --- | --- |
| **O1** | Tenancy | **Single-tenant self-host for now** | One org in practice; still keep `orgId` in queries (schema already multi-org) |
| **O2** | Health depth | **Shallow public health** + **deep admin health** | Public `/api/health` stays load-balancer safe; overview uses admin SSE |
| **O3** | Provider probes | **Optional**, **user-defined interval** | Avoid surprise cost/rate limits; self-hosters opt in |
| **O4** | Demo / unconfigured | **Yes — Demo mode banner** when live path can’t work | Honest for empty BYOK + no platform keys + fake mode |
| **O5** | Live updates | **SSE for overview (and standard for future live pages)** | User preference: vibrant/instant; one reconnecting stream |
| **O6** | Priority | **Health + connectivity first** | Usage aggregates second wave |
| **O7** | Privacy | **No message bodies** on overview | D12 |
| **O8** | Secrets | Never show keys; only **configured / missing** | Security law |

### Open questions (resolved)

1. **Default provider ping interval** when enabled: **15 minutes** (min 5m, max 24h).  
2. **Store last probe results:** `credentials_meta.probe` on each connection + `providerProbeLastRunAt` in org settings.  
3. **SSE auth:** cookie session on `EventSource` same-origin; GET stream (no CSRF).  
4. **Public health:** shallow only; storage/provider only on admin overview.  
5. **Probe scheduler MVP:** only while overview SSE is open (+ manual Probe all now).  

---

## 2. Current state

| Surface | Today |
| --- | --- |
| Overview UI | Members count, provider count, raw usage row count, static “Invite-only” |
| `GET /api/health` | app, postgres, valkey; no storage, version, latency, providers |
| Live UI | Chat uses SSE; admin pages are one-shot fetch |
| Provider test | Manual “Test” on Providers page only |

---

## 3. Information architecture (Overview page)

```
┌──────────────────────────────────────────────────────────────────┐
│ Overview                              [Refresh now] · Live · · · │
│ Single-tenant workspace · v{version} · status: Operational       │
├──────────────────────────────────────────────────────────────────┤
│ [DEMO MODE] Provider mode is fake / no live credentials…  [docs] │
├────────────┬────────────┬────────────┬────────────┬──────────────┤
│ Overall    │ App        │ Postgres   │ Valkey     │ Object store │
│ Operational│ ok 2ms     │ ok 8ms     │ ok 1ms     │ ok 12ms      │
├────────────┴────────────┴────────────┴────────────┴──────────────┤
│ Connectivity                                                     │
│ Mode: live · ENCRYPTION_KEY: set · OpenAI platform: yes · …      │
│ BYOK: 2 enabled / 0 disabled · Allowlist: open (0 rules)         │
│ Provider probes: Off | Every 15m · Last run 2m ago               │
├──────────────────────────────────────────────────────────────────┤
│ Needs attention                                                  │
│ · Valkey degraded — rate limits may fail closed                  │
│ · Connection “Prod OpenAI” never probed                          │
├──────────────────────────────────────────────────────────────────┤
│ Team (compact) — later O3: Usage 7d · Spend                      │
└──────────────────────────────────────────────────────────────────┘
```

**Phase O1 ships:** header status, dependency tiles, connectivity strip, demo banner, SSE live updates, needs-attention (health-derived).  
**Phase O2 ships:** provider probe settings + last results on tiles/list.  
**Phase O3 ships:** usage 7d aggregates (not in this first ship unless trivial).

---

## 4. Domain model — overview snapshot

Pure TypeScript types (domain or web-shared):

```ts
export type ComponentStatus = "ok" | "degraded" | "error" | "unknown";

export type HealthComponent = {
  id: "app" | "postgres" | "valkey" | "storage" | string;
  label: string;
  status: ComponentStatus;
  latencyMs?: number | null;
  detail?: string | null; // safe, no secrets
  checkedAt: string; // ISO
};

export type ConnectivitySnapshot = {
  providerMode: "fake" | "live";
  encryptionKeyConfigured: boolean;
  platform: {
    openai: boolean;
    anthropic: boolean;
    ollamaBaseUrl: boolean;
  };
  byok: {
    total: number;
    enabled: number;
    disabled: number;
  };
  allowlistRuleCount: number;
  /** true when live LLM use is unlikely to work */
  demoMode: boolean;
  demoReasons: string[]; // e.g. "PROVIDER_MODE=fake", "No platform keys and no BYOK"
};

export type ProviderProbeSummary = {
  enabled: boolean;
  intervalMinutes: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  results: Array<{
    connectionId: string;
    name: string;
    kind: string;
    ok: boolean | null; // null = never
    latencyMs?: number | null;
    errorCode?: string | null;
    checkedAt?: string | null;
  }>;
};

export type AttentionItem = {
  id: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail?: string;
  href?: string; // /admin/providers etc.
};

export type OverviewSnapshot = {
  version: string | null;
  gitSha: string | null;
  environment: string | null; // NODE_ENV or APP_ENV
  overall: ComponentStatus;
  components: HealthComponent[];
  connectivity: ConnectivitySnapshot;
  probes: ProviderProbeSummary;
  attention: AttentionItem[];
  /** O3 placeholders optional */
  usage7d?: {
    turns: number;
    inputTokens: number;
    outputTokens: number;
    costMicros: number | null;
    errorTurns: number;
  } | null;
  generatedAt: string;
};
```

### 4.1 Overall status derivation

```
if any component status === error → overall error
else if any degraded OR demoMode → degraded  
else → ok
```

Map UI labels: `ok` → Operational, `degraded` → Degraded, `error` → Down.

### 4.2 Demo mode derivation (O4)

`demoMode = true` when **any**:

1. `PROVIDER_MODE !== "live"` (i.e. fake), **or**  
2. Live mode but **no** platform OpenAI/Anthropic/Ollama base **and** **no** enabled BYOK connection  

Reasons array for banner copy (human-readable, no secrets).

---

## 5. APIs

### 5.1 Public `GET /api/health` (keep shallow)

**No change required** beyond optional additive fields (safe):

```json
{
  "status": "ok" | "degraded",
  "checks": { "app": "ok", "postgres": "ok", "valkey": "ok" },
  "version": "0.0.0",
  "gitSha": "abc1234"
}
```

Do **not** add storage or provider pings here (LB spam + topology leak).

### 5.2 Admin deep health — snapshot builder

**`buildOverviewSnapshot(ctx, env, db, storage): Promise<OverviewSnapshot>`**

Used by:

- `GET /api/admin/overview` — one-shot JSON (for tests + first paint fallback)  
- `GET /api/admin/overview/stream` — SSE  

**Auth:** `requireAuth` + `requireOrgRole(admin)`.

**Checks (O1):**

| id | Method | Timeout |
| --- | --- | --- |
| app | always ok + process uptime | — |
| postgres | `SELECT 1` via existing pool/getDb | 2s |
| valkey | PING | 2s |
| storage | `HeadBucket` or `ListObjects` max-keys 1 / put-get probe of tiny key | 3s |

Record `latencyMs` with `performance.now()` or `Date.now()`.

### 5.3 SSE: `GET /api/admin/overview/stream`

**Protocol:**

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

: comment keepalive every 15s

event: snapshot
data: { ...OverviewSnapshot }

event: tick
data: { "serverTime": "..." }
```

**Behavior:**

1. On connect: immediately emit full `snapshot`.  
2. Recompute snapshot every **`OVERVIEW_SSE_INTERVAL_MS`** default **5000** (health/connectivity).  
3. If provider probes due (see §6), run probes **async**; next snapshot includes results.  
4. On client disconnect: abort timers, close Redis/SQL extras.  
5. **Do not** open a new DB pool per tick — use `getDb`.  
6. Cap concurrent admin streams per user (optional: 3) to avoid abuse.

**Client:**

```ts
const es = new EventSource("/api/admin/overview/stream", { withCredentials: true });
// Note: EventSource sends cookies same-origin by default in browsers for same site
es.addEventListener("snapshot", (e) => setSnapshot(JSON.parse(e.data)));
es.onerror → reconnect with exponential backoff (browser does basic reconnect)
```

**Fallback:** if EventSource fails, poll `GET /api/admin/overview` every 10s.

### 5.4 Provider probe settings (O2)

**Org settings** (extend `organizations_ext.settings` JSON — already exists):

```ts
type OverviewSettings = {
  providerProbeEnabled: boolean; // default false
  providerProbeIntervalMinutes: number; // default 15, clamp 5..1440
};
```

**API:**

- `GET /api/admin/overview/settings`  
- `PATCH /api/admin/overview/settings` — guardMutation, audit `overview.settings_updated`

**Probe execution:**

- Only when `providerProbeEnabled`  
- Interval from last run ≥ configured minutes  
- For each **enabled** connection: call existing `testProviderConnection` (models/tags list, cheap)  
- Persist last result per connection  

**Storage options:**

| Option | Pros | Cons |
| --- | --- | --- |
| A. `provider_connections.credentials_meta` or new `probe_meta` jsonb | No migration if using meta | Mixed concerns |
| B. New table `provider_probe_results` | Clean history | Migration |
| **Recommend A for MVP:** `probe: { ok, latencyMs, errorCode, checkedAt }` on connection meta or dedicated column `last_probe jsonb` |

**Manual:** “Probe all now” button → `POST /api/admin/overview/probe` runs once (rate-limit 1/min).

### 5.5 Attention items (pure function)

```ts
deriveAttention(snapshot): AttentionItem[]
```

Examples:

| Condition | severity | href |
| --- | --- | --- |
| postgres/valkey/storage error | critical | — |
| valkey degraded | warn | — |
| demoMode | info | /admin/providers |
| ENCRYPTION_KEY missing + BYOK exists | critical | — |
| probe enabled + connection never ok | warn | /admin/providers |
| last probe failed | warn | /admin/providers |

Unit-test this function exhaustively.

---

## 6. Live updates philosophy (SSE everywhere)

**Principle (user):** pages should feel live; prefer SSE over silent polling.

| Surface | Transport | Cadence |
| --- | --- | --- |
| Chat | SSE (existing) | per turn |
| Overview | SSE snapshot stream | 5s recompute |
| Future Usage/Audit | optional SSE or invalidate-on-mutation | later |

**Shared client helper:**

```ts
// features/live/use-event-source.ts
useEventSource(url, { onEvent, enabled })
```

Handles: connect, parse named events, reconnect, cleanup, auth failure → redirect login.

**Do not** use SSE for:

- Binary downloads  
- Mutations (stay POST + guardMutation)

---

## 7. UI specification

### 7.1 Design system reuse

- `AdminShell`, `AdminPageHeader`, `AdminStatCard`, `AdminAlert`, `AdminSection`, `DataTable` (for probe results if needed)  
- Status chip component **new:** `StatusPill` — ok/degraded/error colors from tokens  

### 7.2 Live indicator

Header trailing: green pulse **Live** when SSE connected; amber **Reconnecting…**; ghost **Offline** + fallback poll.

### 7.3 Demo banner

`AdminAlert tone="info"` or warn when `connectivity.demoMode`:

> **Demo mode** — {reasons joined}. Chat may use the fake provider. Configure platform keys or a BYOK connection and set `PROVIDER_MODE=live`.

Link: Providers, runbook.

### 7.4 Dependency tiles

Grid of 4–5 cards:

- Label  
- StatusPill  
- Latency  
- Optional one-line detail  

### 7.5 Connectivity strip

Definition list or compact chips (not a form).  
Settings for probe: **Switch** + interval **Select** (5 / 15 / 30 / 60 / 360 min) in a dialog “Configure probes” — not bare always-on form (enterprise IA).

### 7.6 Needs attention

List with severity icon + link. Empty → “All clear” muted panel.

---

## 8. Security

| Risk | Mitigation |
| --- | --- |
| Overview SSE leaks env | Only booleans + safe labels; no connection strings |
| Probe SSRF | Existing `assertSafeBaseUrl` on test path |
| Probe cost | Opt-in + min interval 5m + list models not completion |
| Admin stream DoS | Auth + interval + single snapshot builder shared |
| Public health abuse | Keep shallow; rate limit later if needed |

---

## 9. Work packages (granular)

### WP-O1 — Snapshot domain + deep health (M) — **first**

**Tasks**

- [ ] **O1.1** Types `OverviewSnapshot` (+ tests for `deriveOverall`, `deriveDemoMode`, `deriveAttention`)  
- [ ] **O1.2** `buildOverviewSnapshot` — pg, valkey, storage checks with latency  
- [ ] **O1.3** Connectivity from env + providerRepo counts + allowlist count  
- [ ] **O1.4** `GET /api/admin/overview` JSON  
- [ ] **O1.5** Version/gitSha from `process.env.APP_VERSION` / `GIT_SHA`  
- [ ] **O1.6** Integration tests: admin 200; member 403  
- [ ] **O1.7** Unit tests: demo mode reasons matrix  

**Acceptance:** curl as admin returns full snapshot; member 403; no secrets in JSON.

---

### WP-O2 — SSE stream + live Overview UI (M)

**Tasks**

- [ ] **O2.1** `GET /api/admin/overview/stream` SSE  
- [ ] **O2.2** `useEventSource` hook  
- [ ] **O2.3** Replace admin.index with live dashboard layout (tiles + connectivity + attention + demo banner)  
- [ ] **O2.4** Live/Reconnecting indicator  
- [ ] **O2.5** Fallback poll if SSE dies  
- [ ] **O2.6** Structural + unit tests for client parse of snapshot event  

**Acceptance:** open Overview → sees status without refresh when Valkey killed/restarted (manual); SSE first event within 1s.

---

### WP-O3 — Optional provider probes (M)

**Tasks**

- [ ] **O3.1** Settings schema in org settings JSON  
- [ ] **O3.2** GET/PATCH settings APIs + audit  
- [ ] **O3.3** Persist last probe on connection  
- [ ] **O3.4** Scheduler inside SSE loop or lightweight interval job when stream active **and** background `setInterval` when any admin connected — **MVP: only while overview SSE open** (document; avoids orphan workers)  
- [ ] **O3.5** `POST /api/admin/overview/probe` manual run  
- [ ] **O3.6** UI dialog: enable switch + interval + Probe now  
- [ ] **O3.7** Attention items from failed probes  
- [ ] **O3.8** Tests: disabled by default; clamp interval; probe uses testProviderConnection  

**Acceptance:** probes off by default; enable → results appear in next snapshots; never runs completions.

**Deviation note if needed:** Full background worker without open browser is Phase 2 (process-level cron).

---

### WP-O4 — Usage strip (S–M) — **after O1–O2**

**Tasks**

- [ ] **O4.1** Aggregate query `usage_events` last 7d for org  
- [ ] **O4.2** Add `usage7d` to snapshot  
- [ ] **O4.3** UI cards: turns, tokens, est. $, errors  

---

### WP-O5 — Docs + ops

- [ ] **O5.1** Runbook: demo mode, probes, SSE  
- [ ] **O5.2** Cross-link `docs/plan.md` Overview row  
- [ ] **O5.3** Env: `OVERVIEW_SSE_INTERVAL_MS`, `APP_VERSION`, `GIT_SHA`  

---

## 10. Example SSE session

```
event: snapshot
data: {"overall":"degraded","connectivity":{"providerMode":"fake","demoMode":true,"demoReasons":["PROVIDER_MODE is fake"],...},"components":[...],"attention":[{"id":"demo","severity":"info","title":"Demo mode",...}],"generatedAt":"..."}

event: snapshot
data: {"overall":"ok",...}   // 5s later after user switched to live + keys
```

---

## 11. File-level change list (expected)

```
packages/domain/src/overview-snapshot.ts       # pure derive* helpers
packages/domain/src/overview-snapshot.test.ts

packages/db/src/repos/overview.ts              # buildOverviewSnapshot
packages/db/src/repos/overview.test.ts
packages/db/src/repos/org-settings.ts          # probe settings

apps/web/src/routes/api/admin/overview.ts      # GET snapshot
apps/web/src/routes/api/admin/overview.stream.ts  # SSE
apps/web/src/routes/api/admin/overview.probe.ts   # POST probe
apps/web/src/routes/api/admin/overview.settings.ts

apps/web/src/features/live/use-event-source.ts
apps/web/src/features/admin/overview-dashboard.tsx
apps/web/src/features/admin/status-pill.tsx
apps/web/src/routes/admin.index.tsx            # thin shell

apps/web/src/routes/api/health.ts              # optional version fields

docs/admin-overview-dashboard-plan.md
docs/runbook.md
docs/plan.md                                   # cross-link
```

---

## 12. Test matrix

| ID | Case |
| --- | --- |
| T1 | deriveDemoMode: fake → true |
| T2 | deriveDemoMode: live + platform key → false |
| T3 | deriveDemoMode: live + no keys + no BYOK → true |
| T4 | deriveOverall: any error → error |
| T5 | deriveAttention: demo + storage error |
| T6 | GET overview 403 member |
| T7 | GET overview 200 admin includes components |
| T8 | SSE emits snapshot event (integration or unit of encoder) |
| T9 | Probe interval clamp 5..1440 |
| T10 | Probe disabled → no testProviderConnection calls |
| T11 | Structural: Overview uses EventSource / useEventSource |

---

## 13. Acceptance criteria (O1+O2 ship)

1. Overview shows **live** overall status and component tiles (pg, valkey, storage) with latency.  
2. Connectivity strip reflects mode, encryption configured, platform key presence, BYOK counts, allowlist.  
3. **Demo mode** banner when fake or unconfigured for live LLMs.  
4. Snapshot updates via **SSE** without full page reload; reconnect/fallback works.  
5. Member cannot open overview stream/API (403).  
6. No secrets in any snapshot field.  
7. Public `/api/health` remains shallow and load-balancer safe.  

**O3 add-on:** optional probes user-configurable; results on snapshot; off by default.

---

## 14. Sequencing

```
WP-O1 (snapshot + GET) → WP-O2 (SSE + UI) → WP-O3 (probes) → WP-O4 (usage) → WP-O5 (docs)
```

**Critical path for “health/connectivity first”:** O1 → O2.  
**Probes** are O3 (optional, user interval).  

---

## 15. Approval checklist

- [x] O1 single-tenant self-host  
- [x] O3 optional probes, user interval  
- [x] O4 demo mode banner  
- [x] O5 SSE for live overview  
- [x] O6 health/connectivity first  
- [x] Default probe interval (15m)  
- [x] Probe persistence (connection meta)  
- [x] Probe only while SSE open (MVP)  
- [x] Implemented WP-O1–O5  

---

## 16. Implementation notes (after approval)

1. Prefer pure `derive*` functions for demo/attention/overall — unit test first.  
2. Reuse `getDb`; never `createDb` per SSE tick.  
3. Reuse `testProviderConnection` for probes — do not invent completion-based pings.  
4. Keep public health and admin deep health separate.  
5. Update this doc Status when shipping.  

---

*End of plan. Next: approve remaining open questions, then implement WP-O1.*
