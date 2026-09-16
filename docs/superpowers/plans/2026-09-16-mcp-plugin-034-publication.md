# MCP Plugin 0.3.4 Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the accepted 0.3.4 plugin source immutably to both GitHub repositories and the Official MCP Registry, then record verifiable release evidence.

**Architecture:** Validate the deterministic source candidate, merge the truth-convergence PR, and bind every external action to that accepted source commit. Use the protected public-repository workflow for mirroring and artifacts, then publish the matching `server.json` through pinned `mcp-publisher` 1.8.1. Record evidence in a separate post-publication change.

**Tech Stack:** Git, GitHub CLI and Actions, Node 22, pnpm, deterministic ZIP builder, MCP Registry publisher 1.8.1, curl, jq, SHA-256.

**Spec:** `docs/superpowers/specs/2026-09-16-mcp-convergence-release-design.md`

## Global Constraints

- Run only after the checked-in truth PR passes and merges to `main`.
- Publish source tag `maxvideoai-plugin-v0.3.4` and focused-repository tag `v0.3.4`; never move an existing tag.
- The main repository release is a zero-asset pointer; the focused public release alone owns the installable ZIP and SHA-256 asset.
- Dispatch the existing protected workflow from the exact source tag and review its prepared diff before environment approval.
- Publish Registry version 0.3.4 only after the focused public release exists and matches `server.json`.
- Stop on source drift, public-base drift, tag collision, checksum mismatch, registry mismatch, or missing owner-controlled registry authentication.
- Never print or commit a private key, OAuth token, GitHub token, or test credential.

---

### Task 1: Verify the Accepted Source Candidate

**Files:**
- Verify: `plugins/maxvideoai/VERSION`
- Verify: `plugins/maxvideoai/CHANGELOG.md`
- Verify: `plugins/maxvideoai/server.json`
- Verify: `plugins/maxvideoai/README.md`
- Verify: `docs/marketing/github-asset-manifest.json`
- Verify: `.github/workflows/publish-maxvideoai-plugin.yml`

**Interfaces:**
- Consumes: merged Milestone A PR and source `main`.
- Produces: immutable `SOURCE_SHA` whose plugin version and release gates agree on 0.3.4.

- [ ] **Step 1: Resolve and verify the source commit**

```bash
git fetch origin main --tags
SOURCE_SHA=$(git rev-parse origin/main)
test "$(git show "$SOURCE_SHA":plugins/maxvideoai/VERSION | tr -d '\r\n')" = "0.3.4"
test "$(git show "$SOURCE_SHA":plugins/maxvideoai/server.json | jq -r .version)" = "0.3.4"
git ls-remote --exit-code --tags origin refs/tags/maxvideoai-plugin-v0.3.4 && exit 1 || true
gh release view maxvideoai-plugin-v0.3.4 --repo camgraphe/MaxVideoAi >/dev/null 2>&1 && exit 1 || true
```

Expected: both version checks succeed and neither the source tag nor source release exists.

- [ ] **Step 2: Run the exact protected-workflow gate locally**

```bash
pnpm install --frozen-lockfile
pnpm github:assets:release-check
node scripts/check-github-content.mjs plugins/maxvideoai/README.md
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/maxvideoai-plugin-mirror.test.ts \
  tests/mcp-public-release-bundle.test.ts \
  tests/mcp-plugin-contract.test.ts \
  tests/mcp-reference-file-import.test.ts \
  tests/mcp-reference-local-helper.test.ts \
  tests/github-content-contract.test.ts \
  tests/github-assets.test.ts
```

Expected: release checks and all focused tests pass with no skips.

- [ ] **Step 3: Build the deterministic candidate outside the repository**

```bash
MCP_RELEASE_TMP=$(mktemp -d)
node scripts/build-maxvideoai-plugin-release.mjs \
  --source plugins/maxvideoai \
  --out "$MCP_RELEASE_TMP/release"
shasum -a 256 "$MCP_RELEASE_TMP/release/maxvideoai-plugin-0.3.4.zip"
sed -n '1p' "$MCP_RELEASE_TMP/release/maxvideoai-plugin-0.3.4.zip.sha256"
```

Expected: the calculated archive SHA-256 equals the checksum file and no repository file changes.

### Task 2: Create the Immutable Source Tag

**Files:**
- External write: `camgraphe/MaxVideoAi` tag `maxvideoai-plugin-v0.3.4`

**Interfaces:**
- Consumes: `SOURCE_SHA` from Task 1.
- Produces: one immutable source tag for the protected publication workflow.

- [ ] **Step 1: Create and push the annotated source tag**

```bash
git tag -a maxvideoai-plugin-v0.3.4 "$SOURCE_SHA" -m "MaxVideoAI plugin v0.3.4"
git push origin refs/tags/maxvideoai-plugin-v0.3.4
```

