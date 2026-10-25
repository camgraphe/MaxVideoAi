# Task 7 — Marketing and factual alignment

Status: **DONE_WITH_CONCERNS**. Scoped implementation and local checks complete. Hosted public-route/Offer/cache/auth smoke, final branch review, required CI and Git/Vercel release remain controller-owned. No scoped failing check is left. Base: `d86dc39ef6b19a3e97cec8e71560322d4ca4d653`; branch: `codex/video-provider-mode-parity`; worktree: `/Users/adrienmillot/.codex/worktrees/modify-workflow-release/MaxVideoAi V2`.

## Implemented scope

- Updated **33 model documents**, exactly eleven model slugs × EN/FR/ES: Kling 2.5 Turbo, Kling 2.6 Pro, Omni Standard/Pro/4K, Luma Ray 3.2, H3 Max, FLUX 3, FLUX 3 Draft, LTX 2.3 Pro and Veo Standard. Exact authored model/version names, original prompt/demo copy strings, original media URLs and links stay intact.
- Kling: corrected the three stale “No source video” headings; distinguished Reference's requested output from Edit's source timing/framing; retained Standard/Pro Reference's 3–10s source versus 4K Reference's 3–15s, and Edit's 3–15s / 720–3840 pixel sides / combined-four guidance limit. Standard Edit 720p and Pro Edit 1080p are explicit. No Kling Extend or direct 4K inheritance. Older 2.5/2.6 first/end-frame instructions and factual benchmark rows now agree, without claiming a video source input.
- Luma: Extend means five new seconds forward/backward from an eligible owned completed direct Ray 3.2 generation, with no arbitrary upload/public-copy substitution, extra keyframes or automatic assembly promise. Modify's source limit18s and Reframe's source limit10s / separately selected5s or10s output are distinct. Automatic/manual edit controls and creation versus Modify keyframes are distinct. Removed all-routes-Fal-price claims, including the decision pricing footnote; no new authored numeric prices.
- H3 Max: creation remains integer5–15s and up to1080P. Recast/Relight are specialized source tools with exact portraits, source timing, frame/preparation and resolution rules. Relight2K never becomes a generic creation capability. **New H3 Max Extend/Insert/Reframe remain pending and non-activatable** in all localized copy. No source-operation inference for base H3/Hailuo.
- FLUX: exact1–10 indexed keyframes and their5–20 whole-second request domain; FAST Edit is a separate720p operation with MP4/<15s/<50MB source constraints and inherited timing/framing/audio. Native Draft720p and native Draft Extend remain visible. Separate1080p Enhance requires the owner's eligible native Draft and qualified paired cache, with positive measured duration through21s as application admission, separate earlier Draft charge, rechecked availability and no permanent cache guarantee. Imports/public MP4s/Draft Extend caches confer no Enhance eligibility. Max does not inherit FAST/Enhance/Extend.
- LTX: standard2.3 Reframe keeps exact source timing through60s,720p/1080p and no prompt, without transfer to2.3Fast/2.5. Removed stale “current LTX model” language where it conflicted with retained legacy identity and2.5 successor.
- Veo Standard: exact I2V4/6/8s at its qualified resolutions/audio settings; Reference remains8s with1–3 stills. Corrected controller-assigned stale CI expectation in `comparison-factual-consistency.test.ts`, retaining maximum8s, extension7s, Reference8s and the non-creation exclusions.
- Updated **nine comparison documents** in all three locales, **five family factual sections × three locales**, public reuse help and **three getting-started documents**. Family examples keep their real model/version and original proof; a public media copy never transfers private generation/cache eligibility. The new source operations are not claimed as demonstrated by old media.
- Corrected Task6A review Minor1: the engineering picker paragraph now distinguishes Luma's provider-attempt prefilter from FLUX's owned completed Fal output selection followed by the strict attempt/server-proof/canonical-queue provenance union. The authorized existing six-line d86 Studio receipt is included without alteration.

## Bounded factual projection changes and exact consumers

