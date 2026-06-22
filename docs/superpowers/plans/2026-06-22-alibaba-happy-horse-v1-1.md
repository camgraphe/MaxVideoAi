# Alibaba Happy Horse 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Alibaba Happy Horse 1.1 as the current unified Happy Horse model in MaxVideoAI, keep Happy Horse 1.0 available as a legacy route, update model/comparison/pricing surfaces, and prepare the two model-page videos after code integration.

**Architecture:** Keep Happy Horse in the existing provider-family module at `frontend/src/config/fal-engines/happy-horse.ts`, with one current product entry (`happy-horse-1-1`) aggregating the three Fal 1.1 endpoints and the existing `happy-horse-1-0` entry marked legacy. Preserve existing public URLs for 1.0 while moving family aliases, app defaults, marketing CTAs, pricing order, benchmark scores, and published comparison links to 1.1. Do not add comparison-page videos in this launch; only add model-page `hero` and `demo` media after approved generation.

**Tech Stack:** Next.js App Router, TypeScript catalog modules, generated `engine-catalog.json`, generated model roster JSON/CSV, benchmark JSON data, Node test runner via `tsx`, Fal queue/API endpoints.

---

## Source Facts Verified On 2026-06-22

- Fal current endpoints:
  - `alibaba/happy-horse/v1.1/text-to-video`
  - `alibaba/happy-horse/v1.1/image-to-video`
  - `alibaba/happy-horse/v1.1/reference-to-video`
