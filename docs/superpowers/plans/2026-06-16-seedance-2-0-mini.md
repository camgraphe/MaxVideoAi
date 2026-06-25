# Seedance 2.0 Mini Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox states and must be completed in order unless a step explicitly says it can be parallelized.

**Goal:** Add Dreamina Seedance 2.0 Mini as a public BytePlus ModelArk video engine, with app runtime support, pricing using the same Seedance margin model, localized model/example marketing pages, comparison scorecards without comparison videos, and two generated model-page videos from the admin `camgraphe` account.

**Architecture:** Keep the existing engine-catalog pattern: raw engine data lives in `frontend/src/config/fal-engines/`, generated public catalogs live in `frontend/config/`, runtime provider routing lives in `frontend/server/video-providers/byteplus-modelark*` and `frontend/app/api/generate/_lib/`, marketing pages use the route-local model-page template registry, and compare pages are driven by config plus benchmark score data. Generalize the current BytePlus Seedance standard/fast split by engine id instead of adding one-off Mini branches.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, Node test runner through `tsx`, BytePlus ModelArk Contents Generations API `/v3/contents/generations`, generated engine catalog/model roster scripts, localized EN/FR/ES content.

---

## Starting State

- Work in `/Users/adrienmillot/Desktop/MaxVideoAi-seedance-serp-main`.
- This worktree is on `main`; do not implement in `/Users/adrienmillot/Desktop/MaxVideoAi V2` while that folder is on `codex/maxvideoai-editor`.
- The starting branch check should show `## main...origin/main`.
- The model is BytePlus-only. Do not add a Fal endpoint or route it through Fal.
- Official model id: `dreamina-seedance-2-0-mini-260615`.
- API scope: `/v3/contents/generations`.
- Inputs: text, image, video, audio. Output: video.
- Capabilities to expose: multimodality-to-video, video extension, video editing.
- Limits to expose: `480p`, `720p`, `4-15s`, `24fps`, concurrency `1`, RPM `0.06k`.
- Pricing conversion:
  - Include video input: `2.1 USD/M tokens` = `0.0021 USD/1K tokens`.
  - Exclude video input: `3.5 USD/M tokens` = `0.0035 USD/1K tokens`.
- Positioning rule: Mini is the high-frequency, batch, value option. Seedance 2.0 remains the flagship/final-quality page, and Seedance 2.0 Fast remains the faster draft route. Avoid copy that makes Mini sound like the best overall Seedance choice.

## Implementation Checklist

### 1. Confirm Worktree and Baseline

- [ ] Run:

```bash
cd /Users/adrienmillot/Desktop/MaxVideoAi-seedance-serp-main
git status --short --branch
```

- [ ] Confirm output starts with:

```txt
## main...origin/main
```

- [ ] Read the current repo instructions before editing:

```bash
sed -n '1,260p' AGENTS.md
sed -n '1,260p' docs/engineering/llm-working-guide.md
sed -n '1,240p' docs/engineering/project-structure.md
sed -n '1,260p' docs/engineering/page-architecture.md
sed -n '1,220p' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/AGENTS.md'
sed -n '1,220p' 'frontend/app/(core)/(workspace)/app/AGENTS.md'
```

- [ ] Run a focused baseline on the files that will be extended:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/fal-engine-catalog-architecture.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/seedance-2-pricing.test.ts \
  tests/pricing-definition.test.ts \
  tests/model-page-template-registry.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/examples-route-architecture.test.ts
