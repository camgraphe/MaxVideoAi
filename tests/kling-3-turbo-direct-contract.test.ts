import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateKlingDirectCost } from '../frontend/src/server/video-providers/kling-direct/cost';
import {
  buildKlingDirectPayload,
} from '../frontend/src/server/video-providers/kling-direct/payload';
import {
  isKlingDirectEngine,
  resolveKlingDirectModelRoute,
} from '../frontend/src/server/video-providers/kling-direct/model-map';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

const directFirstEnv = {
  KLING_DIRECT_ENABLED: 'true',
  KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
  KLING_DIRECT_ADMIN_ONLY: 'false',
  KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
  KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED: 'true',
} as const;

test('Kling 3 Turbo variants map to the active direct V3 route with Fal fallback', () => {
  const expected = [
    ['kling-3-turbo-standard', 'std'],
    ['kling-3-turbo-pro', 'pro'],
  ] as const;

  for (const [engineId, mode] of expected) {
    assert.equal(isKlingDirectEngine(engineId), true);
    assert.deepEqual(resolveKlingDirectModelRoute(engineId), {
      engineId,
      endpointFamily: 'video-v3',
      createPaths: {
        t2v: '/v1/videos/text2video',
        i2v: '/v1/videos/image2video',
      },
      pollPathPrefixes: {
        t2v: '/v1/videos/text2video',
        i2v: '/v1/videos/image2video',
      },
      providerModel: 'kling-v3',
      mode,
    });
    assert.deepEqual(
      resolveVideoProviderRoutingPlan({ engineId, mode: 't2v', isAdmin: false, env: directFirstEnv }),
      {
        kind: 'kling_direct_primary',
        primaryProvider: 'kling_direct',
        fallbackProvider: 'fal',
        fallbackEnabled: true,
        fallbackOnCreditsDepletedEnabled: true,
        elementRegistrationEnabled: false,
      }
    );
  }
});

test('Kling 3 Turbo direct payload preserves the portable multishot contract', () => {
  const payload = buildKlingDirectPayload({
    engineId: 'kling-3-turbo-standard',
    jobId: 'job_turbo_multishot',
    mode: 't2v',
    prompt: 'Editorial summary used by MaxVideoAI.',
    multiPrompt: [
      { prompt: 'Wide shot of a cyclist crossing a sunlit plaza.', duration: 3 },
      { prompt: 'Low tracking shot beside the moving bicycle.', duration: 3 },
    ],
    shotType: 'customize',
    durationSec: 6,
    aspectRatio: '16:9',
    audioEnabled: false,
  });

  assert.equal(payload.providerModel, 'kling-v3');
  assert.equal(payload.createPath, '/v1/videos/text2video');
  assert.equal(payload.pollPathPrefix, '/v1/videos/text2video');
  assert.equal(payload.body.mode, 'std');
  assert.equal(payload.body.prompt, undefined);
  assert.equal(payload.body.multi_shot, true);
  assert.equal(payload.body.shot_type, 'customize');
  assert.deepEqual(payload.body.multi_prompt, [
    { index: 1, prompt: 'Wide shot of a cyclist crossing a sunlit plaza.', duration: '3' },
    { index: 2, prompt: 'Low tracking shot beside the moving bicycle.', duration: '3' },
  ]);
});

test('Kling 3 Turbo direct cost estimates remain below the Fal-backed customer ceiling', () => {
  assert.equal(
    estimateKlingDirectCost({
      engineId: 'kling-3-turbo-standard',
      mode: 't2v',
      durationSec: 3,
      audioEnabled: false,
    }).providerCostUsd,
    0.252
  );
  assert.equal(
    estimateKlingDirectCost({
      engineId: 'kling-3-turbo-pro',
      mode: 't2v',
      durationSec: 3,
      audioEnabled: false,
    }).providerCostUsd,
    0.336
  );
});