- I did not find an official Fal 1.1 `video-edit` endpoint. Keep V2V only on legacy `happy-horse-1-0` unless a primary Fal source appears.
- Fal 1.1 public pages show pricing at `$0.14/s` for 720p and `$0.18/s` for 1080p.
- Fal 1.1 supports duration `3` through `15`, default `5`, `resolution` values `720p` and `1080p`, `seed`, and `enable_safety_checker`.
- T2V and R2V support aspect ratios `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `21:9`, `9:21`, `5:4`, `4:5`.
- I2V accepts `image_url`, optional `prompt`, 720p/1080p, duration 3-15, seed, safety checker. Its image limit is max 20 MB, min 300 px, aspect ratio `1:2.5 to 2.5:1`.
- R2V accepts required `prompt`, required `image_urls` with 1-9 images, max 10 MB each, shortest side at least 400 px, using `character1` through `character9`.
- Primary Fal docs:
  - https://fal.ai/models/alibaba/happy-horse/v1.1/text-to-video
  - https://fal.ai/models/alibaba/happy-horse/v1.1/text-to-video/api
  - https://fal.ai/models/alibaba/happy-horse/v1.1/image-to-video
  - https://fal.ai/models/alibaba/happy-horse/v1.1/image-to-video/api
  - https://fal.ai/models/alibaba/happy-horse/v1.1/reference-to-video
  - https://fal.ai/models/alibaba/happy-horse/v1.1/reference-to-video/api

## Launch Decisions

- Current slug: `happy-horse-1-1`.
- Legacy slug: `happy-horse-1-0`.
- Family route `/examples/happy-horse` should resolve to 1.1 as the current model while still listing 1.0 as a published legacy model.
- Alias `happy-horse`, `happyhorse`, and `alibaba-happy-horse` should canonicalize to `happy-horse-1-1`; exact `happy-horse-1-0` aliases should continue resolving to 1.0.
- App route `/app?engine=happy-horse-1-1` should be the current default. `/app?engine=happy-horse-1-0` should remain available for legacy V2V/video-edit workflows.
- 1.1 should expose `t2v`, `i2v`, and `ref2v` only. 1.0 keeps `t2v`, `i2v`, `ref2v`, and `v2v`.
- Do not add comparison showdown videos. Comparison pages should remain text/spec/score focused for this launch.
- Generate exactly two videos for the 1.1 model page after code integration: one `hero` and one `demo`.

## File Map

- Modify: `frontend/src/config/fal-engines/launch-config.ts` for 1.1 endpoint constants and expanded aspect ratios.
- Modify: `frontend/src/config/fal-engines/happy-horse.ts` for current 1.1 entry, legacy 1.0 metadata, surfaces, pricing, modes, FAQs, and prompts.
- Modify: `frontend/src/config/falEngines.ts`, `frontend/src/lib/engine-alias.ts`, `frontend/src/lib/brand-partners.ts`, `frontend/lib/happy-horse-workflow.ts`, `frontend/app/api/generate/_lib/attachment-references.ts`, `frontend/src/lib/fal-request-body.ts`, `frontend/src/lib/pricing-addons.ts` to remove single-id assumptions.
- Modify: `frontend/config/model-families.ts` for family default/current/published model slugs.
- Modify: `frontend/src/config/engineCatalog.overrides.ts`, `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`, model catalog/homepage helper files that pin `happy-horse-1-0`.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/happy-horse-1-1.ts`.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts` to add 1.1 localized copy and convert 1.0 copy to legacy positioning.
- Create: `content/models/en/happy-horse-1-1.json`, `content/models/fr/happy-horse-1-1.json`, `content/models/es/happy-horse-1-1.json`.
- Modify: existing `content/models/*/happy-horse-1-0.json` only where visible copy should say legacy/previous generation.
- Modify: `data/benchmarks/engine-scores.v1.json` and `data/benchmarks/engine-key-specs.v1.json`.
- Modify: `frontend/config/compare-hub.json` and `frontend/config/compare-config.json`.
- Modify after generation: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`.
- Regenerate: `frontend/config/engine-catalog.json`, `frontend/config/model-roster.json`, `docs/model-roster.json`, `docs/model-roster.csv`.
- Update tests: `tests/fal-engine-catalog-architecture.test.ts`, `tests/validate-request.test.ts`, `tests/generate-fal-request.test.ts`, `tests/fal-model-policy.test.ts`, `tests/seedance-prelaunch.test.ts`, `tests/pricing-definition.test.ts`, `tests/brand-partners.test.ts`, `tests/model-page-template-content.test.ts`, `tests/model-page-template-registry.test.ts`, `tests/model-page-decision-data.test.ts`, `tests/premerge-seo-routes.test.ts`, `tests/homepage-real-examples-preview.test.ts`, and any failing focused compare/model tests.

---

### Task 1: Baseline And Drift Check

**Files:**
- Read-only: repo state, generated catalog state, tests

- [ ] **Step 1: Confirm branch and clean worktree**

Run:

```bash
git branch --show-current
git status --short --branch
```

Expected:

```text
codex/alibaba-happy-horse-v1-1
## codex/alibaba-happy-horse-v1-1
```

- [ ] **Step 2: Check existing generated catalog drift**

Run:

```bash
npm run engine:catalog
npm run model:generate
git status --short
```

Expected before edits: either no generated drift or only drift caused by the current branch. If generated files change before code edits, inspect with:

```bash
git diff -- frontend/config/engine-catalog.json frontend/config/model-roster.json docs/model-roster.json docs/model-roster.csv
```

If drift exists before implementation, record it in the implementation notes and keep it separate from Happy Horse code changes.

- [ ] **Step 3: Run the narrow current Happy Horse tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/validate-request.test.ts \
  tests/generate-fal-request.test.ts \
  tests/pricing-definition.test.ts \
  tests/seedance-prelaunch.test.ts \
  tests/brand-partners.test.ts
```

Expected: pass before edits. If a test fails before implementation, capture the failing test name and continue only after confirming it is unrelated to Happy Horse 1.1.

---

### Task 2: Add Happy Horse 1.1 Catalog Entry And Mark 1.0 Legacy

**Files:**
- Modify: `frontend/src/config/fal-engines/launch-config.ts`
- Modify: `frontend/src/config/fal-engines/happy-horse.ts`
- Test: `tests/fal-engine-catalog-architecture.test.ts`

- [ ] **Step 1: Add 1.1 constants**

In `frontend/src/config/fal-engines/launch-config.ts`, keep `HAPPY_HORSE_ENDPOINTS` for 1.0 compatibility and add:

```ts
export const HAPPY_HORSE_1_1_ENDPOINTS = {
  t2v: 'alibaba/happy-horse/v1.1/text-to-video',
  i2v: 'alibaba/happy-horse/v1.1/image-to-video',
  ref2v: 'alibaba/happy-horse/v1.1/reference-to-video',
} as const;

export const HAPPY_HORSE_1_1_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '21:9',
  '9:21',
  '5:4',
  '4:5',
] as const;
```

Keep existing `HAPPY_HORSE_DURATION_OPTIONS`.

- [ ] **Step 2: Rename the existing 1.0 engine constant for clarity**

In `frontend/src/config/fal-engines/happy-horse.ts`, keep the existing object body but name it:

```ts
const HAPPY_HORSE_1_0_ENGINE: EngineCaps = {
  // existing 1.0 body stays here
};
```

Do not change the 1.0 endpoints in this step.

- [ ] **Step 3: Add the 1.1 EngineCaps**

Add this current engine before the 1.0 engine or immediately after imports:

```ts
const HAPPY_HORSE_1_1_ENGINE: EngineCaps = {
  id: 'happy-horse-1-1',
  label: 'Happy Horse 1.1',
  provider: 'Alibaba',
  version: '1.1',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 20,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'official',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'ref2v'],
        requiredInModes: ['t2v', 'ref2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Used as the first frame for Happy Horse 1.1 image-to-video generation.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (1-9)',
        description:
          'Reference subjects with character1, character2, and up to character9 in the prompt. Requires 1-9 JPEG, JPG, PNG, or WEBP references.',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
        slotLabelPattern: 'character{n}',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Optional animation guidance for image-to-video.',
        modes: ['i2v'],
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        modes: ['t2v', 'i2v', 'ref2v'],
        values: HAPPY_HORSE_DURATION_OPTIONS.map(String),
        default: '5',
        min: 3,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2v', 'ref2v'],
        values: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        modes: ['t2v', 'i2v', 'ref2v'],
        values: ['720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Optional random seed for reproducible Happy Horse 1.1 generations. Accepted range: 0-2147483647.',
        modes: ['t2v', 'i2v', 'ref2v'],
        min: 0,
        max: 2147483647,
        step: 1,
      },
      {
        id: 'enable_safety_checker',
        type: 'boolean',
        label: 'Safety checker',
        description: 'Enable provider input and output moderation.',
        modes: ['t2v', 'i2v', 'ref2v'],
        default: true,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
      maxImageSizeMB: 20,
      minImageSidePx: 300,
      minReferenceImageSidePx: 400,
      imageAspectRatioRange: '1:2.5 to 2.5:1',
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 14,
      byResolution: {
        '720p': 14,
        '1080p': 18,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.14,
    byResolution: {
      '720p': 0.14,
      '1080p': 0.18,
    },
    currency: 'USD',
    notes:
      'Provider cost: $0.14/s for 720p and $0.18/s for 1080p on Happy Horse 1.1 text, image, and reference-to-video runs. MaxVideoAI display prices add platform margin before showing quotes.',
  },
  updatedAt: '2026-06-22T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'alibaba',
    modelSlug: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
  },
  availability: 'available',
  brandId: 'alibaba',
  brandAssetPolicy: {
    logoAllowed: false,
    textOnly: true,
    usageNotes: 'Use text-only Alibaba attribution until an approved logo asset and usage guidance are available.',
  },
  modeCaps: {
    t2v: {
      modes: ['t2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
      audioToggle: false,
      notes: 'Text-to-video with native synchronized audio and multilingual lip-sync.',
    },
    i2v: {
      modes: ['i2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
      maxUploadMB: 20,
      audioToggle: false,
      notes: 'Animate one start image with optional prompt guidance. Aspect ratio is inferred from the source image.',
    },
    ref2v: {
      modes: ['ref2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxUploadMB: 10,
      audioToggle: false,
      notes: 'Reference-to-video workflow with 1-9 image references and character1..character9 prompt anchors.',
    },
  },
};
```

- [ ] **Step 4: Add the 1.1 registry entry before the 1.0 entry**

At the start of `HAPPY_HORSE_FAL_ENGINE_REGISTRY`, insert:

```ts
  {
    id: 'happy-horse-1-1',
    modelSlug: 'happy-horse-1-1',
    marketingName: 'Happy Horse 1.1',
    cardTitle: 'Happy Horse 1.1 - Unified native-audio video model',
    provider: 'Alibaba',
    brandId: 'alibaba',
    family: 'happy-horse',
    versionLabel: '1.1',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'sora-2-pro', 'happy-horse-1-0'],
        publishedPairs: ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'sora-2-pro', 'happy-horse-1-0'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 8,
        variantGroup: 'happy-horse',
        variantLabel: '1.1',
      },
      pricing: {
        includeInEstimator: true,
        featuredScenario: 'happy-horse-1-1-native-audio-video',
      },
    },
    engine: HAPPY_HORSE_1_1_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
          audioToggle: false,
          notes: 'Prompt-only generation with synchronized native audio and multilingual lip-sync.',
        },
      },
      {
        mode: 'i2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
          maxUploadMB: 20,
          audioToggle: false,
          notes: 'Animate a first-frame image. The output aspect ratio follows the uploaded image.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Reference-image mode. Use character1..character9 in the prompt to bind uploaded references.',
        },
      },
    ],
    defaultFalModelId: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
    seo: {
      title: 'Happy Horse 1.1 - Alibaba Native-Audio AI Video Model | MaxVideoAI',
      description:
        'Generate Happy Horse 1.1 videos on MaxVideoAI with text, image, and reference-to-video workflows plus native synchronized audio and lip-sync.',
      canonicalPath: '/models/happy-horse-1-1',
    },
    type: 'textImageReferenceVideo',
    seoText:
      'Happy Horse 1.1 combines text-to-video, image-to-video, and reference-image generation in one Alibaba model card, with native audio and lip-sync treated as part of the generation.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/69f25df5-9354-4387-a3d2-44b1736727e2.mp4',
      imagePath: '/assets/models/models-hero-horses-reference.webp',
      altText: 'Happy Horse 1.1 unified video model hero preview',
    },
    prompts: [
      {
        title: 'Native audio presenter',
        prompt:
          '16:9 studio product launch clip, a confident creator speaks directly to camera with natural lip-sync, warm key light, subtle camera push, clean room tone and soft launch music.',
        mode: 't2v',
      },
      {
        title: 'Animate campaign key art',
        prompt:
          'Bring the uploaded campaign still to life with a smooth dolly push, subtle fabric and hair motion, polished ad lighting, and synchronized ambience.',
        mode: 'i2v',
      },
      {
        title: 'Reference character consistency',
        prompt:
          'Use character1 and character2 from the reference images in a cinematic two-person product demo, consistent wardrobe, stable faces, natural synchronized dialogue.',
        mode: 'ref2v',
      },
    ],
    faqs: [
      {
        question: 'What Happy Horse 1.1 workflows are available in MaxVideoAI?',
        answer:
          'Happy Horse 1.1 is exposed as one current model with text-to-video, image-to-video, and reference-to-video generation.',
      },
      {
        question: 'Does Happy Horse 1.1 include lip-sync?',
        answer:
          'Yes. MaxVideoAI treats Happy Horse 1.1 as an audio-native model with synchronized native audio and lip-sync, without a separate lip-sync toggle.',
      },
      {
        question: 'Does Happy Horse 1.1 support video editing?',
        answer:
          'No official Happy Horse 1.1 video-edit endpoint is exposed on Fal for this launch. MaxVideoAI keeps Happy Horse 1.0 available as the legacy video-edit route.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 90,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p native audio',
    },
    promptExample:
      '16:9 product launch presenter, natural lip-sync, warm studio light, slow camera push, synchronized room tone and subtle music, 5 seconds.',
    category: 'video',
  },
```

`pricingHint.amountCents` is provider-base cost for 5 seconds at 1080p (`18 * 5`); display pricing adds MaxVideoAI margin elsewhere.

- [ ] **Step 5: Mark the existing 1.0 entry as legacy**

In the existing `happy-horse-1-0` registry object:

```ts
    isLegacy: true,
```

Update its surfaces to lower app discovery and keep estimator support:

```ts
      app: {
        enabled: true,
        discoveryRank: 50,
        variantGroup: 'happy-horse',
        variantLabel: '1.0 legacy',
      },
      pricing: {
        includeInEstimator: true,
        featuredScenario: 'legacy happy-horse-video-edit',
      },
```

Keep 1.0 `v2v` mode and V2V pricing unchanged.

- [ ] **Step 6: Run the catalog architecture test**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/fal-engine-catalog-architecture.test.ts
```

Expected: pass. If `happy-horse.ts` exceeds 500 lines, split shared constants/helpers inside the same provider-family module before proceeding, or adjust the test only if the module remains focused and the line cap is intentionally raised.

---

### Task 3: Generalize Happy Horse Runtime IDs And Payload Routing

**Files:**
- Modify: `frontend/lib/happy-horse-workflow.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`
- Modify: `frontend/app/api/generate/_lib/attachment-references.ts`
- Modify: `frontend/src/lib/fal-request-body.ts`
- Modify: `frontend/src/lib/pricing-addons.ts`
- Test: `tests/seedance-prelaunch.test.ts`
- Test: `tests/workspace-generation-inputs.test.ts`
- Test: `tests/generate-attachment-references.test.ts`
- Test: `tests/generate-fal-request.test.ts`
- Test: `tests/pricing-definition.test.ts`

- [ ] **Step 1: Replace the single Happy Horse id helper**

In `frontend/lib/happy-horse-workflow.ts`, replace the single constant and helper with:

```ts
export const HAPPY_HORSE_CURRENT_ENGINE_ID = 'happy-horse-1-1';
export const HAPPY_HORSE_LEGACY_ENGINE_ID = 'happy-horse-1-0';
export const HAPPY_HORSE_ENGINE_IDS = new Set([HAPPY_HORSE_CURRENT_ENGINE_ID, HAPPY_HORSE_LEGACY_ENGINE_ID]);
export const HAPPY_HORSE_VIDEO_EDIT_ENGINE_IDS = new Set([HAPPY_HORSE_LEGACY_ENGINE_ID]);
```

Update:

```ts
export function isHappyHorseEngineId(engineId?: string | null): boolean {
  return typeof engineId === 'string' && HAPPY_HORSE_ENGINE_IDS.has(engineId);
}

export function supportsHappyHorseVideoEdit(engineId?: string | null): boolean {
  return typeof engineId === 'string' && HAPPY_HORSE_VIDEO_EDIT_ENGINE_IDS.has(engineId);
}

export function getUnifiedHappyHorseMode(
  inputAssets: HappyHorseAssetMap,
  options: { supportsVideoEdit?: boolean } = {}
): Mode {
  const state = getHappyHorseAssetState(inputAssets);
  if (options.supportsVideoEdit && state.hasEditInputs) return 'v2v';
  if (state.hasR2vReferenceImage) return 'ref2v';
  if (state.hasStartImage) return 'i2v';
  return 't2v';
}
```

- [ ] **Step 2: Pass video-edit support from the workspace hook**

In `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState.ts`, import `supportsHappyHorseVideoEdit` and change the implicit mode branch to:

```ts
    if (isUnifiedHappyHorse && (form?.mode === 't2v' || !form?.mode)) {
      return getUnifiedHappyHorseMode(inputAssets, {
        supportsVideoEdit: supportsHappyHorseVideoEdit(selectedEngine.id),
      });
    }
```

- [ ] **Step 3: Generalize attachment reference routing**

In `frontend/app/api/generate/_lib/attachment-references.ts`, import `isHappyHorseEngineId` and `supportsHappyHorseVideoEdit` from `@/lib/happy-horse-workflow`. Replace:

```ts
      if (params.engineId === 'happy-horse-1-0') {
        if (params.mode === 'v2v') return attachment.slotId === 'reference_image_urls';
        if (params.mode === 'ref2v') return attachment.slotId === 'image_urls' || attachment.slotId === 'reference_images';
      }
```

with:

```ts
      if (isHappyHorseEngineId(params.engineId)) {
        if (params.mode === 'v2v' && supportsHappyHorseVideoEdit(params.engineId)) {
          return attachment.slotId === 'reference_image_urls';
        }
        if (params.mode === 'ref2v') {
          return attachment.slotId === 'image_urls' || attachment.slotId === 'reference_images';
        }
      }
```

- [ ] **Step 4: Generalize Fal request body reference routing**

In `frontend/src/lib/fal-request-body.ts`, import `supportsHappyHorseVideoEdit` and replace:

```ts
    if (expectsSingleSourceVideo && (payload.engineId === 'happy-horse-1-0' || requestBody.reference_image_urls)) {
```

with:

```ts
    if (expectsSingleSourceVideo && (supportsHappyHorseVideoEdit(payload.engineId) || requestBody.reference_image_urls)) {
```

- [ ] **Step 5: Keep V2V pricing only on legacy 1.0**

In `frontend/src/lib/pricing-addons.ts`, import `HAPPY_HORSE_LEGACY_ENGINE_ID` and replace the hard-coded constant:

```ts
const HAPPY_HORSE_ENGINE_ID = HAPPY_HORSE_LEGACY_ENGINE_ID;
```

Keep the existing V2V pricing values unchanged.

- [ ] **Step 6: Update runtime tests**

In `tests/seedance-prelaunch.test.ts`, change the Happy Horse mode inference test to cover both current and legacy behavior:

```ts
test('Unified Happy Horse workspace infers current 1.1 modes and legacy V2V mode from reference slots', () => {
  assert.equal(getUnifiedHappyHorseMode({}), 't2v');
  assert.equal(getUnifiedHappyHorseMode({ image_url: [{ kind: 'image' }] }), 'i2v');
  assert.equal(getUnifiedHappyHorseMode({ image_urls: [{ kind: 'image' }] }), 'ref2v');
  assert.equal(
    getUnifiedHappyHorseMode({ reference_image_urls: [{ kind: 'image' }] }, { supportsVideoEdit: true }),
    'v2v'
  );
  assert.equal(
    getUnifiedHappyHorseMode({ video_url: [{ kind: 'video' }] }, { supportsVideoEdit: true }),
    'v2v'
  );
  assert.equal(getUnifiedHappyHorseMode({ video_url: [{ kind: 'video' }] }), 't2v');
  assert.equal(getHappyHorseAssetState({ image_urls: [{ kind: 'image' }] }).hasR2vReferenceImage, true);
});
```

- [ ] **Step 7: Run focused runtime tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/seedance-prelaunch.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/generate-attachment-references.test.ts \
  tests/generate-fal-request.test.ts \
  tests/pricing-definition.test.ts
```

Expected: tests pass after updating expected IDs and prices in the next tasks.

---

### Task 4: Aliases, Brand Mapping, Family Defaults, And Policy Allowlist

**Files:**
- Modify: `frontend/src/config/falEngines.ts`
- Modify: `frontend/src/lib/engine-alias.ts`
- Modify: `frontend/src/lib/brand-partners.ts`
- Modify: `frontend/config/model-families.ts`
- Test: `tests/brand-partners.test.ts`
- Test: `tests/fal-model-policy.test.ts`
- Test: `tests/seo-phase2a.test.ts`

- [ ] **Step 1: Update canonical aliases**

In `frontend/src/config/falEngines.ts`, update `LEGACY_MODEL_SLUG_ALIASES`:

```ts
  happyhorse: 'happy-horse-1-1',
  'happy-horse': 'happy-horse-1-1',
  'happyhorse-1-1': 'happy-horse-1-1',
  'happy-horse-1.1': 'happy-horse-1-1',
  'alibaba-happy-horse': 'happy-horse-1-1',
  'happyhorse-1-0': 'happy-horse-1-0',
  'happy-horse-1.0': 'happy-horse-1-0',
```

Keep exact `happy-horse-1-0` resolving directly through the registry.

- [ ] **Step 2: Update app engine aliases**

In `frontend/src/lib/engine-alias.ts`, map generic aliases to 1.1 and keep version-specific aliases:

```ts
    happyhorse: 'happy-horse-1-1',
    'happy-horse': 'happy-horse-1-1',
    'happyhorse-1-1': 'happy-horse-1-1',
    'happy-horse-1.1': 'happy-horse-1-1',
    'alibaba-happy-horse': 'happy-horse-1-1',
    'happyhorse-1-0': 'happy-horse-1-0',
    'happy-horse-1.0': 'happy-horse-1-0',
```

- [ ] **Step 3: Update Alibaba brand partner aliases**

In `frontend/src/lib/brand-partners.ts`, add:

```ts
      'happy-horse-1-1',
      'happyhorse-1-1',
      'happy-horse-1.1',
      'alibaba/happy-horse/v1.1/text-to-video',
      'alibaba/happy-horse/v1.1/image-to-video',
      'alibaba/happy-horse/v1.1/reference-to-video',
```

Keep 1.0 aliases and `video-edit` aliases.

- [ ] **Step 4: Update family defaults**

In `frontend/config/model-families.ts`, update the Happy Horse family:

```ts
    navLabel: 'Happy Horse 1.1',
    defaultModelSlug: 'happy-horse-1-1',
    routeAliases: ['happy-horse-1-1', 'happy-horse-1-0'],
    aliases: [
      'happyhorse',
      'happy-horse',
      'happyhorse-1-1',
      'happy-horse-1.1',
      'alibaba-happy-horse',
      'happyhorse-1-0',
      'happy-horse-1.0',
    ],
    prefixes: ['happy-horse', 'happyhorse', 'alibaba/happy-horse'],
    examplesPage: {
      stage: 'indexed',
      showInNav: true,
      publishedModelSlugs: ['happy-horse-1-1', 'happy-horse-1-0'],
      currentModelSlugs: ['happy-horse-1-1'],
    },
```

- [ ] **Step 5: Update brand and policy tests**

In `tests/brand-partners.test.ts`, assert:

```ts
  assert.equal(getPartnerByEngineId('happy-horse-1-1')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('alibaba/happy-horse/v1.1/reference-to-video')?.id, 'alibaba');
  assert.equal(getPartnerByEngineId('happy-horse-1-0')?.id, 'alibaba');
```

In `tests/fal-model-policy.test.ts`, add:

```ts
test('fal proxy policy allows Happy Horse 1.1 endpoints', () => {
  [
    'alibaba/happy-horse/v1.1/text-to-video',
    'alibaba/happy-horse/v1.1/image-to-video',
    'alibaba/happy-horse/v1.1/reference-to-video',
  ].forEach((endpoint) => {
    assert.ok(FAL_PROXY_ALLOWED_ENDPOINTS.includes(endpoint));
    assert.equal(isFalProxyTargetAllowed(`https://queue.fal.run/${endpoint}`), true);
  });
});
```

- [ ] **Step 6: Run focused alias/policy tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/brand-partners.test.ts \
  tests/fal-model-policy.test.ts \
  tests/seo-phase2a.test.ts
```

Expected: pass.

---

### Task 5: Request Validation And Pricing

**Files:**
- Modify: `tests/validate-request.test.ts`
- Modify: `tests/pricing-definition.test.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/src/config/engineCatalog.overrides.ts`

- [ ] **Step 1: Add 1.1 validation coverage**

In `tests/validate-request.test.ts`, keep the existing 1.0 V2V test and add a new 1.1 test:

```ts
test('Happy Horse 1.1 validates text, image, and reference workflow inputs', () => {
  const textValid = validateRequest('happy-horse-1-1', 't2v', {
    prompt: 'Native audio presenter in a modern studio',
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '21:9',
    seed: 12345,
    enable_safety_checker: true,
  });
  assert.deepEqual(textValid, OK);

  const imageValid = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
  });
  assert.deepEqual(imageValid, OK);

  const imageAspectInvalid = validateRequest('happy-horse-1-1', 'i2v', {
    image_url: 'https://example.com/start.png',
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(imageAspectInvalid.ok, false);
  assert.equal(imageAspectInvalid.error?.field, 'aspect_ratio');

  const r2vValid = validateRequest('happy-horse-1-1', 'ref2v', {
    prompt: 'Use character1 and character2 in a short product demo',
    image_urls: ['https://example.com/ref-1.png', 'https://example.com/ref-2.png'],
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '5:4',
  });
  assert.deepEqual(r2vValid, OK);

  const unsupportedV2v = validateRequest('happy-horse-1-1', 'v2v', {
    video_url: 'https://example.com/source.mp4',
    prompt: 'Warm studio relight',
    resolution: '1080p',
  });
  assert.equal(unsupportedV2v.ok, false);
});
```

- [ ] **Step 2: Update 1.1 pricing tests**

In `tests/pricing-definition.test.ts`, add:

```ts
test('Happy Horse 1.1 pricing definition uses current Fal 1080p rate', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-1')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);

  assert.ok(definition);
  assert.equal(definition.baseUnitPriceCents, 14);
  assert.equal(definition.resolutionMultipliers['720p'], 1);
  assert.equal(definition.resolutionMultipliers['1080p'], 18 / 14);
  assert.equal(definition.durationSteps.min, 3);
  assert.equal(definition.durationSteps.max, 15);
});

test('Happy Horse 1.1 displayed quotes include MaxVideoAI margin', async () => {
  const engine = listFalEngines().find((entry) => entry.id === 'happy-horse-1-1')?.engine;
  assert.ok(engine);

  const snapshot = await computePricingSnapshot({
    engine,
    durationSec: 5,
    resolution: '1080p',
    mode: 't2v',
    membershipTier: 'member',
  });

  assert.equal(snapshot.base.amountCents, 90);
  assert.equal(snapshot.margin.amountCents, 27);
  assert.equal(snapshot.totalCents, 117);
});
```

Keep the existing 1.0 V2V double-rate test.

- [ ] **Step 3: Update pricing display order**

In `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`, replace `happy-horse-1-0` with `happy-horse-1-1` in `PRICING_DISPLAY_MODEL_ORDER`, then add `happy-horse-1-0` after the current route or allow it to fall into legacy ordering:

```ts
  'happy-horse-1-1',
  'happy-horse-1-0',
```

Because 1.0 has `isLegacy: true`, it will render in the legacy pricing group.

- [ ] **Step 4: Add catalog best-for override**

In `frontend/src/config/engineCatalog.overrides.ts`, add:

```ts
    'happy-horse-1-1': {
      bestFor: 'Alibaba native-audio text, image, and reference video',
      features: {
        lipsync: { value: true },
      },
    },
    'happy-horse-1-0': {
      bestFor: 'Legacy Happy Horse video-edit coverage',
      features: {
        lipsync: { value: true },
      },
    },
```

- [ ] **Step 5: Run validation/pricing tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/validate-request.test.ts \
  tests/pricing-definition.test.ts \
  tests/pricing-page-architecture.test.ts
```

Expected: pass after all pinned Happy Horse expectations are moved to 1.1 or explicitly marked legacy.

---

### Task 6: Model Page Template, Localized Copy, And Content JSON

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/happy-horse-1-1.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts`
- Create: `content/models/en/happy-horse-1-1.json`
- Create: `content/models/fr/happy-horse-1-1.json`
- Create: `content/models/es/happy-horse-1-1.json`
- Modify: `content/models/en/happy-horse-1-0.json`
- Modify: `content/models/fr/happy-horse-1-0.json`
- Modify: `content/models/es/happy-horse-1-0.json`
- Test: `tests/model-page-template-registry.test.ts`
- Test: `tests/model-page-template-content.test.ts`
- Test: `tests/model-page-decision-data.test.ts`
- Test: `tests/premerge-seo-routes.test.ts`

- [ ] **Step 1: Create the 1.1 template config**

Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/happy-horse-1-1.ts`:

```ts
import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const happyHorse11TemplateConfig: ModelPageTemplateConfig = {
  slug: 'happy-horse-1-1',
  intent: 'production',
  hero: {
    eyebrow: 'ALIBABA NATIVE-AUDIO VIDEO MODEL',
    subtitleHighlightTerms: ['native audio', 'image-to-video', 'reference-to-video'],
    primaryCtaHref: '/app?engine=happy-horse-1-1',
    secondaryCtaHref: '/examples/happy-horse',
    quickLinks: [
      {
        labelKey: 'compareSeedance',
        href: '/ai-video-engines/happy-horse-1-1-vs-seedance-2-0',
        icon: 'compare',
      },
      {
        labelKey: 'viewPricing',
        href: '/pricing#happy-horse-1-1-pricing',
        icon: 'pricing',
      },
      {
        labelKey: 'promptExamples',
        href: '#prompting',
        icon: 'prompt',
      },
    ],
  },
  pricing: {
    anchorHref: '/pricing#happy-horse-1-1-pricing',
    presets: [
      { id: '5s-720p-audio', seconds: 5, resolution: '720p', audio: true, labelKey: 'nativeAudioWorkflow' },
      { id: '10s-720p-audio', seconds: 10, resolution: '720p', audio: true, labelKey: 'commonProductionCheck' },
      {
        id: '15s-1080p-audio',
        seconds: 15,
        resolution: '1080p',
        audio: true,
        labelKey: 'finalDelivery',
        highlightKey: 'mostPopular',
      },
      { id: 'max-duration', fixedValueKey: 'maxDurationValue', labelKey: 'maxDuration', noteKey: 'upTo1080p' },
    ],
  },
  sections: {
    examples: true,
    prompting: true,
    tips: true,
    compare: true,
    specs: true,
    safety: true,
    faq: true,
  },
};
```

- [ ] **Step 2: Register the template**

In `model-page-template-registry.ts`, import and add:

```ts
import { happyHorse11TemplateConfig } from './model-page-templates/happy-horse-1-1';
```

and:

```ts
  [happyHorse11TemplateConfig.slug]: happyHorse11TemplateConfig,
```

- [ ] **Step 3: Add localized 1.1 copy**

In `model-page-template-copy-additional.ts`, add `HAPPY_HORSE_11_COPY` with the same shape as `HAPPY_HORSE_10_COPY`. Use these visible copy anchors:

```ts
const HAPPY_HORSE_11_COPY: LocalizedTemplateCopy = {
  en: {
    hero: {
      eyebrow: 'CURRENT ALIBABA VIDEO MODEL',
      title: 'Happy Horse 1.1',
      subtitle: 'Native audio, lip-sync, image-to-video and reference-to-video in one current Alibaba route.',
      subtitleHighlights: ['Native audio', 'image-to-video', 'reference-to-video'],
      paragraph:
        'Use Happy Horse 1.1 when a shot needs synchronized speech or sound from text, a starting image, or up to nine reference images. Keep Happy Horse 1.0 for legacy video-edit jobs.',
      primaryCta: { label: 'Generate with Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'View examples', href: examplesHref('en', 'happy-horse') },
      quickLinks: [
        { label: 'Compare vs Seedance', href: compareHref('en', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'View pricing', href: pricingHref('en', 'happy-horse-1-1-pricing') },
        { label: 'Prompt examples', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Happy Horse 1.1 example',
      description: 'Native-audio text, image and reference video route',
      renderLabel: 'View render',
      badges: ['Native audio', 'Reference video', '1080p'],
      altContext: 'Happy Horse 1.1 native audio reference-guided video example',
    },
    features: [
      { title: 'Native audio', body: 'Generate dialogue, ambience and SFX with the render when the route supports it.', tone: 'audio' },
      { title: 'Text or image', body: 'Start from a scene brief or a still image to lock subject and composition.', tone: 'reference' },
      { title: 'Reference images', body: 'Use up to nine references with character1 through character9 prompt anchors.', tone: 'continuity' },
      { title: 'Expanded ratios', body: 'Use landscape, vertical, square, classic, wide, tall, 5:4 or 4:5 composition.', tone: 'quality' },
      { title: '720p or 1080p', body: 'Choose the exposed MaxVideoAI resolution before generation.', tone: 'quality' },
      { title: 'Lower 1080p provider rate', body: 'Happy Horse 1.1 uses the current Fal 1080p rate before MaxVideoAI margin.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Happy Horse 1.1 or Seedance?',
        body: 'Use Happy Horse 1.1 for Alibaba native-audio text, image and reference generation. Use Seedance 2.0 when multimodal references, longer production continuity and current Seedance behavior are the priority.',
        cta: { label: 'Compare Happy Horse vs Seedance', href: compareHref('en', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: 'Need video edit?',
        body: 'Use Happy Horse 1.0 only when you specifically need the legacy video-edit endpoint. New text, image and reference jobs should start on 1.1.',
        cta: { label: 'Open legacy Happy Horse 1.0', href: '/models/happy-horse-1-0' },
      },
      {
        title: 'Working from references?',
        body: 'Assign each file one job: identity, wardrobe, movement, environment or audio mood.',
        cta: { label: 'Open Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Write the subject, action, camera, style and audio beats in a compact brief.' },
      { title: 'Image-to-video', body: 'Use a still image to anchor subject, product, wardrobe or composition.' },
      { title: 'Reference-to-video', body: 'Name each reference as character1, character2 and onward to keep roles clear.' },
      { title: 'Legacy video edit', body: 'Switch to Happy Horse 1.0 only when a source video must be edited rather than regenerated.' },
      { title: 'Audio handling', body: 'Keep dialogue short and tie SFX to visible actions for cleaner synchronized output.' },
    ],
    pricingCopy: {
      title: 'Happy Horse 1.1 pricing at a glance',
      subtitle: 'Preset native-audio totals - see the exact live price in the app before you generate.',
      footnote: 'All prices are MaxVideoAI display prices in USD credits for preset scenarios.',
      ctaLabel: 'View full pricing',
      maxDurationNote: 'Up to 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1: Pricing, Native Audio & Reference Video | MaxVideoAI',
      description:
        'Explore Happy Horse 1.1 pricing, native audio, lip-sync, text-to-video, image-to-video and reference-to-video workflows on MaxVideoAI.',
    },
  },
  fr: {
    hero: {
      eyebrow: 'MODÈLE VIDÉO ALIBABA ACTUEL',
      title: 'Happy Horse 1.1',
      subtitle: 'Audio natif, lip-sync, image-to-video et reference-to-video dans une route Alibaba actuelle.',
      subtitleHighlights: ['Audio natif', 'image-to-video', 'reference-to-video'],
      paragraph:
        'Utilisez Happy Horse 1.1 quand un plan doit générer voix ou son synchronisé depuis un texte, une image de départ ou jusqu’à neuf références. Gardez Happy Horse 1.0 pour les montages vidéo legacy.',
      primaryCta: { label: 'Générer avec Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'Voir les exemples', href: examplesHref('fr', 'happy-horse') },
      quickLinks: [
        { label: 'Comparer vs Seedance', href: compareHref('fr', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'Voir les tarifs', href: pricingHref('fr', 'happy-horse-1-1-pricing') },
        { label: 'Exemples de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Exemple Happy Horse 1.1',
      description: 'Route texte, image et références avec audio natif',
      renderLabel: 'Voir le rendu',
      badges: ['Audio natif', 'Références', '1080p'],
      altContext: 'exemple vidéo Happy Horse 1.1 avec audio natif et références',
    },
    features: [
      { title: 'Audio natif', body: 'Générez dialogue, ambiance et SFX avec le rendu quand la route le permet.', tone: 'audio' },
      { title: 'Texte ou image', body: 'Partez d’un brief ou d’une image pour verrouiller sujet et composition.', tone: 'reference' },
      { title: 'Images de référence', body: 'Utilisez jusqu’à neuf références avec les ancres character1 à character9.', tone: 'continuity' },
      { title: 'Ratios élargis', body: 'Utilisez paysage, vertical, carré, classique, large, tall, 5:4 ou 4:5.', tone: 'quality' },
      { title: '720p ou 1080p', body: 'Choisissez la résolution exposée dans MaxVideoAI avant génération.', tone: 'quality' },
      { title: '1080p fournisseur moins cher', body: 'Happy Horse 1.1 utilise le tarif Fal 1080p actuel avant marge MaxVideoAI.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: 'Happy Horse 1.1 ou Seedance ?',
        body: 'Choisissez Happy Horse 1.1 pour les générations Alibaba avec audio natif depuis texte, image ou références. Choisissez Seedance 2.0 pour des références multimodales et une continuité de production Seedance actuelle.',
        cta: { label: 'Comparer Happy Horse vs Seedance', href: compareHref('fr', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: 'Besoin de montage vidéo ?',
        body: 'Utilisez Happy Horse 1.0 seulement si vous avez besoin de l’endpoint video-edit legacy. Les nouveaux jobs texte, image et référence doivent partir de 1.1.',
        cta: { label: 'Ouvrir Happy Horse 1.0 legacy', href: '/fr/modeles/happy-horse-1-0' },
      },
      {
        title: 'Travail avec références ?',
        body: 'Donnez un rôle clair à chaque fichier : identité, tenue, mouvement, environnement ou humeur audio.',
        cta: { label: 'Ouvrir le Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Text-to-video', body: 'Structurez sujet, action, caméra, style et beats audio dans un brief court.' },
      { title: 'Image-to-video', body: 'Utilisez une image pour ancrer sujet, produit, tenue ou composition.' },
      { title: 'Reference-to-video', body: 'Nommez chaque référence character1, character2 et ainsi de suite pour clarifier les rôles.' },
      { title: 'Montage vidéo legacy', body: 'Passez à Happy Horse 1.0 uniquement quand une vidéo source doit être éditée plutôt que régénérée.' },
      { title: 'Gestion audio', body: 'Gardez les dialogues courts et liez les SFX aux actions visibles.' },
    ],
    pricingCopy: {
      title: 'Prix Happy Horse 1.1 en un coup d’œil',
      subtitle: 'Prix totaux avec audio natif — prix exact affiché dans l’app avant génération.',
      footnote: 'Tous les prix sont des prix affichés MaxVideoAI en crédits USD pour des scénarios prédéfinis.',
      ctaLabel: 'Voir tous les tarifs',
      maxDurationNote: 'Jusqu’à 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1 : tarifs, audio natif et références | MaxVideoAI',
      description:
        'Explorez Happy Horse 1.1 : prix, audio natif, lip-sync, text-to-video, image-to-video et reference-to-video sur MaxVideoAI.',
    },
  },
  es: {
    hero: {
      eyebrow: 'MODELO DE VIDEO ALIBABA ACTUAL',
      title: 'Happy Horse 1.1',
      subtitle: 'Audio nativo, lip-sync, imagen a video y referencia a video en una ruta actual de Alibaba.',
      subtitleHighlights: ['Audio nativo', 'imagen a video', 'referencia a video'],
      paragraph:
        'Usa Happy Horse 1.1 cuando un plano necesita voz o sonido sincronizado desde texto, una imagen inicial o hasta nueve referencias. Mantén Happy Horse 1.0 para edición de video legacy.',
      primaryCta: { label: 'Generar con Happy Horse 1.1', href: '/app?engine=happy-horse-1-1' },
      secondaryCta: { label: 'Ver ejemplos', href: examplesHref('es', 'happy-horse') },
      quickLinks: [
        { label: 'Comparar vs Seedance', href: compareHref('es', 'happy-horse-1-1', 'seedance-2-0') },
        { label: 'Ver precios', href: pricingHref('es', 'happy-horse-1-1-pricing') },
        { label: 'Ejemplos de prompts', href: '#prompting' },
      ],
    },
    media: {
      caption: 'Ejemplo Happy Horse 1.1',
      description: 'Ruta de texto, imagen y referencias con audio nativo',
      renderLabel: 'Ver resultado',
      badges: ['Audio nativo', 'Referencias', '1080p'],
      altContext: 'ejemplo de Happy Horse 1.1 con audio nativo y referencias',
    },
    features: [
      { title: 'Audio nativo', body: 'Genera diálogo, ambiente y SFX con el render cuando la ruta lo permite.', tone: 'audio' },
      { title: 'Texto o imagen', body: 'Empieza con un brief o una imagen para fijar sujeto y composición.', tone: 'reference' },
      { title: 'Imágenes de referencia', body: 'Usa hasta nueve referencias con anclas character1 a character9.', tone: 'continuity' },
      { title: 'Ratios ampliados', body: 'Usa paisaje, vertical, cuadrado, clásico, ancho, tall, 5:4 o 4:5.', tone: 'quality' },
      { title: '720p o 1080p', body: 'Elige la resolución disponible en MaxVideoAI antes de generar.', tone: 'quality' },
      { title: '1080p proveedor más barato', body: 'Happy Horse 1.1 usa la tarifa Fal 1080p actual antes del margen MaxVideoAI.', tone: 'price' },
    ],
    decisionCards: [
      {
        title: '¿Happy Horse 1.1 o Seedance?',
        body: 'Usa Happy Horse 1.1 para generación Alibaba con audio nativo desde texto, imagen o referencias. Usa Seedance 2.0 para referencias multimodales y continuidad actual de producción Seedance.',
        cta: { label: 'Comparar Happy Horse vs Seedance', href: compareHref('es', 'happy-horse-1-1', 'seedance-2-0') },
      },
      {
        title: '¿Necesitas edición de video?',
        body: 'Usa Happy Horse 1.0 solo si necesitas el endpoint video-edit legacy. Los nuevos trabajos de texto, imagen y referencia deben empezar en 1.1.',
        cta: { label: 'Abrir Happy Horse 1.0 legacy', href: '/es/modelos/happy-horse-1-0' },
      },
      {
        title: '¿Trabajas con referencias?',
        body: 'Dale una función clara a cada archivo: identidad, vestuario, movimiento, entorno o mood de audio.',
        cta: { label: 'Abrir Prompt Lab', href: '#prompting' },
      },
    ],
    referenceWorkflows: [
      { title: 'Texto a video', body: 'Define sujeto, acción, cámara, estilo y beats de audio en un brief compacto.' },
      { title: 'Imagen a video', body: 'Usa una imagen para fijar sujeto, producto, vestuario o composición.' },
      { title: 'Referencia a video', body: 'Nombra cada referencia como character1, character2 y así sucesivamente para aclarar roles.' },
      { title: 'Edición de video legacy', body: 'Cambia a Happy Horse 1.0 solo cuando una fuente de video deba editarse en lugar de regenerarse.' },
      { title: 'Manejo de audio', body: 'Mantén diálogo corto y conecta SFX con acciones visibles.' },
    ],
    pricingCopy: {
      title: 'Precios de Happy Horse 1.1 de un vistazo',
      subtitle: 'Totales con audio nativo. Consulta el precio exacto en la app antes de generar.',
      footnote: 'Todos los precios son precios mostrados por MaxVideoAI en créditos USD para escenarios predefinidos.',
      ctaLabel: 'Ver precios completos',
      maxDurationNote: 'Hasta 1080p',
    },
    meta: {
      title: 'Happy Horse 1.1: precios, audio nativo y referencias | MaxVideoAI',
      description:
        'Explora Happy Horse 1.1: precios, audio nativo, lip-sync, texto a video, imagen a video y referencia a video en MaxVideoAI.',
    },
  },
};
```

At the bottom registry object in this file, add:

```ts
  'happy-horse-1-1': HAPPY_HORSE_11_COPY,
```

- [ ] **Step 4: Convert the 1.0 copy to legacy positioning**

In `HAPPY_HORSE_10_COPY`, update title/subtitle/paragraph/CTA strings so visible copy explicitly says 1.0 is the legacy video-edit path and points primary CTA to `/app?engine=happy-horse-1-0`. Keep 1.0 comparison links available but make the main next-step card point to `/models/happy-horse-1-1`.

- [ ] **Step 5: Create localized content JSON for 1.1**

Copy the structure from `content/models/en/happy-horse-1-0.json` into `content/models/en/happy-horse-1-1.json`, then update:

```json
{
  "marketingName": "Happy Horse 1.1",
  "versionLabel": "1.1",
  "seo": {
    "title": "Happy Horse 1.1 | Native Audio AI Video Model | MaxVideoAI",
    "description": "Use Happy Horse 1.1 on MaxVideoAI for text-to-video, image-to-video, reference-to-video, native audio, and lip-sync.",
    "image": "/assets/models/models-hero-horses-reference.webp"
  }
}
```

Ensure every 1.1 JSON:

- Uses `/app?engine=happy-horse-1-1`.
- Uses `/ai-video-engines/happy-horse-1-1-vs-seedance-2-0` and `/ai-video-engines/happy-horse-1-1-vs-veo-3-1`.
- Says 1.1 has text, image, and reference-to-video.
- Says video edit remains on legacy 1.0.
- Keeps best-use-case hrefs localized exactly like the existing 1.0 files.

- [ ] **Step 6: Update 1.0 content JSON to legacy**

In the three existing 1.0 JSON files, change user-visible current-model claims:

- English: use phrases `legacy Happy Horse 1.0 video-edit route` and `Use Happy Horse 1.1 for new text, image and reference generations.`
- French: use phrases `route Happy Horse 1.0 legacy pour l’édition vidéo` and `Utilisez Happy Horse 1.1 pour les nouvelles générations texte, image et référence.`
- Spanish: use phrases `ruta Happy Horse 1.0 legacy para edición de video` and `Usa Happy Horse 1.1 para nuevas generaciones de texto, imagen y referencia.`

- [ ] **Step 7: Run model page tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-template-registry.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/premerge-seo-routes.test.ts
```

Expected: pass after expected slugs/titles are updated from 1.0 current to 1.1 current.

---

### Task 7: Comparisons, Scores, Specs, And Best-For Surfaces

**Files:**
- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-value-copy.ts`
- Test: `tests/pricing-definition.test.ts`
- Test: `tests/luma-agents-marketing-surfaces.test.ts`
- Test: compare/model catalog tests that reference Happy Horse

- [ ] **Step 1: Add Happy Horse 1.1 benchmark score**

In `data/benchmarks/engine-scores.v1.json`, add a new score entry:

```json
{
  "modelSlug": "happy-horse-1-1",
  "fidelity": 8.4,
  "visualQuality": 8.3,
  "motion": 8.3,
  "consistency": 8.2,
  "anatomy": 8.2,
  "textRendering": 7.0,
  "lipsyncQuality": 9.0,
  "sequencingQuality": 7.8,
  "controllability": 8.3,
  "speedStability": 6.8,
  "pricing": 8.1,
  "last_updated": "2026-06-22"
}
```

Keep the existing 1.0 score unchanged, except set its `last_updated` only if the implementation deliberately edits the row.

- [ ] **Step 2: Add Happy Horse 1.1 key specs**

In `data/benchmarks/engine-key-specs.v1.json`, add:

```json
{
  "modelSlug": "happy-horse-1-1",
  "sources": [
    "https://fal.ai/models/alibaba/happy-horse/v1.1/text-to-video/api",
    "https://fal.ai/models/alibaba/happy-horse/v1.1/image-to-video/api",
    "https://fal.ai/models/alibaba/happy-horse/v1.1/reference-to-video/api",
    "https://fal.ai/models/alibaba/happy-horse/v1.1/text-to-video",
    "https://fal.ai/models/alibaba/happy-horse/v1.1/image-to-video",
    "https://fal.ai/models/alibaba/happy-horse/v1.1/reference-to-video"
  ],
  "keySpecs": {
    "textToVideo": "Supported",
    "imageToVideo": "Supported",
    "videoToVideo": "Not supported in current Happy Horse 1.1 Fal route",
    "firstLastFrame": "Not supported",
    "referenceImageStyle": "Supported (1-9 reference stills)",
    "referenceVideo": "Not supported in current Happy Horse 1.1 Fal route",
    "maxResolution": "1080p",
    "maxDuration": "15s output",
    "aspectRatios": ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21", "5:4", "4:5"],
    "fpsOptions": ["24 fps"],
    "outputFormats": ["MP4"],
    "audioOutput": "Supported",
    "nativeAudioGeneration": "Supported",
    "lipSync": "Supported",
    "cameraMotionControls": "Basic",
    "watermark": "No (MaxVideoAI)"
  }
}
```

Keep the 1.0 specs and make sure they explicitly mention `video edit` as legacy, not current 1.1.

- [ ] **Step 3: Move published comparison links to 1.1**

In `frontend/config/compare-hub.json`, replace current-product Happy Horse pairs with 1.1:

```json
{ "left": "happy-horse-1-1", "right": "seedance-2-0", "tags": ["audio", "unified", "quality"] }
```

Do this for Seedance, Veo, Kling, and Sora popular/use-case pairs. Add one migration/legacy pair:

```json
{ "left": "happy-horse-1-1", "right": "happy-horse-1-0", "tags": ["current", "legacy", "video-edit"] }
```

Update `opponentOverrides`:

```json
"happy-horse-1-1": ["seedance-2-0", "veo-3-1", "kling-3-pro", "sora-2-pro", "happy-horse-1-0"],
"happy-horse-1-0": ["happy-horse-1-1", "seedance-2-0", "veo-3-1"]
```

- [ ] **Step 4: Update `compare-config.json` references**

Replace Happy Horse current comparisons in top-picks and related comparisons:

- `happy-horse-1-0-vs-seedance-2-0` becomes `happy-horse-1-1-vs-seedance-2-0`.
- `happy-horse-1-0-vs-veo-3-1` becomes `happy-horse-1-1-vs-veo-3-1`.
- `happy-horse-1-0-vs-kling-3-pro` becomes `happy-horse-1-1-vs-kling-3-pro`.
- `happy-horse-1-0-vs-sora-2-pro` becomes `happy-horse-1-1-vs-sora-2-pro`.

Do not add entries under `showdowns` for these new pairs. That keeps comparison pages free of curated comparison videos.

- [ ] **Step 5: Update best-for and model catalog pins**

Replace current `happy-horse-1-0` pins with `happy-horse-1-1` in:

```text
frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-related.ts
frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts
frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts
frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-value-copy.ts
```

Keep 1.0 visible only where the copy is explicitly about legacy video edit.

- [ ] **Step 6: Run benchmark/compare tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-definition.test.ts \
  tests/luma-agents-marketing-surfaces.test.ts \
  tests/models-catalog-architecture.test.ts \
  tests/models-gallery-architecture.test.ts \
  tests/compare-page-architecture.test.ts
```

Expected: pass after updating expected Happy Horse slug lists.

---

### Task 8: Homepage, Examples, SEO Copy, And Public Rosters

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/constants.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/comparisons.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples.ts`
- Modify: `frontend/lib/examples/modelLandingData*.ts` if pinned Happy Horse model slugs exist there
- Modify: `frontend/config/model-slugs.json`
- Regenerate: `frontend/config/engine-catalog.json`
- Regenerate: `frontend/config/model-roster.json`
- Regenerate: `docs/model-roster.json`
- Regenerate: `docs/model-roster.csv`
- Test: `tests/homepage-real-examples-preview.test.ts`
- Test: `tests/seo-phase2a.test.ts`
- Test: `tests/seo-internal-links.test.ts`

- [ ] **Step 1: Update homepage constants**

In `home-route-data/constants.ts`, replace current Happy Horse pins:

```ts
'happy-horse-1-1'
```

Update labels:

```ts
'happy-horse-1-1': { name: 'Happy Horse 1.1', exampleFamily: 'happy-horse', modelSlug: 'happy-horse-1-1', mode: 'ref2v' }
```

Keep alias:

```ts
'happy-horse': 'happy-horse-1-1'
```

- [ ] **Step 2: Update examples family copy where needed**

Search:

```bash
rg -n "happy-horse-1-0|Happy Horse 1\\.0" frontend/lib/examples frontend/app/\\(localized\\)/\\[locale\\]/\\(marketing\\)/\\(home\\)
```

For generic/current Happy Horse references, update to 1.1. For old V2V/video-edit examples, leave 1.0 and add `legacy` to the visible copy.

- [ ] **Step 3: Update slug map**

In `frontend/config/model-slugs.json`, add:

```json
  "happy-horse-1-1": "happy-horse-1-1"
```

Keep:

```json
  "happy-horse-1-0": "happy-horse-1-0"
```

- [ ] **Step 4: Regenerate catalog and roster**

Run:

```bash
npm run engine:catalog
npm run model:generate:write
npm run models:audit
```

Expected:

```text
Generated engine catalog with ...
[model-roster] Wrote ... entries ...
[models:audit] Passed ...
```

The exact entry count will increase by one unless a surface rule hides a model page.

- [ ] **Step 5: Run homepage/SEO tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/homepage-real-examples-preview.test.ts \
  tests/seo-phase2a.test.ts \
  tests/seo-internal-links.test.ts \
  tests/video-pages-sitemap.test.ts \
  tests/model-seo-signals.test.ts
```

Expected: pass.

---

### Task 9: Model Page Video Generation Plan

**Files before generation:**
- Create: `docs/model-launch/happy-horse-1-1-video-generation.md`

**Files after generation:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`
- Optional: update `content/models/*/happy-horse-1-1.json` gallery text if the generated videos reveal a stronger use-case angle.

This task spends generation credits and must not run until the user approves the exact route, settings, prompts, and estimated cost.

- [ ] **Step 1: Create the generation brief**

Create `docs/model-launch/happy-horse-1-1-video-generation.md` with:

```md
# Happy Horse 1.1 Model Page Video Generation