```

### 2. Add Raw Engine Catalog Entry

- [ ] Update `frontend/src/config/fal-engines/launch-config.ts`.
  - Add `BYTEPLUS_SEEDANCE_2_MINI_MODEL_ID = 'dreamina-seedance-2-0-mini-260615'`.
  - Add Mini synthetic capability ids such as:
    - `byteplus/dreamina-seedance-2.0-mini/text-to-video`
    - `byteplus/dreamina-seedance-2.0-mini/image-to-video`
    - `byteplus/dreamina-seedance-2.0-mini/reference-to-video`
    - `byteplus/dreamina-seedance-2.0-mini/video-edit`
    - `byteplus/dreamina-seedance-2.0-mini/video-extension`
  - Add a Mini-specific surface helper instead of reusing the broad standard/fast compare fan-out. Published Mini compare pairs should stay focused:
    - `seedance-2-0-mini-vs-seedance-2-0`
    - `seedance-2-0-fast-vs-seedance-2-0-mini`
    - `ltx-2-3-fast-vs-seedance-2-0-mini`
    - `seedance-2-0-mini-vs-veo-3-1-fast`

- [ ] Extend token pricing types in `frontend/types/engines.ts` with optional input-sensitive rates:

```ts
unitPriceUsdPer1kTokensByInputType?: Partial<Record<'no_video_input' | 'video_input', number>>;
pricingSource?: 'fal' | 'byteplus';
```

- [ ] Update `frontend/src/lib/seedance-2-pricing.ts`.
  - Keep `isSeedance2TokenPricing` compatible with existing `model: 'fal_tokens'`.
  - Add optional `billingInputType?: 'no_video_input' | 'video_input'` to `computeSeedance2TokenQuote`.
  - Resolve token unit price from `unitPriceUsdPer1kTokensByInputType?.[billingInputType]` before falling back to `unitPriceUsdPer1kTokens`.

- [ ] Update `frontend/src/lib/pricing-specialized-snapshots.ts`.
  - Add `billingInputType?: 'no_video_input' | 'video_input'` to `buildSeedance2Snapshot`.
  - Keep the existing 30% margin behavior through pricing rules.
  - Add metadata:
    - `pricing_source: 'byteplus'` for Mini
    - `byteplus_billing_input_type`
    - `unit_price_usd_per_1k_tokens`

- [ ] Update `frontend/src/lib/pricing.ts`.
  - Add `hasVideoInput?: boolean` to `PricingContext`.
  - Pass `billingInputType: context.hasVideoInput ? 'video_input' : 'no_video_input'` into `buildSeedance2Snapshot`.

- [ ] Create `frontend/src/config/fal-engines/seedance-2-mini.ts`.
  - Export `SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY`.
  - Public engine id and model slug: `seedance-2-0-mini`.
  - Marketing name: `Seedance 2.0 Mini`.
  - Provider: `BytePlus ModelArk`.
  - Brand/family/version: `bytedance`, `seedance`, `2.0 Mini`.
  - Availability: public/available, with runtime still gated by `BYTEPLUS_ARK_ENABLED`.
  - Modes: `t2v`, `i2v`, `ref2v`, `v2v`, `extend`.
  - Resolutions: `480p`, `720p`.
  - Aspect ratios: `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`.
  - Duration options: integer `4` through `15`, default `4` or `5`; choose `4` for the value/batch default only if tests and UI copy make that obvious.
  - FPS: `24`.
  - Native generated audio toggle: keep disabled unless BytePlus documentation explicitly confirms generated audio output. Audio should be positioned as reference input, not as final native audio parity with Seedance 2.0.
  - Provider metadata:

```ts
providerMeta: {
  provider: 'byteplus_modelark',
  modelSlug: 'dreamina-seedance-2-0-mini-260615',
}
```

  - Pricing details:

```ts
tokenPricing: {
  model: 'fal_tokens',
  pricingSource: 'byteplus',
  unitPriceUsdPer1kTokens: 0.0035,
  unitPriceUsdPer1kTokensByInputType: {
    no_video_input: 0.0035,
    video_input: 0.0021,
  },
  framesPerSecond: 24,
  defaultAspectRatio: '16:9',
  dimensions: {
    '480p': { ... },
    '720p': { ... },
  },
  rounding: 'ceil_cent',
}
```

- [ ] Update `frontend/src/config/fal-engines/registry.ts`.
  - Import `SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY`.
  - Spread it after `SEEDANCE_2_FAST_FAL_ENGINE_REGISTRY` and before the hidden BytePlus Fast entry.

- [ ] Update `tests/fal-engine-catalog-architecture.test.ts`.
  - Add `seedance-2-mini.ts` to `moduleNames`.
  - Assert `SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY` is imported and spread.

- [ ] Add or extend a Seedance Mini catalog test.
  - Recommended file: `tests/seedance-prelaunch.test.ts`.
  - Assert:
    - engine exists as `seedance-2-0-mini`
    - no Fal URL appears in `defaultFalModelId` or mode ids
    - `providerMeta.provider === 'byteplus_modelark'`
    - model id is `dreamina-seedance-2-0-mini-260615`
    - resolutions are `480p` and `720p` only
    - duration includes `4` and `15`
    - token prices are `0.0035` no-video and `0.0021` video-input

### 3. Generalize BytePlus Runtime Routing

- [ ] Update `frontend/src/lib/env.ts`.
  - Add `BYTEPLUS_ARK_SEEDANCE_MINI_MODEL_ID`, default `dreamina-seedance-2-0-mini-260615`.
  - Add `SEEDANCE_MINI_PROVIDER`, default `byteplus_modelark`.
  - Add `SEEDANCE_MINI_BYTEPLUS_ADMIN_ONLY`, default `false`.
  - Add `SEEDANCE_MINI_BYTEPLUS_MODES`, default `t2v,i2v,ref2v,v2v,extend`.

- [ ] Update `frontend/src/server/video-providers/byteplus-modelark-constants.ts`.
  - Add `PUBLIC_SEEDANCE_MINI_ENGINE_ID = 'seedance-2-0-mini'`.
  - Add `DEFAULT_BYTEPLUS_SEEDANCE_MINI_MODEL_ID`.
  - Add `BYTEPLUS_SEEDANCE_MINI_RESOLUTIONS = ['480p', '720p']`.
  - Add `BYTEPLUS_SEEDANCE_DEFAULT_DURATION_OPTIONS = [5, 6, ..., 15]`.
  - Add `BYTEPLUS_SEEDANCE_MINI_DURATION_OPTIONS = [4, 5, ..., 15]`.
  - Keep standard/fast duration behavior unchanged unless tests show the existing 5-15 guard is already wrong.

- [ ] Update `frontend/src/server/video-providers/byteplus-modelark.ts`.
  - Replace standard/fast boolean branching with engine-id helpers:
    - `isPublicSeedanceMiniEngine(engineId)`
    - `isPublicBytePlusSeedanceEngine(engineId)`
    - `shouldRoutePublicSeedanceMiniToBytePlus(engineId)`
    - `seedanceMiniBytePlusAdminOnly()`
    - `isSeedanceMiniBytePlusModeAllowed(mode)`
    - `getBytePlusSeedanceModelId(config, engineId)`
    - `getBytePlusSeedanceAllowedDurations(engineId)`
  - Keep existing public standard and Fast function names as wrappers when tests or imports expect them.
  - Extend `getBytePlusArkConfig()` to return `seedanceMiniModelId`.
  - Extend `applyBytePlusSeedanceRuntimeOptions` to include Mini resolutions and duration options.

- [ ] Update `frontend/app/api/generate/_lib/route-context.ts`.
  - Replace `isPublicSeedanceBytePlus` as the only provider discriminator with a safer runtime contract:

```ts
bytePlusSeedance: {
  enabled: boolean;
  engineId: string;
  modelId: string;
}
```

  - If a smaller edit is required, add `bytePlusModelId` and `isPublicSeedanceMiniBytePlus`; do not continue to derive model id from `isPublicSeedanceBytePlus ? standard : fast`.
  - Admin-only checks must call the per-engine admin helper.
  - Mode checks must call the per-engine allowed-modes helper.

- [ ] Update `frontend/app/api/generate/_lib/request-options-byteplus.ts`.
  - Validate duration through `getBytePlusSeedanceAllowedDurations(engineId)`.
  - Mini should accept `4`; standard/Fast should keep current supported range.
  - Error message should include the actual allowed range for the selected model.

- [ ] Update `frontend/server/video-providers/byteplus-modelark-payload.ts`.
  - Accept `allowedDurations` or `minDurationSec/maxDurationSec`.
  - Allow Mini `4s`; keep existing rejection for invalid durations.
  - Preserve video/audio/reference payload fields for `ref2v`, `v2v`, and `extend`.

- [ ] Update `frontend/app/api/generate/_lib/byteplus-submission.ts`.
  - Replace `isPublicSeedanceBytePlus` with `bytePlusModelId` or `getBytePlusSeedanceModelId(config, engineId)`.
  - Pass `allowedDurations: getBytePlusSeedanceAllowedDurations(engineId)` into payload construction.
  - Preserve accepted/failed response shape.

- [ ] Update `frontend/app/api/generate/route.ts`.
  - Compute `hasVideoInput` after `deriveGenerationAttachmentReferences`:

```ts
const hasVideoInput =
  videoUrls.length > 0 ||
  Boolean(sourceInputVideoUrl) ||
  mode === 'v2v' ||
  mode === 'extend';
