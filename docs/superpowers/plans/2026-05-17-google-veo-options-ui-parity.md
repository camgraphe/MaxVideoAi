# Google Veo Options UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the Google Vertex Veo 3.1 provider options cleanly in MaxVideoAI while keeping Fal as a safe fallback for unsupported or pre-acceptance failures.

**Architecture:** Keep the public slugs (`veo-3-1`, `veo-3-1-fast`, `veo-3-1-lite`) and the current provider-router architecture. Update the static engine catalog so the workspace UI reflects Google-first capabilities, then update the Google direct provider validation and payload mapping so UI choices either submit to Google direct or intentionally fall back to Fal before provider acceptance. Implement direct Extend only after adding a minimal Google Cloud Storage input-staging path, because the official Vertex Extend REST sample expects a `video.gcsUri`.

**Tech Stack:** Next.js App Router, TypeScript, existing MaxVideoAI engine catalog, `provider_attempts`, Vertex AI `predictLongRunning` / `fetchPredictOperation`, Google OAuth service-account JWT flow already in `GoogleVertexVeoClient`, Node test runner through `pnpm exec tsx --test`.

---

## Current Verification

- Local dev server on port 3000 responds with HTTP `200` for `http://localhost:3000/app?engine=veo-3-1-lite`.
- `http://localhost:3000/api/engines?engine=veo-3-1-lite` responds with HTTP `200`.
- Current UI/API catalog mismatches:
  - `veo-3-1` and `veo-3-1-fast` do not expose `4k`, while the Google model page lists 4K Preview for Standard/Fast.
  - `veo-3-1-lite` does not expose the audio toggle, while Google pricing lists Lite audio and video-only rates.
  - Standard/Fast still expose `1:1`, `auto`, and `webp` in places, while Google direct currently supports only `16:9`, `9:16`, JPEG, and PNG.
  - Standard/Fast reference UI allows 4 images, while Google direct supports up to 3 asset reference images.
  - Standard/Fast expose `extend` in the catalog, but `google_vertex_veo_direct` currently rejects `extend` and routes it to Fal.
  - Lite Extend is exposed after direct support verification, with `720p`/`1080p` only.

## Official Google Facts To Encode

Use these docs as the source of truth during implementation:

- Model capabilities: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/veo/3-1-generate
- Video generation API options: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
- Text-to-video guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-text
- Image-to-video guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/generate-videos-from-an-image
- Reference asset images: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/use-reference-images-to-guide-video-generation
- Extend: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/extend-a-veo-video
- Pricing: https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing

Encode these constraints:

- Model IDs:
  - `veo-3-1` -> `veo-3.1-generate-001`
  - `veo-3-1-fast` -> `veo-3.1-fast-generate-001`
  - `veo-3-1-lite` -> `veo-3.1-lite-generate-001`
- Aspect ratios: `16:9`, `9:16`.
- Durations for generation: `4s`, `6s`, `8s`; `ref2v` is `8s` only.
- Resolutions:
  - Standard/Fast: `720p`, `1080p`, `4k` where `4k` is Preview.
  - Lite: `720p`, `1080p`; no `4k`.
- `generateAudio`: required for Veo 3 models and accepts `true` or `false`.
- `personGeneration`: expose `allow_adult` and `dont_allow`; do not expose `allow_all` until the project is allowlisted.
- `compressionQuality`: `optimized`, `lossless`.
- `resizeMode`: `pad`, `crop`, image-input workflows only.
- `sampleCount`: do not expose in this phase because MaxVideoAI job/media/pricing assumes one output per generation.
- Reference asset images: Standard/Fast only, up to 3 images, `referenceType: "asset"`; do not expose style references for Veo 3.1.
- Image inputs: JPEG and PNG only for Google direct.
- Extend: source video must be a Veo-generated MP4, `1-30s` input according to Vertex docs; output extension length is fixed at 7 seconds. Standard/Fast expose `720p`, `1080p`, and `4k`; Lite exposes `720p` and `1080p`.

## File Structure

- Modify `frontend/src/config/fal-engines/veo-3-1.ts`
  - Google-first UI options for Standard.
  - Standard 4K pricing and option exposure.
  - Reference image max count 3.
  - Remove direct-incompatible UI values (`1:1`, `webp`, `auto_fix`).

- Modify `frontend/src/config/fal-engines/veo-3-1-fast.ts`
  - Google-first UI options for Fast.
  - Fast 4K pricing and option exposure.
  - Reference image max count 3.
  - Remove direct-incompatible UI values (`1:1`, `webp`, `auto_fix`).

- Modify `frontend/src/config/fal-engines/veo-3-1-lite.ts`
  - Add Lite audio toggle and `generate_audio`.
  - Keep no 4K.
  - Add Lite Extend only after direct Extend support is implemented and verified locally.
  - Remove direct-incompatible formats (`webp`, `gif`, `avif`) from Google-first caps.

- Modify `frontend/src/server/video-providers/google-vertex-veo/model-map.ts`
  - Validate Google-supported options explicitly.
  - Add Extend as a direct-capable mode for Standard/Fast after input staging exists.
  - Keep Lite Extend behind code-level support only until local smoke test passes.