## Route

- Engine: `happy-horse-1-1`
- Workflow A: `t2v`
- Workflow B: `ref2v`
- Duration: `10`
- Resolution: `1080p`
- Aspect ratio: `16:9`
- Native audio: on by model behavior
- Estimated provider cost: `$0.18/s * 10s = $1.80` per generation before MaxVideoAI margin
- Initial batch: 1 variant per workflow, 2 total generations
- Stop-loss: stop after 2 rejected attempts per workflow and rewrite prompt

## Hero Prompt

Medium shot of a calm product creator at a sleek desk in a warm modern studio, a small AI video dashboard softly glowing behind them. 0-5s: they look into camera and say clearly, "This is Happy Horse one point one on MaxVideoAI." 5-10s: they gesture toward the screen as a polished reference video preview plays, "Text, image, and references move with native audio in one pass." Natural lip-sync, soft room tone, subtle interface ambience, warm key light, slow camera push, crisp 1080p broadcast quality.

## Demo Prompt

Use character1 as the presenter identity and character2 as the product-style reference. A cinematic 10-second studio demo: the presenter lifts a small transparent display showing a generated video frame, then turns to camera and says, "Start with a prompt, an image, or a reference set." Smooth camera slide, stable face, consistent wardrobe, polished warm lighting, synchronized speech, clean room tone, no readable UI text.

