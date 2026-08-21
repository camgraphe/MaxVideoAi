# MiniMax H3 Production Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch `minimax-h3` as MaxVideoAI's complete public Hailuo flagship with one unified three-mode engine, exact Fal request and pricing behavior, two original-character marketing renders, full localized discovery, complete scoreboards, three indexed VS pages, and one finished production deployment.

**Architecture:** Add one schema-driven Fal engine and isolate H3-specific endpoint, request-body, validation, workflow, and pricing behavior in small helpers instead of adding Seedance branches or rewriting the generic video stack. Keep model identity and publication in `frontend/config/model-registry.json`, editorial model and comparison copy in localized content documents, benchmark data in the existing versioned JSON authorities, and generated projections generated only by repository commands. Run the two authorized paid renders through the same local MaxVideoAI API, billing, persistence, polling, and durable-media path that production users use; publish only accepted assets before the single production deploy.

**Tech Stack:** Next.js App Router, React, TypeScript, Node test runner, Zod-style content parsers, Fal asynchronous video APIs, canonical `@maxvideoai/pricing`, Neon/PostgreSQL job and playlist persistence, localized JSON content, JSON-LD, sitemap and hreflang helpers, Vercel production deployment.

## Global Constraints

- Canonical product ID and public slug are exactly `minimax-h3`; the family is `hailuo`.
- One public engine exposes `t2v`, `i2v`, and `ref2v`; do not create mode-specific public model identities.
- H3 becomes the Hailuo `current` and default model; `minimax-hailuo-02-text` remains published, indexable, selectable, priced, and linked as the secondary budget model.
- The Fal contract is 5–15 integer seconds, 24 FPS, `768P`/`2K`/`4K`, fixed ratios `21:9`/`16:9`/`4:3`/`1:1`/`3:4`/`9:16`, and provider value `adaptive` when MaxVideoAI `auto` is selected in H3 text or reference mode.
- H3 native stereo audio is always present. Do not expose an audio toggle and never send `generate_audio` or an `audio` boolean.
- H3 reference mode supports at most 9 images, 3 videos, 3 audios, and 12 unique references in total. Audio-only reference requests are invalid; video-only reference requests are valid.
- H3 image mode requires one start image, permits one optional end image, and omits `aspect_ratio` from the provider body.
- Provider rates are USD 0.08/s for `768P`, USD 0.13/s for `2K`, and USD 0.16/s for `4K`; the first five reference images are included and each image above five costs USD 0.08.
- No database migration, new admin UI, hidden engine, feature flag, waitlist, prelaunch page, noindex phase, or production canary deployment.
- The only two paid pre-production H3 requests are the approved original-character marketing videos. No product packshot, brand, public figure, copyrighted character, recognizable music, or unapproved retry.
- Public H3 and Seedance 2.5 scoreboards contain all eleven numeric criteria with no provisional label, sample warning, disclaimer, or empty cell.
- The canonical overall ordering is Seedance 2.5 `9.1` > Kling O3 Pro `8.6` > MiniMax H3 `8.5`.
- The primary comparison routes are `minimax-h3-vs-seedance-2-5`, `kling-o3-pro-vs-minimax-h3`, and `minimax-h3-vs-veo-3-1`, fully localized and indexable in EN/FR/ES.
- Public prices come from canonical pricing functions; do not author customer-facing dollar totals in localized content.
- Do not edit `frontend/config/model-runtime.json`, `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, or `docs/model-roster.csv` by hand.
- Preserve unrelated user work and keep route `page.tsx` files as orchestrators.

---

### Task 1: Lock the current Fal contract and add the raw H3 engine

**Files:**
- Create: `docs/model-launch/minimax-h3.md`
- Create: `frontend/src/config/fal-engines/minimax-h3.ts`
- Modify: `frontend/src/config/engineCatalog.overrides.ts`
- Create: `tests/minimax-h3-engine-catalog.test.ts`
- Modify: `tests/fal-engine-catalog-architecture.test.ts`

**Interfaces:**
- Consumes: `RawFalEngineEntry`, `EngineCaps`, and the official H3 Fal endpoint schemas.
- Produces: `MINIMAX_H3_FAL_ENGINE_REGISTRY`, one raw `minimax-h3` engine contract with three mode configs, exact input fields, exact provider rates, and no audio toggle. It is intentionally not added to the executable registry until Task 5 can add the canonical model identity in the same atomic publication change.

- [ ] **Step 1: Re-check and record the official source contract**

Open the current official pages and record the check date, endpoint IDs, input field names, duration/resolution/ratio options, media limits, native-audio behavior, and prices in `docs/model-launch/minimax-h3.md`:

```text
https://fal.ai/minimax-h3
https://fal.ai/models/minimax/h3/text-to-video/api
https://fal.ai/models/minimax/h3/image-to-video/api
https://fal.ai/models/minimax/h3/reference-to-video/api
https://minimaxi.com/blog/minimax-h3
```

If the live contract differs from the approved spec, update the spec, this plan, and the assertions below to the official value before implementation.

- [ ] **Step 2: Write the failing engine-catalog test**

Create `tests/minimax-h3-engine-catalog.test.ts` with assertions equivalent to:

```ts
const entry = MINIMAX_H3_FAL_ENGINE_REGISTRY.find(({ id }) => id === 'minimax-h3');
assert.ok(entry);
assert.equal(entry.engine.provider, 'MiniMax');
assert.deepEqual(entry.engine.modes, ['t2v', 'i2v', 'ref2v']);
assert.deepEqual(entry.engine.resolutions, ['768P', '2K', '4K']);
assert.deepEqual(entry.engine.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto']);
assert.deepEqual(entry.engine.fps, [24]);
assert.equal(entry.engine.maxDurationSec, 15);
assert.equal(entry.engine.audio, true);
assert.equal(entry.modes.find(({ mode }) => mode === 't2v')?.falModelId, 'minimax/h3/text-to-video');
assert.equal(entry.modes.find(({ mode }) => mode === 'i2v')?.falModelId, 'minimax/h3/image-to-video');
assert.equal(entry.modes.find(({ mode }) => mode === 'ref2v')?.falModelId, 'minimax/h3/reference-to-video');
assert.equal(entry.modes.every(({ ui }) => ui.audioToggle === false), true);
assert.equal(entry.engine.inputLimits.promptMaxChars, 7000);
assert.equal(entry.engine.inputSchema?.referenceBudget?.maxTotal, 12);
assert.deepEqual(entry.engine.inputSchema?.referenceBudget?.fieldIds, [
  'reference_image_urls',
  'reference_video_urls',
  'reference_audio_urls',
]);
```

Also assert the per-field counts and media bounds: images `9`/`30 MB`, videos `3`/`50 MB`/`2–15s`, audios `3`/`15 MB`/`2–15s`, and duration values `5` through `15` inclusive.

- [ ] **Step 3: Run the red test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-engine-catalog.test.ts
```

Expected: FAIL because `minimax-h3` is not registered.

- [ ] **Step 4: Implement the raw engine**

Create `frontend/src/config/fal-engines/minimax-h3.ts` with these exported constants and one registry entry:

```ts
export const MINIMAX_H3_ID = 'minimax-h3' as const;
export const MINIMAX_H3_ENDPOINTS = {
  t2v: 'minimax/h3/text-to-video',
  i2v: 'minimax/h3/image-to-video',
  ref2v: 'minimax/h3/reference-to-video',
} as const;
export const MINIMAX_H3_DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const MINIMAX_H3_RESOLUTIONS = ['768P', '2K', '4K'] as const;
export const MINIMAX_H3_FIXED_ASPECT_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
```

Use field IDs `image_url`, `end_image_url`, `reference_image_urls`, `reference_video_urls`, and `reference_audio_urls`. Put `auto` in the `t2v` and `ref2v` UI modes; omit an aspect-ratio control from `i2v`. Set `pricingDetails.perSecondCents` to `8`, `13`, and `16` and set `pricing.base` to `0.13` only as the default 2K presentation rate.

Add `minimax-h3.ts` to the provider-module architecture contract. Do not yet import the raw entry into the executable registry: `falEngines.ts` requires a matching canonical runtime model and deliberately throws when that identity is missing. Add a `minimax-h3` override with `bestFor: 'Native-audio multimodal character video'`.

- [ ] **Step 5: Run the green test and architecture gate**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-engine-catalog.test.ts tests/fal-engine-catalog-architecture.test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 6: Commit the engine boundary**

```bash
git add docs/model-launch/minimax-h3.md frontend/src/config/fal-engines/minimax-h3.ts frontend/src/config/engineCatalog.overrides.ts tests/minimax-h3-engine-catalog.test.ts tests/fal-engine-catalog-architecture.test.ts
git commit -m "feat: add MiniMax H3 engine contract"
```

---

### Task 2: Add exact H3 provider projection and pre-billing validation

**Files:**
- Create: `frontend/src/lib/minimax-h3.ts`
- Modify: `frontend/src/lib/fal-request-body.ts`
- Modify: `frontend/app/api/generate/_lib/validation-payload.ts`
- Modify: `frontend/app/api/generate/_lib/validate-provider-constraints.ts`
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Create: `tests/minimax-h3-request-body.test.ts`
- Create: `tests/minimax-h3-validation.test.ts`

**Interfaces:**
- Consumes: `GeneratePayload`, normalized attachments with slot provenance, and the H3 constants from Task 1.
- Produces: `isMinimaxH3EngineId(id)`, `resolveMinimaxH3Endpoint(mode)`, and `buildMinimaxH3FalRequest(payload)`; all invalid H3 requests fail before billing.

- [ ] **Step 1: Write complete failing provider-body tests**

Test exact deep equality for the three requests:

```ts
assert.deepEqual(buildFalGenerationRequest(textPayload, 'minimax/h3/text-to-video'), {
  model: 'minimax/h3/text-to-video',
  requestBody: {
    prompt: 'Original adult character crosses a storm-lit pier.',
    duration: 15,
    resolution: '2K',
    aspect_ratio: '16:9',
  },
});

assert.deepEqual(buildFalGenerationRequest(imagePayload, 'minimax/h3/image-to-video'), {
  model: 'minimax/h3/image-to-video',
  requestBody: {
    prompt: 'The woman turns toward the lighthouse beam.',
    duration: 10,
    resolution: '4K',
    image_url: 'https://media.maxvideoai.com/start.jpg',
    end_image_url: 'https://media.maxvideoai.com/end.jpg',
  },
});

assert.deepEqual(buildFalGenerationRequest(referencePayload, 'minimax/h3/reference-to-video'), {
  model: 'minimax/h3/reference-to-video',
  requestBody: {
    prompt: 'Two original cartographers exchange a map on a station platform.',
    duration: 15,
    resolution: '4K',
    aspect_ratio: 'adaptive',
    reference_image_urls: ['https://media.maxvideoai.com/a.jpg', 'https://media.maxvideoai.com/b.jpg'],
    reference_video_urls: ['https://media.maxvideoai.com/motion.mp4'],
    reference_audio_urls: ['https://media.maxvideoai.com/station.wav'],
  },
});
```

For every mode assert absence of `fps`, `generate_audio`, `audio`, generic `image_urls`, generic `video_urls`, and generic `audio_urls`. Assert duplicate reference URLs are emitted once.

- [ ] **Step 2: Write failing validation boundary tests**

Cover these table rows in `tests/minimax-h3-validation.test.ts`:

```text
duration: 5 PASS; 15 PASS; 4 FAIL; 16 FAIL; 5.5 FAIL
resolution: 768P PASS; 2K PASS; 4K PASS; 1080p FAIL
t2v ratio: all six fixed values PASS; auto PASS
i2v: one start PASS; missing start FAIL; two starts FAIL; one end PASS; aspect_ratio present FAIL
ref2v: video only PASS; image only PASS; image + audio PASS; video + audio PASS; audio only FAIL
counts: 9 images PASS; 10 images FAIL; 3 videos PASS; 4 videos FAIL; 3 audios PASS; 4 audios FAIL
total unique references: 12 PASS; 13 FAIL; duplicate URL counts once
prompt: 1 character PASS; 7000 PASS; 7001 FAIL; blank FAIL
unsupported generate_audio or audio boolean: FAIL
```

- [ ] **Step 3: Run the red adapter and validation tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-request-body.test.ts tests/minimax-h3-validation.test.ts
```

Expected: FAIL because generic `ref2v` rewrites the H3 fields and generic required-input logic rejects video-only references.

- [ ] **Step 4: Implement the dedicated request helper**

In `frontend/src/lib/minimax-h3.ts`, implement:

```ts
export function isMinimaxH3EngineId(id: string | null | undefined): boolean;
export function resolveMinimaxH3Endpoint(mode: string | null | undefined): string;
export function buildMinimaxH3FalRequest(payload: GeneratePayload): {
  model: string;
  requestBody: Record<string, unknown>;
};
```

The helper derives every media array from `payload.inputs` by its exact `slotId`, de-duplicates in insertion order, maps `auto` to `adaptive` for `t2v` and `ref2v`, omits aspect ratio for `i2v`, and never copies arbitrary `extraInputValues`. Call it at the start of `buildFalGenerationRequest` when `payload.engineId === 'minimax-h3'`.

- [ ] **Step 5: Implement H3 validation without Seedance coupling**

Update `buildGenerateValidationPayload` so H3 `ref2v` uses its schema field IDs and considers a reference image or reference video sufficient. Keep the existing BytePlus behavior unchanged. Add a small H3 branch in provider-constraint validation for integer duration and image-mode aspect omission. Use the existing reference-budget evaluator for the 12-unique limit.

- [ ] **Step 6: Run green tests and existing regression coverage**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-request-body.test.ts tests/minimax-h3-validation.test.ts tests/generate-fal-request.test.ts tests/generate-validation-payload.test.ts tests/validate-request.test.ts tests/engine-reference-budget-propagation.test.ts
git diff --check
```

Expected: PASS with existing engines unchanged.

- [ ] **Step 7: Commit provider projection and validation**

```bash
git add frontend/src/lib/minimax-h3.ts frontend/src/lib/fal-request-body.ts frontend/app/api/generate/_lib/validation-payload.ts frontend/app/api/generate/_lib/validate-provider-constraints.ts frontend/app/api/generate/_lib/attachment-references.ts tests/minimax-h3-request-body.test.ts tests/minimax-h3-validation.test.ts
git commit -m "feat: validate and serialize MiniMax H3 requests"
```

---

### Task 3: Support H3 media constraints and unified workspace mode selection

**Files:**
- Modify: `frontend/types/engines.ts`
- Modify: `frontend/app/api/generate/_lib/generation-media-constraints.ts`
- Modify: `frontend/app/api/generate/_lib/validate-media-inputs.ts`
- Create: `frontend/app/(core)/(workspace)/app/_lib/minimax-h3-unified-workflow.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload.ts`
- Create: `tests/minimax-h3-media-constraints.test.ts`
- Create: `tests/minimax-h3-workspace.test.ts`
- Modify: `tests/workspace-composer-state-hook-contract.test.ts`

**Interfaces:**
- Consumes: H3 input schema and normalized `ReferenceAsset` values.
- Produces: `resolveMinimaxH3UnifiedMode(inputAssets): 't2v' | 'i2v' | 'ref2v'`, correctly ordered attachment payloads, trusted media-duration validation, and no audio-toggle lockout.

- [ ] **Step 1: Write failing media-constraint tests**

Assert exact accepted boundaries and one-unit failures:

```ts
assert.equal(validateH3Media(image({ sizeMB: 30 })).ok, true);
assert.equal(validateH3Media(image({ sizeMB: 30.01 })).ok, false);
assert.equal(validateH3Media(video({ sizeMB: 50, durationSec: 2 })).ok, true);
assert.equal(validateH3Media(video({ sizeMB: 50, durationSec: 15 })).ok, true);
assert.equal(validateH3Media(video({ durationSec: 1.99 })).ok, false);
assert.equal(validateH3Media(video({ durationSec: 15.01 })).ok, false);
assert.equal(validateH3Media(audio({ sizeMB: 15, durationSec: 15 })).ok, true);
assert.equal(validateH3Media(audio({ sizeMB: 15.01 })).ok, false);
```

Add combined-duration cases for three videos and three audios: exactly `15s` passes and `15.01s` fails. Missing duration metadata for an H3 video/audio reference fails with the field ID in the error.

- [ ] **Step 2: Write failing unified-workspace tests**

Use `ReferenceAsset` fixtures and assert:

```ts
assert.equal(resolveMinimaxH3UnifiedMode({}), 't2v');
assert.equal(resolveMinimaxH3UnifiedMode({ image_url: [imageAsset] }), 'i2v');
assert.equal(resolveMinimaxH3UnifiedMode({ end_image_url: [imageAsset] }), 'i2v');
assert.equal(resolveMinimaxH3UnifiedMode({ reference_image_urls: [imageAsset] }), 'ref2v');
assert.equal(resolveMinimaxH3UnifiedMode({ reference_video_urls: [videoAsset] }), 'ref2v');
assert.equal(resolveMinimaxH3UnifiedMode({ reference_audio_urls: [audioAsset] }), 'ref2v');
```

Assert `prepareGenerationInputs` retains all three exact slot IDs and that `buildWorkspaceGeneratePayload` omits `audio` while preserving `inputs`, `durationOption`, `resolution`, and `aspectRatio`.

- [ ] **Step 3: Run red media and workspace tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-media-constraints.test.ts tests/minimax-h3-workspace.test.ts
```

Expected: FAIL because H3 is not recognized as a unified workflow and generic media validation does not enforce combined duration.

- [ ] **Step 4: Add generic trusted-duration constraints**

Extend `EngineInputSchema.constraints` typing with numeric `maxCombinedVideoDurationSec` and `maxCombinedAudioDurationSec`. Set both to `15` in the H3 engine. Generalize the existing duration error copy so video failures say video and audio failures say audio. Validate owner-scoped stored metadata before billing; keep the current allowlisted remote-image behavior unchanged.

- [ ] **Step 5: Add the focused H3 workspace helper**

Implement `isUnifiedMinimaxH3EngineId` and `resolveMinimaxH3UnifiedMode`. In `useWorkspaceEngineModeState`, call it before generic inference and allow H3 reference audio without treating the engine as audio-to-video. Keep mode orchestration inside this hook and pure logic in the new route-local helper.

- [ ] **Step 6: Run green workspace, API, and architecture tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-media-constraints.test.ts tests/minimax-h3-workspace.test.ts tests/workspace-generation-request-helpers.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-composer-state-hook-contract.test.ts tests/seedance-2-5-media-constraints.test.ts
git diff --check
```

Expected: PASS; `AppClient.tsx` remains orchestration-only.

- [ ] **Step 7: Commit unified workspace support**

```bash
git add frontend/types/engines.ts frontend/app/api/generate/_lib/generation-media-constraints.ts frontend/app/api/generate/_lib/validate-media-inputs.ts frontend/app/'(core)'/'(workspace)'/app/_lib/minimax-h3-unified-workflow.ts frontend/app/'(core)'/'(workspace)'/app/_hooks/useWorkspaceEngineModeState.ts frontend/app/'(core)'/'(workspace)'/app/_lib/workspace-generation-inputs.ts frontend/app/'(core)'/'(workspace)'/app/_lib/workspace-generation-payload.ts tests/minimax-h3-media-constraints.test.ts tests/minimax-h3-workspace.test.ts tests/workspace-composer-state-hook-contract.test.ts
git commit -m "feat: support MiniMax H3 unified workspace"
```

---

### Task 4: Make H3 reference pricing canonical across billing and public quotes

**Files:**
- Create: `frontend/src/lib/minimax-h3-pricing.ts`
- Modify: `frontend/src/lib/pricing-billing-facts.ts`
- Modify: `frontend/src/lib/pricing-public-facts.ts`
- Modify: `frontend/app/api/generate/_lib/billing-preflight.ts`
- Modify: `frontend/app/api/generate/route.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-types.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`
- Create: `tests/minimax-h3-pricing.test.ts`
- Modify: `tests/pricing-billing-migration.test.ts`
- Modify: `tests/pricing-public-projection.test.ts`

**Interfaces:**
- Consumes: `PricingContext.referenceImageCount`, H3 duration, resolution, and mode.
- Produces: `calculateMinimaxH3ProviderPrice(input)` and identical factual subtotals for billing, receipts, model-page presets, pricing hub, and public projections.

- [ ] **Step 1: Write failing factual price tests**

Use this table before the existing MaxVideoAI policy is applied:

```ts
assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 5, resolution: '768P', referenceImageCount: 0 }).subtotalUsd, 0.40);
assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '2K', referenceImageCount: 5 }).subtotalUsd, 1.95);
assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '2K', referenceImageCount: 6 }).subtotalUsd, 2.03);
assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '4K', referenceImageCount: 9 }).subtotalUsd, 2.72);
```

Assert the breakdown contains `includedReferenceImages: 5`, `paidReferenceImages`, `referenceImageSurchargeUsd`, `ratePerSecondUsd`, `durationSec`, and `resolution`.

- [ ] **Step 2: Write failing parity and receipt tests**

For `t2v`, `i2v`, and `ref2v`, compare `computeCanonicalBillingSnapshot` with `computeCanonicalPublicSnapshot` for member/plus/pro. Add explicit five-versus-six-reference assertions and assert receipt metadata records the normalized reference count and surcharge.

- [ ] **Step 3: Run red pricing tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-pricing.test.ts tests/pricing-billing-migration.test.ts tests/pricing-public-projection.test.ts
```

Expected: FAIL because standard per-second pricing ignores the sixth-image surcharge and billing preflight does not receive `referenceImageCount`.

- [ ] **Step 4: Implement the factual calculator and both quote paths**

Implement:

```ts
export type MinimaxH3PricingInput = {
  durationSec: number;
  resolution: '768P' | '2K' | '4K';
  referenceImageCount?: number;
};

export function calculateMinimaxH3ProviderPrice(input: MinimaxH3PricingInput): {
  subtotalUsd: number;
  breakdown: {
    durationSec: number;
    resolution: string;
    ratePerSecondUsd: number;
    baseSubtotalUsd: number;
    referenceImageCount: number;
    includedReferenceImages: number;
    paidReferenceImages: number;
    referenceImageSurchargeUsd: number;
  };
};
```

Use this helper before the standard definition branch in both `buildBillingPricingFacts` and `buildPublicPricingFacts`, with compatibility profile `provider-reference-current`. Pass `normalizedReferenceImages.length` from `route.ts` into billing preflight and then into `PricingContext.referenceImageCount`.

- [ ] **Step 5: Expose reference-aware model-page presets**

Add optional `mode` and `referenceImageCount` to `ModelPageVideoPricingPreset` and `VideoPriceScenario`, import `Mode`, and expand the video-preset resolution extract to include `2K` and `4K`. Pass the new fields into `buildPublicPricingFacts`. Base pricing-hub rows remain reference-free; the H3 model page includes an exact six-reference preset so users can see the surcharge before opening the app.

- [ ] **Step 6: Run green pricing tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-pricing.test.ts tests/pricing-billing-migration.test.ts tests/pricing-billing-projection.test.ts tests/pricing-public-projection.test.ts
git diff --check
```

Expected: PASS with exact billing/public equivalence. Regenerate the exhaustive pricing baselines in Task 5, after H3 is atomically added to the executable and public registry so the collectors can discover it.

- [ ] **Step 7: Commit canonical H3 pricing**

```bash
git add frontend/src/lib/minimax-h3-pricing.ts frontend/src/lib/pricing-billing-facts.ts frontend/src/lib/pricing-public-facts.ts frontend/app/api/generate/_lib/billing-preflight.ts frontend/app/api/generate/route.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/pricing/_lib/pricingHubData.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-template-types.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-decision-pricing.ts tests/minimax-h3-pricing.test.ts tests/pricing-billing-migration.test.ts tests/pricing-public-projection.test.ts
git commit -m "feat: add canonical MiniMax H3 pricing"
```

---

### Task 5: Publish H3 in the canonical registry and make it the Hailuo default

**Files:**
- Modify: `frontend/config/model-registry.json`
- Modify: `frontend/config/model-families.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Modify: `content/models/en/minimax-hailuo-02-text.json`
- Modify: `content/models/fr/minimax-hailuo-02-text.json`
- Modify: `content/models/es/minimax-hailuo-02-text.json`
- Modify: `tests/model-registry-validation.test.ts`
- Modify: `tests/model-registry-parity.test.ts`
- Create: `tests/minimax-h3-registry.test.ts`
- Regenerate: `frontend/config/model-runtime.json`
- Regenerate: `frontend/config/engine-catalog.json`
- Regenerate: `frontend/config/model-roster.json`
- Regenerate: `docs/model-roster.json`
- Regenerate: `docs/model-roster.csv`
- Regenerate: `tests/fixtures/pricing-parity.v1.json`
- Regenerate: `tests/fixtures/pricing-public-projections.v1.json`

**Interfaces:**
- Consumes: executable `minimax-h3` engine from Task 1.
- Produces: atomically executable and fully public/indexable registry identity, reciprocal comparison graph, Hailuo family default/current ordering, and generated projections.

- [ ] **Step 1: Write the failing registry contract**

Assert:

```ts
const h3 = getRuntimeModelById('minimax-h3');
assert.ok(h3);
assert.equal(h3.family, 'hailuo');
assert.deepEqual(h3.publication.model, { published: true, indexable: true });
assert.deepEqual(h3.publication.examples, {
  published: true,
  includeInFamilyCopy: true,
  current: true,
  familyRank: 0,
});
assert.equal(h3.publication.app.published, true);
assert.equal(h3.publication.pricing.published, true);
assert.equal(h3.publication.compare.published, true);
assert.equal(h3.publication.compare.indexed, true);
assert.equal(h3.publication.sitemap.published, true);
assert.deepEqual(h3.publication.compare.suggestedOpponentIds, ['seedance-2-5', 'kling-o3-pro', 'veo-3-1']);
assert.equal(getModelFamilyDefinition('hailuo')?.defaultModelSlug, 'minimax-h3');
assert.deepEqual(getModelFamilyDefinition('hailuo')?.examplesPage?.currentModelSlugs, ['minimax-h3']);
```

Assert Hailuo 02 is still public everywhere with `current: false` and `familyRank: 1`.

- [ ] **Step 2: Run the red registry test**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-registry.test.ts
```

Expected: FAIL because the registry entry is absent.

- [ ] **Step 3: Author the H3 registry identity and reciprocal pairs**

Import and spread `MINIMAX_H3_FAL_ENGINE_REGISTRY` in `frontend/src/config/fal-engines/registry.ts`. Add `minimax-h3` to the authored model registry with empty alias arrays and every publication field explicit. Use app discovery rank `-4`, `variantGroup: 'hailuo'`, `variantLabel: 'H3'`, and `launchBadge: 'new'`. Add H3 to the published pair arrays for Seedance 2.5, Kling O3 Pro, and Veo 3.1; add the three opponents to H3's pair array. Do not add provider IDs as aliases.

Change only Hailuo 02 family rank/current state. In `model-families.ts`, change Hailuo nav/default/aliases to H3 while preserving every Hailuo 02 alias:

```ts
navLabel: 'MiniMax H3',
defaultModelId: 'minimax-h3',
routeAliases: ['minimax-h3', 'minimax-hailuo-02-text', 'minimax-hailuo-02-image'],
aliases: ['minimax-h3', 'hailuo-h3', 'hailuo-03', 'minimax-hailuo-02'],
prefixes: ['minimax/h3', 'minimax-h3', 'hailuo-h3', 'minimax-hailuo-02'],
```

Add one localized crawlable Hailuo 02 link to the H3 model page in each existing model document; do not relabel old media.

- [ ] **Step 4: Generate projections**

```bash
pnpm model:registry:generate
pnpm engine:catalog
pnpm model:generate:write
pnpm pricing:baseline -- --write
pnpm pricing:public-baseline:generate
```

- [ ] **Step 5: Run green registry gates**

```bash
pnpm model:registry:check
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-registry.test.ts tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/model-page-publication.test.ts
pnpm pricing:audit
git diff --check
```

Expected: PASS with all generated projections exact.

- [ ] **Step 6: Commit registry and family publication**

```bash
git add frontend/config/model-registry.json frontend/config/model-families.ts frontend/src/config/fal-engines/registry.ts content/models/en/minimax-hailuo-02-text.json content/models/fr/minimax-hailuo-02-text.json content/models/es/minimax-hailuo-02-text.json frontend/config/model-runtime.json frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv tests/fixtures/pricing-parity.v1.json tests/fixtures/pricing-public-projections.v1.json tests/model-registry-validation.test.ts tests/model-registry-parity.test.ts tests/minimax-h3-registry.test.ts
git commit -m "feat: publish MiniMax H3 as Hailuo flagship"
```

---

### Task 6: Complete the H3 and Seedance 2.5 scoreboards

**Files:**
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `tests/benchmark-lab-data.test.ts`
- Create: `tests/minimax-h3-benchmark-positioning.test.ts`

**Interfaces:**
- Consumes: benchmark methodology `manual-v1-internet-calibrated-with-platform-pricing` and current Kling O3 Pro scores.
- Produces: complete eleven-field H3 and Seedance 2.5 score rows, H3 source-backed key specs, and the fixed 9.1 > 8.6 > 8.5 public order.

- [ ] **Step 1: Write the failing completeness and ordering test**

Use the eleven canonical IDs and assert every value is a number:

```ts
const METRICS = [
  'fidelity', 'visualQuality', 'motion', 'consistency', 'anatomy',
  'textRendering', 'lipsyncQuality', 'sequencingQuality',
  'controllability', 'speedStability', 'pricing',
] as const;
for (const slug of ['minimax-h3', 'seedance-2-5']) {
  const row = requireScore(slug);
  for (const metric of METRICS) assert.equal(typeof row[metric], 'number', `${slug}.${metric}`);
}
assert.equal(computeBenchmarkOverall(requireScore('seedance-2-5')), 9.1);
assert.equal(computeBenchmarkOverall(requireScore('kling-o3-pro')), 8.6);
assert.equal(computeBenchmarkOverall(requireScore('minimax-h3')), 8.5);
```

Also scan benchmark and comparison UI copy for H3/Seedance-specific `estimated`, `provisional`, `sample`, `confidence`, or `disclaimer` labels and require none.

- [ ] **Step 2: Run the red benchmark test**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-benchmark-positioning.test.ts tests/benchmark-lab-data.test.ts
```

Expected: FAIL because H3 is absent and Seedance 2.5 contains nulls.

- [ ] **Step 3: Add the approved score rows exactly**

Write:

```json
{
  "modelSlug": "minimax-h3",
  "fidelity": 8.6,
  "visualQuality": 8.5,
  "motion": 8.4,
  "consistency": 8.4,
  "anatomy": 8.1,
  "textRendering": 8.3,
  "lipsyncQuality": 8.7,
  "sequencingQuality": 8.6,
  "controllability": 9.0,
  "speedStability": 7.6,
  "pricing": 9.7,
  "last_updated": "2026-08-08"
}
```

Replace the incomplete Seedance 2.5 row with:

```json
{
  "modelSlug": "seedance-2-5",
  "fidelity": 9.1,
  "visualQuality": 9.2,
  "motion": 9.2,
  "consistency": 9.0,
  "anatomy": 8.9,
  "textRendering": 8.5,
  "lipsyncQuality": 9.3,
  "sequencingQuality": 9.4,
  "controllability": 9.0,
  "speedStability": 7.7,
  "pricing": 7.2,
  "last_updated": "2026-08-08"
}
```

Add H3 key specs with the official URLs and exact three-mode contract. Update top-level `last_updated` dates to `2026-08-08`.

- [ ] **Step 4: Run green benchmark tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-benchmark-positioning.test.ts tests/benchmark-lab-data.test.ts tests/benchmark-lab-route.test.ts tests/app-engine-scores.test.ts tests/models-catalog-architecture.test.ts
git diff --check
```

Expected: PASS and no empty H3/Seedance 2.5 cells.

- [ ] **Step 5: Commit benchmark data**

```bash
git add data/benchmarks/engine-key-specs.v1.json data/benchmarks/engine-scores.v1.json tests/benchmark-lab-data.test.ts tests/minimax-h3-benchmark-positioning.test.ts
git commit -m "feat: publish complete H3 and Seedance scorecards"
```

---

### Task 7: Build the complete localized H3 model and Prompt Lab page

**Files:**
- Create: `content/models/en/minimax-h3.json`
- Create: `content/models/fr/minimax-h3.json`
- Create: `content/models/es/minimax-h3.json`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/minimax-h3.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-default-copy.ts`
- Create: `tests/minimax-h3-marketing-page.test.ts`
- Modify: `tests/model-page-template-registry.test.ts`
- Modify: `tests/model-decision-content-contract.test.ts`
- Modify: `tests/model-prompting-content-contract.test.ts`
- Modify: `tests/model-examples-content-contract.test.ts`

**Interfaces:**
- Consumes: model registry publication, H3 engine specs/pricing, and existing strict `decision`, `prompting`, and `examples` parsers.
- Produces: complete EN/FR/ES H3 model pages with live CTAs, pricing presets, Prompt Lab, real-media slots, FAQs, safety, specs, and localized metadata.

- [ ] **Step 1: Write the failing page/content contract**

Assert the template is `production`, every section is enabled, and quick links point to the localized resolver-compatible destinations. For every locale parse all three strict blocks and assert:

```ts
assert.equal(document.decision.modelSlug, 'minimax-h3');
assert.equal(document.prompting.modelSlug, 'minimax-h3');
assert.equal(document.examples.modelSlug, 'minimax-h3');
assert.equal(document.examples.showWhenEmpty, false);
assert.match(document.decision.hero.primaryCta.href, /\/app\?engine=minimax-h3$/);
assert.doesNotMatch(JSON.stringify(document), /admin|canary|rollout|hidden engine|provider routing/i);
```

Require all three workflow descriptions, 5–15s, 24 FPS, 768P/2K/4K, native stereo audio, 9/3/3/12 reference limits, six ratios plus Auto in text and reference modes, and source-backed update date.

- [ ] **Step 2: Run the red content tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts
```

Expected: FAIL because H3 content/template is absent.

- [ ] **Step 3: Add the production template**

Create a `production` template with this pricing shape:

```ts
presets: [
  { id: '5s-768p', seconds: 5, resolution: '768P', mode: 't2v', labelKey: 'entryDraft' },
  { id: '15s-2k', seconds: 15, resolution: '2K', mode: 't2v', labelKey: 'motionDraft', highlightKey: 'mostPopular' },
  { id: '15s-4k', seconds: 15, resolution: '4K', mode: 't2v', labelKey: 'flagshipRender' },
  { id: '15s-4k-6refs', seconds: 15, resolution: '4K', mode: 'ref2v', referenceImageCount: 6, labelKey: 'referenceRender' },
]
```

Quick links are the primary Seedance comparison, Hailuo examples, pricing anchor, and Prompt Lab. Keep the shared layout; do not add an H3-only route component.

- [ ] **Step 4: Author complete localized documents**

Use natural EN/FR/ES editorial adaptations with identical semantic IDs and array order. Include:

```text
Hero: current Hailuo flagship; three workflows; native audio; up to 4K and 15s.
Decision cards: prompt-only cinematic character scene; start/end-frame motion; multimodal reference production.
Prompt tabs: subject contract; timed shots; audio/dialogue; continuity constraints.
Examples filters: all, character, cinematic, audio, reference.
Proof icons: users, camera, audio, maximize, shield.
Safety: original adult characters and owned references; no public figures, brands, copyrighted characters, or unauthorized voices.
FAQs: modes, native audio, references, Auto ratio, price surcharge, H3 vs Hailuo 02, H3 vs Seedance 2.5.
```

Set `fallbackItems: null` and `showWhenEmpty: false`; accepted playlist media from Task 9 supplies the real items. Do not call the marketing videos a controlled head-to-head.

- [ ] **Step 5: Run green page, locale, and audit gates**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts tests/model-examples-view-model.test.ts
pnpm models:audit
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
git diff --check
```

Expected: PASS in EN/FR/ES.

- [ ] **Step 6: Commit the model-page content**

```bash
git add content/models/en/minimax-h3.json content/models/fr/minimax-h3.json content/models/es/minimax-h3.json frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-templates/minimax-h3.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-template-registry.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/models/'[slug]'/_lib/model-page-default-copy.ts tests/minimax-h3-marketing-page.test.ts tests/model-page-template-registry.test.ts tests/model-decision-content-contract.test.ts tests/model-prompting-content-contract.test.ts tests/model-examples-content-contract.test.ts
git commit -m "feat: add localized MiniMax H3 model page"
```

---

### Task 8: Publish three localized VS pages and complete discovery/indexation

**Files:**
- Create: `content/comparisons/minimax-h3-vs-seedance-2-5.json`
- Create: `content/comparisons/kling-o3-pro-vs-minimax-h3.json`
- Create: `content/comparisons/minimax-h3-vs-veo-3-1.json`
- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/config/compare-showdowns.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-related-links.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/comparisons.ts`
- Modify: `frontend/config/navigation.ts`
- Modify: `frontend/config/sitemap-timestamps.ts`
- Modify: `docs/seo/comparison-indexation-matrix-2026-07-08.json`
- Modify: `docs/seo/comparison-indexation-matrix-2026-07-08.md`
- Modify: `tests/comparison-content-contract.test.ts`
- Create: `tests/minimax-h3-seo-discovery.test.ts`

**Interfaces:**
- Consumes: reciprocal registry pair graph, H3/Seedance/Kling/Veo score and spec data, localized comparison parser, model-family navigation, and sitemap builders.
- Produces: three enriched comparison documents, reciprocal related links, H3 catalog/pricing/examples/benchmark discovery, EN/FR/ES canonical/hreflang routes, sitemap inclusion, and selected H3 Best For placements.

- [ ] **Step 1: Write failing comparison and SEO contracts**

Assert each slug is published and indexable in `['en', 'fr', 'es']`, has one comparison document, returns localized metadata/FAQ/links, and builds reciprocal canonical hreflang. Assert H3 model and Hailuo examples pages appear in model and marketing sitemaps. Assert the three VS pages appear in comparison discovery and related links.

Add score assertions to the H3/Kling and H3/Seedance pages:

```ts
assert.equal(scoreMap.get('minimax-h3'), 8.5);
assert.equal(scoreMap.get('kling-o3-pro'), 8.6);
assert.equal(scoreMap.get('seedance-2-5'), 9.1);
```

- [ ] **Step 2: Run the red discovery tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-seo-discovery.test.ts tests/comparison-content-contract.test.ts tests/comparison-indexation-matrix.test.ts tests/schema-sitemap-architecture.test.ts
```

Expected: FAIL because the three content documents and curated links are absent.

- [ ] **Step 3: Author all three strict localized comparison documents**

Each document contains `slug`, `en`, `fr`, and `es`, with localized metadata, hero intro, primary links, and three FAQs. Use these outcomes consistently:

```text
H3 vs Seedance 2.5: Seedance wins overall quality/long-form sequencing; H3 wins value and offers 2K/4K Fal routes.
Kling O3 Pro vs H3: Kling wins overall by 0.1 and remains the stronger general reference-control choice; H3 wins native-audio value.
H3 vs Veo 3.1: H3 wins value/reference volume; Veo remains the established premium cinematic route where its workflow fits.
```

Inject prices from runtime; do not author dollar totals. Do not add provisional-score or launch-sample language.

- [ ] **Step 4: Add bounded discovery and Best For links**

Add the H3 vs Seedance pair to the primary comparison list, replacing the lowest-priority existing item rather than expanding an unbounded menu. Add H3 to cinematic realism, character reference, reference-to-video, multi-shot, 4K, and lip-sync/dialogue related maps only where the engine contract supports it. Add links from H3, Hailuo 02, pricing, Benchmark Lab, Hailuo examples, models catalog, and relevant home comparison surfaces through their existing owners.

- [ ] **Step 5: Regenerate comparison indexation evidence**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json scripts/generate-comparison-indexation-matrix.ts
```

Confirm the three slugs are indexable in all locales and absent from `noindexByLocale`.

- [ ] **Step 6: Run green comparison, sitemap, and internal-link gates**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-seo-discovery.test.ts tests/comparison-content-contract.test.ts tests/compare-page-architecture.test.ts tests/comparison-indexation-matrix.test.ts tests/schema-sitemap-architecture.test.ts tests/hreflang-variants.test.ts tests/premerge-seo-routes.test.ts
pnpm --prefix frontend run seo:check
pnpm lint:exposure
git diff --check
```

Expected: PASS with EN/FR/ES canonical, hreflang, JSON-LD, sitemap, and internal-link coverage.

- [ ] **Step 7: Commit comparisons and discovery**

```bash
git add content/comparisons/minimax-h3-vs-seedance-2-5.json content/comparisons/kling-o3-pro-vs-minimax-h3.json content/comparisons/minimax-h3-vs-veo-3-1.json frontend/config/compare-hub.json frontend/config/compare-showdowns.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/'[slug]'/_lib/compare-page-related-links.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/ai-video-engines/best-for/'[usecase]'/_lib/best-for-detail-related.ts frontend/app/'(localized)'/'[locale]'/'(marketing)'/'(home)'/_lib/home-route-data/comparisons.ts frontend/config/navigation.ts frontend/config/sitemap-timestamps.ts docs/seo/comparison-indexation-matrix-2026-07-08.json docs/seo/comparison-indexation-matrix-2026-07-08.md tests/comparison-content-contract.test.ts tests/minimax-h3-seo-discovery.test.ts
git commit -m "feat: publish MiniMax H3 comparisons and discovery"
```

---

### Task 9: Generate, accept, and wire the two marketing videos

**Files:**
- Create: `frontend/public/assets/model-examples/minimax-h3/reference/cartographer-one.png`
- Create: `frontend/public/assets/model-examples/minimax-h3/reference/cartographer-two.png`
- Create: `frontend/public/assets/model-examples/minimax-h3/reference/station-ambience.wav`
- Create after acceptance: `frontend/public/models/minimax-h3-launch.jpg`
- Modify after acceptance: `frontend/src/config/fal-engines/minimax-h3.ts`
- Modify after acceptance: `content/models/en/minimax-h3.json`
- Modify after acceptance: `content/models/fr/minimax-h3.json`
- Modify after acceptance: `content/models/es/minimax-h3.json`
- Modify after acceptance: `frontend/config/video-seo-editorial.ts`
- Modify after acceptance: `docs/model-launch/minimax-h3.md`
- Test: `tests/minimax-h3-marketing-page.test.ts`
- Test: `tests/video-seo-editorial-contract.test.ts`

**Interfaces:**
- Consumes: finished local H3 engine, API validation, canonical preflight, Fal submission/polling, durable storage, existing playlist mutation path, and exactly two approved prompts.
- Produces: two accepted public/indexable H3 jobs in `examples-minimax-h3`, one hero poster, two video SEO entries, engine demo media, and a sanitized launch ledger.

- [ ] **Step 1: Create and inspect original reference assets**

Generate two original adult-character portraits with no recognizable person, logo, brand, uniform, or copyrighted design. Use distinct face shapes, hair, coat colors, and accessories. Create an owned 15-second station ambience reference containing rain, distant rail movement, and a generic station announcement without music or a recognizable voice. Inspect the images and audio metadata before upload.

- [ ] **Step 2: Start the local production-equivalent app and verify preflight**

Use the repository's actual environment without printing secrets. Start Next.js, establish the existing authenticated owner session, and request preflight for:

```text
Video A: minimax-h3, t2v, 15s, 2K, 16:9, 0 references
Video B: minimax-h3, ref2v, 15s, 4K, 16:9, 2 image references, 1 audio reference
```

Confirm the factual provider subtotals are USD `1.95` and USD `2.40` before MaxVideoAI policy. Stop if the quotes do not match the canonical pricing test.

- [ ] **Step 3: Submit “The lighthouse messenger” exactly once**

Use this English provider prompt:

```text
Create a cinematic 15-second 16:9 film with native stereo sound. The only principal character is an original adult woman named Elara, age 34, with an angular face, dark wavy shoulder-length hair, and a rust-red storm coat over charcoal work clothes. Keep her face, age, body proportions, coat color, brass signal device, and direction of travel identical throughout. No public figure, no recognizable costume, no brand.

0.0–4.5 seconds — Begin on a medium tracking shot inside an old coastal lighthouse during a severe night storm. Elara climbs the iron spiral staircase quickly but believably, one hand gripping the rail and the other protecting the compact brass signal device. Her feet contact every step; coat and hair react consistently to wind entering narrow windows. The camera rises with her in one smooth clockwise move. Blue lightning briefly reveals rain and black ocean outside.

4.5–10.5 seconds — Cut once to the lantern room. Maintain the same face, wardrobe, wetness, device, and screen direction. Elara reaches the central mechanism, locks the brass device into a matching socket, and turns it with visible resistance. Show clear cause and effect: gears engage, the large lens begins rotating, and a warm rescue beam sweeps across the room. Use a controlled push-in as relief replaces urgency in her expression. Hands remain anatomically correct and the device never changes shape.

10.5–15.0 seconds — Move to a close three-quarter view with the rotating beam and storm behind her. Elara looks toward the sea and says clearly in English, “Harbor light is alive. Bring them home.” Her lip movement, breath, expression, and voice timing match the sentence. End on a stable heroic composition as the beam crosses the rain once.

Stereo soundscape: wind circles outside the tower; rain strikes glass; boots and iron stairs are centered and physically timed; gears start with weight; the rotating lens hums softly; distant surf remains below; Elara's voice is clear and centered with natural room reflection. No music.

Constraints: exactly one Elara; stable identity and wardrobe; believable stair motion and hand contact; no extra limbs or fingers; no text, subtitles, signs, logo, watermark, interface, product framing, identity swap, random object, abrupt montage, or final-frame distortion.
```

Do not retry automatically. Poll to a terminal state and verify durable video/preview/poster creation, receipt, and audio metadata.

- [ ] **Step 4: Submit “The cartographers' last train” exactly once**

Upload the owned two portraits and station ambience into their exact H3 reference fields, then use:

```text
Create a cinematic 15-second 16:9 film with native stereo sound. @Image1 defines only Mara, an original adult cartographer with a narrow oval face, short black curls, olive-green raincoat, dark trousers, and a round brass compass on a leather cord. @Image2 defines only Tomas, an original adult cartographer with a broad face, close-cropped auburn hair, navy wool coat, grey scarf, and a worn canvas map tube. Keep both identities, ages, proportions, clothing, colors, and accessories distinct and unchanged. @Audio1 defines only the rainy station ambience and neutral announcement texture; do not copy music or a recognizable performer.

0.0–4.5 seconds — Wide lateral tracking shot on a rain-slick rural station platform at night. Mara waits beneath one warm lamp holding a folded hand-drawn paper map. Tomas runs in from frame right and stops in front of her with believable weight and wet footsteps. Keep them as two distinct adults with correct eyelines and no identity blending. The last train approaches in the deep background.

4.5–10.0 seconds — One clean cut to a medium two-shot. Mara places the folded map directly into Tomas's open right hand; show one complete, readable handoff with correct fingers, contact, release, and ownership change. Tomas immediately slides the map into his canvas tube while Mara points toward the arriving train. Their raincoats, compass, scarf, map, and screen positions remain stable.

10.0–15.0 seconds — The station announcement says clearly in English, “Final service now arriving on platform two.” Mara and Tomas exchange one determined look, turn together, and run toward the slowing train in the same direction. The camera follows behind at waist height. End with both characters still distinct as the train doors open ahead; no collision or teleportation.

Stereo soundscape: use @Audio1 as the base rain and station-space reference; place the approaching train from distant left toward center; footsteps and coat movement follow each character; the announcement is intelligible and spatially natural; add a restrained brake squeal and door mechanism. No music.

Constraints: preserve @Image1 as Mara only and @Image2 as Tomas only; exactly two principal adults; stable faces and wardrobe; one correct map handoff; anatomically correct hands and running; coherent direction of travel; no product shot, brand, text overlay, subtitle, logo, watermark, public figure, copyrighted character, identity swap, duplicate person, extra limb, or malformed final frame.
```

Do not retry automatically. Poll to a terminal state and reconcile any provider failure through the normal refund path.

- [ ] **Step 5: Grade both outputs and technical delivery**

Watch every frame and sample frames across the full duration. Require:

```text
Both: original adult identities; stable anatomy/wardrobe; coherent action; clean final two seconds; no product focus, brand, subtitle, logo, watermark, public figure, or copyrighted design.
Lighthouse: readable climb; correct device insertion/turn; rotating light cause/effect; intelligible line; stereo ambience.
Cartographers: two distinct identities; one correct map handoff; coherent run direction; intelligible announcement; reference-conditioned ambience.
Technical: requested duration/resolution/aspect; 24 FPS; stereo audio stream; durable MaxVideoAI URL; preview and poster; HTTP byte-range response; persisted actual usage; paid-wallet receipt.
```

If either output is unusable, stop and request explicit approval before any third paid H3 request.

- [ ] **Step 6: Publish accepted jobs and create the model playlist**

Through the existing playlist/job mutation path, set accepted jobs to `visibility=public`, `indexable=true`, and `engine_id=minimax-h3`. Create or update:

```text
name: Model · MiniMax H3
slug: examples-minimax-h3
description: Drives /models/minimax-h3.
public: true
```

Order the strongest accepted clip first for hero media and the other second for the Prompt Lab demo. Keep failed or rejected attempts private; do not delete audit or receipt data.

- [ ] **Step 7: Wire durable media and SEO editorial entries**

Export a 1200×630 poster from the accepted hero to `frontend/public/models/minimax-h3-launch.jpg`. Set all three `seo.image` values to `/models/minimax-h3-launch.jpg`. Update the H3 engine `demoUrl`/`media.videoUrl` with the durable public MaxVideoAI URL, never a signed Fal URL. Add two approved `VIDEO_SEO_EDITORIAL_ENTRIES` keyed by the real job IDs, with `modelSlug: 'minimax-h3'`, `examplesSlug: 'hailuo'`, intent `audio-enabled` or `model-demo`, and fully original titles/descriptions.

- [ ] **Step 8: Record sanitized evidence and run media tests**

In `docs/model-launch/minimax-h3.md`, record settings, quote, actual provider usage, receipt state, technical metadata, and acceptance outcome without credentials, wallet IDs, provider IDs, signed URLs, or private user IDs.

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-marketing-page.test.ts tests/video-seo-editorial-contract.test.ts tests/video-pages-sitemap.test.ts tests/model-examples-view-model.test.ts
git diff --check
```

Expected: PASS and both accepted videos appear on the H3 model page and Hailuo examples family.

- [ ] **Step 9: Commit accepted marketing assets**

```bash
git add frontend/public/assets/model-examples/minimax-h3/reference/cartographer-one.png frontend/public/assets/model-examples/minimax-h3/reference/cartographer-two.png frontend/public/assets/model-examples/minimax-h3/reference/station-ambience.wav frontend/public/models/minimax-h3-launch.jpg frontend/src/config/fal-engines/minimax-h3.ts content/models/en/minimax-h3.json content/models/fr/minimax-h3.json content/models/es/minimax-h3.json frontend/config/video-seo-editorial.ts docs/model-launch/minimax-h3.md tests/minimax-h3-marketing-page.test.ts tests/video-seo-editorial-contract.test.ts
git commit -m "feat: publish MiniMax H3 marketing renders"
```

---

### Task 10: Run final verification, ship once, and verify production

**Files:**
- Verify: every file changed in Tasks 1–9

**Interfaces:**
- Consumes: complete committed H3 runtime, pricing, registry, content, benchmarks, comparisons, links, SEO, and accepted media.
- Produces: one reviewed commit series pushed to the production branch, one Vercel production deployment, submitted indexation URLs, and a sanitized production-verification report in the task handoff.

- [ ] **Step 1: Run focused H3 verification**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/minimax-h3-engine-catalog.test.ts tests/minimax-h3-request-body.test.ts tests/minimax-h3-validation.test.ts tests/minimax-h3-media-constraints.test.ts tests/minimax-h3-workspace.test.ts tests/minimax-h3-pricing.test.ts tests/minimax-h3-registry.test.ts tests/minimax-h3-benchmark-positioning.test.ts tests/minimax-h3-marketing-page.test.ts tests/minimax-h3-seo-discovery.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run registry, pricing, architecture, locale, and SEO gates**

```bash
pnpm model:registry:check
pnpm pricing:audit
pnpm models:audit
npm run architecture:audit -- --min-lines 500
npm --prefix frontend run lint
cd frontend && ./node_modules/.bin/tsc --noEmit
cd ..
npm run lint:exposure
pnpm --prefix frontend run i18n:check
pnpm --prefix frontend run seo:check
git diff --check
```

Expected: all required gates PASS; architecture audit may report pre-existing large files but no new H3 ownership violation.

- [ ] **Step 3: Run the broad suite and production build**

```bash
pnpm run test:validate
pnpm run vercel-build
```

Expected: PASS.

- [ ] **Step 4: Perform local browser QA**

Verify desktop and mobile workspace flows for `t2v`, `i2v`, and `ref2v`; 5/15s boundaries; 768P/2K/4K; fixed/Auto ratios; start/end images; image/video/audio reference slots; five/six-image quote change; audio-only rejection; video-only acceptance; and no audio toggle.

Open EN/FR/ES H3 model, Hailuo examples, pricing, Benchmark Lab, and all three VS routes. Verify autoplay is muted, posters load without layout shift, prices and scores match, canonical/hreflang/JSON-LD are present, all links resolve, and browser console/network contain no H3 error.

- [ ] **Step 5: Review the complete diff and repository state**

```bash
git status --short --branch
git diff --stat origin/main...HEAD
git diff --check origin/main...HEAD
```

Confirm no secret, signed provider URL, private identifier, generated cache, or unrelated file is included.

- [ ] **Step 6: Push and deploy the finished release once**

Resolve whether this repository's established production mechanism is Git-based automatic deployment or an explicit Vercel CLI promotion. Use exactly that one mechanism, not both. Push the reviewed branch as required by that mechanism, deploy the linked Vercel project once, and retain the Git SHA plus deployment URL for the final handoff. Do not deploy an intermediate H3 state.

- [ ] **Step 7: Verify production without a new launch-gating render**

Check live EN/FR/ES routes, workspace engine selection, live prices, both marketing videos, Benchmark Lab ordering, comparison pages, canonical/hreflang/JSON-LD, all relevant sitemaps, and durable byte-range playback. Confirm H3 is visible/current/default and Hailuo 02 remains available.

- [ ] **Step 8: Submit public URLs for indexation**

Use the existing IndexNow route/script to submit the changed H3 model, Hailuo examples, Benchmark Lab, pricing, and three comparison URLs in EN/FR/ES. Verify the URLs are already present in the public sitemaps before submission.

- [ ] **Step 9: Report the production result without triggering a second deployment**

Return the deployment SHA, deployment URL, route checks, sitemap checks, indexation submission result, and post-deploy outcome in the final task handoff. Do not make a documentation-only post-deploy push that would trigger a second production deployment. Expected: production exposes the finished public H3 product on its first H3 deployment. Additional production renders are post-launch product QA, not a condition for this launch report.
