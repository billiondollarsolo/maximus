# TLS, Let’s Encrypt, user certs & automatic rotation

Caddy is the **inbound TLS proxy** in production Compose. Choose how certificates are obtained.

## Modes overview

| `TLS_MODE` | Challenge / source | Auto-renew | When to use | Ports | Secrets |
| --- | --- | --- | --- | --- | --- |
| `http01` | Let’s Encrypt **HTTP-01** | **Yes** (Caddy) | Simple VPS, public IP | **80 + 443** | `ACME_EMAIL` |
| `cloudflare` | LE **DNS-01** (Cloudflare) | **Yes** (Caddy) | Behind CF proxy / no open 80 | 443 | `CLOUDFLARE_API_TOKEN` |
| `route53` | LE **DNS-01** (Route 53) | **Yes** (Caddy) | DNS in AWS | 443 | AWS keys or instance role |
| `custom` | **User-provided** files | **You** rotate + reload | Corporate / purchased / vault-issued certs | 443 | files on disk |
| `local` | Caddy internal CA | n/a | Laptop / LAN smoke | any | none |

Set `TLS_MODE` in `.env.prod` and run `./scripts/up-prod.sh`.

---

## Automatic rotation (ACME modes)

For **`http01`**, **`cloudflare`**, and **`route53`**:

- Caddy obtains certificates from Let’s Encrypt (or the configured ACME CA).
- **Renewal is automatic** while the Caddy container keeps running — **no cron required**.
- Certs and account state live in the **`caddy_data`** Docker volume.
- Caddy renews well before expiry and reloads without dropping long-lived config.

**Ops checklist**

1. Do **not** delete the `caddy_data` volume casually (forces re-issue; watch LE rate limits).  
2. Keep ACME credentials valid (Cloudflare token / AWS IAM) for DNS-01 renewals.  
3. Monitor logs: `docker compose … logs -f caddy` for renewal errors.  
4. Optional: LE staging CA while testing (see below) to avoid rate limits.

There is nothing to schedule for “automated TLS” in these modes beyond running Caddy.

---

## HTTP-01 (default)

1. Point `DOMAIN` A/AAAA at the server.  
2. Open inbound **TCP 80 and 443**.  
3. `.env.prod`:

```bash
TLS_MODE=http01
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
```

4. `./scripts/up-prod.sh` → `docker/Caddyfile`.

LE validates `http://DOMAIN/.well-known/acme-challenge/...`. Caddy renews automatically.

---

## Cloudflare DNS-01

Use when orange-cloud is on, port 80 is closed, or you prefer DNS validation.

```bash
TLS_MODE=cloudflare
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
CLOUDFLARE_API_TOKEN=cf_xxxxxxxx   # Zone:DNS:Edit on that zone
```

`up-prod.sh` builds `docker/Dockerfile.caddy` (plugins) and uses `Caddyfile.cloudflare`.  
TXT `_acme-challenge` is managed by Caddy for issue **and** renew.

---

## AWS Route 53 DNS-01

```bash
TLS_MODE=route53
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

IAM needs `ChangeResourceRecordSets` / `GetChange` / `ListHostedZones` on the zone.  
EC2/EKS can use instance/IRSA roles instead of static keys when the environment supports it.

---

## User-provided certificates (`TLS_MODE=custom`)

For certs from a corporate PKI, digicert, cert-manager export, etc.

### 1. Place files

Default directory: `docker/certs/` (gitignored except README).

```bash
# Either:
docker/certs/tls.crt    # full chain preferred
docker/certs/tls.key

# Or certbot names (up-prod.sh symlinks them):
docker/certs/fullchain.pem
docker/certs/privkey.pem
```

Or any host path:

```bash
TLS_CERT_DIR=/etc/maximus/tls
```

### 2. Configure

```bash
TLS_MODE=custom
DOMAIN=chat.example.com
TLS_CERT_DIR=./docker/certs   # or absolute path
# ACME_EMAIL not required
```

### 3. Deploy

```bash
./scripts/up-prod.sh
```

Caddyfile: `docker/Caddyfile.custom` → `tls /certs/tls.crt /certs/tls.key`.  
Compose mounts `${TLS_CERT_DIR}` → `/certs:ro`.

### Rotation of user-provided certs

Automated ACME renewal **does not** apply. Your process must:

1. Write new `tls.crt` / `tls.key` (atomic replace recommended).  
2. Reload Caddy:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

Or restart the `caddy` service. Wire this to vault-agent, certbot deploy-hook, or your secret operator.

---

## Local / internal certs

```bash
TLS_MODE=local
DOMAIN=localhost
```

Caddy `tls internal` (`Caddyfile.local`). Browsers warn until you trust the local CA.

---

## Staging Let’s Encrypt

While testing ACME, avoid production rate limits:

```caddy
{
	email {$ACME_EMAIL}
	acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}
```

in the relevant Caddyfile. Remove for production.

---

## Kubernetes / Helm

Compose Caddy modes above are for **Docker Compose**. On Kubernetes:

| Need | Pattern |
| --- | --- |
| Automated LE | **cert-manager** ClusterIssuer (HTTP-01 or DNS-01 Cloudflare/R53) + Ingress TLS |
| User-provided cert | Create TLS Secret; set `ingress.tls[].secretName` (see `deploy/helm/maximus/values.yaml`) |
| Auto-rotation (ACME) | cert-manager renews and updates the Secret; Ingress controller reloads |
| Auto-rotation (custom) | External secret operator / vault injects Secret; restart/reload ingress pods as needed |

Example existing cert:

```yaml
ingress:
  enabled: true
  tls:
    - secretName: maximus-tls   # kubernetes of type kubernetes: kubernetes
      hosts: [chat.example.com]
```

Create Secret:

```bash
kubectl create secret tls maximus-tls \
  --cert=tls.crt --key=tls.key -n your-namespace
```

---

## Reverse proxy in front of Maximus

If a corporate load balancer terminates TLS and forwards to Caddy or only to `web`:

- Prefer terminating TLS at **one** place (edge LB **or** Caddy).  
- Set `APP_URL=https://public-host`.  
- Do not double-buffer SSE (see [deploy-helm.md](./deploy-helm.md)).  
- Set **`TRUST_PROXY=true`** (Compose prod default) so the app honors `X-Forwarded-For` / `X-Forwarded-Proto` / `X-Forwarded-Host` for client IP (login throttle) and CSRF origin checks.  
- Optional `TRUSTED_PROXY_HOPS` (default `1`).

## Kubernetes cert-manager samples

| File | Use |
| --- | --- |
| [cert-manager-http01.yaml](../deploy/helm/maximus/examples/cert-manager-http01.yaml) | LE HTTP-01 ClusterIssuer |
| [cert-manager-cloudflare-dns01.yaml](../deploy/helm/maximus/examples/cert-manager-cloudflare-dns01.yaml) | LE DNS-01 Cloudflare |
| [cert-manager-route53-dns01.yaml](../deploy/helm/maximus/examples/cert-manager-route53-dns01.yaml) | LE DNS-01 Route 53 |

cert-manager **auto-renews** certificates and updates TLS Secrets.

---

## Quick decision guide

```
Need public HTTPS with no cert ops?     → http01 or cloudflare/route53 (auto-renew)
Behind Cloudflare orange cloud?         → cloudflare DNS-01
DNS only on Route 53?                   → route53 DNS-01
Corp / bought / vault certs?            → custom + reload hook
Laptop smoke?                           → local
Kubernetes?                             → cert-manager or tls Secret + Ingress
```