## Reference Plan For Demo

- `character1`: generated presenter portrait, neutral wardrobe, front-facing, clean studio light.
- `character2`: generated style/product reference frame, warm MaxVideoAI studio desk, no logo or readable UI text.

## Acceptance Criteria

- Speech is understandable without captions.
- Lip-sync is good enough for model-page marketing.
- No exact MaxVideoAI logo or readable UI text is generated in-model.
- Subject identity remains stable for the full clip.
- Output is 16:9 and suitable for the model page hero/demo slots.
- If a clip fails on lip-sync twice, rewrite to shorter dialogue before rerolling.
```

- [ ] **Step 2: Get explicit generation approval**

Before running any generation, show the user this exact approval block:

```text
Route: happy-horse-1-1
Workflow: 1 text-to-video + 1 reference-to-video
Settings: 10s, 16:9, 1080p, native audio, safety checker on
Prompt version: docs/model-launch/happy-horse-1-1-video-generation.md
Reference count: 0 for hero, 2 generated references for demo
Estimated provider cost: $3.60 before MaxVideoAI margin for the first 2 generations
Number of variants: 2 total
Main risk: lip-sync or generated UI text artifacts
Proceed?
```

Do not generate until the user explicitly approves the spend.

- [ ] **Step 3: Generate references for the demo only if needed**

If the ref2v workflow needs source images, create two neutral reference stills with the existing image workflow or approved asset path. The references must avoid protected logos, exact UI, or real-person likeness.

Record local/remote reference URLs in `docs/model-launch/happy-horse-1-1-video-generation.md` under `## Generated Reference URLs`.

