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

MIGRATION_DATABASE_URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"

if [[ -z "$MIGRATION_DATABASE_URL" ]]; then
  echo "DATABASE_URL_UNPOOLED or DATABASE_URL is required. It must point to Neon, not Supabase." >&2
  exit 1
fi

if ! MIGRATION_DATABASE_HOST="$(node - "$MIGRATION_DATABASE_URL" <<'NODE'
try {
  const parsed = new URL(process.argv[2]);
  if ((parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:')
    || !parsed.username
    || !parsed.hostname) {
    process.exit(1);
  }
  process.stdout.write(parsed.hostname.toLowerCase());
} catch {
  process.exit(1);
}
NODE
)"; then
  echo "DATABASE_URL_UNPOOLED or DATABASE_URL must be a valid PostgreSQL URL." >&2
  exit 1
fi

if [[ "$MIGRATION_DATABASE_HOST" != *.neon.tech ]]; then
  echo "Neon migrations require a direct Neon hostname ending in .neon.tech." >&2
  exit 1
fi

if [[ "$MIGRATION_DATABASE_HOST" =~ (^|\.)[^.]*-pooler(\.|$) ]]; then
  echo "Neon migrations require a direct connection; pooled PgBouncer URLs are rejected." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply Neon migrations." >&2
  exit 1
fi

echo "Applying Neon migrations from $ROOT_DIR/neon/migrations"
for file in "$ROOT_DIR"/neon/migrations/*.sql; do
  echo "==> $(basename "$file")"
  psql "$MIGRATION_DATABASE_URL" --single-transaction -v ON_ERROR_STOP=1 -f "$file"
done