- Modify `frontend/src/server/video-providers/google-vertex-veo/payload.ts`
  - Add `resizeMode`.
  - Add `video` payload support for Extend.
  - Force Extend `durationSeconds` to `7` and `resolution` to `720p`.

- Modify `frontend/src/server/video-providers/google-vertex-veo/client.ts`
  - Add a small authenticated GCS upload helper for Extend source-video staging.

- Create `frontend/src/server/video-providers/google-vertex-veo/video-input.ts`
  - Fetch source video from `gs://`, HTTPS, or data URL.
  - Validate MP4 MIME.
  - Stage non-`gs://` inputs to `GOOGLE_VERTEX_VEO_INPUT_GCS_URI`.

- Modify `frontend/src/lib/env.ts`
  - Add optional `GOOGLE_VERTEX_VEO_INPUT_GCS_URI`.
  - Existing `GOOGLE_VERTEX_VEO_OUTPUT_GCS_URI` stays output-only.

- Modify `tests/google-vertex-veo-routing.test.ts`
  - Provider support, payload, Extend, and provider-cost tests.

- Modify `tests/validate-request.test.ts`
  - Catalog validation and UI schema tests.

- Modify `docs/superpowers/specs/2026-05-17-google-vertex-veo-provider-routing-design.md`
  - Record the final Google option mapping and Extend staging requirement.

---

### Task 1: Lock The Desired Google-First Catalog Contract In Tests

**Files:**
- Modify: `tests/validate-request.test.ts`

- [ ] **Step 1: Update the Lite audio toggle registry test**

Replace the existing Lite assertion:

```ts
assert.equal(veoLite?.engine.inputSchema?.optional?.some((field) => field.id === 'generate_audio'), false);
```

with:

```ts
assert.equal(veoLite?.engine.inputSchema?.optional?.some((field) => field.id === 'generate_audio'), true);
assert.equal(veoLite?.modes.every((mode) => mode.ui.audioToggle === true), true);
```

- [ ] **Step 2: Add Standard/Fast 4K and Lite no-4K assertions**

Add this test after `Veo 3.1 Lite registry exposes the unified lite mode mapping`:

```ts
test('Veo 3.1 registry exposes Google direct resolution support by model', () => {
  const registry = listFalEngines();
  const standard = registry.find((entry) => entry.id === 'veo-3-1');
  const fast = registry.find((entry) => entry.id === 'veo-3-1-fast');
  const lite = registry.find((entry) => entry.id === 'veo-3-1-lite');

  assert.ok(standard);
  assert.ok(fast);
  assert.ok(lite);

  assert.deepEqual(standard?.engine.resolutions, ['720p', '1080p', '4k']);
  assert.deepEqual(fast?.engine.resolutions, ['720p', '1080p', '4k']);
  assert.deepEqual(lite?.engine.resolutions, ['720p', '1080p']);

  assert.equal(validateRequest('veo-3-1', 't2v', {
    duration: '8s',
    resolution: '4k',
    aspect_ratio: '16:9',
  }).ok, true);
  assert.equal(validateRequest('veo-3-1-fast', 't2v', {
    duration: '8s',
    resolution: '4k',
    aspect_ratio: '9:16',
  }).ok, true);
  assert.equal(validateRequest('veo-3-1-lite', 't2v', {
    duration: '8s',
    resolution: '4k',
    aspect_ratio: '16:9',
  }).ok, false);
});
```

- [ ] **Step 3: Add direct-compatible image and aspect-ratio assertions**

Add this test near the Veo validation tests:

```ts
test('Veo 3.1 Google-first catalog avoids Fal-only direct-incompatible options', () => {
  const registry = listFalEngines();
  const engines = ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']
    .map((id) => registry.find((entry) => entry.id === id))
    .filter(Boolean);

  for (const entry of engines) {
    assert.deepEqual(entry?.engine.aspectRatios, ['16:9', '9:16']);
    assert.deepEqual(entry?.engine.inputSchema?.constraints?.supportedFormats, ['jpg', 'jpeg', 'png']);
    assert.equal(entry?.engine.inputSchema?.optional?.some((field) => field.id === 'auto_fix'), false);
  }
});
```

- [ ] **Step 4: Update reference count test from 4 to 3**

In `Veo 3.1 Fast REF2V requires 1-4 reference images`, change:

```ts
test('Veo 3.1 Fast REF2V requires 1-4 reference images', () => {
```

to:

```ts
test('Veo 3.1 Fast REF2V requires 1-3 reference images', () => {
```

Change the too-many payload from 5 images to 4 images:

```ts
image_urls: Array.from({ length: 4 }, (_, index) => `https://example.com/ref-${index + 1}.png`),
```

Change:

```ts
assert.deepEqual(tooMany.error?.allowed, [1, 4]);
```

to:

```ts
assert.deepEqual(tooMany.error?.allowed, [1, 3]);
```

- [ ] **Step 5: Add official Google option validation**

Add this test after the reference count test:

```ts
test('Veo 3.1 accepts Google direct advanced options and rejects allowlisted-only values', () => {
  const valid = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate the product still with a slow push in',
    image_url: 'https://example.com/product.png',
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: false,
    extraInputValues: {
      person_generation: 'dont_allow',
      compression_quality: 'lossless',
      resize_mode: 'crop',
    },
  });
  assert.deepEqual(valid, OK);

  const invalidPersonGeneration = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate the product still with a slow push in',
    image_url: 'https://example.com/product.png',
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    extraInputValues: {
      person_generation: 'allow_all',
    },
  });
  assert.equal(invalidPersonGeneration.ok, false);
  assert.equal(invalidPersonGeneration.error?.field, 'person_generation');
});
```

- [ ] **Step 6: Run the focused validation test and confirm it fails**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/validate-request.test.ts
```

