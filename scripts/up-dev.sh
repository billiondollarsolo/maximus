#!/usr/bin/env bash
# Start local infra (Postgres, Valkey, RustFS) for pnpm dev
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — run ./scripts/generate-secrets.sh --write .env"
fi

docker compose -f docker/docker-compose.yml up -d postgres valkey rustfs
echo "Infra up. Next:"
echo "  pnpm install"
echo "  pnpm db:migrate"
echo "  pnpm dev"
echo "Open http://localhost:3000"
