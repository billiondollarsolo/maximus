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

PORT="${PORT:-3000}"
HOST="${HOST:-0.0.0.0}"

# TanStack Start emits a fetch-handler entry (not a listening process).
# Use docker/serve.mjs to serve client assets + forward to the fetch handler.
# (srvx CLI currently drops --static when --entry is set.)
SERVER_ENTRY=""
STATIC_DIR=""
if [ -f apps/web/dist/server/server.js ]; then
  SERVER_ENTRY="apps/web/dist/server/server.js"
  STATIC_DIR="apps/web/dist/client"
elif [ -f apps/web/.output/server/index.mjs ]; then
  exec node apps/web/.output/server/index.mjs
elif [ -f dist/server/server.js ]; then
  SERVER_ENTRY="dist/server/server.js"
  STATIC_DIR="dist/client"
fi

if [ -z "$SERVER_ENTRY" ]; then
  echo "No server entry found (expected apps/web/dist/server/server.js). Run build first." >&2
  exit 1
fi

if [ ! -d "$STATIC_DIR" ]; then
  echo "Static dir missing: $STATIC_DIR" >&2
  exit 1
fi

export PORT HOST SERVER_ENTRY STATIC_DIR
echo "Starting Maximus entry=$SERVER_ENTRY static=$STATIC_DIR host=$HOST port=$PORT"
exec node docker/serve.mjs
