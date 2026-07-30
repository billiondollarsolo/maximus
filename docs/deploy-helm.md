# Helm deploy

Chart path: **`deploy/helm/maximus`**

## Prerequisites

- Kubernetes 1.25+  
- Helm 3  
- Container image built from `docker/Dockerfile` and pushed to a registry your cluster can pull  
- Optional: [CloudNativePG](https://cloudnative-pg.io/) operator for production Postgres  
- Optional: cert-manager + Ingress controller  

## Quick install (in-cluster data — small / demo)

```bash
# Build & push image first
docker build -f docker/Dockerfile -t YOUR_REG/maximus:0.1.0 .
docker push YOUR_REG/maximus:0.1.0

ENC=$(openssl rand -base64 32)

helm upgrade --install maximus ./deploy/helm/maximus \
  --set image.repository=YOUR_REG/maximus \
  --set image.tag=0.1.0 \
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
  --set image.tag=0.1.0 \
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
| `migrate.enabled` | Helm pre-install/upgrade Job |

Full defaults: [`deploy/helm/maximus/values.yaml`](../deploy/helm/maximus/values.yaml).

## After install

1. `curl -fsS https://YOUR_HOST/api/health`  
2. Open `/login` → bootstrap owner  
3. Admin → Overview → confirm PG / Valkey / object store tiles  

See also [deploy-external.md](./deploy-external.md) and [deploy.md](./deploy.md) (Compose).
