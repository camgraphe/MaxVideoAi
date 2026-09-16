# MCP Plugin 0.3.5 Recovery Publication Plan

This plan starts only after the recovery fix is reviewed and merged. Local
implementation of the fix does not authorize any external publication step.
The release controller supplies the exact accepted merge commit as
`ACCEPTED_FIX_SHA`; do not substitute whichever commit happens to be latest.

## Preserve the cancelled candidate

`maxvideoai-plugin-v0.3.4` remains an unpublished immutable source tag at
`b56e340a1e36c46382b6b49a84c5b71c0402a883` (annotated object
`0e61ecc6cf1c936ee82fe0437eea39a6ebe3aa7b`). Its prepared workflow
[35125303782](https://github.com/camgraphe/MaxVideoAi/actions/runs/35125303782)
was cancelled before publication because seven proof captions described older
images. It must never be moved, deleted, or released. Do not create a focused
`v0.3.4` tag/release or an Official Registry 0.3.4 record.

The replacement identities are source tag `maxvideoai-plugin-v0.3.5`, focused
tag/release `v0.3.5`, source pointer release `maxvideoai-plugin-v0.3.5`, and
Official Registry `com.maxvideoai/maxvideoai` version `0.3.5`. All derive from
the future accepted fix commit. No runtime capability, provider, price, model,
or endpoint change belongs in this recovery.

## 1. Pin and validate the accepted source

Use one persistent fail-fast shell and a new clean detached worktree. If the
shell dies, stop and obtain a controller recovery ruling; revalidate all pinned
identities and artifacts before resuming. Keep secrets out of logs and reports.

```sh
set -euo pipefail
: "${ACCEPTED_FIX_SHA:?Controller must supply the accepted fix commit}"
git fetch origin main --tags
SOURCE_SHA=$(git rev-parse origin/main)
test "$SOURCE_SHA" = "$ACCEPTED_FIX_SHA"
readonly SOURCE_SHA
MCP_SOURCE_TMP=$(mktemp -d)
MCP_SOURCE_WORKTREE="$MCP_SOURCE_TMP/source"
git worktree add --detach "$MCP_SOURCE_WORKTREE" "$SOURCE_SHA"
MCP_SERVER_JSON="$MCP_SOURCE_WORKTREE/plugins/maxvideoai/server.json"
readonly MCP_SOURCE_WORKTREE MCP_SERVER_JSON
assert_release_source() {
  cd "$MCP_SOURCE_WORKTREE"
  test "$(git rev-parse HEAD)" = "$SOURCE_SHA"
  test -z "$(git status --porcelain=v1 --untracked-files=all)"
  test "$(git hash-object "$MCP_SERVER_JSON")" = "$(git rev-parse "$SOURCE_SHA:plugins/maxvideoai/server.json")"
}
assert_release_source
test "$(tr -d '\r\n' < plugins/maxvideoai/VERSION)" = 0.3.5
test "$(jq -r .version "$MCP_SERVER_JSON")" = 0.3.5
pnpm install --frozen-lockfile
assert_release_source
pnpm github:assets:release-check
node scripts/check-github-content.mjs plugins/maxvideoai/README.md
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-plugin-mirror.test.ts tests/mcp-public-release-bundle.test.ts \
  tests/mcp-plugin-contract.test.ts tests/mcp-reference-file-import.test.ts \
  tests/mcp-reference-local-helper.test.ts tests/github-content-contract.test.ts \
  tests/github-assets.test.ts tests/github-visual-system.test.ts
assert_release_source
MCP_RELEASE_TMP=$(mktemp -d)
node scripts/build-maxvideoai-plugin-release.mjs --source plugins/maxvideoai --out "$MCP_RELEASE_TMP/release"
(cd "$MCP_RELEASE_TMP/release" && shasum -a 256 -c maxvideoai-plugin-0.3.5.zip.sha256)
assert_release_source
```

Record the exact checksum and complete public file list. The bundle must contain
the corrected seven captions and current registered captures, with no release
card. Historical `release-0.3.4.png` remains in source only. Compare each image
and caption in the entire candidate, including unchanged consumers; a diff-only
review is insufficient. Require zero local test skips. Record pnpm's known
ignored-build-script warning; do not approve new dependency scripts implicitly.

## 2. Create the new immutable source tag

Immediately before writing, recheck clean source, verify the old source tag is
unchanged, and establish absence of the new source/focused tags and both release
records. `git ls-remote --exit-code` must return 2 for absence; GitHub must report
`release not found`/HTTP 404. Authentication/network failures are not absence.
Inspect the configured Git tagger identity before creation and record it.

```sh
assert_release_source
git tag -a maxvideoai-plugin-v0.3.5 "$SOURCE_SHA" -m "MaxVideoAI plugin v0.3.5"
git push origin refs/tags/maxvideoai-plugin-v0.3.5
```

Verify remote annotated object, peeled `SOURCE_SHA`, message, unchanged branches,
and clean detached worktree. Never force, replace, or move a colliding tag.

## 3. Prepare, review, and publish through the protected workflow

Verify the `maxvideoai-plugin-publication` environment still requires review.
Record focused `main` as `PUBLIC_BASE_SHA` and the pre-dispatch run IDs, then:

```sh
gh workflow run publish-maxvideoai-plugin.yml --repo camgraphe/MaxVideoAi \
  --ref maxvideoai-plugin-v0.3.5 -f source_tag=maxvideoai-plugin-v0.3.5
```

Resolve the newly created RUN_ID by workflow, event, exact ref, head SHA, and
dispatch time; do not assume an unrelated latest run is this dispatch. Record
its URL and the prepare/publish job IDs. Wait for successful preparation and the
pending protected deployment. Download the completed prepare-job log using
`gh api repos/camgraphe/MaxVideoAi/actions/jobs/$PREPARE_JOB_ID/logs` outside the
repository. Do not use `gh run view --log` while the overall run is pending;
older CLI versions reject that even for a completed job.

Review the complete log and staged diff, all candidate captions, asset
registrations, examples/guides, metadata, file membership and checksums. Reject
secrets, staging URLs, unrelated or unregistered files, stale proof claims,
unexpected deletions, source drift, public-base drift, or checksum mismatch.
Only the Linux authoring-validator absence and macOS-alias platform guards may
skip in CI, and only when their corresponding local tests passed and the
controller explicitly accepts the recorded exclusions. Any other skip stops.

After independent pre-approval review passes, the authorized controller approves
only this RUN_ID's pending `maxvideoai-plugin-publication` environment. The
existing workflow must rebuild and match the prepared source/base/tree and
refuse remote drift before its non-force push. Await successful completion.

Read focused main as `PUBLIC_SHA`; verify VERSION 0.3.5, focused `v0.3.5` resolves
to that commit, and the non-draft/non-prerelease release has exactly the ZIP and
`.zip.sha256` assets. Download those assets to a new external temp directory,
run `shasum -a 256 -c`, then `cmp` the ZIP against the pinned local candidate.
Only after equality, create the source release with `--verify-tag`, no uploaded
assets, title `MaxVideoAI plugin v0.3.5`, and notes linking the canonical focused
release and installation/recovery guide. Verify it is public, non-draft,
non-prerelease, at the exact source tag, and has zero assets.

## 4. Publish the matching Official Registry record

Only after the focused release and checksum checks, use official
`mcp-publisher` **1.8.1** outside the repository. On Darwin arm64, download
`mcp-publisher_darwin_arm64.tar.gz` from `modelcontextprotocol/registry` release
`v1.8.1`; require SHA-256
`e45e520892460732a4bdf37255576415d4a53ec171f8b913faf15bb1aef7cb77`
before extracting. Other platforms require a separately verified artifact.

Recheck `assert_release_source`, registry name `com.maxvideoai/maxvideoai`,
version 0.3.5, and remote `https://api.maxvideoai.com/mcp`. Run the pinned
publisher's `validate "$MCP_SERVER_JSON"` and recheck cleanliness. Confirm no
0.3.5 Registry record exists. Use only the existing owner-controlled HTTPS
namespace key (`MCP_REGISTRY_PRIVATE_KEY`) for `login http --algorithm ecdsap384
--domain=maxvideoai.com`; never print it, enable tracing, commit credentials, or
generate a replacement identity. Missing key or ownership proof stops the task.

Immediately before the single `publish "$MCP_SERVER_JSON"`, rerun the source
assertion. If the result is uncertain, inspect the Registry read-only before
retrying. Query the official API for `com.maxvideoai/maxvideoai` and require
0.3.5, `status=active`, `isLatest=true`, correct metadata, and recorded timestamps.
Recheck source cleanliness. Never create the cancelled 0.3.4 Registry record.

## 5. Record post-publication evidence separately

After observed success, use a separate mutable evidence branch/worktree based on
the accepted source. Keep the detached release worktree unchanged. Add red-first
evidence assertions and update discovery, the directory submission ledger, GEO
analysis, next-task queue, and relevant public-release/legal-support contracts
with source/public SHAs, tags, both release URLs, exact asset list and checksum,
workflow URL/conclusion, Registry version/status/timestamps, and clean install
observations. Replace candidate language only with measured published facts.

Preserve the cancelled 0.3.4 history. Record downstream refresh lag and host/store
limits separately; no new directory submission or runtime promotion is implied.
Run release/content gates, focused plugin/bundle/mirror/asset/legal-support tests,
frontend lint, exposure lint, and `git diff --check` before the separately
authorized evidence commit/PR. Any further publication defect requires another
patch version, never a rewritten tag or overwritten release asset.