Expected before implementation: FAIL on Lite audio toggle, missing `4k`, reference max still `4`, and missing advanced option schema.

- [ ] **Step 7: Commit after Task 1 is implemented later**

Do not commit the failing test alone unless execution is intentionally split. After implementation in Task 2, commit both test and catalog changes together.

---

### Task 2: Update The Veo Engine Catalog For Google-First UI

**Files:**
- Modify: `frontend/src/config/fal-engines/veo-3-1.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1-fast.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1-lite.ts`
- Test: `tests/validate-request.test.ts`

- [ ] **Step 1: Update Standard resolutions, aspects, formats, refs, and advanced fields**

In `frontend/src/config/fal-engines/veo-3-1.ts`, apply these catalog changes:

```ts
resolutions: ['720p', '1080p', '4k'],
aspectRatios: ['16:9', '9:16'],
inputLimits: {
  imageMaxMB: 20,
},
```

Change `image_urls.maxCount` from `4` to `3`.

Change the optional `aspect_ratio` field:

```ts
{
  id: 'aspect_ratio',
  type: 'enum',
  label: 'Aspect ratio',
  values: ['16:9', '9:16'],
  default: '16:9',
},
```

Change the optional `resolution` field:

```ts
{
  id: 'resolution',
  type: 'enum',
  label: 'Resolution',
  values: ['720p', '1080p', '4k'],
  default: '720p',
},
```

Remove the `auto_fix` optional field.

Add these optional fields before `generate_audio`:

```ts
{
  id: 'person_generation',
  type: 'enum',
  label: 'People generation',
  values: ['allow_adult', 'dont_allow'],
  default: 'allow_adult',
},
{
  id: 'compression_quality',
  type: 'enum',
  label: 'Compression quality',
  values: ['optimized', 'lossless'],
  default: 'optimized',
},
{
  id: 'resize_mode',
  type: 'enum',
  label: 'Resize mode',
  values: ['pad', 'crop'],
  default: 'pad',
  modes: ['i2v', 'fl2v'],
},
```

Change constraints:

```ts
constraints: {
  supportedFormats: ['jpg', 'jpeg', 'png'],
},
```

For every Standard mode UI cap, remove `1:1` and `auto` from `aspectRatio`, add `4k` to `resolution`, change `acceptsImageFormats` to `['jpg', 'jpeg', 'png']`, and set `maxUploadMB: 20`.

Update Standard pricing:

```ts
pricingDetails: {
  currency: 'USD',
  perSecondCents: {
    default: 40,
    byResolution: {
      '720p': 40,
      '1080p': 40,
      '4k': 60,
    },
  },
  addons: {
    audio_off: {
      perSecondCentsByResolution: {
        '720p': -20,
        '1080p': -20,
        '4k': -20,
      },
    },
  },
},
pricing: {
  unit: 'USD/s',
  base: 0.4,
  byResolution: {
    '720p': 0.4,
    '1080p': 0.4,
    '4k': 0.6,
  },
  currency: 'USD',
  notes: '$0.40/s with audio at 720p/1080p, $0.60/s with audio at 4K; audio off is $0.20/s cheaper',
},
```

- [ ] **Step 2: Update Fast with the same Google-first option shape**

In `frontend/src/config/fal-engines/veo-3-1-fast.ts`, apply the same aspect, format, reference-count, advanced-field, and `auto_fix` removals as Standard.

Use Fast pricing:

```ts
pricingDetails: {
  currency: 'USD',
  perSecondCents: {
    default: 10,
    byResolution: {
      '720p': 10,
      '1080p': 12,
      '4k': 30,
    },
  },
  addons: {
    audio_off: {
      perSecondCentsByResolution: {
        '720p': -2,
        '1080p': -2,
        '4k': -5,
      },
    },
  },
},
pricing: {
  unit: 'USD/s',
  base: 0.1,
  byResolution: {
    '720p': 0.1,
    '1080p': 0.12,
    '4k': 0.3,
  },
  currency: 'USD',
  notes: '$0.10/s at 720p with audio, $0.12/s at 1080p with audio, $0.30/s at 4K with audio; audio off follows Google video-only rates',
},
```

- [ ] **Step 3: Update Lite audio toggle and formats**

In `frontend/src/config/fal-engines/veo-3-1-lite.ts`, keep:

```ts
resolutions: ['720p', '1080p'],
aspectRatios: ['16:9', '9:16'],
```

Change `inputLimits.imageMaxMB` to `20`.

Remove the `auto_fix` optional field.

Add the same `person_generation`, `compression_quality`, and `resize_mode` fields from Standard. Add:

