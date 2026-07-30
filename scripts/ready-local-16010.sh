#!/usr/bin/env bash
# Bring the 1601x local stack into a healthy state for Admin Overview.
# Ports (default): app 16010 · pg 16011 · valkey 16012 · rustfs 16013/16014
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_PORT="${APP_PORT:-16010}"
POSTGRES_PORT="${POSTGRES_PORT:-16011}"
VALKEY_PORT="${VALKEY_PORT:-16012}"
S3_PORT="${S3_PORT:-16013}"
S3_CONSOLE_PORT="${S3_CONSOLE_PORT:-16014}"

export DATABASE_URL="${DATABASE_URL:-postgres://maximus:maximus@127.0.0.1:${POSTGRES_PORT}/maximus}"
export VALKEY_URL="${VALKEY_URL:-redis://127.0.0.1:${VALKEY_PORT}}"
export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:${S3_PORT}}"
export S3_ACCESS_KEY="${S3_ACCESS_KEY:-maximus}"
export S3_SECRET_KEY="${S3_SECRET_KEY:-maximussecret}"
export S3_BUCKET="${S3_BUCKET:-maximus-uploads}"
export APP_URL="${APP_URL:-http://127.0.0.1:${APP_PORT}}"

echo "==> Infra ports: pg=${POSTGRES_PORT} valkey=${VALKEY_PORT} s3=${S3_PORT}"

# Prefer existing maximus-e2e-smoke containers; else start maximus-dev with remapped ports.
if docker ps --format '{{.Names}}' | grep -q 'maximus-e2e-smoke-postgres'; then
  echo "==> Using maximus-e2e-smoke containers"
else
  echo "==> Starting maximus-dev with remapped host ports"
  POSTGRES_PORT="$POSTGRES_PORT" VALKEY_PORT="$VALKEY_PORT" \
    S3_PORT="$S3_PORT" S3_CONSOLE_PORT="$S3_CONSOLE_PORT" \
    docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs
fi

echo "==> Wait for postgres"
for i in $(seq 1 30); do
  if docker exec "$(docker ps -qf name=maximus-e2e-smoke-postgres -f name=docker-postgres -f name=maximus-dev-postgres | head -1)" \
      pg_isready -U maximus -d maximus >/dev/null 2>&1 \
    || psql "$DATABASE_URL" -c 'select 1' >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Ensure S3 bucket"
node scripts/ensure-s3-bucket.mjs

echo "==> Migrate"
pnpm db:migrate

echo "==> Seed e2e owner (if needed)"
pnpm --filter @maximus/auth exec tsx scripts/e2e-seed.ts || true

echo "Ready. Start or restart web with:"
echo "  set -a; source .env; set +a"
echo "  pnpm --filter @maximus/web exec vite dev --host 127.0.0.1 --port ${APP_PORT}"
echo "Login: maximus-e2e@test.local / E2eTestPass99!  →  ${APP_URL}/admin"
