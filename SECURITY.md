# Security Policy

## Supported use

Maximus is intended for **self-hosted, invite-only** deployments (solo or small teams). Treat public multi-tenant SaaS as out of scope until SSO, MFA, and tenancy hardening land.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Email or message the maintainers privately with:

- Description and impact  
- Reproduction steps  
- Affected version / commit  
- Whether you plan to disclose publicly (and preferred timeline)

We will acknowledge receipt as soon as practical and work on a fix before coordinated disclosure.

## Self-host baseline

Follow [docs/security-self-host.md](./docs/security-self-host.md) and use production Compose with TLS ([docs/tls.md](./docs/tls.md)).

Never commit `.env` / `.env.prod` or real `ENCRYPTION_KEY` values.
