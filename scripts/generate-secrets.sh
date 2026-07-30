#!/usr/bin/env bash
# Generate strong secrets for Maximus (.env or .env.prod)
set -euo pipefail

WRITE_FILE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --write) WRITE_FILE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--write path/to/.env]"
      echo "Prints ENCRYPTION_KEY, BETTER_AUTH_SECRET, POSTGRES_PASSWORD, VALKEY_PASSWORD, S3_SECRET_KEY"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

rand_b64() { openssl rand -base64 32 | tr -d '\n'; }
rand_hex() { openssl rand -hex 24 | tr -d '\n'; }

ENC="$(rand_b64)"
AUTH="$(rand_b64)"
PG="$(rand_hex)"
VK="$(rand_hex)"
S3="$(rand_hex)"

block=$(cat <<EOF
# Generated $(date -u +%Y-%m-%dT%H:%MZ) — store offline; do not commit
ENCRYPTION_KEY=${ENC}
BETTER_AUTH_SECRET=${AUTH}
POSTGRES_PASSWORD=${PG}
VALKEY_PASSWORD=${VK}
S3_SECRET_KEY=${S3}
VALKEY_URL=redis://:${VK}@valkey:6379
EOF
)

echo "$block"

if [[ -n "$WRITE_FILE" ]]; then
  if [[ ! -f "$WRITE_FILE" ]]; then
    echo "File not found: $WRITE_FILE (copy .env.example or .env.prod.example first)" >&2
    exit 1
  fi
  # Upsert keys in place
  tmp="$(mktemp)"
  cp "$WRITE_FILE" "$tmp"
  while IFS= read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if grep -q "^${key}=" "$tmp"; then
      # portable sed
      if sed --version >/dev/null 2>&1; then
        sed -i "s|^${key}=.*|${key}=${val}|" "$tmp"
      else
        sed -i '' "s|^${key}=.*|${key}=${val}|" "$tmp"
      fi
    else
      echo "${key}=${val}" >>"$tmp"
    fi
  done <<<"$block"
  mv "$tmp" "$WRITE_FILE"
  chmod 600 "$WRITE_FILE" || true
  echo "Wrote secrets into $WRITE_FILE (mode 600)" >&2
fi
