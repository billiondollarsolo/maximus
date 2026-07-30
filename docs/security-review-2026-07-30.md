# Security checklist pass (2026-07-30)

Review against [security-self-host.md](./security-self-host.md) before public DNS.

## Defaults verified (code / packaging)

| Control | Evidence |
| --- | --- |
| Invite-only after bootstrap | `bootstrapOwner` / `needsBootstrap`; invite routes only |
| Server-authoritative chat | `runChatTurn` rebuilds history from DB; client messages ignored |
| BYOK AES-GCM | `encryptSecret` / `decryptSecret`; Admin never returns secrets |
| Same-origin mutations | `guardMutation` → `assertSameOrigin` |
| Security headers | `withSecurityHeaders` on API responses |
| Rate limits fail closed | Valkey limiter; org/env fail-open opt-in only |
| Prod cookies Secure/HttpOnly | `sessionCookieHeader` + `COOKIE_SECURE` |
| Non-root container | Dockerfile `useradd` uid 10001 |
| Private data-plane ports | Prod compose: no published PG/Valkey/S3 |
| Secrets not in git | `.gitignore` for `.env*` (examples only) |
| SSRF on provider URLs | `assertSafeBaseUrl` on test/live paths |
| Infrastructure not in SPA forms | PG/S3/Valkey env-only; Overview health-only |

## Before public DNS (operator checklist)

- [ ] HTTPS via Caddy (`TLS_MODE=http01|cloudflare|route53`)  
- [ ] Strong `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `S3_SECRET_KEY`  
- [ ] `ENCRYPTION_KEY` offline backup  
- [ ] `APP_URL` = public `https://DOMAIN`  
- [ ] Owner password ≥ 10 chars  
- [ ] Firewall: only 80/443 (or 443-only with DNS-01 edge)  
- [ ] `.env.prod` mode `600`; never committed  
- [ ] SSH hardened; OS updates  

## Residual risks (honest)

| Item | Status |
| --- | --- |
| MFA / SSO | Not in this release |
| CSP `'unsafe-inline'` | Present (UI stack); tighten later |
| Dedicated login rate bucket | Shared chat limiter; separate bucket still roadmap |
| Multi-tenant hostile SaaS | Out of scope (invite-only self-host) |
| Helm default PG/MinIO | Demo-grade; use external/CNPG for prod |

## Disclosure

See [SECURITY.md](../SECURITY.md) for private reporting.

**Conclusion:** Safe to expose with **TLS + secrets + invite-only** and the operator checklist above. Not certified for public multi-tenant SaaS.
