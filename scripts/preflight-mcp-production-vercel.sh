#!/usr/bin/env bash

set -euo pipefail

PRODUCTION_PROJECT='maxvideoai'
PRODUCTION_SCOPE='camgraphes-projects'
VERCEL_VERSION='55.0.0'
REQUIRED_PRODUCTION_ENVIRONMENT=(
  'MCP_API_HOST'
  'MCP_RESOURCE_URL'
  'MCP_ACQUISITION_SIGNING_SECRET'
  'MCP_TOPUP_HANDOFF_SECRET'
  'DATABASE_URL'
  'NEXT_PUBLIC_SITE_URL'
  'NEXT_PUBLIC_SUPABASE_URL'
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  'SUPABASE_SERVICE_ROLE_KEY'
  'SUPABASE_SITE_URL'
  'S3_BUCKET'
  'S3_REGION'
  'S3_ACCESS_KEY_ID'
  'S3_SECRET_ACCESS_KEY'
  'S3_PUBLIC_BASE_URL'
  'VIDEO_RENDER_STORAGE_PREFIX'
  'STRIPE_SECRET_KEY'
  'STRIPE_WEBHOOK_SECRET'
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  'CRON_SECRET'
  'FAL_WEBHOOK_TOKEN'
  'FAL_POLL_TOKEN'
)

if (($#)); then
  printf 'Usage: %s\n' "$0" >&2
  exit 64
fi

for dependency in git jq npx; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    printf 'DEPENDENCY_BLOCKED name=%s\n' "$dependency" >&2
    exit 65
  fi
done

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
PUBLICATION_CONFIG="$REPO_ROOT/frontend/config/mcp-publication.json"
VERCEL_CONFIG="$REPO_ROOT/frontend/vercel.json"

if ! jq -e '
  . == {
    "publicMarketing": false,
    "publicIndexing": false,
    "transport": false,
    "oauth": false,
    "discovery": false,
    "paidGeneration": false,
    "trial": false,
    "referenceUploads": false
  }
' "$PUBLICATION_CONFIG" >/dev/null; then
  printf 'PUBLICATION_BLOCKED expected=all-eight-false\n' >&2
  exit 67
fi

if ! jq -e '
  all((.crons // [])[]; (.path | startswith("/api/cron/mcp-") | not))
' "$VERCEL_CONFIG" >/dev/null; then
  printf 'CRON_INVENTORY_BLOCKED expected=no-mcp-crons-while-all-eight-false\n' >&2
  exit 70
fi

for package_path in 'package.json' 'frontend/package.json'; do
  if ! jq -e '.engines.node == "22.x"' "$REPO_ROOT/$package_path" >/dev/null; then
    printf 'NODE_RUNTIME_BLOCKED expected=22.x package=%s\n' "$package_path" >&2
    exit 71
  fi
done

if [[ -n "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=all)" ]]; then
  printf 'WORKTREE_BLOCKED expected=clean-tracked-head\n' >&2
  exit 69
fi

VERCEL=(npx --yes "vercel@${VERCEL_VERSION}")

read_vercel_api() {
  local endpoint="$1"
  case "$endpoint" in
    "/v9/projects/${PRODUCTION_PROJECT}"|"/v10/projects/${PRODUCTION_PROJECT}/env?decrypt=false&target=production") ;;
    *)
      printf 'READ_ONLY_ENDPOINT_BLOCKED\n' >&2
      exit 68
      ;;
  esac
  "${VERCEL[@]}" api "$endpoint" --scope "$PRODUCTION_SCOPE" --raw
}

PROJECT_METADATA="$(
  read_vercel_api "/v9/projects/${PRODUCTION_PROJECT}" \
    | jq -ce '{name, rootDirectory}'
)"
if ! jq -e \
  --arg project "$PRODUCTION_PROJECT" \
  'select(.name == $project and .rootDirectory == "frontend")' \
  <<<"$PROJECT_METADATA" >/dev/null; then
  printf 'PROJECT_IDENTITY_BLOCKED expected=%s rootDirectory=frontend\n' "$PRODUCTION_PROJECT" >&2
  exit 67
fi

ENVIRONMENT_METADATA="$(
  read_vercel_api "/v10/projects/${PRODUCTION_PROJECT}/env?decrypt=false&target=production" \
    | jq -ce '[
        (.envs // [])[]
        | {
            key,
            target: (
              if (.target | type) == "array" then .target
              elif .target == null then []
              else [.target]
              end
            )
          }
      ]'
)"

has_production_target() {
  local name="$1"
  jq -e \
    --arg name "$name" \
    'any(.[]; .key == $name and (.target | index("production") != null))' \
    <<<"$ENVIRONMENT_METADATA" >/dev/null
}

ENVIRONMENT_FAILURES=0
for name in "${REQUIRED_PRODUCTION_ENVIRONMENT[@]}"; do
  if ! has_production_target "$name"; then
    printf 'ENVIRONMENT_BLOCKED name=%s target=production\n' "$name" >&2
    ENVIRONMENT_FAILURES=$((ENVIRONMENT_FAILURES + 1))
  fi
done

FAL_CREDENTIAL=''
for name in 'FAL_API_KEY' 'FAL_KEY'; do
  if has_production_target "$name"; then
    FAL_CREDENTIAL="$name"
    break
  fi
done
if [[ -z "$FAL_CREDENTIAL" ]]; then
  printf 'ENVIRONMENT_BLOCKED one_of=FAL_API_KEY,FAL_KEY target=production\n' >&2
  ENVIRONMENT_FAILURES=$((ENVIRONMENT_FAILURES + 1))
fi
if ((ENVIRONMENT_FAILURES)); then
  exit 66
fi

printf 'PROJECT_OK name=%s rootDirectory=frontend\n' "$PRODUCTION_PROJECT"
printf 'PUBLICATION_OK all_eight=false\n'
printf 'CRON_INVENTORY_OK mcp_schedules=0\n'
printf 'NODE_RUNTIME_OK version=22.x\n'
printf 'ENVIRONMENT_OK required=%s fal=%s target=production\n' \
  "${#REQUIRED_PRODUCTION_ENVIRONMENT[@]}" \
  "$FAL_CREDENTIAL"
printf 'PRODUCTION_VERCEL_PREFLIGHT_OK project=%s scope=%s\n' \
  "$PRODUCTION_PROJECT" \
  "$PRODUCTION_SCOPE"
