#!/usr/bin/env bash

set -euo pipefail

STAGING_PROJECT='maxvideoai-mcp-staging'
PRODUCTION_PROJECT='maxvideoai'
STAGING_SCOPE='camgraphes-projects'
STABLE_HOST='maxvideoai-mcp-staging.vercel.app'
STAGING_SUPABASE_ORIGIN='https://gecrywjztpbwbrlnomti.supabase.co'
EXPECTED_ROBOTS='noindex, nofollow, noarchive'
EXPECTED_BYTEPLUS_CRON_PATH='/api/cron/byteplus-poll'
EXPECTED_FAL_CRON_PATH='/api/cron/fal-poll'
EXPECTED_GOOGLE_VERTEX_VEO_CRON_PATH='/api/cron/google-vertex-veo-poll'
EXPECTED_GOOGLE_VERTEX_OMNI_CRON_PATH='/api/cron/google-vertex-omni-poll'
EXPECTED_CRON_SCHEDULE='*/5 * * * *'
VERCEL_VERSION='55.0.0'
DEPLOYMENT_REF_FILTER='.deployment.url // .deployment.deploymentUrl // .deployment.id // .url // .deploymentUrl // .id'
REQUIRED_OPERATIONAL_ENVIRONMENT=(
  'MCP_STAGING_OPERATIONAL_ENABLED'
  'BYTEPLUS_ARK_ENABLED'
  'BYTEPLUS_ARK_API_KEY'
  'SEEDANCE_2_5_BYTEPLUS_ENABLED'
  'SEEDANCE_2_5_PROVIDER'
  'SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY'
  'SEEDANCE_2_5_BYTEPLUS_MODES'
  'SEEDANCE_2_5_LAS_ENABLED'
  'MCP_TOPUP_HANDOFF_SECRET'
  'MCP_STAGING_REFERENCE_CLEANUP_ENABLED'
  'MCP_STAGING_REFERENCE_STORAGE_PREFIX'
  'S3_BUCKET'
  'S3_REGION'
  'S3_ACCESS_KEY_ID'
  'S3_SECRET_ACCESS_KEY'
  'S3_PUBLIC_BASE_URL'
  'VIDEO_RENDER_STORAGE_PREFIX'
  'CRON_SECRET'
  'FAL_WEBHOOK_TOKEN'
  'FAL_POLL_TOKEN'
  'GOOGLE_VERTEX_PROJECT_ID'
  'GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON'
  'GOOGLE_VERTEX_LOCATION'
  'GOOGLE_VERTEX_API_BASE_URL'
  'GOOGLE_VERTEX_INPUT_GCS_URI'
  'GOOGLE_VERTEX_VEO_ENABLED'
  'GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED'
  'GOOGLE_VERTEX_VEO_ADMIN_ONLY'
  'GOOGLE_VERTEX_VEO_POLL_TOKEN'
  'GOOGLE_VERTEX_OMNI_ENABLED'
  'GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED'
  'GOOGLE_VERTEX_OMNI_ADMIN_ONLY'
  'GOOGLE_VERTEX_OMNI_POLL_TOKEN'
  'GOOGLE_VERTEX_IMAGE_MCP_ENABLED'
  'GOOGLE_VERTEX_IMAGE_MCP_PUBLIC_ROUTING_ENABLED'
  'GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST'
)

usage() {
  printf 'Usage: %s [--candidate dpl_ID] [--candidate-only] [--dry-run]\n' "$0" >&2
}