```

  - Pass `hasVideoInput` into `resolveGenerateBillingPreflight`.
  - Pass the new BytePlus model id contract into `submitBytePlusGenerateTask`.

- [ ] Update `frontend/app/api/generate/_lib/billing-preflight.ts`.
  - Accept `hasVideoInput?: boolean`.
  - Pass it into `computePricingSnapshot`.
  - Add `hasVideoInput` and `byteplusBillingInputType` to request/pricing metadata for BytePlus Seedance engines.

- [ ] Update `frontend/server/byteplus-accounting.ts`.
  - Add Mini unit prices:

```ts
const BYTEPLUS_MINI_NO_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0035;
const BYTEPLUS_MINI_VIDEO_INPUT_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0021;
```

  - Change `getBytePlusUnitPriceUsdPer1kTokens` to accept `engineId` and optional billing input type.
  - Return Mini video-input/no-video rates for `seedance-2-0-mini`; keep standard/Fast rates unchanged.

- [ ] Update `frontend/server/byteplus-poll.ts`.
  - Use `getBytePlusSeedanceModelId(config, job.engine_id)` for cost metadata.
  - Compute accounting before unit-price lookup so Mini video-input billing uses `0.0021`.
  - Keep existing completion persistence and refund behavior unchanged.

- [ ] Update runtime tests.
  - `tests/generate-byteplus-submission.test.ts`: update mocked config to include `seedanceMiniModelId`; add a Mini test that built payload uses `model-mini`.
  - `tests/byteplus-provider-architecture.test.ts`: add helper export assertions and keep provider modules below line-count limits.
  - Add or update request option tests so `seedance-2-0-mini` accepts `4s` and rejects `3s`, while `seedance-2-0-fast` still rejects `4s` if that remains the current contract.
  - Add BytePlus accounting tests for Mini no-video and video-input prices.

### 4. Update Workspace Engine Behavior

- [ ] Update `frontend/lib/seedance-workflow.ts`.
  - Add `seedance-2-0-mini` to `UNIFIED_SEEDANCE_ENGINE_IDS`.
  - Ensure `ref2v`, `v2v`, and `extend` remain routed through the same unified Seedance attachment logic.

- [ ] Inspect and update route-local workspace helpers under `frontend/app/(core)/(workspace)/app/`.
  - Do not move responsibilities out of `AppClient.tsx` without updating contract tests.
  - Keep composer mode orchestration in `_hooks/useWorkspaceEngineModeState.ts`.
  - Keep composer JSX in `_components/WorkspaceComposerSurface.tsx`.

- [ ] Update focused workspace tests if they assert fixed Seedance engine ids:
  - `tests/workspace-composer-surface-contract.test.ts`
  - `tests/workspace-engine-mode-contract.test.ts`
  - `tests/seedance-seedream-workflow-copy.test.ts`
  - `tests/engine-select-resolution-options.test.ts`
  - `tests/engine-select-architecture.test.ts`

### 5. Regenerate Catalog and Model Roster

- [ ] Run the engine catalog/model scripts after the raw engine entry compiles:

```bash
npm run engines:generate
npm run model:generate:write
```

- [ ] If script names differ, inspect `package.json` scripts and use the existing generation commands that update:
  - `frontend/config/engine-catalog.json`
  - `frontend/config/model-roster.json`
  - `docs/model-roster.csv`

- [ ] Verify generated data contains:
  - `seedance-2-0-mini`
  - `Dreamina Seedance 2.0 Mini`
  - `providerMeta.provider: byteplus_modelark`
  - model page surface enabled
  - examples surface enabled
  - compare surface enabled only for focused scoreboard pairs
  - pricing estimator enabled

- [ ] Do not hand-edit generated JSON unless the repo scripts fail and the failure is fixed or documented.

### 6. Model Family and Examples Pages

- [ ] Update `frontend/config/model-families.ts`.
  - Add `seedance-2-0-mini` to the Seedance family route aliases.
  - Add aliases such as `seedance mini`, `seedance 2 mini`, `seedance 2.0 mini`, and `dreamina seedance 2.0 mini`.
  - Add to `examplesPage.current` after `seedance-2-0-fast`.
  - Keep `seedance-2-0` as the default family model.

- [ ] Update localized Seedance examples content:
  - `frontend/lib/examples/modelLandingData.en.ts`
  - `frontend/lib/examples/modelLandingData.fr.ts`
  - `frontend/lib/examples/modelLandingData.es.ts`

- [ ] Copy direction for examples pages:
  - Say Mini is coming soon for lower-cost batch tests, ecommerce variants, UGC hooks, and reference-guided iterations.
  - Say Seedance 2.0 remains the final/polish route when higher resolution, stronger cinematic finish, or native audio matters.
  - Say Seedance 2.0 Fast remains the faster preview route.
  - Avoid claiming Mini is the best Seedance model overall.

- [ ] Update examples tests:
  - `tests/examples-route-architecture.test.ts`
  - any model-family or examples landing tests that assert current Seedance models.

### 7. Localized Model Page

- [ ] Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/seedance-2-0-mini.ts`.
  - Use the same structure as `seedance-2-0.ts` and `seedance-2-0-fast.ts`.
  - `primaryCtaHref`: compare page, not `/app`, while Mini remains waitlisted.
  - `secondaryCtaHref`: `/examples/seedance`.
  - Intent: `draft` or `specialized`; do not use language that implies flagship quality.
  - Quick links:
    - compare with Seedance 2.0
    - compare with Seedance 2.0 Fast
    - examples
    - launch specs
  - Pricing presets:
    - `4s-480p-16x9`
    - `8s-480p-9x16`
    - `8s-720p-16x9`
    - `15s-720p-16x9`

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`.
  - Import and register the Mini template.

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts`.
  - Add `SEEDANCE_20_MINI_COPY` for `en`, `fr`, and `es`.
  - Content angles:
    - cost-performance Seedance route
    - 480p/720p output
    - 4-15 second clips
    - multimodal references
    - video editing and extension
    - high-frequency ecommerce/marketing/UGC batches
    - upgrade path to Seedance 2.0 for final hero shots
  - Avoid these claims:
    - `1080p`
    - `flagship`
    - `best Seedance quality`
    - `native audio final output`
    - `replaces Seedance 2.0`

