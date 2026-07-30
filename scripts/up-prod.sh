#!/usr/bin/env bash
# Build and start Maximus production compose with the right Caddy TLS profile.
#
# Data plane:
#   COMPOSE_PROFILES=bundled  (default) — Postgres + Valkey + RustFS in compose
#   COMPOSE_PROFILES=         (empty)   — external DATABASE_URL / VALKEY_URL / S3_*
#   DEPLOY_MODE=external      — same as empty profiles + validation
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy .env.prod.example and run scripts/generate-secrets.sh --write $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

TLS_MODE="${TLS_MODE:-http01}"
DOMAIN="${DOMAIN:?DOMAIN required in $ENV_FILE}"
DEPLOY_MODE="${DEPLOY_MODE:-bundled}"

case "$DEPLOY_MODE" in
  bundled|internal)
    export COMPOSE_PROFILES="${COMPOSE_PROFILES:-bundled}"
    if [[ -z "${POSTGRES_PASSWORD:-}" && -z "${DATABASE_URL:-}" ]]; then
      echo "bundled mode needs POSTGRES_PASSWORD (or full DATABASE_URL)" >&2
      exit 1
    fi
    if [[ -z "${VALKEY_PASSWORD:-}" && -z "${VALKEY_URL:-}" ]]; then
      echo "bundled mode needs VALKEY_PASSWORD (or full VALKEY_URL)" >&2
      exit 1
    fi
    ;;
  external)
    export COMPOSE_PROFILES="${COMPOSE_PROFILES:-}"
    missing=()
    [[ -n "${DATABASE_URL:-}" ]] || missing+=("DATABASE_URL")
    [[ -n "${VALKEY_URL:-}" ]] || missing+=("VALKEY_URL")
    [[ -n "${S3_ENDPOINT:-}" ]] || missing+=("S3_ENDPOINT")
    [[ -n "${S3_SECRET_KEY:-}" ]] || missing+=("S3_SECRET_KEY")
    if ((${#missing[@]})); then
      echo "DEPLOY_MODE=external requires: ${missing[*]}" >&2
      echo "See docs/deploy-external.md" >&2
      exit 1
    fi
    ;;
  *)
    echo "Unknown DEPLOY_MODE=$DEPLOY_MODE (bundled|external)" >&2
    exit 1
    ;;
esac

case "$TLS_MODE" in
  http01)
    export CADDYFILE="$ROOT/docker/Caddyfile"
    export CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.9-alpine}"
    ;;
  cloudflare)
    if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
      echo "TLS_MODE=cloudflare requires CLOUDFLARE_API_TOKEN" >&2
      exit 1
    fi
    echo "Building Caddy with Cloudflare DNS plugin..."
    docker build -f docker/Dockerfile.caddy -t maximus-caddy:local docker
    export CADDY_IMAGE=maximus-caddy:local
    export CADDYFILE="$ROOT/docker/Caddyfile.cloudflare"
    ;;
  route53)
    if [[ -z "${AWS_ACCESS_KEY_ID:-}" || -z "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
      echo "TLS_MODE=route53 requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY" >&2
      exit 1
    fi
    echo "Building Caddy with Route53 DNS plugin..."
    docker build -f docker/Dockerfile.caddy -t maximus-caddy:local docker
    export CADDY_IMAGE=maximus-caddy:local
    export CADDYFILE="$ROOT/docker/Caddyfile.route53"
    ;;
  local)
    export CADDYFILE="$ROOT/docker/Caddyfile.local"
    export CADDY_IMAGE="${CADDY_IMAGE:-caddy:2.9-alpine}"
    ;;
  *)
    echo "Unknown TLS_MODE=$TLS_MODE (http01|cloudflare|route53|local)" >&2
    exit 1
    ;;
esac

# Compose needs relative Caddyfile path from docker/
CADDYFILE_REL="${CADDYFILE#$ROOT/docker/}"
if [[ "$CADDYFILE_REL" == "$CADDYFILE" ]]; then
  CADDYFILE_REL="./$(basename "$CADDYFILE")"
else
  CADDYFILE_REL="./$CADDYFILE_REL"
fi
export CADDYFILE="$CADDYFILE_REL"

echo "Starting Maximus (DOMAIN=$DOMAIN TLS_MODE=$TLS_MODE DEPLOY_MODE=$DEPLOY_MODE COMPOSE_PROFILES=${COMPOSE_PROFILES:-<none>} CADDYFILE=$CADDYFILE)..."
docker compose -f docker/docker-compose.prod.yml --env-file "$ENV_FILE" up -d --build

echo ""
echo "Waiting for health..."
for i in $(seq 1 40); do
  if curl -fsS "https://${DOMAIN}/api/health" >/dev/null 2>&1 \
    || curl -kfsS "https://${DOMAIN}/api/health" >/dev/null 2>&1 \
    || curl -fsS "http://127.0.0.1:${HTTP_PORT:-80}/api/health" >/dev/null 2>&1; then
    echo "Healthy."
    break
  fi
  sleep 3
  if [[ "$i" -eq 40 ]]; then
    echo "Still starting — check: docker compose -f docker/docker-compose.prod.yml logs -f" >&2
  fi
done

echo ""
echo "Open: ${APP_URL:-https://$DOMAIN}"
echo "First visit /login to bootstrap the owner (invite-only after that)."
echo "Logs: docker compose -f docker/docker-compose.prod.yml --env-file $ENV_FILE logs -f"
if [[ "$DEPLOY_MODE" == "external" ]]; then
  echo "Data plane: external (DATABASE_URL / VALKEY_URL / S3_ENDPOINT from env)."
else
  echo "Data plane: bundled Postgres + Valkey + RustFS (profile bundled)."
fi