Expected: the remote tag resolves to `SOURCE_SHA` and no branch changes.

### Task 3: Publish the Focused Repository Through the Protected Workflow

**Files:**
- External write: `camgraphe/maxvideoai-plugin` main branch and `v0.3.4` release
- Workflow: `.github/workflows/publish-maxvideoai-plugin.yml`

**Interfaces:**
- Consumes: source tag `maxvideoai-plugin-v0.3.4`.
- Produces: reviewed public commit, public tag `v0.3.4`, deterministic ZIP, and checksum asset.

- [ ] **Step 1: Dispatch from the exact tag ref**

```bash
gh workflow run publish-maxvideoai-plugin.yml \
  --repo camgraphe/MaxVideoAi \
  --ref maxvideoai-plugin-v0.3.4 \
  -f source_tag=maxvideoai-plugin-v0.3.4
```

- [ ] **Step 2: Inspect the prepared diff before environment approval**

```bash
RUN_ID=$(gh run list \
  --repo camgraphe/MaxVideoAi \
  --workflow publish-maxvideoai-plugin.yml \
  --branch maxvideoai-plugin-v0.3.4 \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')
gh run view "$RUN_ID" --repo camgraphe/MaxVideoAi --log
```

Expected prepared diff: 0.3.4 metadata, current README/guides, registered refreshed assets, current examples, checksums, and no secret, staging URL, unregistered file, or unrelated source file. Approve only the pending `maxvideoai-plugin-publication` deployment after this review.

- [ ] **Step 3: Wait and verify public identity**

```bash
gh run watch "$RUN_ID" --repo camgraphe/MaxVideoAi --exit-status
PUBLIC_SHA=$(gh api repos/camgraphe/maxvideoai-plugin/commits/main --jq .sha)
test "$(gh api repos/camgraphe/maxvideoai-plugin/contents/VERSION --jq .content | base64 --decode | tr -d '\r\n')" = "0.3.4"
gh release view v0.3.4 --repo camgraphe/maxvideoai-plugin --json tagName,targetCommitish,isDraft,isPrerelease,assets,url
```

Expected: successful workflow, public `VERSION` 0.3.4, release target `PUBLIC_SHA`, and exactly ZIP plus `.zip.sha256` assets.

- [ ] **Step 4: Download and verify public checksum**

```bash
MCP_PUBLIC_TMP=$(mktemp -d)
gh release download v0.3.4 \
  --repo camgraphe/maxvideoai-plugin \
  --dir "$MCP_PUBLIC_TMP" \
  --pattern 'maxvideoai-plugin-0.3.4.zip*'
cd "$MCP_PUBLIC_TMP"
shasum -a 256 -c maxvideoai-plugin-0.3.4.zip.sha256
```

Expected: `maxvideoai-plugin-0.3.4.zip: OK`.

- [ ] **Step 5: Create the zero-asset main-repository pointer release**

Run this only after Step 4 proves the canonical focused release exists:

```bash
gh release create maxvideoai-plugin-v0.3.4 \
  --repo camgraphe/MaxVideoAi \
  --verify-tag \
  --title "MaxVideoAI plugin v0.3.4" \
  --notes $'# MaxVideoAI plugin v0.3.4\n\nMaxVideoAI plugin `0.3.4` is published from this immutable source tag. The canonical installable ZIP and SHA-256 checksum are owned by the focused [`camgraphe/maxvideoai-plugin` v0.3.4 release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.4). This main-repository release intentionally uploads no package assets.\n\nInstallation and recovery guidance: https://github.com/camgraphe/maxvideoai-plugin/tree/v0.3.4#readme'
```

Expected: public, non-draft, non-prerelease, correct tag, zero uploaded assets.

### Task 4: Publish Official Registry Version 0.3.4

**Files:**
- Publish: `plugins/maxvideoai/server.json`
- External write: Official MCP Registry record `com.maxvideoai/maxvideoai` 0.3.4

**Interfaces:**
- Consumes: focused release `v0.3.4`, HTTPS namespace proof, and owner-controlled `MCP_REGISTRY_PRIVATE_KEY`.
- Produces: one active latest Official MCP Registry record at 0.3.4.

- [ ] **Step 1: Install and verify pinned publisher 1.8.1 outside the repository**

