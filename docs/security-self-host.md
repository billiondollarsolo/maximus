# Self-host security checklist

For **single users and small invite-only teams**. Not a SOC2 certification.

## Defaults that help you

| Control | Status |
| --- | --- |
| Invite-only (no open signup) | Yes — bootstrap only when zero users |
| Server-authoritative chat history | Yes |
| BYOK encrypted at rest (AES-256-GCM) | Yes — needs `ENCRYPTION_KEY` |
| Same-origin guard on mutations | Yes |
| Security headers (CSP baseline, nosniff, frame deny) | Yes |
| Rate limits (Valkey), fail closed | Yes |
| Prod cookies Secure + HttpOnly | Yes when `COOKIE_SECURE=true` |
| Non-root container user | Yes |
| Private DB / Valkey / object store ports | Yes in prod compose |

## Before you expose the internet

- [ ] HTTPS via Caddy (`TLS_MODE=http01|cloudflare|route53`)  
- [ ] Strong `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `S3_SECRET_KEY`  
- [ ] `ENCRYPTION_KEY` generated and **backed up offline**  
- [ ] `APP_URL` matches public `https://DOMAIN`  
- [ ] Owner password ≥ 10 chars; not reused  
- [ ] Firewall: only 80/443 (or only 443 if DNS-01 + edge)  
- [ ] No `.env.prod` in git; file mode `600`  
- [ ] Optional: restrict SSH; fail2ban; automatic OS updates  

## Operational habits

1. **Backups** — `./scripts/backup.sh` + volume snapshots; test restore once.  
2. **Key rotation** — rotating `ENCRYPTION_KEY` requires re-entering BYOK keys ([runbook.md](./runbook.md)).  
3. **Updates** — pull, rebuild compose; migrate job is one-shot in prod stack.  
4. **Invites** — treat invite links as secrets; revoke unused invites.  
5. **Providers** — prefer least privilege API keys; use org allowlists for models.

## Known limitations (be honest with users)

- No MFA / SSO in this release (planned).  
- CSP allows `'unsafe-inline'` for current UI stack.  
- Login rate limiting is not fully bucketed separately from chat (roadmap).  
- Not multi-tenant SaaS isolation for hostile public signup.

## Reporting issues

See [SECURITY.md](../SECURITY.md) for private disclosure. Do not open public issues with secret material.

## Last review

Code/packaging pass: [security-review-2026-07-30.md](./security-review-2026-07-30.md).
