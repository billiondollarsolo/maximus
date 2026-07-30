# UI parity checklist (ChatGPT-class)

Research basis (2024–2026 ChatGPT product UI):

- Canvas `#212121`, sidebar `#171717`, elevated surfaces `#2f2f2f`
- Composer large pill (~28px radius), soft shadow/hairline — **not** green send
- Send control: **neutral** filled circle (white-on-dark / black-on-light)
- Assistant: full-width prose + small mark; user: right soft bubble
- Model control sits **top-center** of main, not stacked on composer
- Empty state: large “What can I help with?” + quiet suggestion cards
- Sidebar: sparse icons, date groups, quiet wordmark — no chrome noise

## Shell

- [x] Dark default + light theme tokens
- [x] Theme toggle persists
- [x] Global CSS only (D17)
- [x] Lucide via Icon wrapper
- [x] Sidebar collapse + date-grouped history
- [x] Empty state centered (ChatGPT density)
- [x] Composer pill geometry + neutral send
- [x] Model picker top-center
- [x] Message layout (user bubble / assistant full-width)
- [x] Maximus wordmark (not OpenAI)

## Chat depth

- [x] Message hover actions + thumbs
- [x] Branch switcher
- [x] Code block copy
- [ ] Streaming without remount jank (partial)
- [ ] Virtualized long threads

## Admin / auth

- [x] Admin nav only for admin/owner
- [x] Auth card on product surfaces