```bash
test "$(uname -s)" = "Darwin"
test "$(uname -m)" = "arm64"
MCP_PUBLISHER_TMP=$(mktemp -d)
gh release download v1.8.1 \
  --repo modelcontextprotocol/registry \
  --dir "$MCP_PUBLISHER_TMP" \
  --pattern 'mcp-publisher_darwin_arm64.tar.gz'
printf '%s  %s\n' \
  'e45e520892460732a4bdf37255576415d4a53ec171f8b913faf15bb1aef7cb77' \
  "$MCP_PUBLISHER_TMP/mcp-publisher_darwin_arm64.tar.gz" | shasum -a 256 -c -
tar -xzf "$MCP_PUBLISHER_TMP/mcp-publisher_darwin_arm64.tar.gz" -C "$MCP_PUBLISHER_TMP" mcp-publisher
"$MCP_PUBLISHER_TMP/mcp-publisher" --help
```

Expected: checksum OK and official publisher help output.

- [ ] **Step 2: Validate exact metadata**

```bash
test "$(jq -r .version plugins/maxvideoai/server.json)" = "0.3.4"
test "$(jq -r .name plugins/maxvideoai/server.json)" = "com.maxvideoai/maxvideoai"
test "$(jq -r '.remotes[0].url' plugins/maxvideoai/server.json)" = "https://api.maxvideoai.com/mcp"
"$MCP_PUBLISHER_TMP/mcp-publisher" validate plugins/maxvideoai/server.json
```

- [ ] **Step 3: Authenticate without exposing the existing key**

```bash
test -n "$MCP_REGISTRY_PRIVATE_KEY"
"$MCP_PUBLISHER_TMP/mcp-publisher" login http \
  --algorithm ecdsap384 \
  --domain=maxvideoai.com \
  --private-key "$MCP_REGISTRY_PRIVATE_KEY"
```

If the variable or existing owner-controlled key is unavailable, stop. Do not generate a replacement identity in this release.

- [ ] **Step 4: Publish once and verify the API**

```bash
"$MCP_PUBLISHER_TMP/mcp-publisher" publish plugins/maxvideoai/server.json
curl -fsSL 'https://registry.modelcontextprotocol.io/v0.1/servers?search=com.maxvideoai%2Fmaxvideoai' | \
  jq -e '.metadata.count == 1 and .servers[0].server.version == "0.3.4" and .servers[0]._meta["io.modelcontextprotocol.registry/official"].status == "active" and .servers[0]._meta["io.modelcontextprotocol.registry/official"].isLatest == true'
```

Expected: one active latest 0.3.4 record.

### Task 5: Record Post-Publication Evidence

**Files:**
- Modify: `plugins/maxvideoai/docs/discovery.md`
- Modify: `docs/marketing/mcp-directory-submissions.md`
- Modify: `docs/marketing/GEO-ANALYSIS.md`
- Modify: `docs/marketing/github-next-task-queue.md`
- Modify: `tests/mcp-legal-support-readiness.test.ts`
- Modify: `tests/mcp-public-release-bundle.test.ts`

**Interfaces:**
- Consumes: exact source/public commits, releases, checksum, workflow result, and Registry timestamp.
- Produces: checked-in public evidence that no longer calls 0.3.4 a candidate.

- [ ] **Step 1: Add failing public-version evidence assertions**

```ts
assert.match(directory, /Official MCP Registry[\s\S]*ACTIVE — VERSION 0\.3\.4/i);
assert.match(directory, /canonical public source[\s\S]*v0\.3\.4/i);
assert.doesNotMatch(directory, /eligible_and_verified[^\n]*0\.3\.3/i);
```

Run the two affected tests and confirm failure before editing evidence documents.

- [ ] **Step 2: Replace candidate language with observed values**

Record the source commit/tag/release URL, public commit/release URL, ZIP SHA-256, workflow run URL, Registry timestamps, and current downstream observations. Keep third-party refresh delays explicit.

- [ ] **Step 3: Run post-publication gates**

```bash
pnpm github:assets:release-check
node scripts/check-github-content.mjs plugins/maxvideoai/README.md
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-public-release-bundle.test.ts \
  tests/maxvideoai-plugin-mirror.test.ts \
  tests/mcp-plugin-contract.test.ts \
  tests/github-content-contract.test.ts \
  tests/github-assets.test.ts
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: all gates pass.

- [ ] **Step 4: Commit, push, and open the evidence PR**

```bash
git add \
  plugins/maxvideoai/docs/discovery.md \
  docs/marketing/mcp-directory-submissions.md \
  docs/marketing/GEO-ANALYSIS.md \
  docs/marketing/github-next-task-queue.md \
  tests/mcp-legal-support-readiness.test.ts \
  tests/mcp-public-release-bundle.test.ts
git commit -m "docs: record MCP plugin 0.3.4 publication"
git push -u origin codex/mcp-034-publication-evidence
gh pr create \
  --base main \
  --head codex/mcp-034-publication-evidence \
  --title "docs: record MCP plugin 0.3.4 publication" \
  --body "Records immutable source, focused-repository, checksum, workflow, and Official MCP Registry evidence for 0.3.4. No runtime capability change."
```
