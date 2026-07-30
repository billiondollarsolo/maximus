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
# Serve with srvx: static client assets + server entry fetch handler.
find_srvx() {
  # Prefer direct dependency path, then pnpm virtual store
  if [ -f node_modules/srvx/bin/srvx.mjs ]; then
    echo "node_modules/srvx/bin/srvx.mjs"
    return
  fi
  if [ -f apps/web/node_modules/srvx/bin/srvx.mjs ]; then
    echo "apps/web/node_modules/srvx/bin/srvx.mjs"
    return
  fi
  ls -1 node_modules/.pnpm/srvx@*/node_modules/srvx/bin/srvx.mjs 2>/dev/null | head -1
}

SERVER_ENTRY=""
STATIC_DIR=""
if [ -f apps/web/dist/server/server.js ]; then
  SERVER_ENTRY="apps/web/dist/server/server.js"
  STATIC_DIR="apps/web/dist/client"
elif [ -f apps/web/.output/server/index.mjs ]; then
  # Legacy Nitro-style output
  exec node apps/web/.output/server/index.mjs
elif [ -f dist/server/server.js ]; then
  SERVER_ENTRY="dist/server/server.js"
  STATIC_DIR="dist/client"
fi

if [ -z "$SERVER_ENTRY" ]; then
  echo "No server entry found (expected apps/web/dist/server/server.js). Run build first." >&2
  exit 1
fi

SRVX_BIN="$(find_srvx || true)"
if [ -z "$SRVX_BIN" ] || [ ! -f "$SRVX_BIN" ]; then
  echo "srvx not found in node_modules — cannot start fetch-handler server." >&2
  exit 1
fi

echo "Starting Maximus (srvx) entry=$SERVER_ENTRY static=$STATIC_DIR host=$HOST port=$PORT"
exec node "$SRVX_BIN" serve --prod \
  --host "$HOST" \
  --port "$PORT" \
  ${STATIC_DIR:+--static "$STATIC_DIR"} \
  --entry "$SERVER_ENTRY"
