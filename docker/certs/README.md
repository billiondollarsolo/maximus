# TLS certificates (TLS_MODE=custom)

Place user-provided files here (or set `TLS_CERT_DIR` to another host directory):

| File | Purpose |
| --- | --- |
| `tls.crt` | Certificate (or full chain) |
| `tls.key` | Private key |

Certbot-style names are also accepted by `scripts/up-prod.sh`:

- `fullchain.pem` → linked as `tls.crt`
- `privkey.pem` → linked as `tls.key`

**Do not commit real certs or keys.** This directory is gitignored except this README.

After rotating files on disk:

```bash
docker compose -f docker/docker-compose.prod.yml --env-file .env.prod exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```
