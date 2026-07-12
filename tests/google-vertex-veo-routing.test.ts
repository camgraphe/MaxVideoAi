import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { estimateGoogleVertexVeoCost } from '../frontend/src/server/video-providers/google-vertex-veo/cost';
import {
  classifyGoogleVertexVeoError,
  GoogleVertexVeoError,
  shouldFallbackFromGoogleVertexVeoSubmit,
} from '../frontend/src/server/video-providers/google-vertex-veo/errors';
import {
  applyGoogleVertexVeoRuntimeOptions,
  isGoogleVertexVeoEngine,
  resolveGoogleVertexVeoModelRoute,
  resolveGoogleVertexVeoSupport,
} from '../frontend/src/server/video-providers/google-vertex-veo/model-map';
import { buildGoogleVertexVeoPayload } from '../frontend/src/server/video-providers/google-vertex-veo/payload';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';
import { normalizeProviderRoutedResolution } from '../frontend/app/api/generate/_lib/provider-resolution';

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
    });
  }
});

test('Google Vertex Veo router is unavailable for public users while public routing is disabled', () => {
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
    { kind: 'google_vertex_unavailable', reason: 'admin_only' }
  );
});

test('Google Vertex Veo router enables public direct Extend only when input staging is configured', () => {
  const baseEnv = {
    GOOGLE_VERTEX_VEO_ENABLED: 'true',
    GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'false',
    GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'true',
    GOOGLE_VERTEX_VEO_PUBLIC_EXTEND_ROUTING_ENABLED: 'true',
    GOOGLE_VERTEX_VEO_FALLBACK_TO_FAL_ENABLED: 'true',
  };

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'veo-3-1',
      mode: 't2v',
      isAdmin: false,
      env: {
        ...baseEnv,
        GOOGLE_VERTEX_VEO_INPUT_GCS_URI: 'gs://maxvideoai-veo-inputs/public-extend',
      },
    }),
    { kind: 'google_vertex_unavailable', reason: 'admin_only' }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'veo-3-1',
      mode: 'extend',
      isAdmin: false,
      env: baseEnv,
    }),
    { kind: 'google_vertex_unavailable', reason: 'admin_only' }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'veo-3-1',
      mode: 'extend',
      isAdmin: false,
      env: {
        ...baseEnv,
        GOOGLE_VERTEX_VEO_INPUT_GCS_URI: 'gs://maxvideoai-veo-inputs/public-extend',
      },
    }),
    {
      kind: 'google_vertex_veo_primary',
      primaryProvider: 'google_vertex_veo_direct',
    }
  );
});

test('Fal-routed Google Vertex Veo Extend uses 720p for route pricing and job metadata', () => {
  assert.deepEqual(
    normalizeProviderRoutedResolution({
      providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false },
      engineId: 'veo-3-1',
      mode: 'extend',
      pricingResolution: '1080p',
      effectiveResolution: '1080p',
    }),
    { pricingResolution: '720p', effectiveResolution: '720p' }
  );

  assert.deepEqual(
    normalizeProviderRoutedResolution({
      providerRoutingPlan: {
        kind: 'google_vertex_veo_primary',
        primaryProvider: 'google_vertex_veo_direct',
      },
      engineId: 'veo-3-1',
      mode: 'extend',
      pricingResolution: '1080p',
      effectiveResolution: '1080p',
    }),
    { pricingResolution: '1080p', effectiveResolution: '1080p' }
  );

  assert.deepEqual(
    normalizeProviderRoutedResolution({
      providerRoutingPlan: { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false },
      engineId: 'veo-3-1',
      mode: 't2v',
      pricingResolution: '1080p',
      effectiveResolution: '1080p',
    }),
    { pricingResolution: '1080p', effectiveResolution: '1080p' }
  );
});

