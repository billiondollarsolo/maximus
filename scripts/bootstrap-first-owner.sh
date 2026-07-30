#!/usr/bin/env sh
# One-shot first-owner bootstrap (empty database only).
# Safe to re-run: API returns 403 when users already exist → exit 0.
#
# Env:
#   APP_URL              Public origin for CSRF Origin header (default http://web:3000)
#   INTERNAL_URL         Optional in-cluster/service URL to curl (default = APP_URL)
#   BOOTSTRAP_EMAIL      required
#   BOOTSTRAP_PASSWORD   required (≥10 chars)
#   BOOTSTRAP_NAME       optional (default Owner)
#   BOOTSTRAP_ORG_NAME   optional (default Maximus)
#   BOOTSTRAP_RETRIES    default 40
set -eu

APP_URL="${APP_URL:-http://web:3000}"
BASE="${INTERNAL_URL:-$APP_URL}"
EMAIL="${BOOTSTRAP_EMAIL:-}"
PASSWORD="${BOOTSTRAP_PASSWORD:-}"
NAME="${BOOTSTRAP_NAME:-Owner}"
ORG="${BOOTSTRAP_ORG_NAME:-Maximus}"
RETRIES="${BOOTSTRAP_RETRIES:-40}"

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "BOOTSTRAP_EMAIL and BOOTSTRAP_PASSWORD required" >&2
  exit 1
fi

echo "Waiting for $BASE/api/health (Origin: $APP_URL) ..."
i=0
while [ "$i" -lt "$RETRIES" ]; do
  if curl -fsS "$BASE/api/health" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 2
done

# Escape JSON strings minimally
json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

BODY=$(printf '{"email":"%s","password":"%s","name":"%s","orgName":"%s"}' \
  "$(json_escape "$EMAIL")" \
  "$(json_escape "$PASSWORD")" \
  "$(json_escape "$NAME")" \
  "$(json_escape "$ORG")")

CODE=$(curl -sS -o /tmp/maximus-bootstrap.json -w "%{http_code}" \
  -X POST "$BASE/api/auth/bootstrap" \
  -H "content-type: application/json" \
  -H "origin: $APP_URL" \
  -d "$BODY" || echo "000")

echo "bootstrap HTTP $CODE"
cat /tmp/maximus-bootstrap.json 2>/dev/null || true
echo

case "$CODE" in
  200|201)
    echo "Owner bootstrapped: $EMAIL"
    exit 0
    ;;
  403)
    echo "Bootstrap skipped (users already exist) — OK"
    exit 0
    ;;
  *)
    echo "Bootstrap failed" >&2
    exit 1
    ;;
esac
