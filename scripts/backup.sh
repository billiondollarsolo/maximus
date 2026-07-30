#!/usr/bin/env bash
# Backup Postgres + list volume hints for RustFS
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/backups}"
mkdir -p "$OUT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

COMPOSE=(docker compose -f "$ROOT/docker/docker-compose.prod.yml")
if [[ -f "$ENV_FILE" ]]; then
  COMPOSE+=(--env-file "$ENV_FILE")
fi

echo "Dumping Postgres → $OUT/pg-$STAMP.sql.gz"
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-maximus}" "${POSTGRES_DB:-maximus}" \
  | gzip >"$OUT/pg-$STAMP.sql.gz"

echo "Done."
echo "Also back up Docker volumes: maximus_pg, maximus_valkey, maximus_rustfs, caddy_data"
echo "  docker volume ls | grep maximus"
echo "Store ENCRYPTION_KEY offline separately — dumps without it cannot decrypt BYOK keys."