```ts
{
  id: 'generate_audio',
  type: 'enum',
  label: 'Generate audio',
  values: ['true', 'false'],
  default: 'true',
},
```

Change Lite constraints:

```ts
constraints: {
  supportedFormats: ['jpg', 'jpeg', 'png'],
},
```

For each Lite mode UI cap, set `audioToggle: true`, `acceptsImageFormats: ['jpg', 'jpeg', 'png']`, `maxUploadMB: 20`, and remove copy that says audio is always included.

Update Lite pricing:

```ts
pricingDetails: {
  currency: 'USD',
  perSecondCents: {
    default: 5,
    byResolution: {
      '720p': 5,
      '1080p': 8,
    },
  },
  addons: {
    audio_off: {
      perSecondCentsByResolution: {
        '720p': -2,
        '1080p': -3,
      },
    },
  },
},
pricing: {
  unit: 'USD/s',
  base: 0.05,
  byResolution: {
    '720p': 0.05,
    '1080p': 0.08,
  },
  currency: 'USD',
  notes: '$0.05/s at 720p with audio, $0.08/s at 1080p with audio; audio off is $0.03/s at 720p and $0.05/s at 1080p',
},
```

Change the Lite FAQ answer about audio to:

```ts
answer: 'Yes. MaxVideoAI exposes the Veo 3.1 Lite audio toggle, so you can generate video with native audio or use the lower-cost video-only path.',
```

Change Lite `pricingHint.label` from `Audio always on` to:

```ts
label: 'Audio optional',
```

- [ ] **Step 4: Run validation tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/validate-request.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit catalog and validation changes**

Run:

```bash
git add frontend/src/config/fal-engines/veo-3-1.ts frontend/src/config/fal-engines/veo-3-1-fast.ts frontend/src/config/fal-engines/veo-3-1-lite.ts tests/validate-request.test.ts
git commit -m "feat: align Veo options with Google direct"
```

---

### Task 3: Validate Google Direct Options Before Submit

**Files:**
- Modify: `frontend/src/server/video-providers/google-vertex-veo/model-map.ts`
- Modify: `tests/google-vertex-veo-routing.test.ts`

- [ ] **Step 1: Add failing provider support assertions**

In `tests/google-vertex-veo-routing.test.ts`, extend `Google Vertex Veo support falls back to Fal for provider options not supported by direct phase 1` with:

```ts
assert.equal(
  resolveGoogleVertexVeoSupport({
    engineId: 'veo-3-1-fast',
    mode: 'i2v',
    falPayload: {
      ...base,
      engineId: 'veo-3-1-fast',
      mode: 'i2v',
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
      extraInputValues: {
        resize_mode: 'crop',
        compression_quality: 'lossless',
        person_generation: 'dont_allow',
      },
    },
  }).supported,
  true
);
assert.equal(
  resolveGoogleVertexVeoSupport({
    engineId: 'veo-3-1-fast',
    mode: 'i2v',
    falPayload: {
      ...base,
      engineId: 'veo-3-1-fast',
      mode: 'i2v',
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
      extraInputValues: { resize_mode: 'stretch' },
    },
  }).reason,
  'resize_mode_not_supported'
);
assert.equal(
  resolveGoogleVertexVeoSupport({
    engineId: 'veo-3-1-fast',
    mode: 't2v',
    falPayload: {
      ...base,
      engineId: 'veo-3-1-fast',
      extraInputValues: { compression_quality: 'maximum' },
    },
  }).reason,
  'compression_quality_not_supported'
);
assert.equal(
  resolveGoogleVertexVeoSupport({
    engineId: 'veo-3-1-fast',
    mode: 't2v',
    falPayload: {
      ...base,
      engineId: 'veo-3-1-fast',
      extraInputValues: { person_generation: 'allow_all' },
    },
  }).reason,
  'person_generation_not_supported'
);
```

- [ ] **Step 2: Add option sets in model-map**

Add below `SUPPORTED_IMAGE_MIME_TYPES`:

```ts
const SUPPORTED_PERSON_GENERATION_VALUES = new Set(['allow_adult', 'dont_allow']);
const SUPPORTED_COMPRESSION_QUALITY_VALUES = new Set(['optimized', 'lossless']);
const SUPPORTED_RESIZE_MODE_VALUES = new Set(['pad', 'crop']);
```

- [ ] **Step 3: Validate extra values in `resolveGoogleVertexVeoSupport`**

After the existing `auto_fix` check, add:

```ts
const personGeneration = extraInputValues.person_generation ?? extraInputValues.personGeneration;
if (typeof personGeneration === 'string' && !SUPPORTED_PERSON_GENERATION_VALUES.has(personGeneration)) {
  return { supported: false, route, reason: 'person_generation_not_supported' };
}

const compressionQuality = extraInputValues.compression_quality ?? extraInputValues.compressionQuality;
if (typeof compressionQuality === 'string' && !SUPPORTED_COMPRESSION_QUALITY_VALUES.has(compressionQuality)) {
  return { supported: false, route, reason: 'compression_quality_not_supported' };
}

const resizeMode = extraInputValues.resize_mode ?? extraInputValues.resizeMode;
if (typeof resizeMode === 'string') {
  if (!SUPPORTED_RESIZE_MODE_VALUES.has(resizeMode)) {
    return { supported: false, route, reason: 'resize_mode_not_supported' };
  }
  if (params.mode !== 'i2v' && params.mode !== 'fl2v') {
    return { supported: false, route, reason: 'resize_mode_not_supported' };
  }
}
```

