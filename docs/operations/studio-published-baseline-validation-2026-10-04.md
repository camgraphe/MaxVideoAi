# Studio published-baseline validation — 4 October 2026

The candidate at `7ffa8d8c4` diverged before the accepted plugin 0.3.6 source.
It omitted shipped runtime fixes and still enabled Sora generation. Those bounded
regressions have now been reconciled locally, preserving the candidate's Studio
actors, editorial policy, seven capability gates, timeline and export tools.
**The branch is not production-ready:** the final combined build, full suite,
public-page smoke and distribution gates still need qualification. This is not
a claim that the whole current-main application has been reconciled.
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
This audit did not edit `frontend/config/agent-model-editorial-policy.json`; the
separate final catalog reconciliation owns subsequent catalog/editorial changes.

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

## Public retirement completion after the full-suite failures

The first broad run at `eb581c5cd` exposed 11 failures (6,082 tests: 6,069 pass,
11 fail, 2 skip). Its log remains
`output/studio-creative-workspace/release-human-validate-eb581c5cd.log`.
Retirement changes were held until that run completed. Public and workspace
closure behavior was then reconciled from the two immutable 0.3.6 ancestors
already identified above; each selected file patch passed `git apply --check`.
This was 59 selected file patches, not a wholesale commit or current-main merge.
The unrelated auth `confirmEmail` message changes in the same published commit
were deliberately excluded. Pricing-audit owners and later catalog/aliases are
owned by the other agents, not this reconciliation.

- **Model archives:** EN/FR/ES Sora 2/Pro content, strict archive parser, metadata
  builder, server component and route early return preserve canonical routes and
  historical family links. The archive emits a WebPage with no Product/Offer or
  generation action. Alternatives are filtered by current app/model publication.
  The existing current brand OG fallback and newer Studio changes are preserved.
- **Comparison and discovery:** closed app publication suppresses comparison
  generation controls and purchasable price arrays. Historical comparison URLs
  remain published/indexable while current recommendations exclude archives.
  Model menus, example-family selectors and homepage fallback cards omit Sora;
  explicit archive selection remains available. Database and local snapshot
  discovery filter before pagination, while historical playlists/watch readers
  and stored rows remain intact.
- **Historical recall:** saved Sora drafts, incoming links and video settings
  preserve their exact model identity. The workspace explains closure and blocks
  submission until the user explicitly chooses an available model. Studio returns
  no executable capability for archived blocks, instead of borrowing another
  model's capability. This preserves the newer Studio gates and saved content.
- **Public prose:** the three gallery introductions/FAQs, Sora access/prompt blogs,
  notices on historical comparison articles, current home/workflow copy and
  provider lists no longer promise Sora generation. Dated historical articles
  keep their date context; undated archive/gallery/home copy uses the announced
  September 24 shutdown date without presenting it as still upcoming.
- **Additional concrete gaps found during review:** the published homepage
  provider filter still promoted Sora because OpenAI also has an active image
  model. The Sora provider card was removed in all three locales, and homepage
  availability counts/provider eligibility now use app publication. Historical
  watch CTAs now say “Reuse prompt with another model” and explain closure while
  preserving the original `/app?from=` recall link, media, recorded cost and
  VideoObject URL. These small additions are local fixes beyond the copied
  retirement patches, with focused red/green tests.
- **MCP evidence:** the directory messaging test now expects the separately
  observed active 0.3.6 Registry release. No manifest bump or store-status change
  is hidden in that assertion.

| New check | Result / evidence in `published-baseline/` |
| --- | --- |
| Published public retirement contracts before changes | 5 pass, 14 fail, 0 skip: `public-retirement-red.log` |
| Published workspace recall contracts before changes | 23 pass, 3 fail, 0 skip: `workspace-retirement-red.log` |
| Watch copy before the additional fix | 3 pass, 2 fail: `watch-retirement-red.log` |
| Homepage provider/counts before the additional fix | 6 pass, 1 fail: `home-providers-red.log` |
| Final focused public/MCP/recall/metadata suite | 119/119 pass, 0 skip: `public-retirement-final.log` |
| Route/media/workspace architecture and registry/catalog contracts | 164/164 pass, 0 skip: `public-retirement-contracts.log` |
| Watch copy, original/media contracts and model pages | 58/58 pass, 0 skip: `watch-retirement-green.log` |
| Homepage provider/counts and route/performance contracts | 14/14 pass, 0 skip: `home-providers-green.log` |
| Frontend TypeScript | Passed: `public-retirement-typecheck-final.log` |
| Frontend lint | 0 errors, 6 existing Studio native-image warnings: `public-retirement-lint.log` |
| Exposure and whitespace | Passed after edits |

