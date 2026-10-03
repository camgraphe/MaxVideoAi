# Studio published-baseline validation — 4 October 2026

The candidate at `7ffa8d8c4` diverged before the accepted plugin 0.3.6 source.
It omitted shipped runtime fixes and still enabled Sora generation. Those bounded
regressions have now been reconciled locally, preserving the candidate's Studio
actors, editorial policy, seven capability gates, timeline and export tools.
**The branch is not production-ready:** this is not a claim that the whole
current-main application has been reconciled.
The remaining integration decisions below must be resolved before production.
No merge, checkout, tag movement, version bump, push, deployment, publication,
Registry write, account connection or provider call was performed by this audit.

## Immutable sources and public artifact

| Evidence | Observed value |
| --- | --- |
| Starting candidate | `7ffa8d8c4`, branch `codex/studio-creative-workspace` |
| Shared ancestor with release and target | `b445f6583098c6cfc6e41874cb2af04e5451ef8c` |
| Accepted source tag | `maxvideoai-plugin-v0.3.6` |
| Annotated source tag object | `2acadc4d6aa5eb1ef0d807b1f6ac62048985d3b6` |
| Peeled source commit | `3f757a540d8cb2ba6835c4e38c9da6923ef545e1` (PR #328) |
| Public plugin tag/commit | `v0.3.6` / `b6c39068243fa1327bfaca864a455bbd32a47bb3` |
| Target main observed by `git ls-remote` | `5251f4d3f826da175ed1c334e0c8e3e10b3fc82a` |
| Public ZIP | `maxvideoai-plugin-0.3.6.zip`, 1,238,490 bytes, 60 files |
| Downloaded ZIP SHA-256 | `efbe2bb3b43a6e3d5fc0b10ed72abf382d55e875da3f3ae95117c4a4743531e9` |
| Source parity | All 59 authored ZIP files equal the accepted source bytes; remaining file is generated `checksums.json` |
| Official Registry | `com.maxvideoai/maxvideoai`, `0.3.6`, `active`, `isLatest: true`; publication timestamp `2026-09-21T23:07:47.693571Z` |

The downloaded ZIP's hash also matches the GitHub release asset digest.
The [canonical release](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.6)
was published at `2026-09-21T23:02:39Z`; the
[source pointer](https://github.com/camgraphe/MaxVideoAi/releases/tag/maxvideoai-plugin-v0.3.6)
at `23:06:15Z`, with no uploaded assets. The
[Registry record](https://registry.modelcontextprotocol.io/v0.1/servers/com.maxvideoai%2Fmaxvideoai/versions/latest)
was read separately. Local refs matched remote immutable refs; no fetch overwrote
an existing tag. Every worktree git command used this worktree's `GIT_WORK_TREE`.

Evidence is under `output/studio-creative-workspace/published-baseline/`:
`provenance.json`, both release API responses, `registry-latest.json`, the downloaded
ZIP, `public-archive-verification.json`, `public-archive-source-parity.json`, and
`source-to-candidate.patch` / `source-to-target-main.patch`. These comparisons use
fixed commits, not moving branch names.

## Regressions restored

| Owner | Lost behavior in the starting candidate | Bounded reconciliation |
| --- | --- | --- |
| `frontend/src/server/mcp/http-handler.ts` | Read the entire request body before enforcing 128 KiB; lost rejected-token reconnect challenge and body-reader error handling. | Restored released bounded streaming read/cancellation, `invalid_token` challenge without credential disclosure, and controlled JSON-RPC failure. |
| `frontend/src/server/mcp/reference-upload-app.ts` and restored `reference-upload-app-legacy.ts` | Re-advertised v1, reused consumed capability on later batch retry, lost successful earlier IDs from model context, allowed concurrent upload events. | Restored v2 URI, fresh retry capabilities, retained successes, upload lock, and exact frozen v1 resource for old host caches. |
| `frontend/src/server/mcp/tool-result.ts` | Added formatting whitespace to every text fallback. | Restored compact JSON with complete structured/text values and resource links. |
| `frontend/src/server/agent-api/paid-generation-execution.ts` | Classified an `ok: true` refunded image result as completed; dropped rejection diagnostics. | Restored rejection/ambiguous-settlement classification and diagnostic forwarding, preserving Studio-specific charge descriptions. |
| `frontend/src/server/generations/paid-provider-execution.ts` | Lost sanitized rejection message and submission-failure metadata on job/refund persistence. | Restored shipped persistence counterpart and idempotent refund behavior. Real disposable PostgreSQL verifies one refund, sanitized failure data and unrelated snapshot preservation. |
| `frontend/src/server/mcp/tools/recommend-models.ts` | Interpreted a budget estimate as `lower_cost`; dropped nullable priority examples. | Restored released field guidance, retaining newer exact-ID editorial and single-asset outcome guidance. |
| Plugin `plan`, `generate`, `generation-safety.md` | Lost schema discovery, precise installed/tool/auth state distinctions, shell/app reconnect caveat, server-directed polling, common media intent and text-only routing exclusions. | Restored released guidance, preserving authorized host-file import and explicit brief/model/reference/job continuity. |
| Plugin Codex/discovery/distribution guides and changelog | Dropped local helper/reconnect instructions and 0.3.6 history; called 0.3.5 latest Registry. | Restored guidance and historical changelog. Discovery now requires checking the Registry separately; maintainer distribution records the dated observed 0.3.6. |
| Canonical model registry and its five generated projections | Sora 2/Pro were `legacy`, app-published and price-published despite accepted source retirement. | Restored `deep_legacy`, disabled app/pricing, removed app ranks/variants; historical identity/model/example/comparison URLs remain authored. Regenerated every projection through the documented commands. |
| `frontend/lib/model-generation-policy.ts`, generate route context and preflight | Hidden aliases/trusted requests could bypass discovery removal. | Restored published registry-derived early rejection before configuration, pricing, billing or provider routing. No hardcoded Sora provider override. |
| `frontend/config/model-families.ts` | Empty current-model membership fell back to historical published models and navigation. | Restored released current-membership derivation and navigation condition from PR #325 (`f08e61f3a`), required by the released registry contract. |
| `frontend/src/server/mcp/oauth-consent.ts` | Consent login defaulted to sign-up. | Ported the self-contained `mode=signin` return URL from target-main PR #376; the existing login mode parser consumes it. Existing authorization-ID validation remains unchanged. |

The Sora policy comes from PR #321 (`63c5105a44aa7542b2e856c817f4df8e4ce83a04`)
and the follow-up discovery fix #325, both contained in the accepted 0.3.6 source.
Only `frontend/config/model-registry.json` was authored; the generated runtime,
engine catalog and three roster files were regenerated, never hand-edited.
`frontend/config/agent-model-editorial-policy.json` was not changed.

The released global instructions were not copied over the Studio implementation.
The 128 capability combinations, 2,000-byte budgets, gated Studio edit/export tools,
new conversation/privacy explanation, and candidate release-art boundaries remain.
The publication workflow already retained the client gate; no replacement of its
newer release process was needed. `package.json` now includes uploader and compact
serialization regressions in `mcp:client:check`. Only `policyFingerprintSha256`
changed in the curated policy fixture; expected decisions and fixture hash remain.

## Verification

| Check | Result / evidence |
| --- | --- |
| Restored runtime contracts before fixes | 43 pass, 9 fail, 0 skip: `restored-contracts-red.log` |
| Rejection persistence before fix | 1 failure on absent persisted message: `refund-persistence-red.log` |
| Runtime and PostgreSQL after fixes | 53/53 pass, 0 skip: `restored-contracts-green.log` |
| Sora/OAuth released contracts before fixes | 69 pass, 6 fail: `sunset-consent-red.log`; subsequent family fallback failure retained in `sunset-consent-green.log` |
| Final Sora/OAuth/registry/catalog/recommendation/Fal/login/editorial suite | 117/117 pass, 0 skip: `sunset-consent-final.log` |
| Final `pnpm mcp:client:check` | 134 pass, 1 optional validator skip, 0 fail, then all 70 curated scenarios: `mcp-client-check-final.log` |
| Private reference import, direct upload, local helper, public release bundle and mirror | 110/110 pass, 0 skip: `import-and-bundle-check.log` |
| Studio generation actors, scope, video/image transactions, MCP trial and framed paid requests | 24/24 pass, 0 skip: `studio-paid-generation-check.log` |
| Registry generate/catalog/roster/check | 55 registry models, 54 roster entries, no drift: `model-registry-regenerate.log` |
| Frontend typecheck | Passed with `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: `typecheck-final.log` |
| Frontend lint | No errors, six existing Studio native-image warnings: `frontend-lint-final.log` |
| Exposure lint | Passed: `exposure-lint.log` |
| Both skill authoring validators | Passed with installed cached PyYAML: `skill-validator.log` |
| Local deterministic archive | Built for inspection as source version 0.3.5; SHA-256 `314b147b2d87a28282af89b040a0e56e235f48b8ed6c1ec4bc0ab6c7768e9b92`: `candidate-bundle.log` |
| Whitespace | `git diff --check` passed |

The one optional combined validator test skips because the local
`plugin-creator/scripts/validate_plugin.py` is absent. The two available skill
validators were run separately and passed after adding cached PyYAML to that
command's environment. An initial direct Python invocation lacked PyYAML; an
initial root `pnpm exec tsc` lacked a root TypeScript binary. Both were corrected
using existing local dependencies, without installing software. No skipped test
is represented as a pass. Offline decisions do not certify real host selection.

## Remaining integration and release gates

1. **Choose an unused release version after final integration.** `VERSION`, Codex,
   Claude/marketplace manifests and `server.json` deliberately remain 0.3.5 under
   this preparation scope; README/Codex install commands also remain pinned there.
   The inspected 0.3.5 candidate archive is not publishable. Update these owners
   together for the authorized new release; never overwrite 0.3.6 or reinstall a
   stale version as an update.
2. **Preserve the published Sora archive presentation.** Runtime spending is now
   blocked, but the candidate still lacks the broader shipped archival rollout:
   `models/[slug]/_components/ModelArchivePage.tsx`, its archive content/metadata
   builders, model route decision, EN/FR/ES Sora model JSON, comparison generation
   cards/prices, historical gallery wording and Sora blog/home copy. The source
   commits above contain those changes. Shipping the candidate directly could
   advertise Sora generation although the service now rejects it. Integrate the
   relevant archive behavior and verify localized pages before production.
3. **Do not half-port new reference/prompt-expansion schemas.** Relative to 0.3.6,
   target main adds `documentUrl`, `webpageUrl`, `enablePromptExpansion` and
   `promptExpansionMode: disabled` to `mcp/tools/prepare-generation.ts`. Matching
   changes exist in agent API `generation-capability-validation.ts`,
   `generation-normalization.ts`, `generation-pricing.ts`, `model-details.ts`,
   `paid-video-request-body.ts`, `types.ts` and related provider/model owners.
   These are new capabilities, not the lost 0.3.6 reliability fixes; they remain
   unimported here. Review the complete dependency set if they are part of the
   target deployment, and test quote/execution parity before advertising fields.
4. **Keep broader onboarding changes separate.** Current-main #376 also introduces
   `frontend/src/lib/mcp-oauth-continuation.ts`, recognition of legacy consent links
   lacking `mode`, localized MCP continuation copy, initial connection/staging UI
   state, and sign-in failure recovery in login controller/components. Only the
   self-contained consent-generated sign-in URL was ported. Integrate the complete
   onboarding slice if the release is intended to include target-main behavior;
   do not claim the larger UX has been reconciled.
5. **Freeze and requalify the actual integrated release.** Target main has unrelated
   model/pricing/provider/financial/site changes. This bounded audit neither
   certifies replacing it with the feature branch nor recommends a blind full
   merge. The release owner must retain current production fixes, resolve the
   integration scope, and rerun full release/build/host gates on the resulting
   immutable candidate.
6. **Deploy, publish and refresh independently.** The local package changes do not
   deploy `https://api.maxvideoai.com/mcp`, alter an installed host cache, publish to
   GitHub, change the Registry, or certify OAuth/end-to-end behavior. Follow the
   [distribution rollout](studio-mcp-distribution-rollout-2026-10-04.md) after
   final acceptance.

## n8n evidence correction

[n8n workflow 19591](https://n8n.io/workflows/19591-turn-creative-briefs-into-approved-maxvideoai-generations-with-human-review/)
is publicly listed on this observation. Its page describes exact quote preparation,
human approval, bounded polling and recovery of the accepted job. This supersedes
the September 17 private-review-only statement in older repository records.
The page observation does not establish byte parity of the downloadable workflow
with local JSON, a new runtime test, n8n Cloud compatibility, or publication of the
two other candidates. No authored store status was promoted by this audit.

## Modified ownership inventory

Runtime and registry owners:

- `frontend/src/server/mcp/{http-handler,reference-upload-app,reference-upload-app-legacy,tool-result,oauth-consent}.ts`
- `frontend/src/server/mcp/tools/recommend-models.ts`
- `frontend/src/server/agent-api/paid-generation-execution.ts`
- `frontend/src/server/generations/paid-provider-execution.ts`
- `frontend/app/api/generate/_lib/route-context.ts`
- `frontend/app/api/preflight/_lib/media-aware-preflight.ts`
- `frontend/lib/model-generation-policy.ts`
- `frontend/config/{model-registry,model-runtime,engine-catalog,model-roster}.json`
- `frontend/config/model-families.ts`
- `docs/model-roster.{json,csv}`
- `package.json`

Plugin source guidance:

- `plugins/maxvideoai/CHANGELOG.md`
- `plugins/maxvideoai/docs/{codex,discovery,distribution}.md`
- `plugins/maxvideoai/skills/{plan,generate}/SKILL.md`
- `plugins/maxvideoai/skills/generate/references/generation-safety.md`

Focused contracts and reviewed fingerprint:

- `tests/mcp-{confirm-generation,reference-upload-app,result-serialization,transport-contract,plugin-contract,rejection-persistence-postgres,oauth-consent-contract,model-catalog,model-recommendations}.test.ts`
- `tests/{model-registry-parity,generate-route-context,preflight-media-pricing,fal-model-policy}.test.ts`
- `tests/fixtures/mcp-tool-selection-curated-policy.json`

This report and the local evidence directory are the only audit documentation/output
owners. Other concurrently created Studio QA/financial files belong to their
respective agents and were not modified here.
