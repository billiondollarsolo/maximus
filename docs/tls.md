# TLS, Let’s Encrypt & DNS ACME

Caddy handles **automatic HTTPS** and **certificate renewal**. You choose how challenges are solved.

## Modes overview

| `TLS_MODE` | Challenge | When to use | Ports | API secrets |
| --- | --- | --- | --- | --- |
| `http01` | HTTP-01 | Simple VPS, public IP | **80 + 443** open | none |
| `cloudflare` | DNS-01 | Behind Cloudflare proxy, or no open 80 | 443 (or proxied) | `CLOUDFLARE_API_TOKEN` |
| `route53` | DNS-01 | DNS in AWS Route 53 | 443 | AWS keys or instance role |
| `local` | Internal CA | Laptop / LAN smoke | any | none |

Renewal is automatic while Caddy is running (no cron required).

---

## HTTP-01 (default)

1. Point `DOMAIN` A/AAAA records at your server.  
2. Open inbound **TCP 80 and 443**.  
3. Set in `.env.prod`:

```bash
TLS_MODE=http01
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
```

4. `./scripts/up-prod.sh` uses `docker/Caddyfile`.

Let’s Encrypt validates `http://DOMAIN/.well-known/acme-challenge/...` then issues certs. Caddy renews before expiry.

---

## Cloudflare DNS-01

Use when:

- Orange-cloud proxy is on, or  
- Port 80 cannot be exposed, or  
- You prefer DNS validation

### 1. API token

Cloudflare Dashboard → **My Profile → API Tokens → Create Token**

- Template: **Edit zone DNS** (or custom: `Zone.DNS:Edit` on the target zone)

### 2. Configure

```bash
TLS_MODE=cloudflare
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
CLOUDFLARE_API_TOKEN=cf_xxxxxxxx
```

### 3. Deploy

`./scripts/up-prod.sh` builds `docker/Dockerfile.caddy` (plugins: `cloudflare` + `route53`) and mounts `Caddyfile.cloudflare`.

Caddy creates `_acme-challenge` TXT records, obtains the cert, and keeps renewing.

### Tips

- Token should be limited to **one zone**.  
- If validation fails, check token zone resources and that `DOMAIN` is that zone (or a subdomain).  
- You can keep Cloudflare **proxied** (orange cloud) with DNS-01.

---

## AWS Route 53 DNS-01

### 1. IAM policy (minimal sketch)

Allow `route53:ChangeResourceRecordSets`, `GetChange`, `ListHostedZones` on the hosted zone for `DOMAIN`.

### 2. Configure

```bash
TLS_MODE=route53
DOMAIN=chat.example.com
ACME_EMAIL=ops@example.com
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### 3. Deploy

Same as Cloudflare: `./scripts/up-prod.sh` builds plugin Caddy and uses `Caddyfile.route53`.

On EC2/EKS you can omit static keys and use instance/IRSA roles if the plugin and environment support it (document your cloud’s credential chain).

---

## Local / internal certs

```bash
TLS_MODE=local
DOMAIN=localhost
```

Uses Caddy `tls internal` (`Caddyfile.local`). Browsers show a warning until you trust the local CA — fine for smoke tests.

---

## Staging Let’s Encrypt

While testing HTTP-01, avoid rate limits by temporarily enabling staging CA in `docker/Caddyfile`:

```caddy
{
	email {$ACME_EMAIL}
	acme_ca https://acme-staging-v02.api.letsencrypt.org/directory
}
```

Remove for production.

---

## Caddy data volume

Certificates live in the Docker volume **`caddy_data`**.  
Back it up with your volume backups so reinstalls don’t re-issue unnecessarily (not secret-critical like `ENCRYPTION_KEY`, but convenient).

---

## Custom / corporate CA

Mount your own certs and use a custom Caddyfile:

```caddy
chat.example.com {
	tls /certs/fullchain.pem /certs/privkey.pem
	reverse_proxy web:3000 {
		flush_interval -1
	}
}
```

---

## Verification

```bash
curl -vI "https://$DOMAIN"
curl -fsS "https://$DOMAIN/api/health"
# Expect: HTTP/2 200, Strict-Transport-Security present
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod logs caddy | tail
```

SSE chat: send a message in the UI; if tokens never arrive, check proxy buffering (stock Maximus Caddyfiles already disable it).