The Sora focused suite checks all six archive canonical/hreflang sets, localized
closure metadata (respecting the shared SEO description truncation), indexability,
strict required archive content and historical comparison sitemap membership.
The PostgreSQL test used a disposable database and proves unchanged stored rows,
three retained historical aliases, and correct current-feed pagination. No live
provider, production data or credentials were used. The React checklist found no
new client boundary, effect, remote fetch, media source or loading-policy change.
No performance improvement or newly rendered-page success is claimed from those
source checks. The `eb581c5cd` preview predates this patch and is not evidence for it.

### Seedance 1.5 publication follow-through

The separate catalog audit then restored target-main `deep_legacy` and disabled
app/pricing publication for Seedance 1.5 Pro. Its existing localized decision
content still advertised `/app?engine=seedance-1-5-pro`; the model template test
reproduced this failure (`seedance-archive-red.log`). This audit owns the bounded
public follow-through: EN/FR/ES `seedance-1-5-pro.json` now has explicit archive
content and historical metadata, with no active generation href. The canonical
model page explains only MaxVideoAI availability; it does not assert a provider
shutdown. Seedance 2.5 is the first current alternative.

Archive source attribution is now an optional strict `{label, href}` block in
localized content, with HTTPS validation. The six Sora archives retain their
OpenAI announcement; Seedance has no irrelevant OpenAI source. The generic
renderer no longer embeds a model-specific external source. Published historical
URLs and current family-example destinations remain intact. The Seedance
prelaunch/decision tests now assert archive status and no current hub membership,
while retaining the comparison-URL and alias contracts.

Seven additional source/locale/metadata tests reproduced missing archives/source
ownership (`seedance-archive-contract-red.log`). The final combined focused run
is **126/126 pass, zero skip** in `public-retirement-catalog-final.log`, covering
Sora, Seedance, public navigation, MCP evidence, historical recall and strict
archive source attribution. TypeScript passes in
`public-retirement-catalog-typecheck.log`; lint still has zero errors and the same
six pre-existing Studio image warnings in `public-retirement-catalog-lint.log`.
The authored registry/projections, three compatibility aliases and Studio catalog
matrix remain owned by the separate catalog agent; this does not certify a full
target-main integration.

### Final combined-build public smoke matrix

The release owner will build and smoke the final immutable combined commit.
For each `sora-2` and `sora-2-pro`:

| Locale | Model archive | Historical family gallery |
| --- | --- | --- |
| EN | `/models/{slug}` | `/examples/sora` |
| FR | `/fr/modeles/{slug}` | `/fr/galerie/sora` |
| ES | `/es/modelos/{slug}` | `/es/galeria/sora` |

Expect HTTP 200; canonical `https://maxvideoai.com` plus the localized model
path; `en`, `fr`, `es` and `x-default` alternate links; index/follow; localized
closure heading/intro; WebPage JSON-LD; no Product/Offer or `app?engine=sora*`
action. Confirm model-page links for Seedance 2.5, MiniMax H3 and Wan 3, plus the
library and localized historical family gallery. Confirm the compatibility URL
`/fr/models/sora-2` permanently resolves to `/fr/modeles/sora-2` without changing
identity. Keep the source announcement link intact. Also smoke
`/models/seedance-1-5-pro`, `/fr/modeles/seedance-1-5-pro` and
`/es/modelos/seedance-1-5-pro` with the same archive metadata/CTA rules, a
Seedance family-example link and no OpenAI announcement. Seedance must also
stay absent from executable picks and current comparison-hub recommendations.