- [ ] **Step 4: Run focused routing tests and confirm they pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit provider option validation**

Run:

```bash
git add frontend/src/server/video-providers/google-vertex-veo/model-map.ts tests/google-vertex-veo-routing.test.ts
git commit -m "feat: validate Google Veo direct options"
```

---

### Task 4: Map Google Direct Advanced Options Into The Vertex Payload

**Files:**
- Modify: `frontend/src/server/video-providers/google-vertex-veo/payload.ts`
- Modify: `tests/google-vertex-veo-routing.test.ts`

- [ ] **Step 1: Add `resizeMode` assertion to the payload test**

In `Google Vertex Veo payload maps supported MaxVideoAI options to predictLongRunning body`, add `resize_mode`:

```ts
extraInputValues: {
  enhance_prompt: false,
  person_generation: 'allow_adult',
  compression_quality: 'lossless',
  resize_mode: 'crop',
},
```

Update the expected parameters:

```ts
assert.deepEqual(payload.body.parameters, {
  sampleCount: 1,
  fps: 24,
  durationSeconds: 8,
  aspectRatio: '16:9',
  resolution: '1080p',
  generateAudio: true,
  seed: 42,
  negativePrompt: 'low quality',
  enhancePrompt: false,
  personGeneration: 'allow_adult',
  compressionQuality: 'lossless',
  resizeMode: 'crop',
});
```

- [ ] **Step 2: Add resize mode mapping**

In `applyOptionalParameters`, after `compressionQuality`:

```ts
const resizeMode = normalizeStringOption(extra.resize_mode ?? extra.resizeMode);
if (resizeMode) {
  params.parameters.resizeMode = resizeMode;
}
```

- [ ] **Step 3: Run routing test**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit payload mapping**

Run:

```bash
git add frontend/src/server/video-providers/google-vertex-veo/payload.ts tests/google-vertex-veo-routing.test.ts
git commit -m "feat: map Google Veo advanced payload options"
```

---

### Task 5: Add GCS Input Staging For Google Direct Extend

**Files:**
- Modify: `frontend/src/lib/env.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-veo/client.ts`
- Create: `frontend/src/server/video-providers/google-vertex-veo/video-input.ts`
- Modify: `tests/google-vertex-veo-routing.test.ts`

- [ ] **Step 1: Add env surface**

In `frontend/src/lib/env.ts`, add near the other Google Vertex entries:

```ts
GOOGLE_VERTEX_VEO_INPUT_GCS_URI: getOptionalEnv('GOOGLE_VERTEX_VEO_INPUT_GCS_URI'),
```

- [ ] **Step 2: Expose authenticated GCS upload in the client**

In `GoogleVertexVeoClient`, add:

```ts
async uploadGcsObject(params: { gcsUri: string; data: Buffer; mime: string }): Promise<string> {
  const match = params.gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new GoogleVertexVeoError('Google input staging URI is not a valid GCS URI.', {
      code: 'GOOGLE_VERTEX_VEO_INVALID_GCS_URI',
      errorClass: 'invalid_request',
      raw: { gcsUri: params.gcsUri },
    });
  }
  const [, bucket, objectName] = match;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await this.token()}`,
      'content-type': params.mime,
    },
    body: params.data,
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new GoogleVertexVeoError('Google GCS input upload failed.', {
      status: response.status,
      code: 'GOOGLE_VERTEX_VEO_INPUT_GCS_UPLOAD_FAILED',
      errorClass: response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
      raw: json,
    });
  }
  return params.gcsUri;
}
```

- [ ] **Step 3: Create video input normalizer**

Create `frontend/src/server/video-providers/google-vertex-veo/video-input.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { GoogleVertexVeoError } from './errors';
import type { GoogleVertexVeoClient } from './client';

export type GoogleVideo = {
  mimeType: 'video/mp4';
  gcsUri: string;
};

const MAX_EXTEND_VIDEO_BYTES = 256 * 1024 * 1024;

function parseGcsPrefix(value: string | undefined): { bucket: string; prefix: string } | null {
  const normalized = (value ?? '').trim().replace(/\/+$/, '');
  const match = normalized.match(/^gs:\/\/([^/]+)\/?(.*)$/);
  if (!match) return null;
  return { bucket: match[1], prefix: match[2] ? `${match[2]}/` : '' };
}

function inferVideoMime(url: string, responseMime?: string | null): string {
  const mime = responseMime?.split(';')[0]?.trim().toLowerCase();
  if (mime) return mime;
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.mp4')) return 'video/mp4';
  } catch {
    return 'application/octet-stream';
  }
  return 'application/octet-stream';
}

