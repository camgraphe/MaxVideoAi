# Gemini Omni Flash Vertex Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gemini Omni Flash as a Google Vertex / Agent Platform direct integration in MaxVideoAI, with a full advanced option surface, marketing/model pages, specs, pricing notes, comparison pages, and verification.

**Architecture:** Implement Gemini Omni Flash as a separate direct provider from the existing Google Vertex Veo provider because Omni uses the Interactions API, stateful `previous_interaction_id`, and different response/file handling from Veo `predictLongRunning`. Keep the workspace route as an orchestrator: model capabilities live in engine/catalog config, provider logic stays server-only, and UI exposure comes through the existing input schema plus a focused Omni advanced options panel. Marketing surfaces remain route-local under the existing model and comparison page architectures.

**Tech Stack:** Next.js 15 App Router, TypeScript, Node `fetch`, existing Google service account OAuth helpers, PostgreSQL `app_jobs` and `provider_attempts`, current engine registry/catalog, localized marketing routes, Node test runner via `pnpm test:validate`.

---

## Current Source Facts

Verified on 2026-07-01:

- Google Cloud documents Gemini Omni Flash Preview under Gemini Enterprise Agent Platform / Vertex AI model docs: `gemini-omni-flash-preview`.
- It is Preview / Pre-GA. Treat all public routing as feature-gated.
- Supported documented capabilities include text-to-video, image-to-video, reference-to-video, video editing, and sound generation through prompt guidance.
- The documented API path for full option coverage is the Interactions API, not Veo `predictLongRunning`.
- Important documented fields include `model`, `input`, `generation_config.video_config.task`, `response_format`, `background`, `store`, and `previous_interaction_id`.
- Important documented limitations include only 16:9 and 9:16 video output, about 8 second video output, no negative prompt, no seed, no explicit audio references, no extend/first-last-frame workflow, no multi-scene storyboard, and no non-video output modalities for this model.

Primary references:

- Google Cloud model page: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-flash-preview
- Google Cloud Interactions API reference: https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/models/interactions-api
- Gemini API Omni guide with examples/options: https://ai.google.dev/gemini-api/docs/omni
- Google Search Central canonicalization guidance: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Google Search Central link best practices: https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- Google Search Central helpful content guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

## Product Decisions

1. Add one new engine: `gemini-omni-flash`.
2. Public label: `Gemini Omni Flash`.
3. Provider key: `google_vertex_omni_direct`.
4. Model id sent to Google: `gemini-omni-flash-preview`.
5. Initial supported app modes:
   - `t2v`: text-to-video.
   - `i2v`: image-to-video.
   - `ref2v`: reference-to-video with multiple images.
   - `v2v`: video edit from uploaded/source video.
   - `retake`: conversational follow-up edit for an existing Omni output using `previous_interaction_id`.
6. Do not expose `extend` or `fl2v` for Omni. Google docs currently call those unsupported for Omni Flash.
7. Do not expose negative prompt or seed for Omni. Google docs currently call those unsupported.
8. Keep routing admin-only by default:
   - `GOOGLE_VERTEX_OMNI_ENABLED=false` by default.
   - `GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true` by default.
   - `GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false` by default.
9. Use `response_format: "url"` by default so video payloads do not bloat provider snapshots.
10. Store `interactionId` in `app_jobs.settings_snapshot.provider.omni.interactionId` and `provider_attempts.response_snapshot.interactionId`.
11. Use `store: true` only when follow-up editing is enabled or when the user explicitly chooses an editable session. Use `store: false` for stateless generation once Google confirms it supports video output without losing retrieval.
12. Launch marketing surfaces as `limited` or `early_access` until actual account quota and pricing are confirmed.

## File Map

### Provider Runtime

- Create: `frontend/src/server/video-providers/google-vertex-omni/client.ts`
  - Shared service-account OAuth, Interactions API create/fetch/download methods, and API base URL construction.
- Create: `frontend/src/server/video-providers/google-vertex-omni/model-map.ts`
  - Engine id, provider model, supported modes, supported aspect ratios, runtime option repair, and support validation.
- Create: `frontend/src/server/video-providers/google-vertex-omni/payload.ts`
  - Convert MaxVideoAI `GeneratePayload` into Interactions API request bodies.
- Create: `frontend/src/server/video-providers/google-vertex-omni/response.ts`
  - Normalize interaction responses into `NormalizedVideoProviderTask` and extract video output URI/file data.
- Create: `frontend/src/server/video-providers/google-vertex-omni/errors.ts`
  - Classify auth, access/quota, moderation, unsupported params, timeout, provider unavailable, and invalid response errors.
- Create: `frontend/src/server/video-providers/google-vertex-omni/cost.ts`
  - Initial provider cost estimate with a clearly marked preview/public-pricing source.
- Create: `frontend/src/server/video-providers/google-vertex-omni/index.ts`
  - Adapter export for provider router/submission use.
- Create: `frontend/src/server/video-providers/google-vertex-omni/media-input.ts`
  - Fetch and normalize image/video inputs, plus safe MIME/size validation.

### Generation And Polling

- Modify: `frontend/src/server/video-providers/router.ts`
  - Add Omni direct routing plan and env gates.
- Modify: `frontend/app/api/generate/_lib/video-provider-submission.ts`
  - Dispatch Omni routing plan to the Omni submission helper.
- Create: `frontend/app/api/generate/_lib/google-vertex-omni-submission.ts`
  - Submit Omni interactions, create provider attempts, update `app_jobs`, and fallback only when explicitly allowed.
- Create: `frontend/server/google-vertex-omni-poll.ts`
  - Poll stored Omni interactions, copy output into MaxVideoAI storage, complete jobs, or mark retry/stalled.
- Create: `frontend/app/api/cron/google-vertex-omni-poll/route.ts`
  - Token-protected cron route.
- Modify: `frontend/vercel.json`
  - Add `google-vertex-omni-poll` schedule.

### Engine Catalog And Workspace Option Surface

- Create: `frontend/src/config/fal-engines/gemini-omni-flash.ts`
  - Register the engine in the existing engine registry shape even though direct routing uses Google.
- Modify: `frontend/src/config/fal-engines/registry.ts`
  - Include `GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY`.
- Modify: `frontend/src/config/falEngines.ts`
  - Add slug aliases such as `gemini-omni-flash`, `google-omni-flash`, `omni-flash`, and `gemini-omni`.
- Modify: `frontend/types/engines.ts`
  - Only if needed, add schema metadata for advanced option grouping. Do not add a new `Mode` unless `v2v` and `retake` cannot express the workflows.
- Create: `docs/model-launch/gemini-omni-flash-ui-brief.md`
  - Product Design brief, design constraints, selected visual direction, and UX acceptance criteria.
- Create: `docs/model-launch/gemini-omni-flash-ui/`
  - Saved Image Gen concept previews and selected mock reference for implementation.
- Modify: workspace input helpers under `frontend/app/(core)/(workspace)/app/_lib/`
  - Preserve `previous_interaction_id` and Omni advanced options in `extraInputValues`.
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx`
  - Focused Omni workbench mounted inside the existing composer surface.
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniTaskTabs.client.tsx`
  - Task/mode selection for Generate, Reference, Edit Video, and Refine.
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniSourceStack.client.tsx`
  - Compact source media stack for image, reference image, source video, and previous output inputs.
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniSessionStrip.client.tsx`
  - Previous interaction/session selector and editable-session toggle.
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniDirectionFields.client.tsx`
  - Focused prompt-adjacent controls for edit, camera, and sound direction.
- Create: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceOmniState.ts`
  - Route-local state for Omni-only UI concerns such as selected session, task-derived field visibility, and validation state.
- Create: `frontend/app/(core)/(workspace)/app/_lib/workspace-omni-options.ts`
  - Pure helpers for normalizing Omni options into `extraInputValues`.
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
  - Mount the Omni studio panel only when selected engine is `gemini-omni-flash`.

### Pricing And Admin

- Modify: `frontend/src/lib/pricing-definition.ts`
  - Add preview pricing definition or guard if pricing is not final.
- Modify: `frontend/src/lib/pricing-rules.ts`
  - Add rule key for `gemini-omni-flash`.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
  - Include Omni in pricing hub only with preview language until provider pricing is confirmed.
- Modify: admin pricing surfaces only if they filter known engine ids:
  - `frontend/app/(core)/admin/pricing/_lib/pricing-admin-helpers.ts`
  - `frontend/app/(core)/admin/pricing/_components/NewPricingRuleCard.tsx`

### Marketing Model Page, Specs, Examples