Smoke `/`, `/fr`, `/es`, `/models`, `/examples` and `/ai-video-engines`: no current
Sora engine/provider card, dropdown/selector recommendation, or general-feed
example. Direct Sora gallery/watch URLs retain historical playback and recorded
costs. For a historical watch fixture, verify “Reuse prompt with another model”
and that recall keeps its saved Sora identity and requests an explicit model
choice. No paid call is necessary. For `/ai-video-engines/sora-2-vs-veo-3-1`
(and localized comparison paths), preserve the URL and historical scores/media
while the Sora side has no generation CTA or purchasable price. Verify a current
comparison still has its normal generation and quoted-price behavior.

### Comparison indexation contract follow-up at `66934ab3c`

The final broad validation exposed one stale discovery assertion in
`tests/comparison-indexation-wave-1.test.ts`: every original FR/ES exclusion was
required to remain recommended in the English comparison directory, including
newly archived Sora and Seedance identities. The isolated test reproduced the
failure (13 pass, 1 fail in `comparison-indexation-retirement-red.log`). Product
behavior already correctly separated historical publication from current
recommendations; no product code changed in this follow-up.

The test now requires every original excluded pair to retain its published route,
English indexability and published sitemap membership, as well as its FR/ES
exclusion. Current pairs must remain discoverable in English; pairs with an
archived model must be absent from the current English directory. Existing
locale filtering checks for popular, use-case, directory and quick-start
recommendations remain intact. The comparison/archival/architecture suite passes
**56/56, zero skip** (`comparison-indexation-retirement-green.log`), and
`git diff --check` is clean. The broader final gate is owned by the release owner.

### Production snapshot routing probe and landmark correction

The `66934ab3c` production snapshot initially returned self-redirects for localized
model/gallery URLs when `next start` bound to `127.0.0.1`. This was a local QA
origin mismatch, not an archive redirect defect. Installed Next.js 15.5.18
normalizes loopback IPs to `localhost` in `server/web/next-url.js`, while the
router constructs `initURL` from the configured server hostname. The resulting
absolute rewrite was treated as external and re-entered canonical routing.
The middleware, route helpers, i18n routing and Next config are unchanged between
`7ffa8d8c4` and `66934ab3c` (empty git diff for those owners).

The same immutable snapshot and sanitized environment, served temporarily with
`--hostname localhost --port 3101`, returned 200 for all nine EN/FR/ES Sora and
Seedance 1.5 archives, both localized Sora galleries, `/fr/studio`, and the current
`/fr/modeles/seedance-2-5`. Wrong-English compatibility paths retained a single
301 to the localized canonical model path. Exact HTTP/canonical/hreflang evidence
is in `localhost-rewrite-probe-66934ab3c.json`. The release owner corrected the
untracked QA runner, retaining its previous copy for provenance. No product
routing change was made. The temporary server was stopped after this probe.
Veo FR and Wan ES reached their renderers but returned 500 because this isolated
fixture deliberately lacks `DATABASE_URL`; they are not represented as validated
current-model pages or as additional routing failures.

The same rendered archive review found a separate accessibility defect: both
`ModelArchivePage` and the marketing layout emitted a main landmark. The archive
root is now a styled `div`, leaving the layout's `main` intact. The bounded
architecture regression failed before the change (`archive-landmark-red.log`)
and the combined archive/indexation suite passes **35/35, zero skip** after it
(`archive-landmark-green.log`). `git diff --check` passes. This small source
change requires a new final build; the prior HTTP probe does not claim it was
already rendered. The release owner owns that rebuild and full qualification.

## Remaining integration and release gates

1. **Choose an unused release version after final integration.** `VERSION`, Codex,
   Claude/marketplace manifests and `server.json` deliberately remain 0.3.5 under
   this preparation scope; README/Codex install commands also remain pinned there.
   The inspected 0.3.5 candidate archive is not publishable. Update these owners
   together for the authorized new release; never overwrite 0.3.6 or reinstall a
   stale version as an update.
2. **Requalify the completed Sora archive reconciliation in the final build.**
   The earlier public-archive gap is now resolved in this branch, including
   localized model pages, comparison controls/prices, public discovery,
   historical galleries/blogs and workspace recall. The checks below establish
   source contracts; the release owner must run the listed localized smoke
   checks on the final combined build, not the earlier `eb581c5cd` preview.
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

### Additional public-retirement ownership

