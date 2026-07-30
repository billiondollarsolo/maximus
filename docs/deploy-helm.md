# Helm deploy

Chart path: **`deploy/helm/maximus`**  
Helm **3.x and 4.x** both work (`apiVersion: v2` chart).

## Prerequisites

- Kubernetes 1.25+  
- **Helm 3** or **Helm 4**  
- Container image your cluster can pull (GHCR release or self-built)  
- Optional: [CloudNativePG](https://cloudnative-pg.io/) operator for production Postgres  
- Optional: cert-manager + Ingress controller  

## GHCR image pull

Release tags (`v*`) build **`ghcr.io/billiondollarsolo/maximus`** via [`.github/workflows/release-ghcr.yml`](../.github/workflows/release-ghcr.yml).

| Tag style | Example |
| --- | --- |
| Semver | `ghcr.io/billiondollarsolo/maximus:0.1.1` |
| Latest (on `v*` tags) | `ghcr.io/billiondollarsolo/maximus:latest` |

**GHCR packages default to private.** Pick one:

### A) Make the package public (best for open-source self-host)

1. GitHub → org/user **Packages** → **maximus**  
2. **Package settings** → **Change visibility** → **Public**  
3. No `imagePullSecrets` needed.

```bash
# Verify
docker pull ghcr.io/billiondollarsolo/maximus:0.1.1
```

### B) Private package + pull secret

```bash
# PAT needs read:packages (enable SSO if the org requires it)
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_PAT \
  --docker-email=you@example.com \
  -n YOUR_NAMESPACE
```

Helm:

```bash
helm upgrade --install maximus ./deploy/helm/maximus \
  --set image.repository=ghcr.io/billiondollarsolo/maximus \
  --set image.tag=0.1.1 \
  --set imagePullSecrets[0].name=ghcr-pull \
  # …secrets, app.url, etc.
```

Sample manifest notes: [`examples/ghcr-pull-secret.yaml`](../deploy/helm/maximus/examples/ghcr-pull-secret.yaml).

### C) Self-built registry

```bash
docker build -f docker/Dockerfile -t YOUR_REG/maximus:0.1.1 .
docker push YOUR_REG/maximus:0.1.1
# --set image.repository=YOUR_REG/maximus --set image.tag=0.1.1
```

## Quick install (in-cluster data — small / demo)

```bash
ENC=$(openssl rand -base64 32)

helm upgrade --install maximus ./deploy/helm/maximus \
  --set image.repository=ghcr.io/billiondollarsolo/maximus \
  --set image.tag=0.1.1 \
  # --set imagePullSecrets[0].name=ghcr-pull   # if package is private
  --set secrets.encryptionKey="$ENC" \
  --set app.url=https://chat.example.com \
  --set postgresql.auth.password=strong-pg-pass \
  --set redis.auth.password=strong-redis-pass \
  --set objectStorage.minio.rootPassword=strong-minio-pass
```

This starts:

| Component | When |
| --- | --- |
| Maximus web + migrate Job | always |
| Postgres StatefulSet | `postgresql.enabled=true` (default) |
| Valkey StatefulSet | `redis.enabled=true` (default) |
| MinIO StatefulSet | `objectStorage.mode=minio` (default) |

**Not recommended for serious production** without storage classes, backups, and HA Postgres.

## Production: external / cloud-native data

```bash
helm upgrade --install maximus ./deploy/helm/maximus \
  -f deploy/helm/maximus/examples/values-external.yaml \
  --set image.repository=YOUR_REG/maximus \
  --set image.tag=0.1.1 \
  --set secrets.encryptionKey="$ENC" \
  --set externalDatabase.url='postgres://…' \
  --set externalRedis.url='redis://:…@…' \
  --set objectStorage.external.endpoint='https://…' \
  --set objectStorage.external.accessKey='…' \
  --set objectStorage.external.secretKey='…'
```

Or inject one Secret:

```yaml
secrets:
  existingSecret: maximus-external
```

Required keys in that Secret:  
`ENCRYPTION_KEY`, `DATABASE_URL`, `VALKEY_URL`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE`.

### CloudNativePG

```bash
# install operator (see CNPG docs), then:
kubectl apply -f deploy/helm/maximus/examples/cnpg-cluster.yaml
# set externalDatabase.url to maximus-pg-rw service
```

## Ingress & TLS

Helm does **not** embed Caddy ACME (that’s Compose). Use Ingress + either automated cert-manager or a user-provided Secret. Details: [tls.md](./tls.md).

### Automated LE (cert-manager) — auto-renew

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod  # or DNS-01 Cloudflare/R53 issuer
  hosts:
    - host: chat.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: maximus-tls
      hosts: [chat.example.com]
```

### User-provided certs

```bash
kubectl create secret tls maximus-tls --cert=tls.crt --key=tls.key -n YOUR_NS
# set ingress.tls[].secretName: maximus-tls
```

Rotate by replacing the Secret contents; reload Ingress if needed.

For SSE (chat + admin overview streams), ensure the ingress **does not buffer** event streams (proxy timeouts high enough; disable response buffering if needed).

## Values reference (high level)

| Key | Meaning |
| --- | --- |
| `postgresql.enabled` | In-chart Postgres (off for CNPG/RDS) |
| `externalDatabase.url` | Full Postgres URL when chart PG off |
| `redis.enabled` | In-chart Valkey |
| `externalRedis.url` | Managed Redis URL |
| `objectStorage.mode` | `minio` \| `external` |
| `secrets.existingSecret` | Use external Secret instead of chart-generated |
| `imagePullSecrets` | Pull private GHCR / registry images |
| `migrate.enabled` | Job on **post-install** + **pre-upgrade** (retries until DB up) |
| `migrate.runOnWeb` | Web entrypoint runs migrations before listen (default `true`) |
| `bootstrap.enabled` | Optional first-owner Job (empty DB only) |
| `trustProxy` | Honor `X-Forwarded-*` behind Ingress (default `true`) |

Full defaults: [`deploy/helm/maximus/values.yaml`](../deploy/helm/maximus/values.yaml).

## Migrations (install / upgrade order)

| Phase | What runs |
| --- | --- |
| Install (resources) | Secret, Postgres/Valkey/MinIO (if enabled), Deployment, Service, … |
| **post-install** hook | Migrate Job (waits/retries for Postgres) |
| Web start | `RUN_MIGRATE=1` — same migrations before HTTP listen (idempotent) |
| **pre-upgrade** hook | Migrate Job against the live DB before the new pods roll |

We deliberately **do not** use `pre-install` for migrate: the app Secret and database do not exist yet on a greenfield install.

## Optional first-owner bootstrap

```bash
helm upgrade --install maximus ./deploy/helm/maximus \
  --set bootstrap.enabled=true \
  --set bootstrap.email=owner@example.com \
  --set bootstrap.password='long-password-here' \
  # …image, secrets.encryptionKey, etc.
```

Or `bootstrap.existingSecret` with keys `email` / `password`.  
Job is post-install (calls in-cluster Service with public `Origin`); **403 when users exist is success** (idempotent).

## After install

1. `curl -fsS https://YOUR_HOST/api/health`  
2. Bootstrap (UI, Job, or API) if not automated  
3. Admin → Overview → confirm PG / Valkey / object store tiles  

### TLS samples

- [cert-manager-http01.yaml](../deploy/helm/maximus/examples/cert-manager-http01.yaml)  
- [cert-manager-cloudflare-dns01.yaml](../deploy/helm/maximus/examples/cert-manager-cloudflare-dns01.yaml)  
- [cert-manager-route53-dns01.yaml](../deploy/helm/maximus/examples/cert-manager-route53-dns01.yaml)  

See also [deploy-external.md](./deploy-external.md), [tls.md](./tls.md), and [deploy.md](./deploy.md) (Compose).