- Create: `docs/model-launch/gemini-omni-flash-seo-research.md`
  - SERP research, keyword/intent clusters, source URLs, ranking pages, differentiation notes, and launch recommendation.
- Create: `docs/model-launch/gemini-omni-flash-cannibalization-map.md`
  - Page ownership matrix for model, comparison, examples, pricing, docs/blog, and Vertex implementation intents.
- Create: `docs/model-launch/gemini-omni-flash-linking-plan.md`
  - Internal-link source/target/anchor plan with localized paths and no link stuffing.
- Modify: `frontend/config/model-roster.json`
  - Add `gemini-omni-flash` with `availability: "limited"` initially.
- Modify: `frontend/config/model-families.ts`
  - Add an `omni` or `gemini-omni` family, or add this under an existing Google family only if the catalog already treats Google image/video models together.
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/gemini-omni-flash.ts`
  - Hero CTA, pricing presets, quick links, and section flags.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
  - Register the new template.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts`
  - Add specs: modes, duration, aspect ratios, input types, output type, unsupported options, launch stage.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-key-specs.ts`
  - Add hero spec cards.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-default-copy.ts`
  - Add fallback localized copy if not template-driven.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`
  - Add model hero/demo media. Use generated or captured real product media; do not leave stock-like placeholders.
- Modify: `frontend/lib/seo/internal-link-builder.ts` and related helpers only if the new page needs explicit internal link recommendations.
- Modify: `frontend/public/llms.txt` only if Omni becomes a public/indexable strategic page.
- Modify examples files if this should appear in examples:
  - `frontend/lib/examples/modelLandingData.en.ts`
  - `frontend/lib/examples/modelLandingData.fr.ts`
  - `frontend/lib/examples/modelLandingData.es.ts`

### Compare Pages And Notes

- Modify: `frontend/config/compare-config.json`
  - Add selected Omni comparisons and decide whether each is full showdown or scoreboard-only.
- Modify: `frontend/config/compare-hub.json`
  - Include Omni in relevant use-case buckets.
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config.ts`
  - Ensure `gemini-omni-flash` appears in `ENGINE_OPTIONS` / catalog resolution.
- Modify localized overrides:
  - `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
  - `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
  - `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Target comparison pages:
  - `/ai-video-engines/gemini-omni-flash-vs-veo-3-1`
  - `/ai-video-engines/gemini-omni-flash-vs-veo-3-1-fast`
  - `/ai-video-engines/gemini-omni-flash-vs-sora-2`
  - `/ai-video-engines/gemini-omni-flash-vs-seedance-2-0`
- Add notes that Omni is for stateful prompt/reference/video editing, while Veo remains the better page for first/last, extend, and 4K paths if Omni limitations still apply.

### Docs And Operations

- Create: `docs/engineering/google-vertex-omni.md`
  - Env vars, rollout gates, quotas, polling, storage, limitations, and fallback policy.
- Modify: `.env.example` or deployment docs if present.
- Modify: `docs/engineering/llm-working-guide.md` only if this creates a new recurring provider pattern that future agents need.

## Env Vars

Add and document:

```txt
GOOGLE_VERTEX_OMNI_ENABLED=false
GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true
GOOGLE_VERTEX_OMNI_FALLBACK_TO_FAL_ENABLED=false
GOOGLE_VERTEX_OMNI_PROJECT_ID=
GOOGLE_VERTEX_OMNI_LOCATION=global
GOOGLE_VERTEX_OMNI_API_BASE_URL=
GOOGLE_VERTEX_OMNI_SERVICE_ACCOUNT_JSON=
GOOGLE_VERTEX_OMNI_OUTPUT_GCS_URI=
GOOGLE_VERTEX_OMNI_INPUT_GCS_URI=
GOOGLE_VERTEX_OMNI_POLL_TOKEN=
GOOGLE_VERTEX_OMNI_STORE_INTERACTIONS=true
```

Prefer reusing `GOOGLE_VERTEX_PROJECT_ID`, `GOOGLE_VERTEX_LOCATION`, and `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` when Omni-specific vars are absent, but keep Omni-specific overrides so rollout can use a separate project/quota.

## Advanced Option Surface

Expose these through engine schema and the dedicated `OmniStudioPanel.client.tsx`:

```ts
type OmniAdvancedOptions = {
  task: 'text_to_video' | 'image_to_video' | 'reference_to_video' | 'video_edit';
  aspectRatio: '16:9' | '9:16';
  responseFormat: 'url';
  storeInteraction: boolean;
  previousInteractionId?: string;
  usePreviousOutput: boolean;
  editableSessionName?: string;
  promptAudioDirection?: string;
  promptCameraDirection?: string;
  promptEditInstruction?: string;
  sourceImageUrl?: string;
  referenceImageUrls?: string[];
  sourceVideoUrl?: string;
};
```

The UI should translate these into four user-facing tasks without showing provider jargon:

```ts
type OmniStudioTask = {
  generate: 'prompt-only video';
  reference: 'image or reference-guided video';
  edit: 'edit an uploaded or existing video';
  refine: 'continue from a previous Omni output';
};
```

The UI must include these visible states:

- Empty state with task tabs and no uploaded media.
- Image/reference state with media chips and replace/remove controls.
- Source video edit state with a source video chip, duration metadata, and edit instruction field.
- Refine state with previous output/session chip and visible `previousInteractionId` stored in hidden form state only.
- Validation state for unsupported combinations such as Refine without a previous interaction, Reference without images, Edit without video, or unsupported aspect ratio.
- Admin/preview-gated state when `GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED` is off.

Do not expose these as active options unless Google docs change:

```ts
type UnsupportedOmniOptions = {
  negativePrompt: never;
  seed: never;
  firstLastFrame: never;
  extend: never;
  audioReferenceUpload: never;
  outputResolution4k: never;
};
```

## Task 1: Provider Model Map And Support Validation

**Files:**
- Create: `frontend/src/server/video-providers/google-vertex-omni/model-map.ts`
- Test: `tests/google-vertex-omni-routing.test.ts`

- [ ] **Step 1: Write the failing routing/model-map tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOOGLE_VERTEX_OMNI_PROVIDER,
  applyGoogleVertexOmniRuntimeOptions,
  isGoogleVertexOmniEngine,
  resolveGoogleVertexOmniModelRoute,
  resolveGoogleVertexOmniSupport,
} from '../frontend/src/server/video-providers/google-vertex-omni/model-map';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

test('Gemini Omni Flash model map uses the Vertex Agent Platform preview model id', () => {
  assert.equal(GOOGLE_VERTEX_OMNI_PROVIDER, 'google_vertex_omni_direct');
  assert.equal(isGoogleVertexOmniEngine('gemini-omni-flash'), true);
  const route = resolveGoogleVertexOmniModelRoute('gemini-omni-flash');
  assert.equal(route.providerModel, 'gemini-omni-flash-preview');
  assert.equal(route.launchStage, 'preview');
  assert.deepEqual(route.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'retake']);
  assert.deepEqual(route.aspectRatios, ['16:9', '9:16']);
});

test('Gemini Omni Flash support rejects unsupported Veo-only controls', () => {
  const base = { engineId: 'gemini-omni-flash', mode: 't2v', aspectRatio: '16:9', prompt: 'Studio product ad' };
  assert.equal(resolveGoogleVertexOmniSupport({ ...base }).supported, true);
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, aspectRatio: '1:1' }).reason, 'aspect_ratio_not_supported');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, mode: 'extend' }).reason, 'unsupported_mode');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, negativePrompt: 'bad anatomy' }).reason, 'negative_prompt_not_supported');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, seed: 123 }).reason, 'seed_not_supported');
});

test('Gemini Omni Flash routing is admin-only by default and gated independently from Veo', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'gemini-omni-flash',
      mode: 't2v',
      isAdmin: false,
      env: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'false',
        GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'gemini-omni-flash',
      mode: 't2v',
      isAdmin: true,
      env: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'true',
      },
    }),
    {
      kind: 'google_vertex_omni_primary',
      primaryProvider: 'google_vertex_omni_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: false,
    }
  );
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-routing.test.ts
```

Expected: FAIL because `google-vertex-omni/model-map.ts` does not exist and router does not know the Omni plan.

- [ ] **Step 3: Implement minimal model-map and router plan**

Add:

```ts
export const GOOGLE_VERTEX_OMNI_PROVIDER = 'google_vertex_omni_direct' as const;
export type GoogleVertexOmniEngineId = 'gemini-omni-flash';
export type GoogleVertexOmniMode = 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'retake';
```

In `router.ts`, add a new `google_vertex_omni_primary` plan and env gates mirroring the Veo direct pattern with Omni-specific env names.