- [ ] **Step 4: Run the two approved video generations**

Use the app generation flow or API route already used by MaxVideoAI. Record each returned job id as:

```md
## Generated Job IDs

- Hero: `job_...`
- Demo: `job_...`
```

Use the actual returned job ids from the generation response; do not invent or reuse old ids.

- [ ] **Step 5: Wire the model page media after both videos are accepted**

In `model-page-static-media.ts`, add:

```ts
  'happy-horse-1-1': {
    hero: 'ACTUAL_ACCEPTED_HERO_JOB_ID_FROM_GENERATION_LOG',
    demo: 'ACTUAL_ACCEPTED_DEMO_JOB_ID_FROM_GENERATION_LOG',
  },
```

Replace the two uppercase tokens with the exact generated job ids recorded in the previous step. Do not add any Happy Horse 1.1 entries to `frontend/config/compare-config.json` `showdowns`.

- [ ] **Step 6: Run model media tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/model-page-static-architecture.test.ts \
  tests/model-page-template-content.test.ts \
  tests/homepage-real-examples-preview.test.ts
```

Expected: pass. If the tests inspect media existence through database-backed jobs, run them with the same environment used for existing model-page video tests.

---

### Task 10: Full Verification And Smoke Checks

**Files:**
- All changed files

- [ ] **Step 1: Run focused project tests**

Run:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/fal-engine-catalog-architecture.test.ts \
  tests/validate-request.test.ts \
  tests/generate-fal-request.test.ts \
  tests/fal-model-policy.test.ts \
  tests/generate-attachment-references.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/seedance-prelaunch.test.ts \
  tests/pricing-definition.test.ts \
  tests/brand-partners.test.ts \
  tests/model-page-template-registry.test.ts \
  tests/model-page-template-content.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/premerge-seo-routes.test.ts \
  tests/homepage-real-examples-preview.test.ts \
  tests/compare-page-architecture.test.ts \
  tests/models-catalog-architecture.test.ts \
  tests/model-seo-signals.test.ts
```

