# Luma Agents Direct + Fal Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Luma Agents image and video models to MaxVideoAI with Luma direct as the primary route, fal.ai as the fallback route when Luma cannot accept a request, customer pricing based on fal reference prices plus the existing 30% margin, and complete marketing content using the current model-page structures.

**Architecture:** Keep the existing MaxVideoAI registry, pricing, provider-routing, image-generation, and marketing template architecture. Add Luma Agents as a provider-specific direct integration beside Kling Direct, Google Vertex Veo, and BytePlus Seedream, while keeping fal payloads as the fallback contract. Public launch exposes only fallback-safe options first; Luma-only advanced options are implemented behind explicit flags until a reliable fal fallback exists.

**Tech Stack:** Next.js App Router, TypeScript, Node test runner via `tsx --test`, existing `frontend/src/config/fal-engines` registry, existing `computePricingSnapshot`, existing `provider_attempts`, existing localized model-page templates and `content/models/{locale}` JSON.

---

## Source Facts To Preserve

- Luma Agents official models: `uni-1` and `uni-1-max` for images, `ray-3.2` for video. Official model guide says they share one submit/poll/download API envelope, with `image`, `image_edit`, `video`, `video_edit`, and `video_reframe` type differences. Source: [Luma Agents Models](https://docs.agents.lumalabs.ai/guides/model/).
- Luma direct API endpoint: `POST https://agents.lumalabs.ai/v1/generations`, then poll `GET /v1/generations/{id}`. Completed output URLs are presigned and expire after 1 hour, so MaxVideoAI must copy provider output to its own storage promptly. Source: [Luma video generation](https://docs.agents.lumalabs.ai/guides/videos/generation).
- Luma direct rate limits include RPM and concurrent-job limits. Both can return HTTP 429 with `Retry-After`; concurrent-job 429 has no `X-RateLimit-*` bucket headers. Source: [Luma rate limits](https://docs.agents.lumalabs.ai/guides/rate-limits/).
- Luma direct image pricing: `uni-1` text-to-image $0.0404, single-image edit $0.0434, references +$0.003 each; `uni-1-max` text-to-image $0.1000, single-image edit $0.1030, references +$0.003 each. Source: [Luma pricing](https://docs.agents.lumalabs.ai/guides/pricing/).
- Luma direct Ray 3.2 generation pricing: SDR `type: "video"` costs 5s/10s: 540p $0.1500/$0.4500, 720p $0.3000/$0.9000, 1080p $1.2000/$3.6000. HDR and EXR are 5s-only direct features. Source: [Luma pricing](https://docs.agents.lumalabs.ai/guides/pricing/).
- fal reference prices to use for customer billing:
  - `luma/agent/uni-1/v1/text-to-image`: $0.042/image. Source: [fal Uni-1 text-to-image](https://fal.ai/models/luma/agent/uni-1/v1/text-to-image).
  - `luma/agent/uni-1/v1/edit`: $0.042 + $0.003 per source/reference image; a single-image edit is $0.045. Source: [fal Uni-1 edit](https://fal.ai/models/luma/agent/uni-1/v1/edit).
  - `luma/agent/uni-1/v1/max`: $0.102/image. Source: [fal Uni-1 Max](https://fal.ai/models/luma/agent/uni-1/v1/max).
  - `luma/agent/uni-1/v1/max/edit`: $0.102 + $0.003 per source/reference image; a single-image edit is $0.105. Source: [fal Uni-1 Max edit](https://fal.ai/models/luma/agent/uni-1/v1/max/edit).
  - `luma/agent/ray/v3.2/image-to-video`: 5s costs $0.50/$1/$2 for 540p/720p/1080p; 10s costs $1/$2/$4. Use the same reference table for Ray 3.2 text-to-video because the fal gallery exposes the same visible pricing for Ray 3.2 generation routes. Source: [fal Ray 3.2 image-to-video](https://fal.ai/models/luma/agent/ray/v3.2/image-to-video).

## Product Decisions

1. **Primary provider:** Luma direct is primary when enabled and request shape is direct-supported.
2. **Fallback provider:** fal.ai is used when Luma direct fails before provider acceptance because of rate limit, concurrency limit, transient 5xx, timeout, or missing direct capability under a fallback-safe mode.
3. **No fallback after Luma acceptance:** once Luma returns an accepted generation id, the app tracks that Luma job. If the accepted job later fails terminally, refund/fail through the normal provider polling flow instead of launching a second fal job. This avoids duplicate renders, double wallet consumption, and confusing outputs.
4. **Customer pricing:** customer-facing pricing remains based on fal reference prices plus the existing 30% pricing rule. Do not lower the customer price when Luma direct is cheaper; the direct route creates extra internal margin.
5. **Public launch scope:** launch public Luma Agents models only where fal fallback exists:
   - `luma-uni-1`: image `t2i` and `i2i`.
   - `luma-uni-1-max`: image `t2i` and `i2i`.
   - `luma-ray-3-2`: video `t2v` and `i2v`.
6. **Advanced Luma-only scope:** implement Ray 3.2 direct payload support for `video_edit`, `video_reframe`, HDR, EXR, and single-keyframe extend behind `LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED`. Keep these admin/labs-only until fal exposes matching fallback routes or we explicitly accept no fallback for those advanced options.
7. **No image VS pages:** exclude `luma-uni-1` and `luma-uni-1-max` from model comparison surfaces. They can appear on image model pages, pricing, examples, prep workflows, and catalog discovery, but no public image-vs-image pages.
8. **Video comparisons:** Ray 3.2 may participate in video comparisons only. Keep it conservative: compare against Ray 2, Seedance 2.0, Kling 3 Pro, and Veo 3.1 where existing compare structures support it.
9. **Marketing structure:** use current model-page template configs, localized copy, pricing scenarios, specs, content JSON, examples family resolver, sitemap and catalog structures. Do not create a new marketing framework.
10. **Scoring:** add conservative manual scores. Ray 3.2 should not outrank Seedance 2.0 or Kling 3 Pro on global motion/visual quality without MaxVideoAI internal benchmark evidence. Uni-1 scores should emphasize image reasoning and editing without claiming video capability.

## Initial Customer Price Reference

The live pricing code must compute these via pricing helpers and the 30% pricing rule, not hardcoded visible strings. These numbers are acceptance references for default member tier with no membership discount:

| Scenario | Fal reference cost | Customer subtotal before discount |
| --- | ---: | ---: |
| Uni-1 text image | $0.042 | $0.06 after cent rounding |
| Uni-1 single-image edit | $0.045 | $0.06 after cent rounding |
| Uni-1 Max text image | $0.102 | $0.14 after cent rounding |
| Uni-1 Max single-image edit | $0.105 | $0.14 after cent rounding |
| Ray 3.2 5s 540p | $0.50 | $0.65 |
| Ray 3.2 5s 720p | $1.00 | $1.30 |
| Ray 3.2 5s 1080p | $2.00 | $2.60 |
| Ray 3.2 10s 540p | $1.00 | $1.30 |
| Ray 3.2 10s 720p | $2.00 | $2.60 |
| Ray 3.2 10s 1080p | $4.00 | $5.20 |

## File Map

### New Shared Luma Agents Core

- Create `frontend/src/lib/luma-agents.ts` for engine ids, model ids, mode helpers, aspect ratios, style values, output formats, reference-count limits, and fallback-safe checks.
- Create `frontend/src/lib/luma-agents-pricing.ts` for fal-reference pricing helpers and price breakdown metadata.
- Test with `tests/luma-agents-pricing.test.ts`.

### Engine Registry

- Create `frontend/src/config/fal-engines/luma-agents-shared.ts`.
- Create `frontend/src/config/fal-engines/luma-uni-1.ts`.
- Create `frontend/src/config/fal-engines/luma-uni-1-max.ts`.
- Create `frontend/src/config/fal-engines/luma-ray-3-2.ts`.
- Modify `frontend/src/config/fal-engines/registry.ts`.
- Update generated files through existing scripts:
  - `frontend/config/engine-catalog.json`
  - `frontend/config/model-roster.json`

### Pricing

- Modify `frontend/src/lib/pricing-specialized-snapshots.ts`.
- Modify `frontend/src/lib/pricing.ts`.
- Modify `tests/pricing-definition.test.ts`.
- Add `tests/luma-agents-pricing.test.ts`.

### Video Direct Provider

- Modify `frontend/src/server/video-providers/types.ts`.
- Modify `frontend/src/server/video-providers/router.ts`.
- Create `frontend/src/server/video-providers/luma-agents/constants.ts`.
- Create `frontend/src/server/video-providers/luma-agents/model-map.ts`.
- Create `frontend/src/server/video-providers/luma-agents/client.ts`.
- Create `frontend/src/server/video-providers/luma-agents/payload.ts`.
- Create `frontend/src/server/video-providers/luma-agents/response.ts`.
- Create `frontend/src/server/video-providers/luma-agents/errors.ts`.
- Create `frontend/src/server/video-providers/luma-agents/cost.ts`.
- Create `frontend/app/api/generate/_lib/luma-agents-submission.ts`.
- Modify `frontend/app/api/generate/_lib/video-provider-submission.ts`.
- Create `frontend/server/luma-agents-poll.ts`.
- Create `frontend/app/api/cron/luma-agents-poll/route.ts`.
- Test with `tests/luma-agents-provider-routing.test.ts`, `tests/luma-agents-payload.test.ts`, `tests/luma-agents-response.test.ts`, and `tests/luma-agents-video-submission.test.ts`.

### Image Direct Provider

- Create `frontend/src/server/images/luma-agents-client.ts`.
- Create `frontend/src/server/images/luma-agents-payload.ts`.
- Create `frontend/src/server/images/luma-agents-response.ts`.
- Create `frontend/src/server/images/luma-agents-error.ts`.
- Create `frontend/src/server/images/luma-agents-execution.ts`.
- Modify `frontend/src/server/images/execute-image-generation.ts`.
- Test with `tests/luma-agents-image-payload.test.ts`, `tests/luma-agents-image-response.test.ts`, and `tests/luma-agents-image-provider.test.ts`.

### Request Validation And UI Surface

- Modify `frontend/src/lib/fal-request-body.ts` only for fal fallback mapping of new Luma fal endpoints.
- Modify `frontend/app/api/generate/_lib/request-options.ts` for Ray 3.2 duration/aspect validation if existing generic rules are insufficient.
- Modify `frontend/app/api/generate/_lib/validate-provider-constraints.ts` for Ray 3.2 public constraints.
- Modify image request helpers under `frontend/app/api/images/utils` only if the existing image field readers do not handle Luma style/output/reference fields.
- Test with `tests/generate-fal-request.test.ts`, `tests/generate-request-options.test.ts`, `tests/image-generation-server-architecture.test.ts`, and new Luma image tests.

### Marketing And SEO

- Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-ray-3-2.ts`.
- Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-uni-1.ts`.
- Create `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-uni-1-max.ts`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts` or `model-page-template-copy.ts` following the existing copy split.
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-links.ts` to add image models to `COMPARE_EXCLUDED_SLUGS`.
- Add localized JSON:
  - `content/models/en/luma-ray-3-2.json`
  - `content/models/fr/luma-ray-3-2.json`
  - `content/models/es/luma-ray-3-2.json`
  - `content/models/en/luma-uni-1.json`
  - `content/models/fr/luma-uni-1.json`
  - `content/models/es/luma-uni-1.json`
  - `content/models/en/luma-uni-1-max.json`
  - `content/models/fr/luma-uni-1-max.json`
  - `content/models/es/luma-uni-1-max.json`
- Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`.
- Modify `tests/model-page-template-registry.test.ts`.
- Modify `tests/model-page-template-content.test.ts`.
- Modify `tests/model-page-copy-architecture.test.ts` only if line-count or split rules require it.

### Scoring, Specs, Best-For, Examples

- Modify `data/benchmarks/engine-scores.v1.json`.
- Modify `data/benchmarks/engine-key-specs.v1.json`.
- Modify `frontend/config/compare-config.json` for Ray 3.2 only.
- Do not add image compare pairs for Uni-1 or Uni-1 Max.
- Add or update examples playlists only if the existing family resolver needs explicit Luma family coverage.
- Test with `tests/pricing-definition.test.ts`, `tests/model-page-template-content.test.ts`, and compare/best-for tests touched by the data changes.

### Env And Docs

- Modify `frontend/src/lib/env.ts`.
- Add docs to `docs/engineering/luma-agents-provider.md`.
- Reference new env vars in the relevant deployment/operations doc if one exists near existing provider env docs.

Required env vars:

```txt
LUMA_AGENTS_API_KEY
LUMA_AGENTS_BASE_URL=https://agents.lumalabs.ai
LUMA_AGENTS_ENABLED=false
LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=false
LUMA_AGENTS_ADMIN_ONLY=true
LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED=true
LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED=false
LUMA_AGENTS_IMAGE_DIRECT_ENABLED=false
LUMA_AGENTS_VIDEO_DIRECT_ENABLED=false
LUMA_AGENTS_SUBMIT_TIMEOUT_MS=30000
LUMA_AGENTS_POLL_INTERVAL_MS=5000
LUMA_AGENTS_VIDEO_POLL_MAX_MINUTES=35
LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS=180000
```

## Task 1: Add Luma Agents Constants And Pricing Tests

**Files:**
- Create: `frontend/src/lib/luma-agents.ts`
- Create: `frontend/src/lib/luma-agents-pricing.ts`
- Create: `tests/luma-agents-pricing.test.ts`

- [ ] **Step 1: Write pricing tests**

Add `tests/luma-agents-pricing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '../frontend/src/lib/luma-agents-pricing';

test('Luma Uni-1 fal-reference pricing uses source/reference image counts', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.042
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.045
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 3,
    }).totalUsd,
    0.054
  );
});

test('Luma Uni-1 Max fal-reference pricing keeps max tier separate', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.102
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 'i2i',
      referenceImageCount: 1,
    }).totalUsd,
    0.108
  );
});

test('Luma Ray 3.2 fal-reference pricing uses 5s and 10s totals by resolution', () => {
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '540p' }).totalUsd, 0.5);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '720p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '1080p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '540p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '720p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '1080p' }).totalUsd, 4);
});