- [ ] Suggested EN metadata:
  - Title: `Seedance 2.0 Mini: Low-Cost AI Video, Pricing & Best Uses`
  - Description: `Use Seedance 2.0 Mini for lower-cost 480p/720p video tests, batch ecommerce assets, UGC variants, and reference-guided motion before moving final hero shots to Seedance 2.0.`

- [ ] Suggested FR metadata:
  - Title: `Seedance 2.0 Mini : vidéo IA moins chère, prix et usages`
  - Description: `Utilisez Seedance 2.0 Mini pour tester des vidéos 480p/720p à coût réduit, produire des variantes ecommerce et UGC en série, puis passer à Seedance 2.0 pour les plans finaux.`

- [ ] Suggested ES metadata:
  - Title: `Seedance 2.0 Mini: video IA de bajo coste, precios y usos`
  - Description: `Usa Seedance 2.0 Mini para pruebas 480p/720p de menor coste, lotes ecommerce, variantes UGC y movimiento con referencias antes de finalizar tomas clave en Seedance 2.0.`

- [ ] Update model page tests:
  - `tests/model-page-template-registry.test.ts`
  - `tests/model-page-template-content.test.ts`
  - `tests/model-page-decision-data.test.ts`
  - `tests/model-page-copy-architecture.test.ts`
  - `tests/model-page-static-architecture.test.ts`
  - `tests/model-seo-signals.test.ts`

