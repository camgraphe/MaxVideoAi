#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

load_env_file "$ROOT_DIR/.env.local"
load_env_file "$ROOT_DIR/frontend/.env.local"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required. It must point to Neon, not Supabase." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply Neon migrations." >&2
  exit 1
fi

echo "Applying Neon migrations from $ROOT_DIR/neon/migrations"
for file in "$ROOT_DIR"/neon/migrations/*.sql; do
  echo "==> $(basename "$file")"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done