test('Luma Ray 3.2 rejects non-public fallback-safe pricing combinations', () => {
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '9s', resolution: '720p' }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '4k' }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
});
```

- [ ] **Step 2: Run tests and verify they fail for missing modules**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-pricing.test.ts
```

Expected: FAIL with module-not-found errors for `frontend/src/lib/luma-agents-pricing`.

- [ ] **Step 3: Implement constants**

Add `frontend/src/lib/luma-agents.ts`:

```ts
import type { Mode } from '@/types/engines';

export const LUMA_AGENTS_PROVIDER = 'luma_agents_direct' as const;

export const LUMA_UNI_1_ENGINE_IDS = ['luma-uni-1', 'luma-uni-1-max'] as const;
export const LUMA_RAY_32_ENGINE_ID = 'luma-ray-3-2' as const;
export const LUMA_AGENTS_ENGINE_IDS = [...LUMA_UNI_1_ENGINE_IDS, LUMA_RAY_32_ENGINE_ID] as const;

export type LumaAgentsImageEngineId = (typeof LUMA_UNI_1_ENGINE_IDS)[number];
export type LumaAgentsEngineId = (typeof LUMA_AGENTS_ENGINE_IDS)[number];
export type LumaAgentsImageMode = Extract<Mode, 't2i' | 'i2i'>;
export type LumaRay32PublicMode = Extract<Mode, 't2v' | 'i2v'>;
export type LumaRay32AdvancedMode = Extract<Mode, 'v2v' | 'reframe' | 'extend'>;

export const LUMA_UNI_MODEL_BY_ENGINE: Record<LumaAgentsImageEngineId, 'uni-1' | 'uni-1-max'> = {
  'luma-uni-1': 'uni-1',
  'luma-uni-1-max': 'uni-1-max',
};

export const LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE: Record<LumaAgentsImageEngineId, Record<LumaAgentsImageMode, string>> = {
  'luma-uni-1': {
    t2i: 'luma/agent/uni-1/v1/text-to-image',
    i2i: 'luma/agent/uni-1/v1/edit',
  },
  'luma-uni-1-max': {
    t2i: 'luma/agent/uni-1/v1/max',
    i2i: 'luma/agent/uni-1/v1/max/edit',
  },
};

export const LUMA_RAY_32_FAL_MODEL_BY_MODE: Record<LumaRay32PublicMode, string> = {
  t2v: 'luma/agent/ray/v3.2/text-to-video',
  i2v: 'luma/agent/ray/v3.2/image-to-video',
};

export const LUMA_UNI_ASPECT_RATIOS = ['3:1', '2:1', '16:9', '3:2', '1:1', '2:3', '9:16', '1:2', '1:3'] as const;
export const LUMA_UNI_MANGA_ASPECT_RATIOS = ['2:3', '9:16', '1:2', '1:3'] as const;
export const LUMA_UNI_STYLES = ['auto', 'manga'] as const;
export const LUMA_UNI_OUTPUT_FORMATS = ['png', 'jpeg'] as const;
export const LUMA_RAY_32_DURATIONS = ['5s', '10s'] as const;
export const LUMA_RAY_32_RESOLUTIONS = ['540p', '720p', '1080p'] as const;
export const LUMA_RAY_32_ASPECT_RATIOS = ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9'] as const;

export function isLumaAgentsEngineId(value: string | null | undefined): value is LumaAgentsEngineId {
  return Boolean(value && LUMA_AGENTS_ENGINE_IDS.includes(value as LumaAgentsEngineId));
}

export function isLumaAgentsImageEngineId(value: string | null | undefined): value is LumaAgentsImageEngineId {
  return Boolean(value && LUMA_UNI_1_ENGINE_IDS.includes(value as LumaAgentsImageEngineId));
}

export function isLumaRay32EngineId(value: string | null | undefined): value is typeof LUMA_RAY_32_ENGINE_ID {
  return value === LUMA_RAY_32_ENGINE_ID;
}

export function isLumaRay32PublicMode(value: string | null | undefined): value is LumaRay32PublicMode {
  return value === 't2v' || value === 'i2v';
}

export function isLumaRay32AdvancedMode(value: string | null | undefined): value is LumaRay32AdvancedMode {
  return value === 'v2v' || value === 'reframe' || value === 'extend';
}
```

- [ ] **Step 4: Implement pricing helpers**