- [ ] **Step 4: Run test and verify it passes**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-routing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/server/video-providers/google-vertex-omni/model-map.ts frontend/src/server/video-providers/router.ts tests/google-vertex-omni-routing.test.ts
git commit -m "feat: add Gemini Omni Flash Vertex routing map"
```

## Task 2: Interactions API Client

**Files:**
- Create: `frontend/src/server/video-providers/google-vertex-omni/client.ts`
- Test: `tests/google-vertex-omni-client.test.ts`

- [ ] **Step 1: Write failing client tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { GoogleVertexOmniClient } from '../frontend/src/server/video-providers/google-vertex-omni/client';

test('Gemini Omni client builds Agent Platform Interactions API URLs', async () => {
  const requests: Array<{ url: string; method: string; body?: unknown }> = [];
  const client = new GoogleVertexOmniClient({
    projectId: 'demo-project',
    location: 'global',
    apiBaseUrl: 'https://aiplatform.googleapis.com',
    serviceAccount: { client_email: 'svc@example.com', private_key: TEST_PRIVATE_KEY, token_uri: 'https://oauth2.googleapis.com/token' },
    getAccessTokenForTest: async () => 'test-token',
    fetchFn: async (url, init) => {
      requests.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({ name: 'interactions/abc123', status: 'RUNNING' }), { status: 200 });
    },
  });

  await client.createInteraction({
    model: 'gemini-omni-flash-preview',
    input: [{ role: 'user', content: [{ type: 'text', text: 'Generate a cinematic product shot' }] }],
    generation_config: { video_config: { task: 'text_to_video', aspect_ratio: '16:9' } },
    response_format: 'url',
    background: true,
    store: true,
  });

  assert.match(requests[0]?.url ?? '', /projects\/demo-project\/locations\/global\/models\/interactions:create/);
  assert.equal(requests[0]?.method, 'POST');
  assert.equal((requests[0]?.body as Record<string, unknown>).model, 'gemini-omni-flash-preview');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-client.test.ts
```

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement client**

Reuse the Veo OAuth approach. Keep a local `requestJson()` helper with timeout and user-safe error wrapping. Add methods:

```ts
createInteraction(request: GoogleVertexOmniInteractionRequest): Promise<GoogleVertexOmniInteraction>
fetchInteraction(nameOrId: string): Promise<GoogleVertexOmniInteraction>
downloadOutputUri(uri: string): Promise<{ data: Buffer; mime: string }>
```

- [ ] **Step 4: Run test and verify it passes**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-client.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/server/video-providers/google-vertex-omni/client.ts tests/google-vertex-omni-client.test.ts
git commit -m "feat: add Gemini Omni Flash interactions client"
```

## Task 3: Payload Builder With Full Supported Options

**Files:**
- Create: `frontend/src/server/video-providers/google-vertex-omni/payload.ts`
- Create: `frontend/src/server/video-providers/google-vertex-omni/media-input.ts`
- Test: `tests/google-vertex-omni-payload.test.ts`

- [ ] **Step 1: Write failing payload tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGoogleVertexOmniPayload } from '../frontend/src/server/video-providers/google-vertex-omni/payload';

test('Omni text-to-video payload uses Interactions video_config task and URL response format', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 't2v',
    prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
    aspectRatio: '16:9',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A 16:9 cinematic hero shot of a matte black espresso machine',
      mode: 't2v',
      aspectRatio: '16:9',
      extraInputValues: { store_interaction: true, prompt_audio_direction: 'soft cafe ambience' },
    },
  });

  assert.equal(payload.model, 'gemini-omni-flash-preview');
  assert.equal(payload.response_format, 'url');
  assert.equal(payload.background, true);
  assert.equal(payload.store, true);
  assert.deepEqual(payload.generation_config.video_config, {
    task: 'text_to_video',
    aspect_ratio: '16:9',
  });
  assert.match(JSON.stringify(payload.input), /soft cafe ambience/);
});

test('Omni retake payload preserves previous interaction id', async () => {
  const payload = await buildGoogleVertexOmniPayload({
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    prompt: 'Make the camera slower and add more steam',
    aspectRatio: '16:9',
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Make the camera slower and add more steam',
      mode: 'retake',
      aspectRatio: '16:9',
      extraInputValues: { previous_interaction_id: 'interactions/abc123' },
    },
  });

  assert.equal(payload.previous_interaction_id, 'interactions/abc123');
  assert.equal(payload.generation_config.video_config.task, 'video_edit');
});

test('Omni payload rejects unsupported negative prompt and seed before provider call', async () => {
  await assert.rejects(
    () =>
      buildGoogleVertexOmniPayload({
        engineId: 'gemini-omni-flash',
        mode: 't2v',
        prompt: 'test',
        aspectRatio: '16:9',
        negativePrompt: 'bad',
        falPayload: { engineId: 'gemini-omni-flash', prompt: 'test', mode: 't2v', aspectRatio: '16:9' },
      }),
    /negative prompt/i
  );
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-payload.test.ts
```

Expected: FAIL because payload builder does not exist.

- [ ] **Step 3: Implement payload builder**

Map modes:

```ts
const OMNI_TASK_BY_MODE = {
  t2v: 'text_to_video',
  i2v: 'image_to_video',
  ref2v: 'reference_to_video',
  v2v: 'video_edit',
  retake: 'video_edit',
} as const;
```

Normalize `extraInputValues` keys:

```ts
store_interaction | storeInteraction -> boolean
previous_interaction_id | previousInteractionId -> string
prompt_audio_direction | promptAudioDirection -> text appended to prompt context
prompt_camera_direction | promptCameraDirection -> text appended to prompt context
prompt_edit_instruction | promptEditInstruction -> text appended to prompt context
```

Validate:

- prompt required.
- aspect ratio must be `16:9` or `9:16`.
- `i2v` requires `imageUrl`.
- `ref2v` requires at least one reference image.
- `v2v` requires `videoUrl`.
- `retake` requires `previous_interaction_id`.
- negative prompt and seed throw unsupported-param errors.

- [ ] **Step 4: Run test and verify it passes**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-payload.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/server/video-providers/google-vertex-omni/payload.ts frontend/src/server/video-providers/google-vertex-omni/media-input.ts tests/google-vertex-omni-payload.test.ts
git commit -m "feat: build Gemini Omni Flash interaction payloads"
```

## Task 4: Response Normalization, Submission, Polling

**Files:**
- Create: `frontend/src/server/video-providers/google-vertex-omni/response.ts`
- Create: `frontend/src/server/video-providers/google-vertex-omni/errors.ts`
- Create: `frontend/src/server/video-providers/google-vertex-omni/cost.ts`
- Create: `frontend/src/server/video-providers/google-vertex-omni/index.ts`
- Create: `frontend/app/api/generate/_lib/google-vertex-omni-submission.ts`
- Create: `frontend/server/google-vertex-omni-poll.ts`
- Create: `frontend/app/api/cron/google-vertex-omni-poll/route.ts`
- Modify: `frontend/app/api/generate/_lib/video-provider-submission.ts`
- Modify: `frontend/vercel.json`
- Test: `tests/google-vertex-omni-submission.test.ts`
- Test: `tests/google-vertex-omni-poll.test.ts`

- [ ] **Step 1: Write failing poll test**

Use `tests/google-vertex-veo-poll.test.ts` as the pattern. Assert:

- pending Omni jobs are selected by provider `google_vertex_omni_direct`.
- provider output is copied into MaxVideoAI storage before completion.
- `interactionId` is stored in job settings.
- `provider_attempts` does not store binary/video payloads.
- cron route uses header `x-google-vertex-omni-poll-token`.

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-poll.test.ts
```

Expected: FAIL because poller/route do not exist.

- [ ] **Step 3: Implement response and poller**

Normalize states:

```ts
RUNNING | PENDING | QUEUED -> running
SUCCEEDED | COMPLETED | DONE -> completed
FAILED | CANCELLED | EXPIRED -> failed
```

Output extraction order:

1. provider URL / URI response from Interactions API.
2. file URI from output content.
3. inline bytes only if Google returns them.

Completion order:

1. fetch interaction.
2. extract output.
3. copy to MaxVideoAI storage.
4. generate thumbnail/preview/keyframes via existing helpers.
5. update `app_jobs` to completed.
6. mark provider attempt finished with sanitized snapshot.

- [ ] **Step 4: Add submission helper**

Follow `google-vertex-veo-submission.ts` structure:

- create provider attempt.
- build payload.
- call `createInteraction`.
- update `app_jobs.provider`, `provider_job_id`, progress/message.
- return accepted response for local render polling.
- only fallback to fal if explicitly enabled and if fal route exists; for Omni, initial fallback should normally stay disabled.

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-submission.test.ts tests/google-vertex-omni-poll.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/server/video-providers/google-vertex-omni frontend/app/api/generate/_lib/google-vertex-omni-submission.ts frontend/app/api/generate/_lib/video-provider-submission.ts frontend/server/google-vertex-omni-poll.ts frontend/app/api/cron/google-vertex-omni-poll/route.ts frontend/vercel.json tests/google-vertex-omni-submission.test.ts tests/google-vertex-omni-poll.test.ts
git commit -m "feat: submit and poll Gemini Omni Flash Vertex jobs"
```

## Task 5: Product Design Brief And Existing Workspace Audit

**Files:**
- Create: `docs/model-launch/gemini-omni-flash-ui-brief.md`
- Inspect: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Inspect: `frontend/app/(core)/(workspace)/app/_components/WorkspaceAppShell.tsx`
- Inspect: `frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs.ts`
- Inspect: current workspace screenshots if the app can be run locally

- [ ] **Step 1: Run Product Design context preflight**

Run:

```bash
cd /Users/adrienmillot/.codex/plugins/cache/openai-curated-remote/product-design/0.1.47/skills/user-context
python3 scripts/user_context_preflight.py
```

Expected: the command prints saved Product Design context if it exists. If no context exists, use the MaxVideoAI repo as the visual source and document that no saved Product Design context was available.

- [ ] **Step 2: Inspect the current workspace UI and component boundaries**

Run:

```bash
rg -n "Composer|SettingsControls|CoreSettingsBar|WorkspaceComposerSurface|inputSchema|extraInputValues" frontend/app/\(core\)/\(workspace\)/app frontend/src/lib frontend/types
sed -n '1,260p' frontend/app/\(core\)/\(workspace\)/app/_components/WorkspaceComposerSurface.tsx
sed -n '1,220p' frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-generation-inputs.ts
```

Expected: identify the current composer/settings patterns, which controls are generic schema-driven, and where a route-local Omni panel can be mounted without moving responsibilities into `AppClient.tsx`.

- [ ] **Step 3: Capture visual references before any Image Gen work**

If the app can run locally, start it and capture desktop and mobile screenshots of the existing workspace composer with a current Google/Veo engine selected:

```bash
npm --prefix frontend run dev
```

Capture:

- Desktop: `1440 x 1024`, workspace composer open.
- Mobile: `390 x 844`, composer/settings visible.
- Existing upload/reference media state if easy to reach.

Save captures under:

```txt
docs/model-launch/gemini-omni-flash-ui/workspace-desktop-reference.png
docs/model-launch/gemini-omni-flash-ui/workspace-mobile-reference.png
```

Expected: screenshots show real MaxVideoAI spacing, typography, dark/light treatment, composer density, and control patterns for grounding Image Gen.

- [ ] **Step 4: Write the design brief**

Create `docs/model-launch/gemini-omni-flash-ui-brief.md` with this structure:

```md
# Gemini Omni Flash UI Brief

## Product Goal

Design a dedicated Omni Studio surface inside the existing MaxVideoAI workspace composer. It should make Gemini Omni Flash feel like a high-control Google Vertex video tool, not a generic advanced-options drawer.

## User Jobs

- Generate a prompt-only video.
- Generate from one source image.
- Generate from multiple reference images.
- Edit a source video with concise instructions.
- Refine a previous Omni output through a stored interaction/session.

## Visual Source

Match the current MaxVideoAI workspace composer and settings design. Use captured workspace screenshots and route-local component patterns as the source of truth.

## Interactivity Level

Full interactivity for task tabs, source media chips, edit/refine validation, aspect ratio selection, editable-session toggle, previous-output selection, and payload state.

## Must Expose

- Task: Generate, Reference, Edit Video, Refine.
- Aspect ratio: 16:9 and 9:16.
- Store/editable session toggle.
- Previous interaction id through selected previous output state.
- Source image, reference images, source video.
- Camera direction, sound direction, edit instruction.

## Must Not Expose

- Negative prompt.
- Seed.
- First/last frame.
- Extend.
- 4K toggle.
- Audio reference upload.

## UX Constraints

- No cards inside cards.
- No long instructional paragraphs inside the app.
- Use existing icon/button/toggle/segmented-control patterns.
- Keep text readable and non-overlapping at desktop and mobile widths.
- Keep `AppClient.tsx` as orchestration only.
```

- [ ] **Step 5: Confirm brief before ideation**

Send the brief summary to the user:

```text
Brief UI Omni: a dedicated Omni Studio inside the existing workspace composer, with four tasks: Generate, Reference, Edit Video, Refine. It should match the current MaxVideoAI workspace, expose Vertex Omni controls cleanly, and avoid unsupported controls like seed, negative prompt, first/last, extend and 4K. Full interactivity is expected.
```

Expected: do not proceed to Image Gen until the user confirms or edits this brief.

- [ ] **Step 6: Commit**

```bash
git add docs/model-launch/gemini-omni-flash-ui-brief.md docs/model-launch/gemini-omni-flash-ui
git commit -m "docs: define Gemini Omni Flash UI brief"
```

## Task 6: Image Gen Omni Studio Visual Exploration

**Files:**
- Create: `docs/model-launch/gemini-omni-flash-ui/concept-1-omni-console.png`
- Create: `docs/model-launch/gemini-omni-flash-ui/concept-2-session-timeline.png`
- Create: `docs/model-launch/gemini-omni-flash-ui/concept-3-director-board.png`
- Create: `docs/model-launch/gemini-omni-flash-ui/selected-desktop.png`
- Create: `docs/model-launch/gemini-omni-flash-ui/selected-mobile.png`
- Modify: `docs/model-launch/gemini-omni-flash-ui-brief.md`

- [ ] **Step 1: Generate exactly three desktop concepts with Image Gen**

Use Product Design `$ideate` after the brief is confirmed. Generate exactly three independent `1440 x 1024` UI mockups. Use the built-in Image Gen tool, attach or reference the captured workspace screenshots when available, and save the generated previews in `docs/model-launch/gemini-omni-flash-ui/`.

Prompt for concept 1:

```text
Use case: ui-mockup
Asset type: desktop SaaS workspace composer panel, 1440 x 1024
Primary request: Design "Omni Console", a dedicated Gemini Omni Flash control surface inside the existing MaxVideoAI workspace composer. It must match MaxVideoAI's current product UI density, typography, dark workspace feel, compact controls, and generation workflow.
Visual source: current MaxVideoAI workspace composer screenshots and route-local component patterns.
Layout: One focused composer surface with top task tabs for Generate, Reference, Edit Video, Refine; a central prompt area; a right-side compact source stack; a bottom settings row for aspect ratio, editable session, and output handling. Use icons, segmented controls, toggles, chips, and concise labels.
Must expose: aspect ratio 16:9/9:16, source image, reference images, source video, previous output/session, camera direction, sound direction, edit instruction, editable session toggle.
Must avoid: seed, negative prompt, first/last frame, extend, 4K, audio reference upload, provider jargon, long instructional paragraphs, cards inside cards, overlapping text.
Presentation: production-quality UI, readable 14-16px body text, restrained color, no marketing hero, no browser chrome.
```

Prompt for concept 2:

```text
Use case: ui-mockup
Asset type: desktop SaaS workspace composer panel, 1440 x 1024
Primary request: Design "Session Timeline", a Gemini Omni Flash workflow surface centered on stateful video refinement. It should make previous outputs and follow-up edits feel first-class while staying inside the MaxVideoAI workspace composer.
Visual source: current MaxVideoAI workspace composer screenshots and route-local component patterns.
Layout: Left task rail for Generate, Reference, Edit Video, Refine; central prompt and edit-instruction stack; horizontal session strip showing previous output chips and interaction continuity; compact media source area below prompt; bottom validation/pricing row.
Must expose: previous interaction/session selection, editable session toggle, source video edit state, reference images, aspect ratio, sound direction, camera direction.
Must avoid: seed, negative prompt, first/last frame, extend, 4K, audio reference upload, provider jargon, long instructional paragraphs, nested cards.
Presentation: quiet operational UI, dense but organized, clear hierarchy, no decorative blobs or marketing styling.
```

Prompt for concept 3:

```text
Use case: ui-mockup
Asset type: desktop SaaS workspace composer panel, 1440 x 1024
Primary request: Design "Director Board", a Gemini Omni Flash workspace for creative direction where prompt, source media, camera notes, sound notes, and edit intent are composed together.
Visual source: current MaxVideoAI workspace composer screenshots and route-local component patterns.
Layout: Top mode segmented control; source media board directly under mode; large prompt field; three compact direction fields for Edit, Camera, Sound; right preview/session summary; bottom action bar with aspect ratio, editable session, and generate button.
Must expose: Generate, Reference, Edit Video, Refine workflows; source image/reference/source video/previous output states; aspect ratio 16:9/9:16; session storage; concise validation states.
Must avoid: seed, negative prompt, first/last frame, extend, 4K, audio reference upload, verbose helper copy, cards inside cards, oversized hero type.
Presentation: polished production UI, readable text, stable dimensions, realistic spacing, no browser chrome.
```

Expected: three visually distinct directions, each with the same hard capability constraints.

- [ ] **Step 2: Present concepts and wait for selection**

Ask:

```text
Which direction should become the implementation target: 1 Omni Console, 2 Session Timeline, or 3 Director Board? You can also ask for a hybrid before we build.
```

Expected: no code changes until the user selects or revises a direction.

- [ ] **Step 3: Generate selected desktop and mobile refinements**

After selection, generate:

- `selected-desktop.png`: `1440 x 1024`, complete first implementation target.
- `selected-mobile.png`: `390 x 844`, same controls adapted to mobile without overlap.

Prompt:

```text
Use case: ui-mockup
Asset type: final responsive UI target for implementation
Primary request: Refine the selected Gemini Omni Flash Omni Studio concept into an implementation-ready MaxVideoAI workspace surface. Preserve the selected concept's layout strategy while matching the current workspace design language.
Desktop target: 1440 x 1024
Mobile target: 390 x 844
Must include states: Generate, Reference, Edit Video, Refine; empty media state; selected source image/reference chips; source video edit state; previous output/session chip; aspect ratio control; editable session toggle; camera/sound/edit instruction fields; validation state.
Must avoid: unsupported controls, long instructions, overlapping text, clipped labels, nested cards, marketing styling.
```

- [ ] **Step 4: Update brief with selected direction**

Append:

```md
## Selected Direction