DRY_RUN=false
CANDIDATE_ONLY=false
RESUME_CANDIDATE_ID=''
while (($#)); do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --candidate)
      if (($# < 2)) || [[ ! "$2" =~ ^dpl_[A-Za-z0-9]+$ ]]; then
        usage
        exit 64
      fi
      RESUME_CANDIDATE_ID="$2"
      shift 2
      ;;
    --candidate-only)
      CANDIDATE_ONLY=true
      shift
      ;;
    *)
      usage
      exit 64
      ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
  printf 'Refusing deployment: commit tracked changes first; this script exports tracked HEAD.\n' >&2
  exit 65
fi
if test -n "$(git -C "$REPO_ROOT" ls-files --others --exclude-standard)"; then
  printf 'Refusing deployment: untracked files are present; review and commit or remove them first.\n' >&2
  exit 65
fi

APPROVED_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
[[ "$APPROVED_HEAD" =~ ^[0-9a-f]{40,64}$ ]]
TRACKED_ARCHIVE_SHA256="$(git -C "$REPO_ROOT" archive HEAD | shasum -a 256 | awk '{print $1}')"
[[ "$TRACKED_ARCHIVE_SHA256" =~ ^[0-9a-f]{64}$ ]]

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/maxvideoai-mcp-staging.XXXXXX")"
cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT INT TERM

if [[ -z "$RESUME_CANDIDATE_ID" ]]; then
  git -C "$REPO_ROOT" archive HEAD | tar -xf - -C "$TEMP_ROOT"

  STAGING_CONFIG="$TEMP_ROOT/frontend/vercel.mcp-staging.json"
  EFFECTIVE_CONFIG="$TEMP_ROOT/frontend/vercel.json"
  test -f "$STAGING_CONFIG"
  test -f "$TEMP_ROOT/packages/pricing/package.json"
  cp "$STAGING_CONFIG" "$EFFECTIVE_CONFIG"

  jq -e \
    --arg expected "$EXPECTED_ROBOTS" \
    --arg byteplus_cron_path "$EXPECTED_BYTEPLUS_CRON_PATH" \
    --arg fal_cron_path "$EXPECTED_FAL_CRON_PATH" \
    --arg google_vertex_veo_cron_path "$EXPECTED_GOOGLE_VERTEX_VEO_CRON_PATH" \
    --arg google_vertex_omni_cron_path "$EXPECTED_GOOGLE_VERTEX_OMNI_CRON_PATH" \
    --arg cron_schedule "$EXPECTED_CRON_SCHEDULE" '
    .crons == [
      {path: $byteplus_cron_path, schedule: $cron_schedule},
      {path: $fal_cron_path, schedule: $cron_schedule},
      {path: $google_vertex_veo_cron_path, schedule: $cron_schedule},
      {path: $google_vertex_omni_cron_path, schedule: $cron_schedule}
    ] and
    .headers == [
      {
        "source": "/(.*)",
        "headers": [
          {
            "key": "X-Robots-Tag",
            "value": $expected
          }
        ]
      }
    ]
  ' "$EFFECTIVE_CONFIG" >/dev/null
  cmp -s "$STAGING_CONFIG" "$EFFECTIVE_CONFIG"
fi

if "$DRY_RUN"; then
  if [[ -n "$RESUME_CANDIDATE_ID" ]]; then
    printf 'SAFE_PACKAGE_OK project=%s scope=%s tracked_head=%s mode=existing-candidate candidate=%s\n' \
      "$STAGING_PROJECT" \
      "$STAGING_SCOPE" \
      "$(git -C "$REPO_ROOT" rev-parse --short HEAD)" \
      "$RESUME_CANDIDATE_ID"
  else
    printf 'SAFE_PACKAGE_OK project=%s scope=%s tracked_head=%s mode=new-candidate\n' \
      "$STAGING_PROJECT" \
      "$STAGING_SCOPE" \
      "$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
  fi
  exit 0
fi

VERCEL=(npx --yes "vercel@${VERCEL_VERSION}")
ARTIFACTS="$TEMP_ROOT/.mcp-staging-deploy"
mkdir -p "$ARTIFACTS"

capture_production_baseline() {
  local prefix="$1"
  "${VERCEL[@]}" api "/v9/projects/${PRODUCTION_PROJECT}" \
    --scope "$STAGING_SCOPE" \
    --raw >"${prefix}.project.raw.json"
  jq -S '{
    id,
    name,
    framework,
    rootDirectory,
    nodeVersion,
    buildCommand,
    installCommand,
    outputDirectory,
    sourceFilesOutsideRootDirectory,
    gitForkProtection,
    ssoProtection,
    skewProtectionMaxAge
  }' "${prefix}.project.raw.json" >"${prefix}.project.json"

  "${VERCEL[@]}" api "/v9/projects/${PRODUCTION_PROJECT}/domains" \
    --scope "$STAGING_SCOPE" \
    --raw >"${prefix}.domains.raw.json"
  jq -S '[.domains[]? | {name, redirect, redirectStatusCode, gitBranch, verified}] | sort_by(.name)' \
    "${prefix}.domains.raw.json" >"${prefix}.domains.json"

  "${VERCEL[@]}" project protection "$PRODUCTION_PROJECT" \
    --scope "$STAGING_SCOPE" \
    --format json >"${prefix}.protection.json"
  jq -S . "${prefix}.protection.json" >"${prefix}.protection.sorted.json"
}

capture_staging_environment_metadata() {
  local output="$1"
  "${VERCEL[@]}" api "/v10/projects/${STAGING_PROJECT}/env?decrypt=false&target=production" \
    --scope "$STAGING_SCOPE" \
    --raw \
    | jq -eS '[
        (.envs // [])[]
        | {
            key,
            target: ((
              if (.target | type) == "array" then .target
              elif .target == null then []
              else [.target]
              end
            ) | sort)
          }
      ] | sort_by(.key, .target)' >"$output"
}

assert_staging_mutation() {
  local command="$1"
  shift
  local argument
  local project=''
  local scope=''
  local previous=''

  for argument in "$@"; do
    if [[ "$argument" == "$PRODUCTION_PROJECT" || "$argument" == 'maxvideoai.com' ]]; then
      printf 'PRODUCTION_MUTATION_BLOCKED\n' >&2
      exit 67
    fi
    if [[ "$previous" == '--project' ]]; then project="$argument"; fi
    if [[ "$previous" == '--scope' ]]; then scope="$argument"; fi
    previous="$argument"
  done

  if [[ "$scope" != "$STAGING_SCOPE" ]]; then
    printf 'STAGING_IDENTITY_BLOCKED\n' >&2
    exit 67
  fi
  if [[ "$command" == 'link' || "$command" == 'deploy' ]]; then
    if [[ "$project" != "$STAGING_PROJECT" ]]; then
      printf 'STAGING_IDENTITY_BLOCKED\n' >&2
      exit 67
    fi
  fi
}

run_staging_mutation() {
  local command="$1"
  shift
  assert_staging_mutation "$command" "$@"
  "${VERCEL[@]}" "$command" "$@"
}

assert_staging_operational_environment() {
  local metadata="$ARTIFACTS/staging-environment-metadata.json"
  local name

  capture_staging_environment_metadata "$metadata"

  for name in 'BYTEPLUS_ARK_API_KEY' 'MCP_TOPUP_HANDOFF_SECRET'; do
    if ! jq -e --arg name "$name" \
      'any(.[]; .key == $name and .target == ["production"])' \
      "$metadata" >/dev/null; then
      printf 'CREDENTIAL_BLOCKED\n' >&2
      exit 66
    fi
  done

  if ! jq -e --arg name 'CRON_SECRET' \
    'any(.[]; .key == $name and .target == ["production"])' \
    "$metadata" >/dev/null; then
    printf 'CLEANUP_BLOCKED\n' >&2
    exit 66
  fi

  if ! jq -e '
    any(.[];
      (.key == "FAL_API_KEY" or .key == "FAL_KEY") and
      .target == ["production"]
    )
  ' "$metadata" >/dev/null; then
    printf 'ENVIRONMENT_BLOCKED one_of=FAL_API_KEY,FAL_KEY target=production\n' >&2
    exit 66
  fi

  for name in "${REQUIRED_OPERATIONAL_ENVIRONMENT[@]}"; do
    if ! jq -e --arg name "$name" \
      'any(.[]; .key == $name and .target == ["production"])' \
      "$metadata" >/dev/null; then
      printf 'ENVIRONMENT_BLOCKED name=%s target=production\n' "$name" >&2
      exit 66
    fi
  done
}

"${VERCEL[@]}" api "/v9/projects/${STAGING_PROJECT}" \
  --scope "$STAGING_SCOPE" \
  --raw >"$ARTIFACTS/staging-project.json"
STAGING_PROJECT_ID="$(jq -er --arg name "$STAGING_PROJECT" 'select(.name == $name) | .id' "$ARTIFACTS/staging-project.json")"
"${VERCEL[@]}" api "/v9/projects/${STAGING_PROJECT}/domains" \
  --scope "$STAGING_SCOPE" \
  --raw \
  | jq -eS '[.domains[]? | {name}] | sort_by(.name)' >"$ARTIFACTS/staging-domains.json"
if ! jq -e --arg stable "$STABLE_HOST" \
  'any(.[]; .name == $stable)' "$ARTIFACTS/staging-domains.json" >/dev/null; then
  printf 'STAGING_IDENTITY_BLOCKED\n' >&2
  exit 67
fi
assert_staging_operational_environment

capture_production_baseline "$ARTIFACTS/production-before"

PRODUCTION_PROJECT_ID="$(jq -er --arg name "$PRODUCTION_PROJECT" 'select(.name == $name) | .id' "$ARTIFACTS/production-before.project.raw.json")"
test "$STAGING_PROJECT_ID" != "$PRODUCTION_PROJECT_ID"

if [[ -n "$RESUME_CANDIDATE_ID" ]]; then
  CANDIDATE_REF="$RESUME_CANDIDATE_ID"
else
  run_staging_mutation link \
    --cwd "$TEMP_ROOT" \
    --yes \
    --project "$STAGING_PROJECT" \
    --scope "$STAGING_SCOPE" \
    --no-color >/dev/null
  rm -f "$TEMP_ROOT/.env.local"
  jq -e \
    --arg id "$STAGING_PROJECT_ID" \
    --arg name "$STAGING_PROJECT" \
    '.projectId == $id and .projectName == $name' \
    "$TEMP_ROOT/.vercel/project.json" >/dev/null

  run_staging_mutation deploy "$TEMP_ROOT" \
    --project "$STAGING_PROJECT" \
    --scope "$STAGING_SCOPE" \
    --prod \
    --skip-domain \
    --meta mcpApprovedGitSha="$APPROVED_HEAD" \
    --meta mcpTrackedArchiveSha256="$TRACKED_ARCHIVE_SHA256" \
    --yes \
    --format json \
    --no-color >"$ARTIFACTS/deploy.json"

  CANDIDATE_REF="$(jq -er "$DEPLOYMENT_REF_FILTER" "$ARTIFACTS/deploy.json")"
fi
"${VERCEL[@]}" inspect "$CANDIDATE_REF" \
  --scope "$STAGING_SCOPE" \
  --wait \
  --timeout 10m \
  --format json >"$ARTIFACTS/candidate-inspect.json"

CANDIDATE_ID="$(jq -er --arg name "$STAGING_PROJECT" '
  select(
    .readyState == "READY" and
    .target == "production" and
    .name == $name
  ) | .id
' "$ARTIFACTS/candidate-inspect.json")"
CANDIDATE_HOST="$(jq -er '.url' "$ARTIFACTS/candidate-inspect.json")"
CANDIDATE_URL="https://${CANDIDATE_HOST}"
test "$CANDIDATE_HOST" != "$STABLE_HOST"
if [[ -n "$RESUME_CANDIDATE_ID" ]]; then
  test "$CANDIDATE_ID" = "$RESUME_CANDIDATE_ID"
fi

"${VERCEL[@]}" api "/v13/deployments/${CANDIDATE_ID}" \
  --scope "$STAGING_SCOPE" \
  --raw >"$ARTIFACTS/candidate-api.json"
jq -e \
  --arg project_id "$STAGING_PROJECT_ID" \
  --arg stable "$STABLE_HOST" \
  --arg approved_head "$APPROVED_HEAD" \
  --arg archive_sha256 "$TRACKED_ARCHIVE_SHA256" \
  --arg byteplus_cron_path "$EXPECTED_BYTEPLUS_CRON_PATH" \
  --arg fal_cron_path "$EXPECTED_FAL_CRON_PATH" \
  --arg google_vertex_veo_cron_path "$EXPECTED_GOOGLE_VERTEX_VEO_CRON_PATH" \
  --arg google_vertex_omni_cron_path "$EXPECTED_GOOGLE_VERTEX_OMNI_CRON_PATH" \
  --arg cron_schedule "$EXPECTED_CRON_SCHEDULE" '
    .projectId == $project_id and
    .readyState == "READY" and
    .target == "production" and
    .meta.mcpApprovedGitSha == $approved_head and
    .meta.mcpTrackedArchiveSha256 == $archive_sha256 and
    has("crons") and
    (.crons | type == "array") and
    .crons == [
      {path: $byteplus_cron_path, schedule: $cron_schedule},
      {path: $fal_cron_path, schedule: $cron_schedule},
      {path: $google_vertex_veo_cron_path, schedule: $cron_schedule},
      {path: $google_vertex_omni_cron_path, schedule: $cron_schedule}
    ] and
    ([.alias[]?, .automaticAliases[]?] | index($stable) | not)
  ' "$ARTIFACTS/candidate-api.json" >/dev/null

assert_exact_robots_header() {
  local header_file="$1"
  awk -v expected="$EXPECTED_ROBOTS" '
    BEGIN { IGNORECASE = 1; found = 0 }
    /^x-robots-tag:/ {
      value = $0
      sub(/^[^:]+:[[:space:]]*/, "", value)
      sub(/\r$/, "", value)
      if (value == expected) found++
    }
    END { exit(found == 1 ? 0 : 1) }
  ' "$header_file"
}

assert_public_noindex() {
  local url="$1"
  local prefix="$2"
  local status
  status="$(curl \
    --silent \
    --show-error \
    --max-time 30 \
    --dump-header "${prefix}.headers" \
    --output /dev/null \
    --write-out '%{http_code}' \
    "$url")"
  test "$status" = '200'
  assert_exact_robots_header "${prefix}.headers"
  ! grep -Eiq '^location:' "${prefix}.headers"
}

assert_protocol_endpoints() {
  local base_url="$1"
  local prefix="$2"
  local mode="$3"
  local discovery_status
  local mcp_status
  local mcp_path='/mcp'
  if [[ "$mode" == 'candidate' ]]; then
    mcp_path='/api/mcp'
  fi

  discovery_status="$(curl \
    --silent \
    --show-error \
    --max-time 30 \
    --dump-header "${prefix}.oauth.headers" \
    --output "${prefix}.oauth.json" \
    --write-out '%{http_code}' \
    "${base_url}/.well-known/oauth-protected-resource/mcp")"
  assert_exact_robots_header "${prefix}.oauth.headers"

  mcp_status="$(curl \
    --silent \
    --show-error \
    --max-time 30 \
    --request POST \
    --header 'Accept: application/json, text/event-stream' \
    --header 'Content-Type: application/json' \
    --dump-header "${prefix}.mcp.headers" \
    --output /dev/null \
    --write-out '%{http_code}' \
    --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"staging-deploy-gate","version":"1.0"}}}' \
    "${base_url}${mcp_path}")"
  assert_exact_robots_header "${prefix}.mcp.headers"

  if [[ "$mode" == 'candidate' ]]; then
    test "$discovery_status" = '404'
    test "$mcp_status" = '404'
    return
  fi

  test "$mode" = 'stable'
  test "$discovery_status" = '200'
  jq -e \
    --arg resource "https://${STABLE_HOST}/mcp" \
    --arg authorization_server "${STAGING_SUPABASE_ORIGIN}/auth/v1" '
      .resource == $resource and
      .authorization_servers == [$authorization_server]
    ' "${prefix}.oauth.json" >/dev/null

  test "$mcp_status" = '401'
  grep -Eiq '^cache-control:[[:space:]]*private, no-store\r?$' "${prefix}.mcp.headers"
  grep -Eiq "^www-authenticate:[[:space:]]*Bearer resource_metadata=\"https://${STABLE_HOST}/\.well-known/oauth-protected-resource/mcp\"\r?$" \
    "${prefix}.mcp.headers"
}

assert_public_noindex "${CANDIDATE_URL}/" "$ARTIFACTS/candidate-root"
assert_protocol_endpoints "$CANDIDATE_URL" "$ARTIFACTS/candidate-protocol" candidate

if "$CANDIDATE_ONLY"; then
  capture_production_baseline "$ARTIFACTS/production-after"
  diff -u "$ARTIFACTS/production-before.project.json" "$ARTIFACTS/production-after.project.json" >/dev/null
  diff -u "$ARTIFACTS/production-before.domains.json" "$ARTIFACTS/production-after.domains.json" >/dev/null
  diff -u "$ARTIFACTS/production-before.protection.sorted.json" "$ARTIFACTS/production-after.protection.sorted.json" >/dev/null
  printf 'SAFE_CANDIDATE_OK project=%s deployment=%s url=%s stable_unchanged=true\n' \
    "$STAGING_PROJECT" \
    "$CANDIDATE_ID" \
    "$CANDIDATE_URL"
  exit 0
fi

run_staging_mutation promote "$CANDIDATE_ID" \
  --scope "$STAGING_SCOPE" \
  --yes \
  --timeout 10m \
  --no-color >/dev/null

"${VERCEL[@]}" inspect "$STABLE_HOST" \
  --scope "$STAGING_SCOPE" \
  --format json >"$ARTIFACTS/stable-inspect.json"
jq -e \
  --arg candidate "$CANDIDATE_ID" \
  --arg name "$STAGING_PROJECT" '
    .id == $candidate and
    .name == $name and
    .readyState == "READY" and
    .target == "production"
  ' "$ARTIFACTS/stable-inspect.json" >/dev/null

assert_public_noindex "https://${STABLE_HOST}/" "$ARTIFACTS/stable-root"
assert_protocol_endpoints "https://${STABLE_HOST}" "$ARTIFACTS/stable-protocol" stable

capture_production_baseline "$ARTIFACTS/production-after"
diff -u "$ARTIFACTS/production-before.project.json" "$ARTIFACTS/production-after.project.json" >/dev/null
diff -u "$ARTIFACTS/production-before.domains.json" "$ARTIFACTS/production-after.domains.json" >/dev/null
diff -u "$ARTIFACTS/production-before.protection.sorted.json" "$ARTIFACTS/production-after.protection.sorted.json" >/dev/null

printf 'SAFE_DEPLOY_OK project=%s deployment=%s stable=https://%s\n' \
  "$STAGING_PROJECT" \
  "$CANDIDATE_ID" \
  "$STABLE_HOST"