Add `frontend/src/lib/luma-agents-pricing.ts`:

```ts
import {
  LUMA_RAY_32_DURATIONS,
  LUMA_RAY_32_RESOLUTIONS,
  type LumaAgentsImageEngineId,
  type LumaAgentsImageMode,
} from '@/lib/luma-agents';

type ImageReferencePricingBreakdown = {
  engineId: LumaAgentsImageEngineId;
  mode: LumaAgentsImageMode;
  falReferenceSource: string;
  base_task_usd: number;
  source_or_reference_image_count: number;
  per_source_or_reference_image_usd: number;
  computed_total_usd: number;
};

type Ray32PricingBreakdown = {
  engineId: 'luma-ray-3-2';
  falReferenceSource: string;
  duration: '5s' | '10s';
  resolution: '540p' | '720p' | '1080p';
  computed_total_usd: number;
};

export function calculateLumaAgentsImageReferencePrice(params: {
  engineId: LumaAgentsImageEngineId;
  mode: LumaAgentsImageMode;
  referenceImageCount: number;
}): { totalUsd: number; baseSubtotalUsd: number; breakdown: ImageReferencePricingBreakdown } {
  const isMax = params.engineId === 'luma-uni-1-max';
  const sourceOrReferenceCount =
    params.mode === 'i2i'
      ? 1 + Math.max(0, Math.round(params.referenceImageCount))
      : Math.max(0, Math.round(params.referenceImageCount));
  const baseTaskUsd = params.mode === 't2i' ? (isMax ? 0.102 : 0.042) : (isMax ? 0.102 : 0.042);
  const perSourceOrReferenceUsd = 0.003;
  const totalUsd =
    params.mode === 't2i'
      ? Number((baseTaskUsd + perSourceOrReferenceUsd * sourceOrReferenceCount).toFixed(4))
      : Number((baseTaskUsd + perSourceOrReferenceUsd * sourceOrReferenceCount).toFixed(4));

  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: params.engineId,
      mode: params.mode,
      falReferenceSource: params.mode === 't2i' ? 'fal_luma_uni_text_to_image' : 'fal_luma_uni_image_edit',
      base_task_usd: baseTaskUsd,
      source_or_reference_image_count: sourceOrReferenceCount,
      per_source_or_reference_image_usd: perSourceOrReferenceUsd,
      computed_total_usd: totalUsd,
    },
  };
}

const RAY_32_FAL_REFERENCE_PRICE_USD = {
  '5s': {
    '540p': 0.5,
    '720p': 1,
    '1080p': 2,
  },
  '10s': {
    '540p': 1,
    '720p': 2,
    '1080p': 4,
  },
} as const;

export function calculateLumaRay32ReferencePrice(params: {
  duration: string | number | null | undefined;
  resolution: string | null | undefined;
}): { totalUsd: number; baseSubtotalUsd: number; breakdown: Ray32PricingBreakdown } {
  const duration =
    typeof params.duration === 'number'
      ? (`${Math.round(params.duration)}s` as string)
      : (params.duration ?? '5s').trim().toLowerCase();
  if (!LUMA_RAY_32_DURATIONS.includes(duration as '5s' | '10s')) {
    throw new Error('Luma Ray 3.2 supports 5s or 10s public fallback-safe durations.');
  }

  const resolution = (params.resolution ?? '720p').trim().toLowerCase();
  if (!LUMA_RAY_32_RESOLUTIONS.includes(resolution as '540p' | '720p' | '1080p')) {
    throw new Error('Luma Ray 3.2 supports 540p, 720p, or 1080p public fallback-safe resolutions.');
  }

  const totalUsd = RAY_32_FAL_REFERENCE_PRICE_USD[duration as '5s' | '10s'][resolution as '540p' | '720p' | '1080p'];
  return {
    totalUsd,
    baseSubtotalUsd: totalUsd,
    breakdown: {
      engineId: 'luma-ray-3-2',
      falReferenceSource: 'fal_luma_ray_3_2_generation',
      duration: duration as '5s' | '10s',
      resolution: resolution as '540p' | '720p' | '1080p',
      computed_total_usd: totalUsd,
    },
  };
}
```

- [ ] **Step 5: Run pricing tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-pricing.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/luma-agents.ts frontend/src/lib/luma-agents-pricing.ts tests/luma-agents-pricing.test.ts
git commit -m "feat: add Luma Agents pricing primitives"
```

## Task 2: Add Engine Registry Entries

**Files:**
- Create: `frontend/src/config/fal-engines/luma-agents-shared.ts`
- Create: `frontend/src/config/fal-engines/luma-uni-1.ts`
- Create: `frontend/src/config/fal-engines/luma-uni-1-max.ts`
- Create: `frontend/src/config/fal-engines/luma-ray-3-2.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Modify: `tests/model-page-template-registry.test.ts`
- Modify: `tests/public-engines.test.ts` only if public engine ordering expectations change.

- [ ] **Step 1: Write registry tests**

Extend `tests/model-page-template-registry.test.ts` in the existing registry test:

```ts
const lumaUni = getModelPageTemplateConfig('luma-uni-1');
const lumaUniMax = getModelPageTemplateConfig('luma-uni-1-max');
const lumaRay32 = getModelPageTemplateConfig('luma-ray-3-2');

assert.ok(lumaUni);
assert.ok(lumaUniMax);
assert.ok(lumaRay32);
assert.equal(lumaUni.intent, 'reference-prep');
assert.equal(lumaUniMax.intent, 'specialized');
assert.equal(lumaRay32.intent, 'production');
assert.equal(lumaUni.hero.primaryCtaHref, '/app/image?engine=luma-uni-1');
assert.equal(lumaUniMax.hero.primaryCtaHref, '/app/image?engine=luma-uni-1-max');
assert.equal(lumaRay32.hero.primaryCtaHref, '/app?engine=luma-ray-3-2');
```

Also add the slugs to the expected sorted `listModelPageTemplateSlugs()` array.

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts
```

Expected: FAIL because model-page templates are not registered yet.

- [ ] **Step 3: Implement shared registry constants**

Create `frontend/src/config/fal-engines/luma-agents-shared.ts` with exported constants that mirror `frontend/src/lib/luma-agents.ts` for registry readability:

```ts
export const LUMA_UNI_REFERENCE_IMAGE_LIMIT_T2I = 9;
export const LUMA_UNI_REFERENCE_IMAGE_LIMIT_EDIT = 8;
export const LUMA_UNI_IMAGE_MAX_MB = 50;
export const LUMA_RAY_32_IMAGE_MAX_MB = 50;
export const LUMA_RAY_32_VIDEO_MAX_MB = 200;
export const LUMA_RAY_32_VIDEO_MAX_DURATION_SEC = 30;
```

- [ ] **Step 4: Implement `luma-uni-1` registry entry**

Create `frontend/src/config/fal-engines/luma-uni-1.ts`. The entry must:

- `id: 'luma-uni-1'`
- `modelSlug: 'luma-uni-1'`
- `category: 'image'`
- `modes: ['t2i', 'i2i']`
- `provider: 'Luma AI'`
- `brandId: 'luma'`
- `providerMeta.provider: 'luma_agents_direct'`
- `defaultFalModelId: 'luma/agent/uni-1/v1/text-to-image'`
- `inputSchema.optional` includes `style`, `output_format`, `enable_web_search`, `image_urls`.
- `image_urls` allows max 9 in `t2i` reference mode and max 8 references in `i2i` because the source occupies its own slot.
- `resolutionLocked: true` and `resolution: ['2K']`.
- `surfaces.compare.includeInHub: false` and no published image pairs.

Use the Seedream and GPT Image 2 registry style as the local pattern.

- [ ] **Step 5: Implement `luma-uni-1-max` registry entry**

Create `frontend/src/config/fal-engines/luma-uni-1-max.ts` with the same shape, but:

- `id: 'luma-uni-1-max'`
- `modelSlug: 'luma-uni-1-max'`
- `marketingName: 'Luma Uni-1 Max'`
- `defaultFalModelId: 'luma/agent/uni-1/v1/max'`
- `modes[].falModelId` maps `t2i` to `luma/agent/uni-1/v1/max` and `i2i` to `luma/agent/uni-1/v1/max/edit`.
- `surfaces.app.discoveryRank` should be below faster/common image routes until quality is proven in MaxVideoAI. Suggested rank: 10-12.

- [ ] **Step 6: Implement `luma-ray-3-2` registry entry**

Create `frontend/src/config/fal-engines/luma-ray-3-2.ts`. Public fallback-safe entry must:

- `id: 'luma-ray-3-2'`
- `modelSlug: 'luma-ray-3-2'`
- `marketingName: 'Luma Ray 3.2'`
- `category: 'video'`
- `modes: ['t2v', 'i2v']` for public launch.
- `maxDurationSec: 10`
- `resolutions: ['540p', '720p', '1080p']`
- `aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9']`
- `fps: [24]`
- `audio: false`
- `extend: false` in public entry until advanced direct-only flag is active.
- `inputSchema.optional` includes duration, aspect ratio, resolution, loop, `image_url`, `end_image_url`, and `reference_image_urls` only if fal text-to-video fallback accepts reference images for that route. If fal text-to-video schema does not accept reference images in live testing, keep reference images out of public UI for `t2v`.
- `modes[].falModelId` maps `t2v` to `luma/agent/ray/v3.2/text-to-video` and `i2v` to `luma/agent/ray/v3.2/image-to-video`.