export async function fetchVideoAsGoogleVideo(params: {
  url: string;
  client: GoogleVertexVeoClient;
  inputGcsPrefix?: string;
}): Promise<GoogleVideo> {
  if (params.url.startsWith('gs://')) {
    if (!params.url.toLowerCase().endsWith('.mp4')) {
      throw new GoogleVertexVeoError('Google Vertex Veo Extend requires an MP4 source video.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { source: 'gcs' },
      });
    }
    return { gcsUri: params.url, mimeType: 'video/mp4' };
  }

  const staging = parseGcsPrefix(params.inputGcsPrefix);
  if (!staging) {
    throw new GoogleVertexVeoError('GOOGLE_VERTEX_VEO_INPUT_GCS_URI is required for Google direct Extend.', {
      code: 'GOOGLE_VERTEX_VEO_INPUT_GCS_URI_MISSING',
      errorClass: 'unsupported_params',
    });
  }

  const response = await fetch(params.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new GoogleVertexVeoError('Failed to fetch source video for Google Vertex Veo Extend.', {
      status: response.status,
      code: 'GOOGLE_VERTEX_VEO_VIDEO_FETCH_FAILED',
      errorClass: response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
    });
  }
  const mime = inferVideoMime(params.url, response.headers.get('content-type'));
  if (mime !== 'video/mp4') {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend requires an MP4 source video.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { mime },
    });
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_EXTEND_VIDEO_BYTES) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend source video is too large.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { contentLength },
    });
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_EXTEND_VIDEO_BYTES) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend source video is empty or too large.', {
      code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
      errorClass: 'unsupported_params',
      raw: { byteLength: data.length },
    });
  }

  const objectName = `${staging.prefix}veo-inputs/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.mp4`;
  const gcsUri = `gs://${staging.bucket}/${objectName}`;
  await params.client.uploadGcsObject({ gcsUri, data, mime: 'video/mp4' });
  return { gcsUri, mimeType: 'video/mp4' };
}
```

- [ ] **Step 4: Add client unit coverage through payload tests in Task 6**

No standalone network test is needed for `uploadGcsObject`; the unit boundary is the generated Extend payload. GCS upload failures are provider submit failures and are already covered by fallback classification through `GoogleVertexVeoError`.

- [ ] **Step 5: Commit staging helper**

Run:

```bash
git add frontend/src/lib/env.ts frontend/src/server/video-providers/google-vertex-veo/client.ts frontend/src/server/video-providers/google-vertex-veo/video-input.ts
git commit -m "feat: stage Google Veo extend inputs in GCS"
```

---

### Task 6: Enable Google Direct Extend For Standard And Fast

**Files:**
- Modify: `frontend/src/server/video-providers/google-vertex-veo/model-map.ts`
- Modify: `frontend/src/server/video-providers/google-vertex-veo/payload.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1.ts`
- Modify: `frontend/src/config/fal-engines/veo-3-1-fast.ts`
- Modify: `tests/google-vertex-veo-routing.test.ts`
- Modify: `tests/validate-request.test.ts`

- [ ] **Step 1: Add Extend support assertions**

In `tests/google-vertex-veo-routing.test.ts`, add:

```ts
test('Google Vertex Veo Standard and Fast support direct Extend with staged MP4 source video', async () => {
  const sourceVideo = 'gs://maxvideoai-veo-inputs/test/source.mp4';
  const support = resolveGoogleVertexVeoSupport({
    engineId: 'veo-3-1-fast',
    mode: 'extend',
    falPayload: {
      engineId: 'veo-3-1-fast',
      prompt: 'Continue the camera move through the neon alley',
      mode: 'extend',
      videoUrl: sourceVideo,
      aspectRatio: '16:9',
      resolution: '720p',
    },
  });
  assert.equal(support.supported, true);

  const payload = await buildGoogleVertexVeoPayload({
    engineId: 'veo-3-1-fast',
    mode: 'extend',
    prompt: 'Continue the camera move through the neon alley',
    negativePrompt: null,
    durationSec: 7,
    aspectRatio: '16:9',
    audioEnabled: true,
    falPayload: {
      engineId: 'veo-3-1-fast',
      prompt: 'Continue the camera move through the neon alley',
      mode: 'extend',
      videoUrl: sourceVideo,
      resolution: '720p',
    },
  });

  assert.deepEqual(payload.body.instances[0]?.video, {
    gcsUri: sourceVideo,
    mimeType: 'video/mp4',
  });
  assert.equal(payload.body.parameters.durationSeconds, 7);
  assert.equal(payload.body.parameters.resolution, '720p');
});
```

- [ ] **Step 2: Update mode type**

In `model-map.ts`, change:

```ts
export type GoogleVertexVeoMode = Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'fl2v'>;
```

to:

```ts
export type GoogleVertexVeoMode = Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'fl2v' | 'extend'>;
```

- [ ] **Step 3: Add Extend to Standard/Fast routes**

Change Standard/Fast `supportedModes` to:

```ts
supportedModes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
```

Keep Lite as:

```ts
supportedModes: ['t2v', 'i2v', 'fl2v'],
```

- [ ] **Step 4: Replace the phase-1 Extend rejection**

Replace:

```ts
if (params.mode === 'extend') {
  return { supported: false, route, reason: 'extend_phase_1_fal_only' };
}
```

with:

```ts
if (params.mode === 'extend') {
  if (!params.falPayload.videoUrl) {
    return { supported: false, route, reason: 'extend_source_video_required' };
  }
  if (params.falPayload.resolution && params.falPayload.resolution !== '720p') {
    return { supported: false, route, reason: 'extend_resolution_not_supported' };
  }
}
```

- [ ] **Step 5: Add Extend payload mapping**

In `payload.ts`, import the client and video helper:

```ts
import { getGoogleVertexVeoClient } from './client';
import { fetchVideoAsGoogleVideo } from './video-input';
```

In `buildGoogleVertexVeoPayload`, before the parameters block, add:

```ts
if (params.mode === 'extend') {
  if (!params.falPayload.videoUrl) {
    throw new GoogleVertexVeoError('Google Vertex Veo Extend requires a source video.', {
      code: 'GOOGLE_VERTEX_VEO_INVALID_REQUEST',
      errorClass: 'invalid_request',
    });
  }
  instance.video = await fetchVideoAsGoogleVideo({
    url: params.falPayload.videoUrl,
    client: getGoogleVertexVeoClient(),
    inputGcsPrefix: process.env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI,
  });
}
```

Change parameter normalization:

```ts
const resolution = params.mode === 'extend'
  ? '720p'
  : params.falPayload.resolution === '4k'
    ? '4k'
    : params.falPayload.resolution ?? '720p';