- [ ] Test expectations:
  - Mini page builds in EN/FR/ES.
  - Copy contains `480p`, `720p`, `4-15`, and batch/value positioning.
  - Copy links to Seedance 2.0 as the final/polish path.
  - Copy does not mention `1080p` except in a comparison context that clearly belongs to Seedance 2.0.

### 8. Generate Two Model-Page Videos with Admin `camgraphe`

- [ ] Complete runtime/provider support before this step so the app can actually submit Mini jobs.

- [ ] Start the local app:

```bash
npm --prefix frontend run dev
```

- [ ] Use the admin `camgraphe` account in the browser.
  - If there is an existing local authenticated session, use it.
  - If login is required, use the project’s normal admin login flow; do not hard-code credentials.

- [ ] Generate the model-page hero video with:
  - Engine: `seedance-2-0-mini`
  - Mode: `t2v`
  - Duration: `8s`
  - Resolution: `720p`
  - Aspect ratio: `16:9`
  - Native audio: disabled unless Mini official support has been confirmed
  - Prompt:

```txt
Cinematic 16:9 tracking shot through a neon rain-soaked street market at night. A courier on a reflective e-bike weaves between umbrellas, steam plumes, passing scooters, and glowing food stalls. The camera starts low behind the spinning wheel, whip-pans beside the rider, then cranes upward as sparks, rain streaks, and foreground signage sweep across the lens. Strong parallax, volumetric light, realistic motion blur, dynamic reflections, no logos, no readable text, no watermark.
```