Do not expose HDR, EXR, `video_edit`, `video_reframe`, or extend in the public registry entry during this task.

- [ ] **Step 7: Register entries**

Modify `frontend/src/config/fal-engines/registry.ts`:

```ts
import { LUMA_UNI_1_FAL_ENGINE_REGISTRY } from './luma-uni-1';
import { LUMA_UNI_1_MAX_FAL_ENGINE_REGISTRY } from './luma-uni-1-max';
import { LUMA_RAY_3_2_FAL_ENGINE_REGISTRY } from './luma-ray-3-2';
```

Add them near existing Luma entries:

```ts
  ...LUMA_RAY_3_2_FAL_ENGINE_REGISTRY,
  ...LUMA_UNI_1_FAL_ENGINE_REGISTRY,
  ...LUMA_UNI_1_MAX_FAL_ENGINE_REGISTRY,
```

- [ ] **Step 8: Run registry checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/public-engines.test.ts
```

Expected: template test still fails until marketing templates are added in Task 7; public engine test should pass.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/config/fal-engines/luma-agents-shared.ts frontend/src/config/fal-engines/luma-uni-1.ts frontend/src/config/fal-engines/luma-uni-1-max.ts frontend/src/config/fal-engines/luma-ray-3-2.ts frontend/src/config/fal-engines/registry.ts tests/model-page-template-registry.test.ts
git commit -m "feat: register Luma Agents engines"
```

## Task 3: Add Pricing Snapshot Support

**Files:**
- Modify: `frontend/src/lib/pricing-specialized-snapshots.ts`
- Modify: `frontend/src/lib/pricing.ts`
- Modify: `tests/pricing-definition.test.ts`
- Modify: `tests/luma-agents-pricing.test.ts`

- [ ] **Step 1: Add snapshot tests**

Extend `tests/luma-agents-pricing.test.ts` with compute snapshot checks:

```ts
import { listFalEngines } from '../frontend/src/config/falEngines';
import { computePricingSnapshot } from '../frontend/src/lib/pricing';

test('Luma Uni-1 displayed snapshot uses fal reference plus 30 percent margin', async () => {
  const engine = listFalEngines().find((entry) => entry.id === 'luma-uni-1')?.engine;
  assert.ok(engine);

  const snapshot = await computePricingSnapshot({
    engine,
    mode: 't2i',
    durationSec: 1,
    resolution: '2K',
    currency: 'USD',
  });

  assert.equal(snapshot.base.amountCents, 4);
  assert.equal(snapshot.margin?.percentApplied, 0.3);
  assert.equal(snapshot.totalCents, 6);
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_reference_price');
});

test('Luma Ray 3.2 displayed snapshot uses fal reference plus 30 percent margin', async () => {
  const engine = listFalEngines().find((entry) => entry.id === 'luma-ray-3-2')?.engine;
  assert.ok(engine);

  const snapshot = await computePricingSnapshot({
    engine,
    mode: 't2v',
    durationSec: 10,
    durationOption: '10s',
    resolution: '1080p',
    currency: 'USD',
  });

  assert.equal(snapshot.base.amountCents, 400);
  assert.equal(snapshot.margin?.percentApplied, 0.3);
  assert.equal(snapshot.totalCents, 520);
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_reference_price');
});
```