Expected: pass.

- [ ] **Step 2: Run project checks**

Run:

```bash
npm --prefix frontend run lint
npm run lint:exposure
npm run model:check
npm run models:audit
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Smoke-test localized public routes**

Start the app:

```bash
npm --prefix frontend run dev
```

Open and inspect:

```text
http://localhost:3000/models/happy-horse-1-1
http://localhost:3000/fr/modeles/happy-horse-1-1
http://localhost:3000/es/modelos/happy-horse-1-1
http://localhost:3000/models/happy-horse-1-0
http://localhost:3000/ai-video-engines/happy-horse-1-1-vs-seedance-2-0
http://localhost:3000/pricing#happy-horse-1-1-pricing
http://localhost:3000/app?engine=happy-horse-1-1
http://localhost:3000/app?engine=happy-horse-1-0
```

Check:

- 1.1 pages show current copy and no video-edit claim.
- 1.0 pages show legacy/video-edit positioning.
- 1.1 pricing shows current 1080p rate after MaxVideoAI margin.
- Comparison page has score/spec content but no curated comparison videos.
- App 1.1 offers text, image, and reference inputs only.
- App 1.0 still offers legacy video edit.

- [ ] **Step 4: Final diff review**

Run:

```bash
git diff --stat
git diff -- frontend/src/config/fal-engines/happy-horse.ts
git diff -- data/benchmarks/engine-scores.v1.json data/benchmarks/engine-key-specs.v1.json
git status --short
```

Confirm no unrelated files were changed and no generated QA artifacts were staged.

---

## Self-Review

- Spec coverage:
  - New Alibaba/Fal 1.1 endpoints: covered in Tasks 2, 4, 5, 7.
  - Unified MaxVideoAI model over text/image/reference endpoints: covered in Tasks 2 and 3.
  - 1.0 legacy: covered in Tasks 2, 4, 5, 6, 8.
  - Marketing model pages: covered in Task 6.
  - VS scoring/comparison surfaces: covered in Task 7.
  - Pricing: covered in Task 5 and Task 10 smoke checks.
  - Two model-page videos after implementation: covered in Task 9.
  - No comparison videos: explicitly covered in Tasks 7 and 9.
  - Separate branch: this plan was created on `codex/alibaba-happy-horse-v1-1`.
- Placeholder scan:
  - The only unknown strings are generated job IDs in Task 9. They are runtime outputs from an approved generation step and must be replaced immediately after generation before the media edit is considered complete.
- Type consistency:
  - Current id is `happy-horse-1-1`.
  - Legacy id is `happy-horse-1-0`.
  - Current endpoints use `HAPPY_HORSE_1_1_ENDPOINTS`.
  - Legacy endpoints use existing `HAPPY_HORSE_ENDPOINTS`.
  - Shared helper ids live in `frontend/lib/happy-horse-workflow.ts`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-alibaba-happy-horse-v1-1.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.