The exact additional paths are recorded below (all paths are repository-relative).
`output/studio-creative-workspace/published-baseline/public-retirement-patches.json`
records per-file source commits; `public-retirement-owned-files.json` is the
machine-readable full ownership list for staging/review. These exclude the other
agents' pricing, conversation-director, catalog/aliases and financial work.

- `content/en/blog/access-sora-2-without-invite.mdx`
- `content/en/blog/compare-ai-video-engines.mdx`
- `content/en/blog/sora-2-sequenced-prompts.mdx`
- `content/en/blog/veo-3-updates.mdx`
- `content/es/blog/accede-a-sora-2-sin-invitacion.mdx`
- `content/es/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika.mdx`
- `content/es/blog/indicaciones-secuenciadas-de-sora-2-con-sonido-e-identidad-de-marca.mdx`
- `content/es/blog/las-actualizaciones-de-veo-3-traen-controles-cinematograficos.mdx`
- `content/fr/blog/acceder-a-sora-2-sans-invitation.mdx`
- `content/fr/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika.mdx`
- `content/fr/blog/invites-sequencees-sora-2-avec-son-et-image-de-marque.mdx`
- `content/fr/blog/les-mises-a-jour-de-veo-3-apportent-des-controles-cinematographiques.mdx`
- `content/models/en/seedance-1-5-pro.json`
- `content/models/en/sora-2-pro.json`
- `content/models/en/sora-2.json`
- `content/models/es/seedance-1-5-pro.json`
- `content/models/es/sora-2-pro.json`
- `content/models/es/sora-2.json`
- `content/models/fr/seedance-1-5-pro.json`
- `content/models/fr/sora-2-pro.json`
- `content/models/fr/sora-2.json`
- `docs/engineering/model-registry.md`
- `docs/operations/studio-published-baseline-validation-2026-10-04.md`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceGenerationRunner.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-archived-engine.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-hydration.ts`
- `frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings.ts`
- `frontend/app/(core)/(workspace)/app/studio/workspace/_lib/models/model-capability-registry.ts`
- `frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx`
- `frontend/app/(core)/video/[id]/_components/VideoWatchSidebar.tsx`
- `frontend/app/(core)/video/[id]/_lib/video-watch-page-utils.ts`
- `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/engine-stats.ts`
- `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts`
- `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/filters.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareGenerateCard.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareShowdownSection.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq.ts`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing.ts`
- `frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts`
- `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelArchivePage.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-content.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-metadata.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx`
- `frontend/app/(localized)/[locale]/(marketing)/workflows/page.tsx`
- `frontend/components/marketing/home/HomeConversionSections.tsx`
- `frontend/config/navigation.ts`
- `frontend/lib/compare-hub/data.ts`
- `frontend/lib/examples/discovery.ts`
- `frontend/lib/examples/modelLandingData.en.ts`
- `frontend/lib/examples/modelLandingData.es.ts`
- `frontend/lib/examples/modelLandingData.fr.ts`
- `frontend/lib/i18n/dictionary-data/en-content.ts`
- `frontend/lib/i18n/dictionary-data/en-home.ts`
- `frontend/lib/i18n/dictionary-data/en-layout.ts`
- `frontend/lib/i18n/dictionary-data/en-workflows-models.ts`
- `frontend/lib/models/i18n-normalization.ts`
- `frontend/messages/en.json`
- `frontend/messages/es.json`
- `frontend/messages/fr.json`
- `frontend/server/local-public-examples-data.ts`
- `frontend/server/videos.ts`
- `tests/marketing-navigation.test.ts`
- `tests/maxvideoai-editor-engine-picker.test.ts`
- `tests/mcp-directory-messaging.test.ts`
- `tests/model-archive-publication.test.ts`
- `tests/model-page-template-content.test.ts`
- `tests/seedance-prelaunch.test.ts`
- `tests/sora-discovery-postgres.test.ts`
- `tests/sora-discovery.test.ts`
- `tests/sora-sunset.test.ts`
- `tests/watch-page-commercial-copy.test.ts`
- `tests/workspace-hydration.test.ts`
- `tests/workspace-video-settings.test.ts`

- Additional follow-up owner: `tests/comparison-indexation-wave-1.test.ts`.