- [ ] Generate the model-page demo video with:
  - Engine: `seedance-2-0-mini`
  - Mode: `t2v`
  - Duration: `8s`
  - Resolution: `720p`
  - Aspect ratio: `16:9`
  - Native audio: disabled unless Mini official support has been confirmed
  - Prompt:

```txt
Cinematic 16:9 lifestyle product motion shot in a misty forest at sunrise. A trail runner sprints across wet rocks and leaps through shallow water while the camera races beside a generic unbranded running shoe, shifts into a low macro splash close-up, then orbits wide as droplets, leaves, and sunlight beams streak through the frame. Energetic camera movement, visible acceleration, layered foreground motion, realistic fabric and water physics, no logos, no readable text, no watermark.
```

- [ ] Wait for both jobs to complete and capture the exact returned `job_*` ids.

- [ ] Update `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`.
  - Add:

```ts
'seedance-2-0-mini': {
  hero: '<exact hero job id from the completed camgraphe generation>',
  demo: '<exact demo job id from the completed camgraphe generation>',
},
```

- [ ] Replace the angle-bracket text with the literal returned job ids before committing. Do not leave placeholder text in source.

- [ ] Smoke-check `/models/seedance-2-0-mini` and ensure both videos render, are not blank, and do not overlap page text.

### 9. Compare Scoreboards Without Compare Videos

- [ ] Update `data/benchmarks/engine-scores.v1.json`.
  - Add `seedance-2-0-mini` with scores below Seedance 2.0 on quality and controllability, below or close to Fast on stability, and higher on pricing/value.
  - Recommended initial score row:

```json
{
  "modelSlug": "seedance-2-0-mini",
  "fidelity": 7.6,
  "visualQuality": 7.4,
  "motion": 7.6,
  "consistency": 7.0,
  "anatomy": 7.3,
  "textRendering": 6.4,
  "lipsyncQuality": 6.8,
  "sequencingQuality": 7.1,
  "controllability": 7.7,
  "speedStability": 7.8,
  "pricing": 9.4,
  "last_updated": "2026-06-16"
}
```

- [ ] Update `data/benchmarks/engine-key-specs.v1.json`.
  - Add Mini specs:
    - max resolution `720p`
    - duration `4-15s`
    - FPS `24`
    - text/image/video/audio inputs
    - video output
    - video editing and extension support
    - concurrency `1`
    - RPM `0.06k`
    - model id `dreamina-seedance-2-0-mini-260615`
  - Use the official BytePlus URL if a public docs URL exists during implementation; otherwise cite the MaxVideoAI model page and record the BytePlus console model name in the source label/copy.