test('Google Vertex Veo model map uses Agent Platform Veo 3.1 model ids including Lite', () => {
  assert.equal(resolveGoogleVertexVeoModelRoute('veo-3-1').providerModel, 'veo-3.1-generate-001');
  assert.equal(resolveGoogleVertexVeoModelRoute('veo-3-1').supports4k, true);
  assert.equal(resolveGoogleVertexVeoModelRoute('veo-3-1').supportedModes.includes('extend'), true);
  const fast = resolveGoogleVertexVeoModelRoute('veo-3-1-fast');
  assert.equal(fast.providerModel, 'veo-3.1-fast-generate-001');
  assert.equal(fast.supports4k, true);
  assert.equal(fast.supportedModes.includes('extend'), true);
  const lite = resolveGoogleVertexVeoModelRoute('veo-3-1-lite');
  assert.equal(lite.providerModel, 'veo-3.1-lite-generate-001');
  assert.equal(lite.launchStage, 'preview');
  assert.equal(lite.supportsReferenceImages, false);
  assert.equal(lite.supports4k, false);
  assert.equal(lite.supportedModes.includes('extend'), true);
});

test('Google Vertex Veo runtime options repair stale engine_settings caps', () => {
  const standard = getBaseEngines().find((engine) => engine.id === 'veo-3-1');
  const lite = getBaseEngines().find((engine) => engine.id === 'veo-3-1-lite');
  assert.ok(standard);
  assert.ok(lite);

  const staleStandard = applyGoogleVertexVeoRuntimeOptions({
    ...standard,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['auto', '16:9', '9:16', '1:1'],
    inputSchema: standard.inputSchema
      ? {
          ...standard.inputSchema,
          optional: standard.inputSchema.optional?.map((field) => {
            if (field.id === 'resolution') return { ...field, values: ['720p', '1080p'] };
            if (field.id === 'aspect_ratio') return { ...field, values: ['auto', '16:9', '9:16', '1:1'] };
            return field;
          }),
        }
      : standard.inputSchema,
  });

  assert.deepEqual(staleStandard.resolutions, ['720p', '1080p', '4k']);
  assert.deepEqual(staleStandard.aspectRatios, ['16:9', '9:16']);
  assert.deepEqual(staleStandard.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values, [
    '720p',
    '1080p',
    '4k',
  ]);
  assert.equal(staleStandard.inputSchema?.optional?.some((field) => field.id === 'enhance_prompt'), false);
  assert.deepEqual(staleStandard.modeCaps?.t2v?.resolution, ['720p', '1080p', '4k']);

  const staleLite = applyGoogleVertexVeoRuntimeOptions({
    ...lite,
    modes: ['t2v', 'i2v', 'fl2v', 'extend'],
    resolutions: ['720p', '1080p', '4k'],
  });
  assert.deepEqual(staleLite.modes, ['t2v', 'i2v', 'fl2v', 'extend']);
  assert.deepEqual(staleLite.resolutions, ['720p', '1080p']);
  assert.deepEqual(staleLite.modeCaps?.extend?.resolution, ['720p', '1080p']);
});

test('Google Vertex Veo support validates direct-supported and fallback-only options', () => {
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
    resolveGoogleVertexVeoSupport({ engineId: 'veo-3-1', mode: 't2v', falPayload: { ...base, resolution: '4k' } }).supported,
    true
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-lite',
      mode: 't2v',
      falPayload: { ...base, engineId: 'veo-3-1-lite', resolution: '4k' },
    }).reason,
    'resolution_not_supported'
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-lite',
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
      engineId: 'veo-3-1-lite',
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
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-fast',
      mode: 'extend',
      falPayload: {
        ...base,
        engineId: 'veo-3-1-fast',
        mode: 'extend',
        videoUrl: 'gs://maxvideoai-veo-inputs/test/source.mp4',
        resolution: '4k',
      },
    }).supported,
    true
  );
  assert.equal(
    resolveGoogleVertexVeoSupport({
      engineId: 'veo-3-1-lite',
      mode: 'extend',
      falPayload: {
        ...base,
        engineId: 'veo-3-1-lite',
        mode: 'extend',
        videoUrl: 'gs://maxvideoai-veo-inputs/test/source.mp4',
        resolution: '4k',
      },
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
        compression_quality: 'lossless',
        resize_mode: 'crop',
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
    personGeneration: 'allow_adult',
    compressionQuality: 'lossless',
    resizeMode: 'crop',
  });
});

