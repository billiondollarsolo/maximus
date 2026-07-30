#!/bin/sh
set -eu

# Optional one-shot migrate when RUN_MIGRATE=1 (used by migrate service or first boot)
if [ "${RUN_MIGRATE:-0}" = "1" ]; then
  echo "Running database migrations..."
  pnpm --filter @maximus/db exec tsx src/migrate.ts
  echo "Migrations complete."
  if [ "${MIGRATE_ONLY:-0}" = "1" ]; then
    exit 0
  fi
fi

# Prefer built server entry
if [ -f apps/web/dist/server/server.js ]; then
  exec node apps/web/dist/server/server.js
fi
if [ -f apps/web/.output/server/index.mjs ]; then
  exec node apps/web/.output/server/index.mjs
fi

echo "No server entry found. Run build first." >&2
exit 1
