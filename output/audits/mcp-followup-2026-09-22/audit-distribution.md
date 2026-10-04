# Targeted MCP distribution audit

Date: 2026-09-22
Scope: source plugin manifests, skill dependencies and implicit invocation, relative resources, deterministic release builder, marketplace/release workflow, and supported-host documentation.
Validation: `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/mcp-plugin-contract.test.ts tests/mcp-public-release-bundle.test.ts tests/maxvideoai-plugin-mirror.test.ts` — all 22 subtests passed. A local build from `plugins/maxvideoai` succeeded.

## Findings

### 1. Defect: the deterministic public bundle drops `docs/distribution.md`

`plugins/maxvideoai/docs/distribution.md:1-8` is the package's distribution/install-status document, and `:47-70` carries the MCP Registry, OpenAI/Anthropic directory, and distribution-matrix status. It is present in the source tree, but it is absent from the release allowlist in `scripts/build-maxvideoai-plugin-release.mjs:21-79` and from the independent expected inventory in `tests/mcp-public-release-bundle.test.ts:29-87`.

Reproduction from the repository root:

```sh
out=$(mktemp -d /private/tmp/maxvideoai-bundle-audit.XXXXXX)
node scripts/build-maxvideoai-plugin-release.mjs --source plugins/maxvideoai --out "$out"
test -e "$out/maxvideoai-plugin/docs/distribution.md"; echo "$?"  # 1
```

The mirror synchronizer is exact (`scripts/sync-maxvideoai-plugin-repository.mjs:322-333`), so the next publication removes this document from the dedicated public repository. This is a release-surface defect if the public repository is expected to retain its distribution/status documentation; either add it to the allowlist and bundle contract or explicitly mark it as source-only and remove the source-level public-doc ownership expectation. This finding is independent of the unshipped text edits and does not rely on the `0.3.5` version value.

### 2. Coverage gap: evaluation tests say “package ships” while the release archive ships no evals

`tests/mcp-plugin-contract.test.ts:576-596` names its test “the package ships user-centered evaluation scenarios” and reads `plugins/maxvideoai/evals/README.md` and `evals/scenarios.md`. The deterministic allowlist at `scripts/build-maxvideoai-plugin-release.mjs:21-79` contains no `evals/*`, and the built bundle has no `evals/conversation-cases.json`, `evals/README.md`, or `evals/scenarios.md`.

Reproduction: build the bundle, then `test -e "$out/maxvideoai-plugin/evals/scenarios.md"` returns `1`. The test currently passes because it validates the source checkout rather than the archive. This is a contract/coverage ambiguity, not evidence that hosts need the eval files: decide whether evals are maintainer-only (rename/reword the test and add an explicit archive-exclusion assertion) or public package material (add them to the allowlist and checksum inventory).

### 3. Hypothesis / coverage gap: the packaged local helper is not executable after archive extraction

The helper has a shebang at `plugins/maxvideoai/scripts/import-reference-files.mjs:1`, and the user-facing README says Codex/Claude Code should use the packaged local helper at `plugins/maxvideoai/README.md:95-101`. The custom ZIP writer sets every central-entry UNIX mode to `0644` at `scripts/build-maxvideoai-plugin-release.mjs:720`, including `scripts/import-reference-files.mjs`.

Reproduction against the locally built archive:

```text
maxvideoai/scripts/import-reference-files.mjs -> UNIX mode 0644
```

An operator invoking `./scripts/import-reference-files.mjs` after extracting the ZIP will therefore receive the platform's permission error; invoking `node scripts/import-reference-files.mjs ...` remains viable. No current host-specific guide gives the helper command or tests extracted-archive execution. This is a bounded compatibility hypothesis because host installers may invoke Node explicitly. Either preserve executable mode for the helper, document the explicit `node` invocation, or add an extracted-archive launch check.

## Duplication review

Useful duplication that should remain:

- The endpoint and server identity appear in `.mcp.json`, the Codex dependency YAML, `server.json`, and human setup docs because each host/registry/documentation consumer reads a different surface.
- Approval, recovery, and reference rules appear in each skill's short main instructions and in its linked reference files because a skill may be loaded without its references; the reference files then provide the deeper standalone workflow.
- Host-specific install/reconnect steps in `docs/chatgpt.md`, `docs/claude.md`, and `docs/codex.md` must remain separate. A generic MCP guide cannot safely stand in for exact host UX.

No concrete removable instruction duplication was proven in this bounded audit. The duplicated public-file inventory between the builder and `tests/mcp-public-release-bundle.test.ts` is a maintenance risk, but it is deliberately independent verification rather than customer-facing instruction duplication; removing it without replacing the independent check would weaken the release contract.

## Not findings

The installed cache still contains the earlier `0.3.5` package while the working tree has unshipped changes. Per the repository instructions, I did not treat that cache/version state as a defect, modify it, or infer host behavior from it. The focused suites and local builder passed; no network, installation, publication, deployment, secrets, or Git mutations were used.