test('Google Vertex Veo first-last-frame payload uses normalized last frame attachments', async () => {
  const firstFrame = `data:image/png;base64,${Buffer.from('first').toString('base64')}`;
  const lastFrame = `data:image/png;base64,${Buffer.from('last').toString('base64')}`;
  const payload = await buildGoogleVertexVeoPayload({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    prompt: 'Match the motion from the first frame into the final pose',
    durationSec: 8,
    aspectRatio: '16:9',
    audioEnabled: true,
    falPayload: {
      engineId: 'veo-3-1',
      prompt: 'Match the motion from the first frame into the final pose',
      mode: 'fl2v',
      imageUrl: firstFrame,
      inputs: [
        {
          name: 'last-frame',
          type: 'image/png',
          size: 4,
          kind: 'image',
          slotId: 'last_frame_url',
          url: lastFrame,
        },
      ],
      resolution: '1080p',
    },
  });

  assert.deepEqual(payload.body.instances[0]?.image, {
    mimeType: 'image/png',
    bytesBase64Encoded: Buffer.from('first').toString('base64'),
  });
  assert.deepEqual(payload.body.instances[0]?.lastFrame, {
    mimeType: 'image/png',
    bytesBase64Encoded: Buffer.from('last').toString('base64'),
  });
});

test('Google Vertex Veo payload only enables prompt enhancement when explicitly true', async () => {
  const payload = await buildGoogleVertexVeoPayload({
    engineId: 'veo-3-1',
    mode: 't2v',
    prompt: 'A cinematic city street at blue hour',
    durationSec: 8,
    aspectRatio: '16:9',
    audioEnabled: true,
    falPayload: {
      engineId: 'veo-3-1',
      prompt: 'A cinematic city street at blue hour',
      mode: 't2v',
      resolution: '720p',
      extraInputValues: {
        enhance_prompt: true,
      },
    },
  });

  assert.equal(payload.body.parameters.enhancePrompt, true);
});

test('Google Vertex Veo Extend maps a staged source MP4 to a fixed 7 second direct request', async () => {
  const sourceVideo = 'gs://maxvideoai-veo-inputs/test/source.mp4';
  const payload = await buildGoogleVertexVeoPayload({
    engineId: 'veo-3-1-fast',
    mode: 'extend',
    prompt: 'Continue the same cinematic movement',
    durationSec: 30,
    aspectRatio: '9:16',
    audioEnabled: false,
    falPayload: {
      engineId: 'veo-3-1-fast',
      prompt: 'Continue the same cinematic movement',
      mode: 'extend',
      videoUrl: sourceVideo,
      resolution: '4k',
    },
  });

  assert.equal(payload.providerModel, 'veo-3.1-fast-generate-001');
  assert.deepEqual(payload.body.instances[0]?.video, {
    gcsUri: sourceVideo,
    mimeType: 'video/mp4',
  });
  assert.deepEqual(payload.body.parameters, {
    sampleCount: 1,
    fps: 24,
    durationSeconds: 7,
    aspectRatio: '9:16',
    resolution: '4k',
    generateAudio: false,
  });
});

test('Google Vertex Veo fallback classification is submit-only and safe before operation acceptance', () => {
  const googleHttpNotFound = classifyGoogleVertexVeoError(
    new GoogleVertexVeoError('Google Vertex Veo request failed.', {
      status: 404,
      raw: {
        error: {
          code: 404,
          status: 'NOT_FOUND',
          message: 'Publisher Model was not found.',
        },
      },
    })
  );
  assert.equal(googleHttpNotFound.errorClass, 'provider_error');
  assert.equal(googleHttpNotFound.code, 'NOT_FOUND');
  assert.equal(googleHttpNotFound.fallbackEligible, false);
  assert.match(googleHttpNotFound.message, /Publisher Model/);

  const googleHttpUnavailable = classifyGoogleVertexVeoError(
    new GoogleVertexVeoError('Google Vertex Veo request failed.', {
      status: 503,
      raw: {
        error: {
          code: 503,
          status: 'UNAVAILABLE',
          message: 'Service temporarily unavailable.',
        },
      },
    })
  );
  assert.equal(googleHttpUnavailable.errorClass, 'provider_unavailable');
  assert.equal(googleHttpUnavailable.code, 'UNAVAILABLE');
  assert.equal(googleHttpUnavailable.fallbackEligible, true);

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
