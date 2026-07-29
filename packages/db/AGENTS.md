# @maximus/db

- Expand/contract migrations only; never edit applied migrations.
- One entity family per repo file (`conversations.ts`, `messages.ts`, …).
- Never write Better Auth tables directly — use Better Auth APIs.