const durationSeconds = params.mode === 'extend' ? 7 : params.durationSec;
```

Then set:

```ts
durationSeconds,
```

inside `parameters` instead of `durationSeconds: params.durationSec`.

- [ ] **Step 6: Make Standard/Fast Extend UI fixed-length**

In Standard/Fast config files, change Extend UI caps from:

```ts
duration: { min: 1, default: 5 },
```

to:

```ts
duration: { options: ['7s'], default: '7s' },
resolution: ['720p'],
aspectRatio: ['16:9', '9:16'],
audioToggle: true,
```

Replace the optional numeric Extend duration field with:

```ts
{
  id: 'duration',
  type: 'enum',
  label: 'Extension duration',
  values: ['7s'],
  default: '7s',
  modes: ['extend'],
},
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts tests/validate-request.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Standard/Fast Extend**

Run:

```bash
git add frontend/src/server/video-providers/google-vertex-veo/model-map.ts frontend/src/server/video-providers/google-vertex-veo/payload.ts frontend/src/config/fal-engines/veo-3-1.ts frontend/src/config/fal-engines/veo-3-1-fast.ts tests/google-vertex-veo-routing.test.ts tests/validate-request.test.ts
git commit -m "feat: enable Google Veo direct extend"
```

---

### Task 7: Evaluate Lite Extend Separately

**Files:**
- Modify only if local smoke test passes: `frontend/src/config/fal-engines/veo-3-1-lite.ts`
- Modify only if local smoke test passes: `frontend/src/server/video-providers/google-vertex-veo/model-map.ts`
- Modify only if local smoke test passes: `tests/google-vertex-veo-routing.test.ts`
- Modify only if local smoke test passes: `tests/validate-request.test.ts`

- [ ] **Step 1: Keep Lite Extend disabled before the smoke test**

Keep Lite route:

```ts
supportedModes: ['t2v', 'i2v', 'fl2v'],
```

Keep Lite engine:

```ts
modes: ['t2v', 'i2v', 'fl2v'],
extend: false,
```

- [ ] **Step 2: Run a local admin smoke test against Google only**

Use a previously generated Google/Veo MP4 source. Submit a local request for `veo-3-1-lite` Extend only after `GOOGLE_VERTEX_VEO_INPUT_GCS_URI` is configured and service account storage write permissions are confirmed.

Expected outcomes:

- If Google accepts and returns `operation.name`, enable Lite Extend in the next step.
- If Google rejects Lite Extend, keep Lite Extend out of the public catalog and document the rejection message in the spec.

- [ ] **Step 3: Enable Lite Extend only after Google acceptance**

If Step 2 succeeds, change Lite route:

```ts
supportedModes: ['t2v', 'i2v', 'fl2v', 'extend'],
```

Change Lite engine:

```ts
modes: ['t2v', 'i2v', 'fl2v', 'extend'],
extend: true,
```

Add the same `video_url` required field and fixed `7s` Extend duration field used by Standard/Fast.

- [ ] **Step 4: Add Lite Extend tests only if enabled**

Add assertions:

```ts
assert.equal(resolveGoogleVertexVeoSupport({
  engineId: 'veo-3-1-lite',
  mode: 'extend',
  falPayload: {
    engineId: 'veo-3-1-lite',
    prompt: 'Extend the ending by one beat',
    mode: 'extend',
    videoUrl: 'gs://maxvideoai-veo-inputs/test/source.mp4',
    resolution: '720p',
  },
}).supported, true);
```

- [ ] **Step 5: Commit Lite Extend decision**

If enabled:

```bash
git add frontend/src/config/fal-engines/veo-3-1-lite.ts frontend/src/server/video-providers/google-vertex-veo/model-map.ts tests/google-vertex-veo-routing.test.ts tests/validate-request.test.ts
git commit -m "feat: expose Veo Lite direct extend"
```