Selected concept: <Omni Console | Session Timeline | Director Board | Hybrid>

Desktop reference: `docs/model-launch/gemini-omni-flash-ui/selected-desktop.png`

Mobile reference: `docs/model-launch/gemini-omni-flash-ui/selected-mobile.png`

Implementation notes:

- <specific selected layout choices>
- <specific states that must be implemented>
- <specific details to avoid>
```

- [ ] **Step 5: Commit**

```bash
git add docs/model-launch/gemini-omni-flash-ui docs/model-launch/gemini-omni-flash-ui-brief.md
git commit -m "design: explore Gemini Omni Flash workspace UI"
```

## Task 7: Engine Registry And Workspace Data Contract

**Files:**
- Create: `frontend/src/config/fal-engines/gemini-omni-flash.ts`
- Modify: `frontend/src/config/fal-engines/registry.ts`
- Modify: `frontend/src/config/falEngines.ts`
- Modify: route-local generation payload helpers under `frontend/app/(core)/(workspace)/app/_lib/`
- Test: `tests/workspace-generation-inputs.test.ts`
- Test: `tests/workspace-generation-request-helpers.test.ts`
- Test: `tests/google-vertex-omni-engine-catalog.test.ts`

- [ ] **Step 1: Write failing engine catalog test**

Assert `getBaseEngines()` includes `gemini-omni-flash` with:

- modes `['t2v', 'i2v', 'ref2v', 'v2v', 'retake']`.
- aspect ratios `['16:9', '9:16']`.
- no seed field.
- no negative prompt field.
- no extend or first/last fields.
- optional fields for `store_interaction`, `previous_interaction_id`, `response_format`, `prompt_audio_direction`, `prompt_camera_direction`, and `prompt_edit_instruction`.

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-engine-catalog.test.ts
```

Expected: FAIL because the engine is not registered.

- [ ] **Step 3: Add engine registry entry**

Use the existing `RawFalEngineEntry` shape but make direct routing responsible for runtime submission. Suggested engine fields:

```ts
id: 'gemini-omni-flash'
label: 'Gemini Omni Flash'
provider: 'Google'
version: 'Preview'
status: 'early_access'
latencyTier: 'standard'
region: 'global'
modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'retake']
maxDurationSec: 8
resolutions: ['720p']
aspectRatios: ['16:9', '9:16']
fps: [24]
audio: true
motionControls: false
keyframes: false
availability: 'limited'
brandId: 'google'
```

- [ ] **Step 4: Preserve Omni option payload state**

Update workspace request helpers so these UI fields land in `extraInputValues`:

```ts
{
  response_format: 'url',
  store_interaction: boolean,
  previous_interaction_id: string | null,
  prompt_audio_direction: string | null,
  prompt_camera_direction: string | null,
  prompt_edit_instruction: string | null
}
```

Expected: server payload tests in Task 3 can consume the same key names the workspace sends.

- [ ] **Step 5: Run workspace and catalog tests**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-engine-catalog.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config/fal-engines/gemini-omni-flash.ts frontend/src/config/fal-engines/registry.ts frontend/src/config/falEngines.ts frontend/app/\(core\)/\(workspace\)/app/_lib tests/google-vertex-omni-engine-catalog.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts
git commit -m "feat: add Gemini Omni Flash engine contract"
```

## Task 8: Build Selected Omni Studio UI

**Files:**
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniStudioPanel.client.tsx`
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniTaskTabs.client.tsx`
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniSourceStack.client.tsx`
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniSessionStrip.client.tsx`
- Create: `frontend/app/(core)/(workspace)/app/_components/omni/OmniDirectionFields.client.tsx`
- Create: `frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceOmniState.ts`
- Create: `frontend/app/(core)/(workspace)/app/_lib/workspace-omni-options.ts`
- Modify: `frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx`
- Test: `tests/workspace-omni-ui-contract.test.ts`
- Test: `tests/workspace-composer-generation-split-contract.test.ts`

- [ ] **Step 1: Write failing UI architecture contract**

Create `tests/workspace-omni-ui-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const omniDir = join(root, 'frontend/app/(core)/(workspace)/app/_components/omni');
const composerPath = join(root, 'frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface.tsx');
const appClientPath = join(root, 'frontend/app/(core)/(workspace)/app/AppClient.tsx');

test('Omni Studio UI stays route-local and out of AppClient orchestration', () => {
  for (const file of [
    'OmniStudioPanel.client.tsx',
    'OmniTaskTabs.client.tsx',
    'OmniSourceStack.client.tsx',
    'OmniSessionStrip.client.tsx',
    'OmniDirectionFields.client.tsx',
  ]) {
    assert.ok(existsSync(join(omniDir, file)), `${file} should exist`);
  }

  const composer = readFileSync(composerPath, 'utf8');
  const appClient = readFileSync(appClientPath, 'utf8');
  assert.match(composer, /OmniStudioPanel/);
  assert.doesNotMatch(appClient, /OmniStudioPanel|OmniTaskTabs|OmniSourceStack|OmniSessionStrip|OmniDirectionFields/);
});

