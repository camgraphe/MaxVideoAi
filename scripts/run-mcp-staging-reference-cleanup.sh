#!/usr/bin/env bash

set -euo pipefail

STAGING_PROJECT='maxvideoai-mcp-staging'
STAGING_HOST='maxvideoai-mcp-staging.vercel.app'
STAGING_CLEANUP_URL="https://${STAGING_HOST}/api/cron/mcp-reference-upload-cleanup"
BATCH_LIMIT=100
MAX_BATCHES=20

usage() {
  printf 'Usage: %s [--dry-run] [--execute] [--teardown]\n' "$0" >&2
}

EXECUTE=false
TEARDOWN=false
while (($#)); do
  case "$1" in
    --dry-run)
      EXECUTE=false
      ;;
    --execute)
      EXECUTE=true
      ;;
    --teardown)
      TEARDOWN=true
      ;;
    *)
      usage
      exit 64
      ;;
  esac
  shift
done

if ! "$EXECUTE"; then
  mode='cleanup'
  "$TEARDOWN" && mode='teardown'
  printf 'SAFE_CLEANUP_PLAN project=%s host=%s mode=%s limit=%s max_batches=%s\n' \
    "$STAGING_PROJECT" "$STAGING_HOST" "$mode" "$BATCH_LIMIT" "$MAX_BATCHES"
  exit 0
fi

CLEANUP_SECRET="${MCP_STAGING_CLEANUP_SECRET:-}"
if ((${#CLEANUP_SECRET} < 32 || ${#CLEANUP_SECRET} > 512)) \
  || [[ ! "$CLEANUP_SECRET" =~ ^[[:alnum:]_.~-]+$ ]]; then
  printf 'CLEANUP_CREDENTIAL_BLOCKED\n' >&2
  exit 66
fi

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/maxvideoai-mcp-cleanup.XXXXXX")"
cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT INT TERM

run_batches() {
  local mode="$1"
  local label="$2"
  local batch
  local response="$TEMP_ROOT/${mode}.json"
  local status
  local selected
  local deleted

  for ((batch = 1; batch <= MAX_BATCHES; batch += 1)); do
    : >"$response"
    status="$(
      printf 'header = "Authorization: Bearer %s"\n' "$CLEANUP_SECRET" \
        | curl \
          --config - \
          --silent \
          --show-error \
          --max-time 30 \
          --request POST \
          --output "$response" \
          --write-out '%{http_code}' \
          "${STAGING_CLEANUP_URL}?mode=${mode}"
    )"
    if [[ "$status" != '200' ]]; then
      printf 'CLEANUP_BLOCKED mode=%s status=%s\n' "$mode" "$status" >&2
      exit 67
    fi
    if ! jq -e --arg mode "$mode" '
      .ok == true and .mode == $mode and
      (.selected | type == "number") and (.selected >= 0) and
      (.deleted | type == "number") and (.deleted >= 0)
    ' "$response" >/dev/null; then
      printf 'CLEANUP_BLOCKED mode=%s status=invalid-response\n' "$mode" >&2
      exit 67
    fi
    selected="$(jq -er '.selected' "$response")"
    deleted="$(jq -er '.deleted' "$response")"
    printf '%s_BATCH_OK batch=%s selected=%s deleted=%s\n' \
      "$label" "$batch" "$selected" "$deleted"
    if [[ "$selected" != "$deleted" ]]; then
      printf 'CLEANUP_BLOCKED mode=%s status=incomplete\n' "$mode" >&2
      exit 67
    fi
    if [[ "$selected" == '0' ]]; then
      return
    fi
  done

  printf 'CLEANUP_BLOCKED mode=%s status=batch-limit\n' "$mode" >&2
  exit 67
}

run_batches ledger CLEANUP
if "$TEARDOWN"; then
  run_batches purge-staging PURGE
fi
