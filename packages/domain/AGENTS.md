# @maximus/domain

- Pure TypeScript only. No I/O, no React, no other workspace packages.
- Tree ops return plans (new nodes), never mutate history in place.
- Export public API only via `src/index.ts`.
- Colocate `*.test.ts`; keep coverage high on tree/model-ref/title.
