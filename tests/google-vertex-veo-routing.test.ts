import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import { estimateGoogleVertexVeoCost } from '../frontend/src/server/video-providers/google-vertex-veo/cost';
import {
  classifyGoogleVertexVeoError,
  GoogleVertexVeoError,
  shouldFallbackFromGoogleVertexVeoSubmit,
} from '../frontend/src/server/video-providers/google-vertex-veo/errors';
import {
  isGoogleVertexVeoEngine,
  resolveGoogleVertexVeoModelRoute,
  resolveGoogleVertexVeoSupport,
} from '../frontend/src/server/video-providers/google-vertex-veo/model-map';
import { buildGoogleVertexVeoPayload } from '../frontend/src/server/video-providers/google-vertex-veo/payload';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

test('Google Vertex Veo router selects admin-only direct routing for all public Veo 3.1 slugs', () => {
  const engineIds = ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite'];
  assert.ok(engineIds.every(isGoogleVertexVeoEngine));

  for (const engineId of engineIds) {
    const plan = resolveVideoProviderRoutingPlan({
      engineId,
      mode: 't2v',
      isAdmin: true,
      env: {
        GOOGLE_VERTEX_VEO_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'false',
        GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'true',
        GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    });

    assert.deepEqual(plan, {
      kind: 'google_vertex_veo_primary',
      primaryProvider: 'google_vertex_veo_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
    });
  }
});

test('Google Vertex Veo router keeps Fal for public users while public routing is disabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'veo-3-1',
      mode: 't2v',
      isAdmin: false,
      env: {
        GOOGLE_VERTEX_VEO_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'false',
        GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Google Vertex Veo model map uses Agent Platform Veo 3.1 model ids including Lite', () => {
  assert.equal(resolveGoogleVertexVeoModelRoute('veo-3-1').providerModel, 'veo-3.1-generate-001');
  assert.equal(resolveGoogleVertexVeoModelRoute('veo-3-1-fast').providerModel, 'veo-3.1-fast-generate-001');
  const lite = resolveGoogleVertexVeoModelRoute('veo-3-1-lite');
  assert.equal(lite.providerModel, 'veo-3.1-lite-generate-001');
  assert.equal(lite.launchStage, 'preview');
  assert.equal(lite.supportsReferenceImages, false);
  assert.equal(lite.supports4k, false);
});

test('Google Vertex Veo support falls back to Fal for provider options not supported by direct phase 1', () => {
  const base: GeneratePayload = {
    engineId: 'veo-3-1',
    prompt: 'A cinematic coastal sunrise',
    mode: 't2v',
    aspectRatio: '16:9',
    resolution: '720p',
  };

  assert.equal(resolveGoogleVertexVeoSupport({ engineId: 'veo-3-1', mode: 't2v', falPayload: base }).supported, true);
  assert.deepEqual(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-lite',
      mode: 'ref2v',
      falPayload: { ...base, engineId: 'veo-3-1-lite', referenceImages: ['https://cdn.maxvideoai.com/a.png'] },
    }),
    {
      supported: false,
      route: resolveGoogleVertexVeoModelRoute('veo-3-1-lite'),
      reason: 'unsupported_mode',
    }
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1',
      mode: 'ref2v',
      falPayload: {
        ...base,
        referenceImages: [
          'https://cdn.maxvideoai.com/a.png',
          'https://cdn.maxvideoai.com/b.png',
          'https://cdn.maxvideoai.com/c.png',
          'https://cdn.maxvideoai.com/d.png',
        ],
      },
    }).reason,
    'too_many_reference_images'
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({ engineId: 'veo-3-1', mode: 't2v', falPayload: { ...base, aspectRatio: '1:1' } }).reason,
    'aspect_ratio_not_supported'
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-lite',
      mode: 't2v',
      falPayload: { ...base, engineId: 'veo-3-1-lite', resolution: '4k' },
    }).reason,
    'resolution_not_supported'
  );
});

test('Google Vertex Veo payload maps supported MaxVideoAI options to predictLongRunning body', async () => {
  const image = `data:image/png;base64,${Buffer.from('png').toString('base64')}`;
  const payload = await buildGoogleVertexVeoPayload({
    engineId: 'veo-3-1-fast',
    mode: 'i2v',
    prompt: 'A slow cinematic dolly shot over a mountain lake',
    negativePrompt: 'low quality',
    durationSec: 8,
    aspectRatio: '16:9',
    audioEnabled: true,
    falPayload: {
      engineId: 'veo-3-1-fast',
      prompt: 'A slow cinematic dolly shot over a mountain lake',
      mode: 'i2v',
      imageUrl: image,
      resolution: '1080p',
      seed: 42,
      extraInputValues: {
        enhance_prompt: false,
        person_generation: 'allow_adult',
        camera_control: 'push_in',
      },
    },
  });

  assert.equal(payload.providerModel, 'veo-3.1-fast-generate-001');
  assert.equal(payload.body.instances[0]?.prompt, 'A slow cinematic dolly shot over a mountain lake');
  assert.deepEqual(payload.body.instances[0]?.image, {
    mimeType: 'image/png',
    bytesBase64Encoded: Buffer.from('png').toString('base64'),
  });
  assert.equal(payload.body.instances[0]?.cameraControl, 'push_in');
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
  });
});

test('Google Vertex Veo fallback classification is submit-only and safe before operation acceptance', () => {
  assert.equal(
    classifyGoogleVertexVeoError(new GoogleVertexVeoError('rate limited', { status: 429 })).fallbackEligible,
    true
  );
  assert.equal(
    classifyGoogleVertexVeoError(new GoogleVertexVeoError('provider unavailable', { status: 503 })).fallbackEligible,
    true
  );
  assert.equal(
    classifyGoogleVertexVeoError(
      new GoogleVertexVeoError('missing operation', {
        code: 'GOOGLE_VERTEX_VEO_NO_OPERATION',
        errorClass: 'invalid_response',
      })
    ).fallbackEligible,
    true
  );
  assert.equal(
    classifyGoogleVertexVeoError(new GoogleVertexVeoError('permission denied', { status: 403 })).fallbackEligible,
    false
  );
  assert.equal(
    classifyGoogleVertexVeoError(new GoogleVertexVeoError('safety policy', { status: 400 })).fallbackEligible,
    false
  );
  assert.equal(
    shouldFallbackFromGoogleVertexVeoSubmit({
      acceptedProviderJobId: 'operations/accepted',
      error: new GoogleVertexVeoError('provider unavailable', { status: 503 }),
      fallbackToFalEnabled: true,
    }),
    false
  );
});

test('Google Vertex Veo provider cost estimates use Agent Platform public pricing', () => {
  assert.equal(
    estimateGoogleVertexVeoCost({
      engineId: 'veo-3-1',
      durationSec: 8,
      audioEnabled: true,
      resolution: '720p',
    }).providerCostUsd,
    3.2
  );
  assert.equal(
    estimateGoogleVertexVeoCost({
      engineId: 'veo-3-1-fast',
      durationSec: 8,
      audioEnabled: false,
      resolution: '1080p',
    }).providerCostUsd,
    0.8
  );
  assert.equal(
    estimateGoogleVertexVeoCost({
      engineId: 'veo-3-1-lite',
      durationSec: 8,
      audioEnabled: true,
      resolution: '1080p',
    }).providerCostUsd,
    0.64
  );
});
