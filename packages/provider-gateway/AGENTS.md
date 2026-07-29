# @maximus/provider-gateway

- May import `@maximus/domain` and `@maximus/config` only.
- Fake adapter for tests; no live provider network in unit CI.
- Encrypt secrets before callers persist them. SSRF-check every baseUrl.