`frontend/lib/marketing/video-operation-specs.ts` projects available `v2v` operation labels from the executable engine's `operationCaps`, overriding stale generic benchmark text. Its only consumers are the model and comparison `buildSpecValues` owners. Exact localized qualifiers name Recast/Relight, FAST Edit, paired-cache Enhance, and Reference/Edit. Existing generic source editing remains unchanged when there is no operation metadata; publication, provider gates, execution, price scenarios and tariffs are untouched.

`model-page-hero-specs.ts#normalizeMaxResolution` retains semicolon-qualified values so detail specs cannot reduce “native Draft720p; paired Enhance1080p” to bare720p. `models/_lib/models-catalog-cards.ts` separately uses native engine resolution for the explicit paired-Enhance capability, keeping Draft discovery720p. It does **not** cut every fact string at its first semicolon: the valid “T2V:480p/720p; I2V:480p/720p/1080p” maximum remains1080p. Existing catalog duration parsing excludes source/intake clauses; H3 creation stays15s and LTX Reframe60s does not become new-clip duration.

Inspected comparison hub, catalog decision data, best-for guidance, example reuse/snapshot ownership and MCP/Studio detail ownership. Generic hub “V2V” remains a source-to-video classification, with no newly authored free-edit claim or ranking. MCP/Studio already consume the reviewed operation metadata; no instructions/tool budgets or functional projection changes were needed. No new global nomenclature, route, source media, score, benchmark ranking or commercial offer was introduced.

## Verification evidence

### RED / GREEN

1. `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-operation-marketing-truth.test.ts`: initial **1 pass /6 failures** (`/tmp/task7-red.log`). Reproduced H3 generic reference-only label, FLUX continuation-only labels, false4K exclusion, false older-Kling frame exclusions and missing localized operation/prerequisite copy. Initial green **7/7** (`/tmp/task7-green.log`). Final expanded coverage is **11/11**, included in the final combined runs below.
2. Real model-page spec projection regression: **7 pass /1 failure** before repair (`/tmp/task7-projection-red2.log`), demonstrating an actual rendered Draft resolution of `720p` instead of the native/Enhance qualification. Green in final truth suites.
3. `tests/models-catalog-streaming.test.ts`: RED reproduced generic Draft1080p in every applicable EN/FR/ES all/video scope (`/tmp/task7-catalog-red.log`). After native-resolution correction, real catalog SSR/streaming, metadata and price fixture contracts pass. Added positive H3 creation15s and separate valid I2V1080p clause assertions.
4. `tests/comparison-factual-consistency.test.ts`: RED reproduced stale expected `[8]` versus actual `[4,6,8]` for Veo Standard I2V (`/tmp/task7-veo-red.log`). GREEN **22/22** combined with the eleven operation-marketing tests (`/tmp/task7-final-projections.log`); Reference remains exactly `[8]`.

### Final focused suite

