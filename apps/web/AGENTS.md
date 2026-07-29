# @maximus/web

- **D17:** Global CSS only (`styles/tokens.css` + `styles/app.css`). No CSS modules / page CSS.
- Routes are thin shells — compose `features/*` + `components/*`.
- Icons: `lucide-react` via shared `Icon` wrapper only (add in WP1).
- Server-authoritative chat history when chat API lands.
- No business logic in route files.