- [ ] Update compare configs:
  - `frontend/config/compare-config.json`
  - `frontend/config/compare-hub.json`

- [ ] Compare positioning:
  - Add Mini as a focused opponent for Seedance standard/Fast and budget/fast alternatives.
  - Do not add Mini to top quality/cinematic “best” lists where it would cannibalize Seedance 2.0.
  - Add it to `fast-drafts` or value-oriented compare buckets where copy can explain the lower-cost tradeoff.

- [ ] Add a scorecard-only mechanism.
  - Preferred: add a config list such as `scoreboardOnlyComparisons` to compare config, then read it in compare-page helpers.
  - Scoreboard-only pairs:
    - `seedance-2-0-mini-vs-seedance-2-0`
    - `seedance-2-0-fast-vs-seedance-2-0-mini`
    - `ltx-2-3-fast-vs-seedance-2-0-mini`
    - `seedance-2-0-mini-vs-veo-3-1-fast`
  - For these pairs, `buildCompareShowdownSlots` should return no video slots while scorecards, specs, and copy still render.

- [ ] Update localized compare overrides:
  - `frontend/app/(localized)/[locale]/(marketing)/compare/_lib/compare-page-overrides-en.ts`
  - `frontend/app/(localized)/[locale]/(marketing)/compare/_lib/compare-page-overrides-fr.ts`
  - `frontend/app/(localized)/[locale]/(marketing)/compare/_lib/compare-page-overrides-es.ts`

- [ ] Copy direction for Mini compare pages:
  - Mini vs Seedance 2.0: Mini for batch/value 480p/720p; Seedance 2.0 for polished hero outputs, higher ceiling, and final assets.
  - Mini vs Seedance 2.0 Fast: Mini for lower cost per batch and multimodal/edit tests; Fast for stronger draft quality and speed when budget allows.
  - Mini vs LTX 2.3 Fast: Mini for Seedance-style reference workflows and value batches; LTX for fast ideation where its strengths score higher.
  - Mini vs Veo 3.1 Fast: Mini for low-cost batches; Veo Fast for Google/Veo look and broader premium workflow comparisons.

- [ ] Update compare tests:
  - `tests/compare-page-architecture.test.ts`
  - benchmark/spec tests if present
  - sitemap/SEO tests that enumerate published compare slugs

- [ ] Assertions:
  - Mini compare pages have scorecards/spec tables.
  - Mini compare pages do not render comparison video slots.
  - Compare metadata uses “value”, “batch”, “480p/720p”, or “low-cost” language.
  - Mini is not ranked above Seedance 2.0 in quality-led compare pages.

### 10. Update Seedance 2.0 and Seedance 2.0 Fast Pages

- [ ] Update existing Seedance 2.0 copy in `model-page-template-copy.ts`.
  - Add a small “When to use Mini” path that points to Mini for budget/high-volume drafts.
  - Keep Seedance 2.0 positioned as final/polished/hero output.

- [ ] Update Seedance 2.0 Fast copy.
  - Mention Mini as lower-cost batch exploration.
  - Keep Fast positioned as a stronger/faster draft route, not obsolete.

- [ ] Update template quick links for Seedance 2.0 and Fast if their templates have curated related links.
  - Add Mini only as a cost/batch alternative.

- [ ] Tests should assert anti-cannibalization copy:
  - Seedance 2.0 page still contains final/polish language.
  - Fast page still contains speed/draft language.
  - Mini page contains lower-cost/batch language.

### 11. Sitemap, SEO, and Internal Links

- [ ] Update generated or static sitemap inputs if tests require explicit entries:
  - `frontend/config/sitemap-timestamps.ts`
  - `tests/video-pages-sitemap.test.ts`
  - `tests/video-sitemap-lastmod.test.ts`