**264 tests passed,0 failed/skipped** (`/tmp/task7-final-content-seo.log`). Command:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/video-operation-marketing-truth.test.ts tests/comparison-factual-consistency.test.ts tests/docs-product-truth.test.ts tests/model-page-template-content.test.ts tests/model-page-copy-helpers.test.ts tests/models-catalog-streaming.test.ts tests/models-catalog-architecture.test.ts tests/luma-agents-marketing-surfaces.test.ts tests/p0-model-page-seo-content.test.ts tests/compare-page-architecture.test.ts tests/compare-pricing-scenarios.test.ts tests/compare-page-pricing-display.test.ts tests/comparison-seo-preservation.test.ts tests/model-registry-redirects.test.ts tests/hreflang-variants.test.ts tests/examples-pagination-seo.test.ts tests/examples-lcp-performance.test.ts tests/model-page-copy-architecture.test.ts tests/model-prompting-architecture.test.ts tests/model-examples-architecture.test.ts tests/model-examples-content-contract.test.ts tests/model-page-specs-architecture.test.ts tests/model-page-publication.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/comparison-content-contract.test.ts tests/luma-mini-seo-comparisons.test.ts tests/minimax-h3-seo-discovery.test.ts tests/examples-family-journeys.test.ts tests/examples-version-continuity.test.ts tests/examples-family-metadata.test.ts tests/examples-commercial-copy.test.ts tests/kling-o3-model-pages.test.ts tests/flux-3-family-continuity.test.ts tests/h3-max-public-capability-truth.test.ts tests/google-veo-marketing-surfaces.test.ts
```

The final self-review refined six localized Omni decision-card bodies to retain the specific Standard/Pro and Omni/Kling3 comparison intent instead of repeating generic source guidance. A final targeted rerun of Kling pages and strict decision/prompting contracts after that text refinement passed **23/23** (`/tmp/task7-final-editorial-review.log`).

- `pnpm model:registry:check`: exit0; runtime/catalog current,56 catalog entries,55 roster entries, no generated drift (`/tmp/task7-registry.log`). No generated projection was hand-edited or regeneration needed.
- `frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json`: exit0, empty output (`/tmp/task7-typecheck-final.log`).
- `npm --prefix frontend run lint`: exit0,**0 errors /6 inherited warnings** (`/tmp/task7-lint-final.log`). Hook warnings remain at image `useImageWorkspaceDisplayState.ts:39` and billing `BillingClient.tsx:64`; four existing image-element warnings remain in ConversationMedia, ConversationReferenceCard, ConversationReferenceLightbox and ConversationTimeline. No suppression or unrelated fix.
- `npm run lint:exposure`: exit0,public exposure check passed (`/tmp/task7-exposure.log`).
- `git diff --check`: passed throughout and again before staging.
- Structural before/after comparison of **42 changed JSON documents** preserved every original `href`, `modelSlug`, media URL field, recorded `prompt` and Prompt Lab `copy` value (`/tmp/task7-copy-preservation.json`). Original URL identity/canonical/hreflang/schema builder, pricing/scenario owners, gallery order, playback and rendition files are unchanged. Existing source/settings/proof stays intact; removed stale “four workflows” capability badges did not relabel a video's model/version.

### Mobile/desktop and service boundary

`node /tmp/task7-render-smoke.cjs` passed **66 cases**: eleven exact models × EN/FR/ES ×390px/1440px. The fixture renders actual `ModelSpecsSection` and `ModelDecisionPromptingSection`, the real spec projection/localized labels, real Tailwind theme and route CSS, current authored reference workflows/global guidance; each disclosure was opened, all workflows counted, and horizontal overflow/text-container clipping rejected. The navigation import is a fixture anchor adapter; tabs/demo media are omitted, all network requests blocked, and no production auth, price, hydration or media qualification is claimed. Final output is clean (`/tmp/task7-render-smoke.log`); machine receipts `/tmp/task7-smoke/results.json`. Manually inspected French mobile H3 Max and Draft screenshots in that directory: full Recast/Relight/pending and paired-cache guidance remains readable. Initial fixture setup failures were isolated adapter/path issues and resolved without application/config changes.

A real candidate `next dev` server started on127.0.0.1:3277; `/models/flux-3-draft` returned500 because `DATABASE_URL` is mandatory (`/tmp/task7-dev.log`). The environment had no DB/provider/Supabase secrets and no `.env.local`. Stopped the server; did not connect production, copy ambiguous preview envs, weaken auth or alter config. Root explicitly accepted focused render contracts here and retains **36 hosted model/locale routes, family/comparison/mobile/desktop and commercial Offer verification** after publication. Existing production SEO baselines were not recaptured. Root's d86 actual phone Relight/cache recovery results are controller evidence, not Task7 hosted-marketing certification.

## Self-review and constraints

Reviewed the brief/map, final independent38-entry matrix, approved89-addition tariff guide, relevant nearest/root ownership and implementer procedure. Self-review caught and corrected lingering localized four-workflow copy, the Luma pricing footnote, nested Kling2.5 FAQ, generic H3 creation2K wording, stale LTX-current wording, native/Enhance resolution normalization and catalog discovery, and overly generic Omni decision-card text. Kept exact tiers/provider variants, source-derived versus requested quantities, integer H3 creation, and pending H3 operations distinct.

**Remaining qualifications, not scoped code failures:** new89 tariffs are reviewed/prepared but not externally applied by this task; no marketing text constitutes live activation/invoice evidence. Root owns exact final CI, hosted readiness, independent review and release. Controller reported two other d86 Fast failures (FLUX recovery ordering and empty-modelId public quote coverage) plus a schema80 test fixture for6A; these were not edited or masked here. No full financial/browser suite or build was rerun for this copy pass. No push/PR/deploy, paid generation, media publication, provider write, wallet action, tariff/policy mutation, live DB/storage/env write or subagent occurred. `.serena/` and `PASSATION-VIDEO-MODES-2026-10-24.md` remain untracked and untouched.

## Exact changed files

- `.superpowers/sdd/2026-10-24-video-provider-mode-parity/task-6a-report.md`
- `.superpowers/sdd/2026-10-24-video-provider-mode-parity/task-7-report.md`
- `content/comparisons/dreamina-seedance-2-0-mini-vs-luma-ray-3-2.json`
- `content/comparisons/flux-3-vs-flux-3-draft.json`
- `content/comparisons/flux-3-vs-flux-3-max.json`
- `content/comparisons/flux-3-vs-grok-imagine-video-1-5.json`
- `content/comparisons/happy-horse-1-1-vs-kling-o3-pro.json`
- `content/comparisons/kling-3-standard-vs-kling-o3-standard.json`
- `content/comparisons/luma-ray-3-2-vs-veo-3-1-fast.json`
- `content/comparisons/minimax-h3-max-vs-seedance-2-5.json`
- `content/comparisons/minimax-h3-vs-minimax-h3-max.json`
- `content/docs/get-started.mdx`
- `content/es/docs/get-started.mdx`
- `content/fr/docs/get-started.mdx`
- `content/models/en/flux-3-draft.json`
- `content/models/en/flux-3.json`
- `content/models/en/kling-2-5-turbo.json`
- `content/models/en/kling-2-6-pro.json`
- `content/models/en/kling-o3-4k.json`
- `content/models/en/kling-o3-pro.json`
- `content/models/en/kling-o3-standard.json`
- `content/models/en/ltx-2-3-pro.json`
- `content/models/en/luma-ray-3-2.json`
- `content/models/en/minimax-h3-max.json`
- `content/models/en/veo-3-1.json`
- `content/models/es/flux-3-draft.json`
- `content/models/es/flux-3.json`
- `content/models/es/kling-2-5-turbo.json`
- `content/models/es/kling-2-6-pro.json`
- `content/models/es/kling-o3-4k.json`
- `content/models/es/kling-o3-pro.json`
- `content/models/es/kling-o3-standard.json`
- `content/models/es/ltx-2-3-pro.json`
- `content/models/es/luma-ray-3-2.json`
- `content/models/es/minimax-h3-max.json`
- `content/models/es/veo-3-1.json`
- `content/models/fr/flux-3-draft.json`
- `content/models/fr/flux-3.json`
- `content/models/fr/kling-2-5-turbo.json`
- `content/models/fr/kling-2-6-pro.json`
- `content/models/fr/kling-o3-4k.json`
- `content/models/fr/kling-o3-pro.json`
- `content/models/fr/kling-o3-standard.json`
- `content/models/fr/ltx-2-3-pro.json`
- `content/models/fr/luma-ray-3-2.json`
- `content/models/fr/minimax-h3-max.json`
- `content/models/fr/veo-3-1.json`
- `data/benchmarks/engine-key-specs.v1.json`
- `docs/engineering/flux-ltx-source-operations.md`
- `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts`
- `frontend/app/(localized)/[locale]/(marketing)/examples/_lib/example-reuse-copy.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-hero-specs.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values.ts`
- `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`
- `frontend/lib/examples/modelLandingData.en.ts`
- `frontend/lib/examples/modelLandingData.es.ts`
- `frontend/lib/examples/modelLandingData.fr.ts`
- `frontend/lib/marketing/spec-capability-copy.ts`
- `frontend/lib/marketing/video-operation-specs.ts`
- `tests/comparison-factual-consistency.test.ts`
- `tests/docs-product-truth.test.ts`
- `tests/luma-agents-marketing-surfaces.test.ts`
- `tests/models-catalog-streaming.test.ts`
- `tests/video-operation-marketing-truth.test.ts`
