# External data plane (Postgres, Valkey, S3)

Maximus **never** stores infrastructure credentials in the Admin UI.  
Configure **Postgres**, **Valkey/Redis**, and **S3-compatible storage** via **environment / secrets** at deploy time. Admin **Overview** only reports connectivity (ok / error / latency).

## App env (already supported)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `VALKEY_URL` | Redis protocol URL (password in URL) |
| `S3_ENDPOINT` | S3 API base (AWS, R2, MinIO, GCS interop, …) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Object credentials |
| `S3_BUCKET` | Bucket name (create before first upload) |
| `S3_REGION` | Region string |
| `S3_FORCE_PATH_STYLE` | `true` for MinIO/RustFS path-style |

Local defaults live in [`.env.example`](../.env.example). Production template: [`.env.prod.example`](../.env.prod.example).

---

## Docker Compose

### Bundled (default)

```bash
# .env.prod
DEPLOY_MODE=bundled
COMPOSE_PROFILES=bundled
POSTGRES_PASSWORD=…
VALKEY_PASSWORD=…
S3_SECRET_KEY=…
./scripts/up-prod.sh
```

Starts **Postgres + Valkey + RustFS** on the internal network only (Caddy is the public edge).

### External managed services

```bash
# .env.prod
DEPLOY_MODE=external
COMPOSE_PROFILES=          # empty — do not start postgres/valkey/rustfs

DATABASE_URL=postgres://maximus:…@db.example.com:5432/maximus
VALKEY_URL=redis://:…@redis.example.com:6379
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_ACCESS_KEY=…
S3_SECRET_KEY=…
S3_BUCKET=maximus-uploads
S3_FORCE_PATH_STYLE=false

ENCRYPTION_KEY=…
DOMAIN=chat.example.com
# …
./scripts/up-prod.sh
```

Only **Caddy + migrate + web** run. Ensure:

1. Network path from the Docker host/network to DB/Redis/S3  
2. Bucket exists (`scripts/ensure-s3-bucket.mjs` or cloud console)  
3. Migrate job can reach Postgres (`pnpm db:migrate` uses `DATABASE_URL`)

---

## Kubernetes / Helm

See **[deploy-helm.md](./deploy-helm.md)** and:

```bash
helm upgrade --install maximus ./deploy/helm/maximus \
  -f deploy/helm/maximus/examples/values-external.yaml
```

### CloudNativePG

1. Install the [CNPG operator](https://cloudnative-pg.io/).  
2. Apply [examples/cnpg-cluster.yaml](../deploy/helm/maximus/examples/cnpg-cluster.yaml) (edit secrets).  
3. Set `postgresql.enabled=false` and `externalDatabase.url` to the **rw** service.

### Managed S3

Set `objectStorage.mode=external` and fill `objectStorage.external.*` (or inject via `secrets.existingSecret`).

---

## Admin UI

| Do | Don’t |
| --- | --- |
| Use **Overview** to verify PG / Valkey / object store health | Paste DB passwords into the SPA |
| Configure **LLM** BYOK under Providers | Treat Overview as a connection-string form |

Infrastructure stays **ops-owned**; product config stays **org-owned** (models, members, allowlists).

---

## Checklist

- [ ] `DATABASE_URL` reachable; migrations applied  
- [ ] `VALKEY_URL` PING works (rate limits fail closed if not)  
- [ ] S3 bucket exists; `S3_ENDPOINT` + credentials list objects  
- [ ] `ENCRYPTION_KEY` backed up offline  
- [ ] `/api/health` ok; Admin Overview components ok  