test('Omni Studio UI does not expose unsupported Omni controls', () => {
  const source = readFileSync(join(omniDir, 'OmniStudioPanel.client.tsx'), 'utf8');
  assert.doesNotMatch(source, /negative prompt/i);
  assert.doesNotMatch(source, /\bseed\b/i);
  assert.doesNotMatch(source, /first.?last/i);
  assert.doesNotMatch(source, /\bextend\b/i);
  assert.doesNotMatch(source, /\b4k\b/i);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/workspace-omni-ui-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts
```

Expected: FAIL because the Omni UI files do not exist.

- [ ] **Step 3: Implement selected UI direction**

Build from `docs/model-launch/gemini-omni-flash-ui/selected-desktop.png` and `selected-mobile.png`, not from prose alone. Requirements:

- `OmniStudioPanel.client.tsx` owns composition only.
- `OmniTaskTabs.client.tsx` renders stable segmented task controls.
- `OmniSourceStack.client.tsx` renders media slots/chips with replace/remove controls.
- `OmniSessionStrip.client.tsx` renders editable-session toggle and previous output chip.
- `OmniDirectionFields.client.tsx` renders edit, camera, and sound fields with compact labels.
- `useWorkspaceOmniState.ts` owns task-derived visibility and validation.
- `workspace-omni-options.ts` converts UI state into `extraInputValues`.
- `WorkspaceComposerSurface.tsx` conditionally mounts the panel when `engineId === 'gemini-omni-flash'`.

Do not add provider-specific UI logic to `AppClient.tsx`.

- [ ] **Step 4: Run UI contract tests**

Run:

```bash
pnpm test:validate -- tests/workspace-omni-ui-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Visual QA with desktop and mobile screenshots**

Run the app:

```bash
npm --prefix frontend run dev
```

Check:

- `/app?engine=gemini-omni-flash` at `1440 x 1024`.
- `/app?engine=gemini-omni-flash` at `390 x 844`.
- Task tab switching does not resize the composer unexpectedly.
- Long labels do not overlap or clip.
- Source chips, toggle, and direction fields remain readable.
- Validation states are visible without long instructional paragraphs.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/\(core\)/\(workspace\)/app/_components/omni frontend/app/\(core\)/\(workspace\)/app/_hooks/useWorkspaceOmniState.ts frontend/app/\(core\)/\(workspace\)/app/_lib/workspace-omni-options.ts frontend/app/\(core\)/\(workspace\)/app/_components/WorkspaceComposerSurface.tsx tests/workspace-omni-ui-contract.test.ts tests/workspace-composer-generation-split-contract.test.ts tests/workspace-generation-inputs.test.ts tests/workspace-generation-request-helpers.test.ts
git commit -m "feat: build Gemini Omni Flash studio UI"
```

## Task 9: Pricing And Billing Notes

**Files:**
- Modify: `frontend/src/lib/pricing-definition.ts`
- Modify: `frontend/src/lib/pricing-rules.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Test: `tests/pricing-model-links.test.ts`
- Test: `tests/google-vertex-omni-pricing.test.ts`

- [ ] **Step 1: Write failing pricing tests**

Assert:

- pricing definition exists for `gemini-omni-flash`.
- pricing displays a preview source note.
- pricing page links to `/models/gemini-omni-flash`.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-pricing.test.ts tests/pricing-model-links.test.ts
```

Expected: FAIL because pricing is not registered.

- [ ] **Step 3: Add conservative pricing**

If Google Cloud pricing is not final for the account, use one of these approaches:

- preferred: admin-only pricing rule with explicit cents per 8s job supplied by operator.
- fallback: blocked preflight for public users with message "Gemini Omni Flash is in limited Vertex preview."

Do not silently reuse Veo pricing unless Google confirms the rate.

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
pnpm test:validate -- tests/google-vertex-omni-pricing.test.ts tests/pricing-model-links.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/pricing-definition.ts frontend/src/lib/pricing-rules.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/pricing/_lib/pricingHubData.ts tests/google-vertex-omni-pricing.test.ts tests/pricing-model-links.test.ts
git commit -m "feat: add Gemini Omni Flash preview pricing"
```

## Task 10: SEO Research, Cannibalization Map, And Internal Linking Plan

**Files:**
- Create: `docs/model-launch/gemini-omni-flash-seo-research.md`
- Create: `docs/model-launch/gemini-omni-flash-cannibalization-map.md`
- Create: `docs/model-launch/gemini-omni-flash-linking-plan.md`
- Test: `tests/google-omni-seo-research-contract.test.ts`

- [ ] **Step 1: Write failing SEO research contract**

Create `tests/google-omni-seo-research-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const researchPath = 'docs/model-launch/gemini-omni-flash-seo-research.md';
const cannibalizationPath = 'docs/model-launch/gemini-omni-flash-cannibalization-map.md';
const linkingPath = 'docs/model-launch/gemini-omni-flash-linking-plan.md';

function read(path: string) {
  assert.ok(existsSync(path), `${path} should exist`);
  return readFileSync(path, 'utf8');
}

test('Gemini Omni Flash SEO research is source-backed before page publication', () => {
  const source = read(researchPath);
  assert.match(source, /# Gemini Omni Flash SEO Research/);
  assert.match(source, /Research Date:/);
  assert.match(source, /## Source Log/);
  assert.match(source, /## Keyword And Intent Map/);
  assert.match(source, /## SERP Findings/);
  assert.match(source, /## Page Strategy/);
  assert.match(source, /Google Cloud|Google AI|Google Search Central/);
  const sourceRows = source.split('\n').filter((line) => /^\| .+ \| https?:\/\//.test(line));
  assert.ok(sourceRows.length >= 8, `expected at least 8 source-backed research rows, got ${sourceRows.length}`);
});

test('Gemini Omni Flash cannibalization map assigns one owner per intent', () => {
  const source = read(cannibalizationPath);
  assert.match(source, /# Gemini Omni Flash Cannibalization Map/);
  for (const intent of [
    'model decision',
    'Vertex implementation',
    'comparison',
    'pricing',
    'examples',
    'workspace generation',
  ]) {
    assert.match(source.toLowerCase(), new RegExp(intent), `${intent} should be mapped`);
  }
  assert.match(source, /\/models\/gemini-omni-flash/);
  assert.match(source, /\/ai-video-engines\/gemini-omni-flash-vs-veo-3-1/);
  assert.match(source, /Noindex Or Do Not Publish/);
});

test('Gemini Omni Flash linking plan controls anchors and avoids link stuffing', () => {
  const source = read(linkingPath);
  assert.match(source, /# Gemini Omni Flash Internal Linking Plan/);
  assert.match(source, /## Required Links/);
  assert.match(source, /## Anchor Rules/);
  assert.match(source, /## Links To Avoid/);
  assert.match(source, /descriptive/i);
  assert.doesNotMatch(source, /click here|read more/i);
  const requiredRows = source.split('\n').filter((line) => /^\| \/.+ \| \/.+ \| .+ \|/.test(line));
  assert.ok(requiredRows.length >= 8, `expected at least 8 planned internal links, got ${requiredRows.length}`);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
pnpm test:validate -- tests/google-omni-seo-research-contract.test.ts
```

Expected: FAIL because the research, cannibalization, and linking docs do not exist.

- [ ] **Step 3: Perform real source-backed research**

Use current web research and official sources. Do not invent search volume. If Semrush or GSC data is unavailable, write `not available in this run` instead of guessing.

Minimum research set:

```txt
gemini omni flash
gemini omni flash vertex ai
gemini omni flash api
gemini omni flash video editing
gemini omni flash vs veo
google omni flash fal ai
vertex ai video generation google
google veo vs gemini omni flash
```

Required sources:

- Google Cloud Omni Flash model docs.
- Google Cloud Interactions API docs.
- Gemini API Omni guide.
- Google Search Central canonicalization docs.
- Google Search Central link best practices.
- Google Search Central helpful content guidance.
- fal.ai Omni Flash page only as a market signal, not as implementation source.
- At least one current SERP snapshot row per target query.

If GSC access is configured, also inspect MaxVideoAI query/page data for:

```txt
veo
gemini
vertex ai
google video
omni flash
video editing ai
reference to video
```

Expected: research doc has a dated source log, target queries, SERP intent, competing page types, and a recommendation for which URLs should be created or withheld.

- [ ] **Step 4: Create keyword and intent map**

`docs/model-launch/gemini-omni-flash-seo-research.md` must include this table shape:

```md
| Query Cluster | Primary Intent | Funnel Stage | Current SERP Pattern | MaxVideoAI Target URL | Publish? | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| gemini omni flash | model overview | awareness/decision | official docs, provider pages, news | /models/gemini-omni-flash | yes | Model page owns broad product decision intent. |
| gemini omni flash vertex ai | implementation/access | technical decision | official Google docs | docs/engineering/google-vertex-omni.md or blog only if public docs are needed | no public page initially | Avoid cannibalizing the model page with implementation content. |
| gemini omni flash vs veo | comparison | decision | comparison/search snippets | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | yes | Comparison page owns explicit vs intent. |
| gemini omni flash pricing | pricing | purchase | pricing docs/provider pages | /pricing#gemini-omni-flash-pricing | conditional | Publish only after real pricing is known. |
```

Expected: every query cluster has exactly one target URL owner or an explicit no-publish decision.

- [ ] **Step 5: Create anti-cannibalization map**

`docs/model-launch/gemini-omni-flash-cannibalization-map.md` must define:

```md
| Intent | Owner URL | Supporting URLs | Pages That Must Not Target This Intent | Canonical Rule | Internal Link Rule |
| --- | --- | --- | --- | --- | --- |
| model decision | /models/gemini-omni-flash | /pricing, selected comparisons | engineering docs, blog implementation posts | self-canonical | Comparisons link back with "Gemini Omni Flash model specs" or equivalent. |
| Vertex implementation | docs/engineering/google-vertex-omni.md | none public at launch | /models/gemini-omni-flash | not public/indexed | Keep implementation details out of model page except high-level access note. |
| comparison | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/gemini-omni-flash, /models/veo-3-1 | /models/gemini-omni-flash | self-canonical | Model page links to only the top 2-3 comparison pages. |
| pricing | /pricing#gemini-omni-flash-pricing | /models/gemini-omni-flash | comparison pages | pricing page self-canonical | Use pricing anchors only where pricing is confirmed. |
| examples | /examples/gemini-omni or no page | /models/gemini-omni-flash | model page | self-canonical if published | Publish examples only after real outputs exist. |
| workspace generation | /app?engine=gemini-omni-flash | /models/gemini-omni-flash | public SEO pages | app remains auth/workspace surface | CTA only; not SEO target. |
```

Expected: the model page does not try to rank for every comparison, pricing, implementation, and examples query.

- [ ] **Step 6: Create internal linking plan**

`docs/model-launch/gemini-omni-flash-linking-plan.md` must include:

```md
# Gemini Omni Flash Internal Linking Plan

## Anchor Rules

- Use descriptive, concise anchors.
- Avoid generic anchors such as "click here" or "read more".
- Avoid repeating exact-match "Gemini Omni Flash" more than necessary in dense sections.
- Use comparison anchors only on pages where a comparison helps the user choose.
- Keep model page quick links limited to the most relevant pages.

## Required Links

| Source URL | Target URL | Anchor Text | Placement | Reason |
| --- | --- | --- | --- | --- |
| /models/gemini-omni-flash | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | Compare Gemini Omni Flash vs Veo 3.1 | hero quick link | Explicit model-vs-model decision path. |
| /models/gemini-omni-flash | /pricing#gemini-omni-flash-pricing | Gemini Omni Flash pricing | pricing section | Pricing intent belongs on pricing hub. |
| /models/gemini-omni-flash | /app?engine=gemini-omni-flash | Open Gemini Omni Flash in the workspace | primary CTA | Conversion path. |
| /models/veo-3-1 | /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | Compare with Gemini Omni Flash | compare section | Natural adjacent Google model comparison. |
| /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/gemini-omni-flash | Gemini Omni Flash model specs | model card/link block | Sends model-detail intent back to model page. |
| /ai-video-engines/gemini-omni-flash-vs-veo-3-1 | /models/veo-3-1 | Veo 3.1 model specs | model card/link block | Keeps comparison balanced. |
| /pricing | /models/gemini-omni-flash | Gemini Omni Flash specs and limits | model pricing row | Pricing users can inspect model constraints. |
| /models | /models/gemini-omni-flash | Gemini Omni Flash | model grid card | Discovery path from catalog. |

## Links To Avoid

- Do not link every Veo mention sitewide to Omni.
- Do not add Omni links to unrelated model pages unless the comparison is genuinely relevant.
- Do not publish `/blog/gemini-omni-flash-vertex-ai` unless research shows a distinct implementation intent that should be public.
```

Expected: the link plan follows Google’s descriptive-anchor guidance and the repo’s existing internal-link strategy.

- [ ] **Step 7: Run test and verify it passes**

Run:

```bash
pnpm test:validate -- tests/google-omni-seo-research-contract.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add docs/model-launch/gemini-omni-flash-seo-research.md docs/model-launch/gemini-omni-flash-cannibalization-map.md docs/model-launch/gemini-omni-flash-linking-plan.md tests/google-omni-seo-research-contract.test.ts
git commit -m "docs: research Gemini Omni Flash SEO strategy"
```

## Task 11: Marketing Model Page, Specs, Sitemap, Locales

**Files:**
- Read first: `docs/model-launch/gemini-omni-flash-seo-research.md`
- Read first: `docs/model-launch/gemini-omni-flash-cannibalization-map.md`
- Read first: `docs/model-launch/gemini-omni-flash-linking-plan.md`
- Modify: `frontend/config/model-roster.json`
- Modify: `frontend/config/model-families.ts`
- Create: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-templates/gemini-omni-flash.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-key-specs.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts`
- Test: `tests/model-page-template-registry.test.ts`
- Test: `tests/model-page-specs-architecture.test.ts`
- Test: `tests/video-pages-sitemap.test.ts`
- Test: `tests/google-omni-marketing-surfaces.test.ts`
- Test: `tests/google-omni-seo-research-contract.test.ts`

- [ ] **Step 1: Write failing marketing surface tests**

Assert:

- model roster contains `gemini-omni-flash`.
- template registry returns a config for `gemini-omni-flash`.
- specs mention Preview, Interactions API, 16:9/9:16, text/image/reference/video edit inputs, no extend, no first/last, no negative prompt, no seed.
- sitemap includes the model page only if `includeInSitemap` is true.
- model page copy follows the cannibalization map: overview/specs only, not deep Vertex implementation, not comparison stuffing, not unconfirmed pricing claims.
- quick links match the internal linking plan.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm test:validate -- tests/google-omni-marketing-surfaces.test.ts tests/google-omni-seo-research-contract.test.ts tests/model-page-template-registry.test.ts tests/model-page-specs-architecture.test.ts tests/video-pages-sitemap.test.ts
```

Expected: FAIL because marketing config is missing.

- [ ] **Step 3: Add model page template**

Suggested template:

```ts
slug: 'gemini-omni-flash'
intent: 'specialized'
hero.eyebrow: 'GOOGLE MULTIMODAL VIDEO PREVIEW'
hero.primaryCtaHref: '/app?engine=gemini-omni-flash'
hero.secondaryCtaHref: '/ai-video-engines/gemini-omni-flash-vs-veo-3-1'
pricing.anchorHref: '/pricing#gemini-omni-flash-pricing'
sections: { examples: true, prompting: true, tips: true, compare: true, specs: true, safety: true, faq: true }
```

- [ ] **Step 4: Add specs and copy**

Spec rows must be factual and conservative:

- Launch stage: Preview.
- Provider route: Google Vertex / Agent Platform Interactions API.
- Output: video with native audio from prompt context.
- Duration: about 8 seconds.
- Aspect ratios: 16:9, 9:16.
- Inputs: text, images, reference images, source video for edit, previous interaction id for follow-up.
- Unsupported: first/last frame, extend, negative prompt, seed, audio reference upload, multi-scene storyboard.
- SEO ownership: broad model decision intent only. Link to comparison pages for vs intent, pricing hub for price intent, and engineering docs only from internal docs/admin contexts.

The copy must cite official source facts in editorial notes or source comments where the local model-page system supports it. Do not use fal.ai as the implementation authority for the Vertex page.

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
pnpm test:validate -- tests/google-omni-marketing-surfaces.test.ts tests/google-omni-seo-research-contract.test.ts tests/model-page-template-registry.test.ts tests/model-page-specs-architecture.test.ts tests/video-pages-sitemap.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/config/model-roster.json frontend/config/model-families.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-templates/gemini-omni-flash.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-template-registry.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-specs.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-key-specs.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/models/\[slug\]/_lib/model-page-static-media.ts tests/google-omni-marketing-surfaces.test.ts tests/google-omni-seo-research-contract.test.ts tests/model-page-template-registry.test.ts tests/model-page-specs-architecture.test.ts tests/video-pages-sitemap.test.ts
git commit -m "feat: add Gemini Omni Flash marketing page"
```

## Task 12: Compare Pages And Editorial Notes

**Files:**
- Read first: `docs/model-launch/gemini-omni-flash-seo-research.md`
- Read first: `docs/model-launch/gemini-omni-flash-cannibalization-map.md`
- Read first: `docs/model-launch/gemini-omni-flash-linking-plan.md`
- Modify: `frontend/config/compare-config.json`
- Modify: `frontend/config/compare-hub.json`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-en.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-fr.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides-es.ts`
- Test: `tests/compare-page-architecture.test.ts`
- Test: `tests/google-omni-compare-pages.test.ts`

- [ ] **Step 1: Write failing compare tests**

Assert compare slugs resolve:

- `gemini-omni-flash-vs-veo-3-1`
- `gemini-omni-flash-vs-veo-3-1-fast`
- `gemini-omni-flash-vs-sora-2`
- `gemini-omni-flash-vs-seedance-2-0`

Assert English overrides include:

- CTR metadata without site-name suffix for the highest-priority page.
- quick verdict distinguishing Omni stateful edit from Veo first/last/extend.
- FAQ covering "Omni Flash vs Veo", "Vertex AI", "video editing", and "reference images".
- each comparison owns exactly one vs intent and links back to the model page for general specs.
- comparison pages do not target broad "Gemini Omni Flash" model overview intent.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
pnpm test:validate -- tests/google-omni-compare-pages.test.ts tests/compare-page-architecture.test.ts
```

Expected: FAIL because compare entries are missing.

- [ ] **Step 3: Add compare config and localized copy**

Recommended editorial angles:

- vs Veo 3.1: Omni for conversational multimodal edit; Veo for polished direct video modes, first/last, extend, 4K.
- vs Veo 3.1 Fast: Omni for advanced edit/reference experiments; Veo Fast for cheaper predictable drafts if pricing supports it.
- vs Sora 2: Omni for Vertex/Google stack and prompt-driven native sound; Sora for OpenAI route and broader story generation depending current catalog.
- vs Seedance 2.0: Omni for Google preview editing; Seedance for production multi-shot model workflows if current docs still favor Seedance there.

Internal linking rules:

- Each comparison links to `/models/gemini-omni-flash` with a specs/details anchor.
- The model page links only to the highest-value comparison pages selected in the research doc.
- Do not add all possible Omni comparisons to every page.
- Use self-canonical comparison pages; do not canonicalize `gemini-omni-flash-vs-veo-3-1` to either model page.

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
pnpm test:validate -- tests/google-omni-compare-pages.test.ts tests/compare-page-architecture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/config/compare-config.json frontend/config/compare-hub.json frontend/app/\(localized\)/\[locale\]/\(marketing\)/ai-video-engines/\[slug\]/_lib/compare-page-config.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/ai-video-engines/\[slug\]/_lib/compare-page-overrides-en.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/ai-video-engines/\[slug\]/_lib/compare-page-overrides-fr.ts frontend/app/\(localized\)/\[locale\]/\(marketing\)/ai-video-engines/\[slug\]/_lib/compare-page-overrides-es.ts tests/google-omni-compare-pages.test.ts tests/compare-page-architecture.test.ts
git commit -m "feat: add Gemini Omni Flash comparison pages"
```

## Task 13: Operations Documentation And Rollout Gates

**Files:**
- Create: `docs/engineering/google-vertex-omni.md`
- Modify deployment env docs if present.
- Test: `tests/provider-message-copy.test.ts`
- Test: `tests/user-facing-failure-messages.test.ts`

- [ ] **Step 1: Write failing docs/guard tests**

Assert user-facing messages do not leak `Vertex`, `Agent Platform`, raw quota strings, service account info, or provider internals.

- [ ] **Step 2: Run tests and verify they fail or pass for the right reason**

Run:

```bash
pnpm test:validate -- tests/provider-message-copy.test.ts tests/user-facing-failure-messages.test.ts
```

Expected: PASS if existing guards cover the messages, FAIL if new Omni errors leak provider text.

- [ ] **Step 3: Add operations doc**

Include:

- Required Google Cloud APIs.
- IAM/service account scopes.
- Required env vars.
- How to enable admin-only testing.
- How to enable public routing.
- How to check quota/access failures.
- Polling cron behavior.
- Storage copy retry behavior.
- Known unsupported options.
- Rollback: set `GOOGLE_VERTEX_OMNI_ENABLED=false`.

- [ ] **Step 4: Run tests and docs checks**

Run:

```bash
pnpm test:validate -- tests/provider-message-copy.test.ts tests/user-facing-failure-messages.test.ts
git diff --check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/engineering/google-vertex-omni.md tests/provider-message-copy.test.ts tests/user-facing-failure-messages.test.ts
git commit -m "docs: document Gemini Omni Flash Vertex rollout"
```

## Task 14: End-to-End Verification

**Files:** no planned code changes.

- [ ] **Step 1: Run focused unit tests**

```bash
pnpm test:validate -- \
  tests/google-vertex-omni-routing.test.ts \
  tests/google-vertex-omni-client.test.ts \
  tests/google-vertex-omni-payload.test.ts \
  tests/google-vertex-omni-submission.test.ts \
  tests/google-vertex-omni-poll.test.ts \
  tests/google-vertex-omni-engine-catalog.test.ts \
  tests/workspace-omni-ui-contract.test.ts \
  tests/workspace-generation-inputs.test.ts \
  tests/workspace-generation-request-helpers.test.ts \
  tests/google-vertex-omni-pricing.test.ts \
  tests/google-omni-seo-research-contract.test.ts \
  tests/google-omni-marketing-surfaces.test.ts \
  tests/google-omni-compare-pages.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run broader validation**

```bash
pnpm test:validate
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
```

Expected: PASS.

- [ ] **Step 3: Run model/catalog generation checks**

```bash
npm run model:check
npm run models:audit
```

Expected: PASS.

- [ ] **Step 4: Smoke-test local app**

```bash
npm --prefix frontend run dev
```

Smoke-test:

- `/app?engine=gemini-omni-flash` as admin.
- `/models/gemini-omni-flash`
- `/fr/modeles/gemini-omni-flash`
- `/es/modelos/gemini-omni-flash`
- `/ai-video-engines/gemini-omni-flash-vs-veo-3-1`
- `/pricing#gemini-omni-flash-pricing`

Expected:

- workspace renders controls with no overlapping text.
- task tabs, media chips, editable-session toggle, and direction fields match the selected design reference.
- desktop and mobile screenshots match `docs/model-launch/gemini-omni-flash-ui/selected-desktop.png` and `selected-mobile.png` closely enough for implementation QA.
- unsupported controls are not visible.
- model page has canonical/hreflang/JSON-LD.
- model page, pricing links, and comparison pages follow `docs/model-launch/gemini-omni-flash-linking-plan.md`.
- broad model, comparison, pricing, examples, and Vertex implementation intents follow `docs/model-launch/gemini-omni-flash-cannibalization-map.md`.
- compare page renders score/spec/FAQ sections.

- [ ] **Step 5: Admin-only live provider test**

With real Vertex quota and env:

```txt
GOOGLE_VERTEX_OMNI_ENABLED=true
GOOGLE_VERTEX_OMNI_ADMIN_ONLY=true
GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED=false
```

Run one admin `t2v` job:

- prompt: "A clean 16:9 product hero video of a matte black espresso machine on a steel counter, slow push-in, soft cafe ambience."
- aspect ratio: 16:9.
- store interaction: true.

Expected:

- job moves pending/running/completed.
- provider output is copied to MaxVideoAI storage.
- `provider_attempts` has sanitized response snapshot.
- `settings_snapshot.provider.omni.interactionId` is present.

- [ ] **Step 6: Retake live provider test**

Start from the completed Omni job:

- mode: `retake`.
- prompt: "Make the camera movement slower and add more visible steam, keep the same product."
- previous interaction id from the completed job.

Expected:

- payload includes `previous_interaction_id`.
- provider accepts interaction.
- output is copied and associated with the new job.

- [ ] **Step 7: Final commit if verification fixes were needed**

```bash
git status --short
git add <only verification fix files>
git commit -m "fix: stabilize Gemini Omni Flash verification"
```

## Rollout Checklist

- [ ] Google Cloud project has Agent Platform / Vertex access for `gemini-omni-flash-preview`.
- [ ] Service account has required API access.
- [ ] Billing/quota confirmed.
- [ ] Admin-only routing tested.
- [ ] Public pricing confirmed.
- [ ] Public routing enabled only after provider success rate is acceptable.
- [ ] Marketing page can be indexed only after the model is actually usable by intended customers.
- [ ] Compare pages do not overclaim unsupported capabilities.
- [ ] Rollback env is documented and tested.

## Open Questions Before Execution

1. Should the public slug be `gemini-omni-flash` or `google-omni-flash`? Recommendation: `gemini-omni-flash` because it matches the model identity and avoids implying it is part of the Veo family.
2. Should public routing launch at all while the model is Preview? Recommendation: admin-only first, then limited users.
3. What exact retail price should MaxVideoAI charge? Recommendation: do not finalize until the Vertex account shows actual billing/quota terms.
4. Should Omni join a new `gemini` family or a new `omni` family? Recommendation: new `gemini` family if future Gemini video/image models will share it; otherwise `omni` as a compact one-model family.
5. Do we want source-video editing (`v2v`) in the first launch? Recommendation: include the server path in the plan, but gate the UI until live upload/File API behavior is verified.

## Self-Review

- Spec coverage: provider integration, advanced Vertex options, workspace tool, pricing, marketing page, specs, comparison notes, docs, and verification are covered.
- Placeholder scan: no task depends on "TBD" implementation; open questions are explicit product decisions before execution.
- Type consistency: provider key is consistently `google_vertex_omni_direct`, engine id is consistently `gemini-omni-flash`, model id is consistently `gemini-omni-flash-preview`.
- Risk flags: the largest risk is Google Preview API drift. Mitigate by keeping provider code isolated and feature-gated.