If not enabled:

```bash
git add docs/superpowers/specs/2026-05-17-google-vertex-veo-provider-routing-design.md
git commit -m "docs: document Veo Lite extend limitation"
```

---

### Task 8: Browser And API Verification

**Files:**
- No source changes unless verification exposes a bug.

- [ ] **Step 1: Start or reuse dev server**

Run:

```bash
npm --prefix frontend run dev -- --port 3000
```

Expected: Next.js server starts on `http://localhost:3000`.

- [ ] **Step 2: Verify engine API exposes coherent options**

Run:

```bash
curl -sS 'http://localhost:3000/api/engines?engine=veo-3-1-lite' > /tmp/maxvideo-veo-engines.json
node -e "const data=require('/tmp/maxvideo-veo-engines.json'); for (const id of ['veo-3-1','veo-3-1-fast','veo-3-1-lite']) { const e=data.engines.find((x)=>x.id===id); console.log(id, { modes:e.modes, resolutions:e.resolutions, aspectRatios:e.aspectRatios, optional:e.inputSchema.optional.map((f)=>f.id) }); }"
```

Expected:

- Standard/Fast list `4k`; Lite does not.
- All three list `generate_audio`.
- All three omit `auto_fix`.
- All three list `person_generation`, `compression_quality`.
- Image modes list `resize_mode`.

- [ ] **Step 3: Verify workspace route loads**

Open:

```txt
http://localhost:3000/app?engine=veo-3-1-lite
```

Expected:

- Page title loads.
- Composer loads without overlapping controls.
- Lite shows audio toggle.
- Lite resolution selector has only `720p`, `1080p`.
- Standard/Fast show `4k`.
- Reference upload UI caps Standard/Fast at 3 images.

- [ ] **Step 4: Verify direct routing stays provider-safe**

With local admin flags enabled:

```bash
GOOGLE_VERTEX_VEO_ENABLED=true
GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED=false
GOOGLE_VERTEX_VEO_ADMIN_ONLY=true
GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED=true
```

Submit one cheap local admin test for:

- `veo-3-1-lite`, `t2v`, `4s`, `720p`, audio off.
- `veo-3-1-fast`, `t2v`, `4s`, `720p`, audio off.

Expected:

- `app_jobs.provider` is `google_vertex_veo_direct`.
- `app_jobs.provider_job_id` contains a Google operation name.
- `provider_attempts.provider_cost_usd` matches Google public pricing estimate.
- Output is copied to MaxVideoAI storage before completion.

- [ ] **Step 5: Verify Fal fallback still works before acceptance**

Temporarily set an invalid `GOOGLE_VERTEX_LOCATION` locally and submit a cheap admin test.

Expected:

- First `provider_attempts` row is `google_vertex_veo_direct` and failed before acceptance.
- Second row is `fal` when `GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED=true`.
- No fallback happens after Google returns an operation name.

---

### Task 9: Final Checks And Documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-05-17-google-vertex-veo-provider-routing-design.md`

- [ ] **Step 1: Update the spec**

Add a section:

```md
## Google Veo Option Exposure

- `veo-3-1` and `veo-3-1-fast` expose `720p`, `1080p`, and `4k`; 4K is treated as Preview.
- `veo-3-1-lite` exposes `720p` and `1080p`; no 4K.
- All Veo 3.1 engines expose `generate_audio` because Google has audio and video-only prices for all three tiers.
- Google direct image workflows accept JPEG and PNG only.
- Reference asset images are limited to 3 and use `referenceType: "asset"`.
- `person_generation` exposes `allow_adult` and `dont_allow`; `allow_all` remains hidden until allowlisted.
- `compression_quality` exposes `optimized` and `lossless`.
- `resize_mode` exposes `pad` and `crop` on image-input workflows.
- `sample_count` remains hidden because the MaxVideoAI job model is one output per generation.
- Google direct Extend requires GCS input staging via `GOOGLE_VERTEX_VEO_INPUT_GCS_URI`, accepts MP4 source videos, and treats the extension duration as fixed at 7 seconds.
```

- [ ] **Step 2: Run final focused checks**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/google-vertex-veo-routing.test.ts tests/validate-request.test.ts tests/google-vertex-veo-poll.test.ts
npm --prefix frontend run lint
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Commit documentation and any final fixes**

Run:

```bash
git add docs/superpowers/specs/2026-05-17-google-vertex-veo-provider-routing-design.md
git commit -m "docs: document Google Veo option parity"
```

---

## Rollout Notes

- Do not enable `GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED=true` until the local smoke tests above pass for at least one Standard/Fast and one Lite generation.
- `GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON` must never be committed or pasted into docs.
- Direct Extend needs the service account to write to the input GCS bucket and read the output GCS bucket:
  - minimum practical role for the bucket: Storage Object User on the specific staging bucket.
  - keep this bucket separate from public MaxVideoAI/S3 storage.
- Fal remains fallback only before Google returns `operation.name`.
- If an option is Google-only and Fal fallback happens, preserve the request snapshot in `provider_attempts`; if Fal rejects the Google-only field, surface a normal job failure rather than silently mutating user intent after acceptance.
