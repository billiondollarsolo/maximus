#!/usr/bin/env bash
# Build and start Maximus production compose with the right Caddy TLS profile.
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

echo "Starting Maximus (DOMAIN=$DOMAIN TLS_MODE=$TLS_MODE CADDYFILE=$CADDYFILE)..."
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