- [ ] Verify localized route behavior:
  - `/models/seedance-2-0-mini`
  - `/fr/models/seedance-2-0-mini`
  - `/es/models/seedance-2-0-mini`
  - `/compare/seedance-2-0-mini-vs-seedance-2-0`
  - `/compare/seedance-2-0-fast-vs-seedance-2-0-mini`

- [ ] Confirm canonical/hreflang JSON-LD are generated by existing route helpers, not hard-coded in the page.

- [ ] Update internal link tests:
  - `tests/seo-internal-links.test.ts`
  - `tests/pricing-model-links.test.ts`
  - model gallery/catalog tests if they enumerate engines.

### 12. Verification Commands

- [ ] Run focused provider/catalog/pricing tests:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/fal-engine-catalog-architecture.test.ts \
  tests/byteplus-provider-architecture.test.ts \
  tests/generate-byteplus-submission.test.ts \
  tests/seedance-prelaunch.test.ts \
  tests/seedance-2-pricing.test.ts \
  tests/pricing-definition.test.ts \
  tests/public-engines.test.ts \
  tests/engine-select-resolution-options.test.ts
```

- [ ] Run focused marketing/SEO/compare tests:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-template-registry.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/model-page-copy-architecture.test.ts \
  tests/model-page-static-architecture.test.ts \
  tests/model-seo-signals.test.ts \
  tests/models-catalog-architecture.test.ts \
  tests/models-gallery-architecture.test.ts \
  tests/examples-route-architecture.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/seo-internal-links.test.ts \
  tests/pricing-model-links.test.ts \
  tests/video-pages-sitemap.test.ts \
  tests/video-sitemap-lastmod.test.ts
```

- [ ] Run workspace contract tests touched by Mini engine exposure:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/workspace-composer-surface-contract.test.ts \
  tests/workspace-engine-mode-contract.test.ts \
  tests/seedance-seedream-workflow-copy.test.ts
```

- [ ] Run broader required checks:

```bash
npm --prefix frontend run lint
npm run lint:exposure
npm run model:check
npm run models:audit
git diff --check
```

### 13. Local Smoke Test

- [ ] Start the app:

```bash
npm --prefix frontend run dev
```

- [ ] Smoke-test:
  - `/models/seedance-2-0-mini`
  - `/fr/models/seedance-2-0-mini`
  - `/es/models/seedance-2-0-mini`
  - `/examples/seedance`
  - `/compare/seedance-2-0-mini-vs-seedance-2-0`
  - `/compare/seedance-2-0-fast-vs-seedance-2-0-mini`
  - `/pricing`

- [ ] Browser checks:
  - model page presents Mini as coming soon and does not link to the app CTA
  - pricing displays only prelaunch estimates while the pricing estimator excludes Mini
  - compare pages show scoreboards/specs but no video showdown slots
  - app engine selector does not expose Mini until BytePlus API access is open

### 14. Optional Live Provider Smoke Test

- [ ] Only run this if `BYTEPLUS_ARK_API_KEY` and BytePlus model activation are available in the selected region.

- [ ] Submit one small `4s`, `480p`, `16:9`, `t2v` job as admin.

- [ ] Confirm:
  - provider is `byteplus_modelark`
  - provider model id is `dreamina-seedance-2-0-mini-260615`
  - task completes
  - stored pricing metadata has Mini token price
  - poll cost metadata uses Mini model id

## Done Criteria

- [ ] `seedance-2-0-mini` is public in engine catalog, model roster, examples, model pages, and focused compare pages, but hidden from the app selector and pricing estimator while waitlisted.
- [ ] Generation uses BytePlus ModelArk only and never Fal for Mini.
- [ ] Customer pricing uses Seedance token math with existing margin rules and Mini-specific token rates.
- [ ] BytePlus polling/accounting uses Mini model id and Mini no-video/video-input unit prices.
- [ ] Marketing copy clearly avoids cannibalizing Seedance 2.0 and Seedance 2.0 Fast.
- [ ] Compare pages for Mini are scoreboard/spec only until real compare videos exist.
- [ ] Two `camgraphe` generated Mini videos are wired into the model page.
- [ ] Focused tests, lint, exposure lint, model checks, and `git diff --check` pass.