- [ ] **Step 2: Run tests and verify pricing path fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-pricing.test.ts
```

Expected: FAIL because `computePricingSnapshot` does not know the Luma Agents special pricing path yet.

- [ ] **Step 3: Add snapshot builders**

In `frontend/src/lib/pricing-specialized-snapshots.ts`, add two exported builders:

```ts
export function buildLumaAgentsImageSnapshot(params: {
  engineId: 'luma-uni-1' | 'luma-uni-1-max';
  mode: 't2i' | 'i2i';
  referenceImageCount: number;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { totalUsd, breakdown } = calculateLumaAgentsImageReferencePrice(params);
  return buildCentsSnapshotFromProviderReference({
    providerCostCents: Math.max(0, Math.round(totalUsd * 100)),
    unit: 'image',
    secondsOrQuantity: 1,
    unitRateUsd: totalUsd,
    breakdown,
    providerCostSource: 'fal_reference_price',
    rule: params.rule,
    memberTier: params.memberTier,
    memberTierDiscounts: params.memberTierDiscounts,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
  });
}

export function buildLumaRay32Snapshot(params: {
  duration: number | string | null | undefined;
  resolution: string;
  rule: PricingRule;
  memberTier: 'member' | 'plus' | 'pro';
  memberTierDiscounts: PricingEngineDefinition['memberTierDiscounts'];
  currency: string;
  vendorAccountId?: string | null;
}): PricingSnapshot {
  const { totalUsd, breakdown } = calculateLumaRay32ReferencePrice({
    duration: params.duration,
    resolution: params.resolution,
  });
  const seconds = breakdown.duration === '10s' ? 10 : 5;
  return buildCentsSnapshotFromProviderReference({
    providerCostCents: Math.max(0, Math.round(totalUsd * 100)),
    unit: 'sec',
    secondsOrQuantity: seconds,
    unitRateUsd: Number((totalUsd / seconds).toFixed(4)),
    breakdown,
    providerCostSource: 'fal_reference_price',
    rule: params.rule,
    memberTier: params.memberTier,
    memberTierDiscounts: params.memberTierDiscounts,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
  });
}
```

Implement `buildCentsSnapshotFromProviderReference` as a private helper in the same file by reusing the margin/discount logic already present in `buildGptImage2Snapshot` and `buildLumaRay2Snapshot`. Keep the helper pure and scoped to this file.

- [ ] **Step 4: Route pricing through the new builders**

In `frontend/src/lib/pricing.ts`, import Luma helpers:

```ts
import { isLumaAgentsImageEngineId, isLumaRay32EngineId } from '@/lib/luma-agents';
import { buildLumaAgentsImageSnapshot, buildLumaRay32Snapshot } from '@/lib/pricing-specialized-snapshots';
```

Add branches before generic pricing:

```ts
  } else if (isLumaAgentsImageEngineId(engine.id)) {
    const currency = (context.currency ?? rule.currency ?? pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
    const referenceCount =
      typeof context.addons?.reference_image_count === 'number'
        ? context.addons.reference_image_count
        : 0;
    snapshot = buildLumaAgentsImageSnapshot({
      engineId: engine.id,
      mode: lumaMode === 'i2i' ? 'i2i' : 't2i',
      referenceImageCount: referenceCount,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
  } else if (isLumaRay32EngineId(engine.id)) {
    const currency = (context.currency ?? rule.currency ?? pricingDetails?.currency ?? engine.pricing?.currency ?? 'USD').toUpperCase();
    snapshot = buildLumaRay32Snapshot({
      duration: context.durationOption ?? durationSec,
      resolution,
      rule,
      memberTier,
      memberTierDiscounts,
      currency,
      vendorAccountId,
    });
  } else {
```

If `addons.reference_image_count` is not the right pattern for image references, add a typed optional `referenceImageCount?: number` field to `PricingContext` and set it from image execution. Keep backward compatibility by falling back to zero.

- [ ] **Step 5: Run pricing tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-pricing.test.ts tests/pricing-definition.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/pricing-specialized-snapshots.ts frontend/src/lib/pricing.ts tests/luma-agents-pricing.test.ts tests/pricing-definition.test.ts
git commit -m "feat: price Luma Agents from fal reference rates"
```

## Task 4: Add Video Direct Routing And Fal Fallback

**Files:**
- Modify: `frontend/src/lib/env.ts`
- Modify: `frontend/src/server/video-providers/types.ts`
- Modify: `frontend/src/server/video-providers/router.ts`
- Create: `frontend/src/server/video-providers/luma-agents/constants.ts`
- Create: `frontend/src/server/video-providers/luma-agents/model-map.ts`
- Create: `frontend/src/server/video-providers/luma-agents/client.ts`
- Create: `frontend/src/server/video-providers/luma-agents/payload.ts`
- Create: `frontend/src/server/video-providers/luma-agents/response.ts`
- Create: `frontend/src/server/video-providers/luma-agents/errors.ts`
- Create: `frontend/src/server/video-providers/luma-agents/cost.ts`
- Create: `frontend/app/api/generate/_lib/luma-agents-submission.ts`
- Modify: `frontend/app/api/generate/_lib/video-provider-submission.ts`
- Create: `tests/luma-agents-provider-routing.test.ts`
- Create: `tests/luma-agents-payload.test.ts`
- Create: `tests/luma-agents-response.test.ts`
- Create: `tests/luma-agents-video-submission.test.ts`

- [ ] **Step 1: Write routing tests**

Add `tests/luma-agents-provider-routing.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

test('Luma Agents routes Ray 3.2 direct for admins when enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'false',
        LUMA_AGENTS_ADMIN_ONLY: 'true',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      advancedDirectOnlyEnabled: false,
    }
  );
});

test('Luma Agents stays fal-only for public users until public routing is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      isAdmin: false,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'false',
        LUMA_AGENTS_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Luma Agents advanced modes stay fal-only unless advanced direct-only flag is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 'reframe',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'false',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});
```

- [ ] **Step 2: Implement env vars**

In `frontend/src/lib/env.ts`, add optional env values to `ENV`:

```ts
  LUMA_AGENTS_API_KEY: getOptionalEnv('LUMA_AGENTS_API_KEY'),
  LUMA_AGENTS_BASE_URL: getOptionalEnv('LUMA_AGENTS_BASE_URL', 'https://agents.lumalabs.ai'),
  LUMA_AGENTS_ENABLED: getOptionalEnv('LUMA_AGENTS_ENABLED', 'false'),
  LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: getOptionalEnv('LUMA_AGENTS_PUBLIC_ROUTING_ENABLED', 'false'),
  LUMA_AGENTS_ADMIN_ONLY: getOptionalEnv('LUMA_AGENTS_ADMIN_ONLY', 'true'),
  LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: getOptionalEnv('LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED', 'true'),
  LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: getOptionalEnv('LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED', 'false'),
  LUMA_AGENTS_IMAGE_DIRECT_ENABLED: getOptionalEnv('LUMA_AGENTS_IMAGE_DIRECT_ENABLED', 'false'),
  LUMA_AGENTS_VIDEO_DIRECT_ENABLED: getOptionalEnv('LUMA_AGENTS_VIDEO_DIRECT_ENABLED', 'false'),
  LUMA_AGENTS_SUBMIT_TIMEOUT_MS: getOptionalEnv('LUMA_AGENTS_SUBMIT_TIMEOUT_MS', '30000'),
  LUMA_AGENTS_POLL_INTERVAL_MS: getOptionalEnv('LUMA_AGENTS_POLL_INTERVAL_MS', '5000'),
  LUMA_AGENTS_VIDEO_POLL_MAX_MINUTES: getOptionalEnv('LUMA_AGENTS_VIDEO_POLL_MAX_MINUTES', '35'),
  LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS: getOptionalEnv('LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS', '180000'),
```

- [ ] **Step 3: Extend provider types and routing**

In `frontend/src/server/video-providers/types.ts`, extend:

```ts
export type VideoProviderKey =
  | 'fal'
  | 'kling_direct'
  | 'byteplus_modelark'
  | 'google_vertex_veo_direct'
  | 'luma_agents_direct';
```

In `frontend/src/server/video-providers/router.ts`, extend `RoutingEnv`, `VideoProviderRoutingPlan`, and `resolveVideoProviderRoutingPlan`:

```ts
  | {
      kind: 'luma_agents_direct_primary';
      primaryProvider: 'luma_agents_direct';
      fallbackProvider: 'fal';
      fallbackEnabled: boolean;
      advancedDirectOnlyEnabled: boolean;
    }
```

Use this routing behavior:

- Return fal-only if engine is not `luma-ray-3-2`.
- Return fal-only if mode is `v2v`, `reframe`, or `extend` and `LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED` is not enabled.
- Return fal-only if `LUMA_AGENTS_ENABLED` or `LUMA_AGENTS_VIDEO_DIRECT_ENABLED` is false.
- Honor `LUMA_AGENTS_ADMIN_ONLY` the same way Kling/Google do.
- Honor `LUMA_AGENTS_PUBLIC_ROUTING_ENABLED` for non-admin users.

- [ ] **Step 4: Implement model-map**

Create `frontend/src/server/video-providers/luma-agents/model-map.ts`:

```ts
import type { Mode } from '@/types/engines';
import { isLumaRay32EngineId, isLumaRay32PublicMode, isLumaRay32AdvancedMode } from '@/lib/luma-agents';

export const LUMA_AGENTS_DIRECT_PROVIDER = 'luma_agents_direct' as const;

export function isLumaAgentsVideoEngine(engineId: string): boolean {
  return isLumaRay32EngineId(engineId);
}

export function isLumaAgentsVideoModeSupported(mode: Mode | string, options?: { advancedDirectOnlyEnabled?: boolean }): boolean {
  if (isLumaRay32PublicMode(mode)) return true;
  return options?.advancedDirectOnlyEnabled === true && isLumaRay32AdvancedMode(mode);
}

export function resolveLumaAgentsModelRoute(params: {
  engineId: string;
  mode: Mode | string;
}): { providerModel: 'ray-3.2'; type: 'video' | 'video_edit' | 'video_reframe'; fallbackCompatible: boolean } {
  if (!isLumaRay32EngineId(params.engineId)) {
    throw new Error(`Unsupported Luma Agents video engine: ${params.engineId}`);
  }
  if (params.mode === 'v2v') {
    return { providerModel: 'ray-3.2', type: 'video_edit', fallbackCompatible: false };
  }
  if (params.mode === 'reframe') {
    return { providerModel: 'ray-3.2', type: 'video_reframe', fallbackCompatible: false };
  }
  return { providerModel: 'ray-3.2', type: 'video', fallbackCompatible: params.mode === 't2v' || params.mode === 'i2v' };
}
```

- [ ] **Step 5: Implement payload tests**

Add `tests/luma-agents-payload.test.ts` with direct payload expectations:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLumaAgentsVideoPayload } from '../frontend/src/server/video-providers/luma-agents/payload';

test('Luma Ray 3.2 text-to-video payload maps public settings', () => {
  assert.deepEqual(
    buildLumaAgentsVideoPayload({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      prompt: 'A cinematic tram at night',
      durationSec: 5,
      durationOption: '5s',
      aspectRatio: '16:9',
      resolution: '720p',
      loop: true,
      imageUrl: null,
      endImageUrl: null,
      videoUrl: null,
      referenceImageUrls: [],
      extraInputValues: null,
    }),
    {
      model: 'ray-3.2',
      type: 'video',
      prompt: 'A cinematic tram at night',
      aspect_ratio: '16:9',
      video: {
        resolution: '720p',
        duration: '5s',
        loop: true,
      },
    }
  );
});

test('Luma Ray 3.2 image-to-video payload maps start and end frames', () => {
  const payload = buildLumaAgentsVideoPayload({
    engineId: 'luma-ray-3-2',
    mode: 'i2v',
    prompt: 'Subtle product push-in',
    durationSec: 5,
    durationOption: '5s',
    aspectRatio: '9:16',
    resolution: '1080p',
    loop: false,
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    videoUrl: null,
    referenceImageUrls: [],
    extraInputValues: null,
  });

  assert.deepEqual(payload.video, {
    resolution: '1080p',
    duration: '5s',
    start_frame: { url: 'https://cdn.maxvideoai.com/start.png' },
    end_frame: { url: 'https://cdn.maxvideoai.com/end.png' },
  });
});
```

- [ ] **Step 6: Implement payload builder**

Create `frontend/src/server/video-providers/luma-agents/payload.ts`. It must enforce public validation before submit:

- `duration` must be `5s` or `10s`.
- `resolution` must be `540p`, `720p`, or `1080p`.
- `aspect_ratio` must be one of the six Ray 3.2 ratios or omitted.
- `10s` must not include `start_frame`, `end_frame`, `loop`, `hdr`, or `exr_export`.
- `loop` must not be combined with `10s`, HDR, or `end_frame`.
- `hdr` and `exr_export` are not emitted unless advanced direct-only flag is active.

Use `source.url` for `v2v` and `reframe` advanced payloads, but keep those paths guarded by routing.

- [ ] **Step 7: Implement client, response, and errors**

Create:

- `client.ts`: `getLumaAgentsClient()` with `createGeneration(payload)` and `getGeneration(id)`.
- `response.ts`: normalize `queued`, `running`, `completed`, `failed` into `NormalizedVideoProviderTask`.
- `errors.ts`: classify errors:
  - `rate_limit` for 429 `Rate limit exceeded`.
  - `concurrent_limit` for 429 `Too many concurrent jobs`.
  - `auth_error` for 401/403.
  - `billing_or_access` for 402.
  - `invalid_request` for 400/422.
  - `payload_too_large` for 413.
  - `transient_provider_error` for 502/503/504/network timeout.

Fallback eligibility:

```ts
export function shouldFallbackFromLumaAgentsSubmit(error: unknown): boolean {
  const classified = classifyLumaAgentsError(error);
  return ['rate_limit', 'concurrent_limit', 'transient_provider_error', 'timeout'].includes(classified.errorClass);
}
```

Do not fallback for auth errors, billing/access errors, invalid request, content safety/moderation, or payload too large.

- [ ] **Step 8: Implement submission helper**

Create `frontend/app/api/generate/_lib/luma-agents-submission.ts` based on the Google Vertex Veo and Kling direct patterns:

- Create provider attempt 1 with `provider: 'luma_agents_direct'`.
- Build direct payload from the existing `falPayload`.
- Submit direct.
- On accepted response:
  - mark attempt accepted.
  - update `app_jobs.provider = 'luma_agents_direct'`.
  - update `provider_job_id`.
  - set status to `queued` or `running`.
  - return accepted response body.
- On fallback-eligible submit error before acceptance:
  - mark Luma attempt failed with `fallbackEligible: true`.
  - create attempt 2 with `provider: 'fal'`.
  - link attempts.
  - update `app_jobs.provider = 'fal'`.
  - call `submitFalGenerateTask`.
- On non-fallback error:
  - mark attempt failed.
  - refund pending wallet payment using the existing rollback path.
  - return user-safe error response.

- [ ] **Step 9: Wire video provider submission**

Modify `frontend/app/api/generate/_lib/video-provider-submission.ts`:

```ts
import { submitLumaAgentsGenerateTask } from './luma-agents-submission';
```

Add branch before Google/Kling or after them:

```ts
  if (params.providerRoutingPlan.kind === 'luma_agents_direct_primary') {
    const lumaSubmission = await submitLumaAgentsGenerateTask({
      ...same scoped params as Google/Kling,
      fallbackToFalEnabled: params.providerRoutingPlan.fallbackEnabled,
      advancedDirectOnlyEnabled: params.providerRoutingPlan.advancedDirectOnlyEnabled,
    });
    if (!lumaSubmission.ok) return { kind: 'error_response', status: lumaSubmission.status, body: lumaSubmission.body };
    if (lumaSubmission.kind === 'accepted') return { kind: 'accepted_response', body: lumaSubmission.body };
    return { kind: 'generation_result', generationResult: lumaSubmission.generationResult };
  }
```

- [ ] **Step 10: Run routing and submission tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-provider-routing.test.ts tests/luma-agents-payload.test.ts tests/luma-agents-response.test.ts tests/luma-agents-video-submission.test.ts
```

Expected: PASS after implementation.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/lib/env.ts frontend/src/server/video-providers frontend/app/api/generate/_lib tests/luma-agents-provider-routing.test.ts tests/luma-agents-payload.test.ts tests/luma-agents-response.test.ts tests/luma-agents-video-submission.test.ts
git commit -m "feat: route Luma Agents video direct with fal fallback"
```

## Task 5: Add Luma Video Polling

**Files:**
- Create: `frontend/server/luma-agents-poll.ts`
- Create: `frontend/app/api/cron/luma-agents-poll/route.ts`
- Modify: any cron manifest/config if this project keeps an explicit Vercel cron list.
- Create: `tests/luma-agents-poll.test.ts`

- [ ] **Step 1: Write polling tests**

Add `tests/luma-agents-poll.test.ts` modeled after direct provider poll tests. Cover:

- Completed Luma output copies provider URL to MaxVideoAI storage.
- Failed Luma output refunds paid wallet jobs once.
- Polling stalled after max duration marks `provider_polling_stalled`.
- Provider attempt is marked completed or failed.

- [ ] **Step 2: Implement poller**

Create `frontend/server/luma-agents-poll.ts` by following `frontend/server/google-vertex-veo-poll.ts` and `frontend/server/kling-direct-poll.ts`.

Provider-specific differences:

- Query pending jobs where `provider = 'luma_agents_direct'`.
- Use `getLumaAgentsClient().getGeneration(providerJobId)`.
- Normalize output through `normalizeLumaAgentsGeneration`.
- On completion, copy the MP4 output to storage immediately because Luma output URLs expire after 1 hour.
- Persist preview, thumbnail, keyframes, and legacy media outputs through the same helpers as Google/Kling pollers.
- Mark `provider_attempts.provider_cost_usd` using actual Luma direct cost estimate from `frontend/src/server/video-providers/luma-agents/cost.ts`, while the customer `pricing_snapshot` remains fal-reference.

- [ ] **Step 3: Add cron route**

Create `frontend/app/api/cron/luma-agents-poll/route.ts` matching existing cron auth style:

```ts
import { NextRequest } from 'next/server';
import { runLumaAgentsPoll } from '@/server/luma-agents-poll';
import { validateCronRequest } from '@/server/cron-auth';

export async function GET(request: NextRequest) {
  const unauthorized = validateCronRequest(request);
  if (unauthorized) return unauthorized;
  return runLumaAgentsPoll();
}
```

If the current cron auth helper has a different name, use the helper already used by `frontend/app/api/cron/google-vertex-veo-poll/route.ts`.

- [ ] **Step 4: Run polling tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-poll.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/server/luma-agents-poll.ts frontend/app/api/cron/luma-agents-poll/route.ts tests/luma-agents-poll.test.ts
git commit -m "feat: poll Luma Agents video jobs"
```

## Task 6: Add Image Direct Execution With Fal Fallback

**Files:**
- Create: `frontend/src/server/images/luma-agents-client.ts`
- Create: `frontend/src/server/images/luma-agents-payload.ts`
- Create: `frontend/src/server/images/luma-agents-response.ts`
- Create: `frontend/src/server/images/luma-agents-error.ts`
- Create: `frontend/src/server/images/luma-agents-execution.ts`
- Modify: `frontend/src/server/images/execute-image-generation.ts`
- Create: `tests/luma-agents-image-payload.test.ts`
- Create: `tests/luma-agents-image-provider.test.ts`

- [ ] **Step 1: Write image payload tests**

Add `tests/luma-agents-image-payload.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLumaAgentsImagePayload } from '../frontend/src/server/images/luma-agents-payload';

test('Luma Uni-1 text-to-image maps style, output format, web search, and refs', () => {
  assert.deepEqual(
    buildLumaAgentsImagePayload({
      engineId: 'luma-uni-1',
      mode: 't2i',
      prompt: 'A product poster with exact text "LAUNCH"',
      aspectRatio: '1:1',
      style: 'auto',
      outputFormat: 'png',
      webSearch: true,
      sourceImageUrl: null,
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref-a.png'],
    }),
    {
      model: 'uni-1',
      type: 'image',
      prompt: 'A product poster with exact text "LAUNCH"',
      aspect_ratio: '1:1',
      style: 'auto',
      output_format: 'png',
      web_search: true,
      image_ref: [{ url: 'https://cdn.maxvideoai.com/ref-a.png' }],
    }
  );
});

test('Luma Uni-1 Max edit maps source and edit refs', () => {
  assert.deepEqual(
    buildLumaAgentsImagePayload({
      engineId: 'luma-uni-1-max',
      mode: 'i2i',
      prompt: 'Keep the object, change the background to brushed steel',
      aspectRatio: null,
      style: 'auto',
      outputFormat: 'jpeg',
      webSearch: false,
      sourceImageUrl: 'https://cdn.maxvideoai.com/source.png',
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
    }),
    {
      model: 'uni-1-max',
      type: 'image_edit',
      prompt: 'Keep the object, change the background to brushed steel',
      style: 'auto',
      output_format: 'jpeg',
      source: { url: 'https://cdn.maxvideoai.com/source.png' },
      image_ref: [{ url: 'https://cdn.maxvideoai.com/ref.png' }],
    }
  );
});
```

- [ ] **Step 2: Implement image payload builder**

Create `frontend/src/server/images/luma-agents-payload.ts`:

- Map `engineId` to `model: 'uni-1' | 'uni-1-max'`.
- Map `t2i` to `type: 'image'`.
- Map `i2i` to `type: 'image_edit'`.
- Send `source` only for `i2i`.
- Send `image_ref` for references.
- Enforce max 9 references for `t2i`.
- Enforce max 8 references for `i2i`.
- Enforce `output_format` only `png` or `jpeg`.
- Enforce `style` only `auto` or `manga`.
- Enforce `style: 'manga'` portrait aspect ratios in `t2i`.

- [ ] **Step 3: Implement client and response parser**

Create:

- `luma-agents-client.ts`: direct `fetch` wrapper with submit and poll. Use `ENV.LUMA_AGENTS_API_KEY`, `ENV.LUMA_AGENTS_BASE_URL`, and `AbortSignal.timeout`.
- `luma-agents-response.ts`: extract generated image outputs from `output[]` where `type === 'image'`.
- `luma-agents-error.ts`: same fallback classification as video.

- [ ] **Step 4: Implement image execution wrapper**

Create `frontend/src/server/images/luma-agents-execution.ts`. It should accept the prepared values from `executeImageGeneration` and return the same shape the fal path expects after generation:

- Submit Luma direct.
- Poll every 2-5 seconds until completed/failed or `LUMA_AGENTS_IMAGE_SYNC_TIMEOUT_MS`.
- If submit fails with fallback-eligible error before an id is accepted, call `runFalImageGeneration`.
- If accepted Luma job fails or times out, throw `ImageGenerationExecutionError` and let existing failure/refund code handle it.
- Copy direct output image URLs to MaxVideoAI storage using the existing `copyGeneratedImagesToStorage` path because Luma URLs expire.

- [ ] **Step 5: Wire image execution**

In `frontend/src/server/images/execute-image-generation.ts`, replace the direct fal call branch with:

```ts
if (isLumaAgentsImageEngineId(engine.id) && lumaAgentsImageDirectEnabled()) {
  const lumaResult = await executeLumaAgentsImageGenerationWithFalFallback({
    falModelId: modeConfig.falModelId,
    effectivePrompt,
    numImages,
    mode,
    combinedImageUrls,
    falAspectRatio,
    providerImageSize,
    resolutionEngineParam,
    outputFormat,
    enableWebSearch,
    engine,
    engineEntry,
    onProviderJobId(requestId) {
      providerJobId = requestId;
    },
  });
  // Continue through existing extract/copy/persist logic using normalized result shape.
}
```

Keep the returned shape compatible with the existing `extractImages(result.data)` flow to avoid duplicating image persistence.

- [ ] **Step 6: Pass reference count to pricing**

When calling `computePricingSnapshot` for Luma image engines, pass the image reference count so edit/reference pricing is accurate:

```ts
addons: {
  ...(enableWebSearch ? { enable_web_search: true } : {}),
  ...(isLumaAgentsImageEngineId(engine.id) ? { reference_image_count: Math.max(0, combinedImageUrls.length - (mode === 'i2i' ? 1 : 0)) } : {}),
},
```

If the count is clearer as a first-class `PricingContext.referenceImageCount`, add that field and use it instead of an addon.

- [ ] **Step 7: Run image tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-image-payload.test.ts tests/luma-agents-image-provider.test.ts tests/image-generation-server-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/server/images/luma-agents-client.ts frontend/src/server/images/luma-agents-payload.ts frontend/src/server/images/luma-agents-response.ts frontend/src/server/images/luma-agents-error.ts frontend/src/server/images/luma-agents-execution.ts frontend/src/server/images/execute-image-generation.ts tests/luma-agents-image-payload.test.ts tests/luma-agents-image-provider.test.ts
git commit -m "feat: run Luma Agents image direct with fal fallback"
```

## Task 7: Add Marketing Templates And Localized Copy

**Files:**
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-ray-3-2.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-uni-1.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/luma-uni-1-max.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy-additional.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-links.ts`
- Create localized JSON files under `content/models/{en,fr,es}`.
- Modify: `tests/model-page-template-registry.test.ts`
- Modify: `tests/model-page-template-content.test.ts`

- [ ] **Step 1: Add template config tests**

Update `tests/model-page-template-registry.test.ts` with the assertions from Task 2. Add these expected pricing preset ids:

```ts
assert.deepEqual(
  lumaRay32.pricing.presets.map((preset) => preset.id),
  ['5s-540p', '5s-720p', '10s-1080p', 'max-duration']
);
assert.deepEqual(
  lumaUni.pricing.presets.map((preset) => preset.id),
  ['2k-image', 'single-edit', 'reference-edit-set']
);
assert.deepEqual(
  lumaUniMax.pricing.presets.map((preset) => preset.id),
  ['2k-hero-image', 'hero-edit', 'reference-edit-set']
);
```

If image pricing presets do not yet support edit/reference count labels, extend `ModelPageImagePricingPreset` with `mode?: 't2i' | 'i2i'` and `referenceImageCount?: number` in a separate focused step, with tests.

- [ ] **Step 2: Create templates**

Create `luma-ray-3-2.ts`:

```ts
import type { ModelPageTemplateConfig } from '../model-page-template-types';

export const lumaRay32TemplateConfig: ModelPageTemplateConfig = {
  slug: 'luma-ray-3-2',
  intent: 'production',
  hero: {
    eyebrow: 'LUMA CURRENT VIDEO ROUTE',
    subtitleHighlightTerms: ['cinematic Ray 3.2 motion', '5s or 10s shots', 'direct Luma route with fal fallback'],
    primaryCtaHref: '/app?engine=luma-ray-3-2',
    secondaryCtaHref: '/examples/luma',
    quickLinks: [
      { labelKey: 'viewPricing', href: '/pricing#luma-ray-3-2-pricing', icon: 'pricing' },
      { labelKey: 'promptExamples', href: '#prompting', icon: 'prompt' },
      { labelKey: 'compareFast', href: '/ai-video-engines/kling-3-pro-vs-luma-ray-3-2', icon: 'compare' },
    ],
  },
  pricing: {
    anchorHref: '/pricing#luma-ray-3-2-pricing',
    presets: [
      { id: '5s-540p', seconds: 5, resolution: '540p', labelKey: 'motionDraft' },
      { id: '5s-720p', seconds: 5, resolution: '720p', labelKey: 'standardPreview', highlightKey: 'mostPopular' },
      { id: '10s-1080p', seconds: 10, resolution: '1080p', labelKey: 'deliveryRender' },
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

Create image templates with `compare: false`:

```ts
sections: {
  examples: true,
  prompting: true,
  tips: true,
  compare: false,
  specs: true,
  safety: true,
  faq: true,
}
```

- [ ] **Step 3: Add localized marketing copy**

Add copy blocks for EN/FR/ES to the same copy structure used by recent image models.

Minimum content for `luma-uni-1`:

- Hero title: `Luma Uni-1`
- Positioning: reasoning-led 2K image model for text-to-image, image edits, multi-reference guidance, visual layout reasoning, web-grounded references.
- Do not claim video, animation, audio, 4K, or guaranteed text perfection.
- Decision cards:
  - When to choose Uni-1.
  - How to use references.
  - When to move to Uni-1 Max.
- Reference workflows:
  - Text-to-image.
  - Source edit.
  - Multi-reference layout.
  - Web-grounded visual research.
  - Handoff to video.
- Pricing copy: "display prices use MaxVideoAI fal-reference pricing; exact price appears before generation."

Minimum content for `luma-uni-1-max`:

- Hero title: `Luma Uni-1 Max`
- Positioning: higher-fidelity Uni-1 route for hero stills, product visuals, typography-sensitive layouts, precise image revisions.
- Do not claim it is always faster or cheaper than Uni-1.
- Decision cards:
  - Max or base Uni-1.
  - Product/typography hero still.
  - Edit with references.
- Reference workflows:
  - Hero still.
  - Product label or poster.
  - High-detail edit.
  - Multi-reference creative direction.
  - Handoff to video.

Minimum content for `luma-ray-3-2`:

- Hero title: `Luma Ray 3.2`
- Positioning: current Luma cinematic video generation route for text-to-video and image-to-video, 5s/10s, 540p/720p/1080p, loop for supported public cases.
- Mention direct Luma route with fal fallback in operational terms, not as a guarantee of instant capacity.
- Do not advertise HDR/EXR publicly until advanced direct-only scope is product-approved.
- Decision cards:
  - Ray 3.2 or Ray 2.
  - Prompt-only or start image.
  - When to use 10s.
- Reference workflows:
  - Text prompt.
  - Start image.
  - Optional end image for 5s.
  - Seamless loop constraints.
  - 1080p final check.

- [ ] **Step 4: Exclude image models from VS**

Modify `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-links.ts`:

```ts
export const COMPARE_EXCLUDED_SLUGS = new Set([
  'nano-banana',
  'nano-banana-pro',
  'nano-banana-2',
  'gpt-image-2',
  'seedream',
  'luma-uni-1',
  'luma-uni-1-max',
]);
```

Ensure image engine `surfaces.compare` is disabled in the engine registry entries.

- [ ] **Step 5: Add localized content JSON**

Use existing `content/models/en/seedream.json`, `content/models/en/gpt-image-2.json`, and `content/models/en/luma-ray-2.json` as structural references. Add the nine JSON files listed in the file map.

Each JSON must include:

- `marketingName`
- `seo.title`
- `seo.description`
- `overview`
- `hero.title`
- `hero.ctas`
- FAQ entries
- prompt/tips sections
- pricing language aligned with fal-reference display pricing
- no placeholder media paths

- [ ] **Step 6: Extend content tests**

In `tests/model-page-template-content.test.ts`:

- Add slugs to `MIGRATED_TEMPLATE_SLUGS`.
- Add image-specific tests:

```ts
test('Luma Uni image pages stay image-only and avoid compare routes', () => {
  for (const slug of ['luma-uni-1', 'luma-uni-1-max'] as const) {
    const decision = buildModelDecisionData({ engine: getEngine(slug), locale: 'en' });
    assert.ok(decision);
    assert.match(decision.hero.primaryCta.href, /^\/app\/image\?engine=/);
    assert.doesNotMatch(visibleDecisionText(decision), /text-to-video|image-to-video|MP4|HDR|EXR|vs /i);
  }
});
```

- Add Ray 3.2 tests:

```ts
test('Luma Ray 3.2 page is video-first and does not expose direct-only HDR copy at launch', () => {
  const decision = buildModelDecisionData({ engine: getEngine('luma-ray-3-2'), locale: 'en' });
  assert.ok(decision);
  assert.equal(decision.hero.primaryCta.href, '/app?engine=luma-ray-3-2');
  assert.doesNotMatch(visibleDecisionText(decision), /EXR|HDR export|video edit controls/i);
  assert.match(visibleDecisionText(decision), /5s|10s|540p|720p|1080p/i);
});
```

- [ ] **Step 7: Run marketing tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts tests/model-page-copy-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib' content/models tests/model-page-template-registry.test.ts tests/model-page-template-content.test.ts
git commit -m "feat: add Luma Agents model marketing pages"
```

## Task 8: Add Conservative Scoring, Specs, And Discovery

**Files:**
- Modify: `data/benchmarks/engine-scores.v1.json`
- Modify: `data/benchmarks/engine-key-specs.v1.json`
- Modify: `frontend/config/compare-config.json`
- Modify: `tests/pricing-definition.test.ts` or add `tests/luma-agents-marketing-surfaces.test.ts`

- [ ] **Step 1: Add scoring tests**

Add `tests/luma-agents-marketing-surfaces.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };

function score(slug: string) {
  const entry = scoresFile.scores.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Missing score for ${slug}`);
  return entry;
}

test('Luma Agents scores are conservative against current video leaders', () => {
  const ray32 = score('luma-ray-3-2');
  const seedance = score('seedance-2-0');
  const kling = score('kling-3-pro');

  assert.ok((ray32.motion ?? 0) <= (seedance.motion ?? 0));
  assert.ok((ray32.visualQuality ?? 0) <= (kling.visualQuality ?? 0));
  assert.ok((ray32.speedStability ?? 0) <= 7.2);
});

test('Luma Uni image models have specs but no compare pairs', () => {
  for (const slug of ['luma-uni-1', 'luma-uni-1-max']) {
    assert.ok(keySpecsFile.specs.find((entry) => entry.modelSlug === slug), `Missing specs for ${slug}`);
    assert.equal(JSON.stringify(compareConfig).includes(`${slug}-vs-`), false);
    assert.equal(JSON.stringify(compareConfig).includes(`-vs-${slug}`), false);
  }
});
```

- [ ] **Step 2: Add score entries**

Add conservative entries to `data/benchmarks/engine-scores.v1.json`:

```json
{
  "modelSlug": "luma-ray-3-2",
  "fidelity": 8.2,
  "visualQuality": 8.2,
  "motion": 8.3,
  "consistency": 7.8,
  "anatomy": 7.9,
  "textRendering": 6.8,
  "lipsyncQuality": 6.0,
  "sequencingQuality": 7.7,
  "controllability": 8.0,
  "speedStability": 6.8,
  "pricing": 7.8,
  "last_updated": "2026-06-09"
}
```

For image models, use the same fields where applicable but keep video-specific fields neutral/lower:

```json
{
  "modelSlug": "luma-uni-1",
  "fidelity": 8.1,
  "visualQuality": 8.1,
  "motion": 0,
  "consistency": 8.0,
  "anatomy": 7.8,
  "textRendering": 7.8,
  "lipsyncQuality": 0,
  "sequencingQuality": 6.8,
  "controllability": 8.3,
  "speedStability": 6.9,
  "pricing": 8.7,
  "last_updated": "2026-06-09"
}
```

```json
{
  "modelSlug": "luma-uni-1-max",
  "fidelity": 8.4,
  "visualQuality": 8.4,
  "motion": 0,
  "consistency": 8.2,
  "anatomy": 8.0,
  "textRendering": 8.0,
  "lipsyncQuality": 0,
  "sequencingQuality": 7.0,
  "controllability": 8.5,
  "speedStability": 6.5,
  "pricing": 7.9,
  "last_updated": "2026-06-09"
}
```

These are deliberately not top-of-market claims. Increase only after MaxVideoAI internal examples and user acceptance data support it.

- [ ] **Step 3: Add key specs**

Add `engine-key-specs.v1.json` entries:

For `luma-ray-3-2`:

- `textToVideo`: Supported
- `imageToVideo`: Supported
- `videoToVideo`: Direct-only advanced route, not public fallback-safe at launch
- `firstLastFrame`: Supported for 5s image-to-video; rejected with 10s
- `referenceImageStyle`: Public fallback-safe only where fal schema supports it
- `maxResolution`: 1080p
- `maxDuration`: 10s
- `aspectRatios`: `9:16`, `3:4`, `1:1`, `4:3`, `16:9`, `21:9`
- `outputFormats`: MP4
- `audioOutput`: Not supported
- `nativeAudioGeneration`: Not supported
- `lipSync`: Not supported as native audio/lip-sync route
- `cameraMotionControls`: Prompt-based; advanced edit controls direct-only

For image models:

- `textToImage`: Supported
- `imageToImage`: Supported
- `imageReferences`: up to 9 for generation, up to 8 references plus source for edit
- `webSearch`: Supported
- `maxResolution`: 2048px / 2K
- `aspectRatios`: 3:1, 2:1, 16:9, 3:2, 1:1, 2:3, 9:16, 1:2, 1:3
- `outputFormats`: PNG, JPEG
- `videoToVideo`: Not supported
- `audioOutput`: Not supported

- [ ] **Step 4: Update best-for carefully**

In `frontend/config/compare-config.json`:

- Add `luma-ray-3-2` to relevant video `topPicks` only below the current top models unless an existing page is explicitly about Luma.
- Suggested placements:
  - `cinematic-realism`: after `seedance-2-0`, `kling-3-pro`, and `veo-3-1`.
  - `image-to-video`: after `seedance-2-0`, `veo-3-1`, and `kling-3-pro`.
  - `product-videos`: after current top two or three.
- Do not add `luma-uni-1` or `luma-uni-1-max` to video best-for pages.

- [ ] **Step 5: Run scoring tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/luma-agents-marketing-surfaces.test.ts tests/pricing-definition.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add data/benchmarks/engine-scores.v1.json data/benchmarks/engine-key-specs.v1.json frontend/config/compare-config.json tests/luma-agents-marketing-surfaces.test.ts tests/pricing-definition.test.ts
git commit -m "feat: score Luma Agents conservatively"
```

## Task 9: Regenerate Catalogs And Verify Public Surfaces

**Files:**
- Modify generated catalog files from existing scripts.
- Modify tests only if generated outputs require stable expected values.

- [ ] **Step 1: Regenerate model files**

Run:

```bash
pnpm model:generate:write
pnpm engine:catalog
```

Expected: generated model roster and engine catalog include `luma-ray-3-2`, `luma-uni-1`, and `luma-uni-1-max`.

- [ ] **Step 2: Validate generated outputs**

Run:

```bash
pnpm model:check
pnpm models:audit
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/fal-engine-catalog-architecture.test.ts tests/models-catalog-architecture.test.ts tests/model-landing-data-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/config/engine-catalog.json frontend/config/model-roster.json
git commit -m "chore: regenerate model catalog for Luma Agents"
```

## Task 10: Documentation And Rollout

**Files:**
- Create: `docs/engineering/luma-agents-provider.md`
- Modify: relevant deployment env doc if present.

- [ ] **Step 1: Add engineering doc**

Create `docs/engineering/luma-agents-provider.md` with:

- Provider overview.
- Public fallback-safe scope.
- Advanced direct-only scope.
- Env vars and default values.
- Pricing policy: fal reference + pricing rule margin; direct Luma cost only in internal provider attempt metadata.
- Fallback policy: only before Luma acceptance.
- Polling/copy policy: output URLs expire after 1 hour.
- Operational checklist for admin smoke tests.

- [ ] **Step 2: Add rollout checklist**

Use this staged rollout:

1. Deploy with all direct flags false. Confirm fal-only behavior.
2. Enable `LUMA_AGENTS_ENABLED=true`, `LUMA_AGENTS_VIDEO_DIRECT_ENABLED=true`, `LUMA_AGENTS_IMAGE_DIRECT_ENABLED=true`, `LUMA_AGENTS_ADMIN_ONLY=true`, `LUMA_AGENTS_PUBLIC_ROUTING_ENABLED=false`.
3. Run admin smoke tests:
   - Uni-1 text image.
   - Uni-1 image edit.
   - Uni-1 Max text image.
   - Ray 3.2 5s 720p text-to-video.
   - Ray 3.2 5s image-to-video.
4. Force fallback by temporarily lowering direct rate limit locally or mocking a Luma 429; verify provider attempts show Luma failed then fal started.
5. Enable public image direct first.
6. Enable public Ray 3.2 direct for `t2v` and `i2v`.
7. Keep advanced direct-only flag false until product signs off on no-fallback advanced options.

- [ ] **Step 3: Commit**

```bash
git add docs/engineering/luma-agents-provider.md
git commit -m "docs: document Luma Agents provider rollout"
```

## Final Verification

Run focused checks:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/luma-agents-pricing.test.ts \
  tests/luma-agents-provider-routing.test.ts \
  tests/luma-agents-payload.test.ts \
  tests/luma-agents-response.test.ts \
  tests/luma-agents-video-submission.test.ts \
  tests/luma-agents-image-payload.test.ts \
  tests/luma-agents-image-provider.test.ts \
  tests/luma-agents-marketing-surfaces.test.ts \
  tests/model-page-template-registry.test.ts \
  tests/model-page-template-content.test.ts \
  tests/fal-engine-catalog-architecture.test.ts
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm model:check
pnpm models:audit
git diff --check
```

Before merge, run when feasible:

```bash
pnpm --prefix frontend run build
```

Smoke-test localized routes after starting the app:

```txt
/models/luma-ray-3-2
/fr/modeles/luma-ray-3-2
/es/modelos/luma-ray-3-2
/models/luma-uni-1
/fr/modeles/luma-uni-1
/es/modelos/luma-uni-1
/models/luma-uni-1-max
/fr/modeles/luma-uni-1-max
/es/modelos/luma-uni-1-max
```

Check on each page:

- Canonical URL.
- Hreflang output.
- JSON-LD script output.
- Pricing scenarios.
- Prompt Lab links.
- No image VS links on Uni pages.
- Ray 3.2 has video-only compare links.
- CTA routes image models to `/app/image`.
- CTA routes Ray 3.2 to `/app`.

## Implementation Order

Use this merge order to reduce conflicts with other Codex work:

1. Constants and pricing primitives.
2. Engine registry entries.
3. Pricing snapshot integration.
4. Video direct provider and polling.
5. Image direct provider.
6. Marketing pages and localized content.
7. Scoring/specs/catalog generation.
8. Docs and rollout.

Each task should be a separate commit. If another branch edits `frontend/src/config/fal-engines/registry.ts`, `frontend/src/lib/pricing.ts`, or model-page copy files, rebase before starting the task that touches the same file.

