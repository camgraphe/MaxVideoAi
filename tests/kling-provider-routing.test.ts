import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  classifyKlingDirectError,
  KlingDirectError,
  shouldFallbackFromKlingDirectSubmit,
} from '../frontend/src/server/video-providers/kling-direct/errors';
import {
  buildKlingDirectPayload,
} from '../frontend/src/server/video-providers/kling-direct/payload';
import {
  isKlingDirectEngine,
  resolveKlingDirectModelRoute,
} from '../frontend/src/server/video-providers/kling-direct/model-map';
import {
  resolveVideoProviderRoutingPlan,
} from '../frontend/src/server/video-providers/router';

const root = process.cwd();
const generateRouteSource = readFileSync(join(root, 'frontend/app/api/generate/route.ts'), 'utf8');
const providerSubmissionSource = readFileSync(join(root, 'frontend/app/api/generate/_lib/video-provider-submission.ts'), 'utf8');
const jobDetailRouteSource = readFileSync(join(root, 'frontend/app/api/jobs/[jobId]/route.ts'), 'utf8');

test('Kling direct router selects admin-only primary routing without changing public engine slugs', () => {
  const klingEngineIds = ['kling-3-standard', 'kling-3-pro', 'kling-3-4k'];
  const engines = listFalEngines().filter((engine) => klingEngineIds.includes(engine.id));
  assert.deepEqual(engines.map((engine) => engine.id).sort(), klingEngineIds.sort());
  assert.ok(klingEngineIds.every(isKlingDirectEngine));

  const plan = resolveVideoProviderRoutingPlan({
    engineId: 'kling-3-pro',
    mode: 't2v',
    isAdmin: true,
    env: {
      KLING_DIRECT_ENABLED: 'true',
      KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
      KLING_DIRECT_ADMIN_ONLY: 'true',
      KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
    },
  });

  assert.deepEqual(plan, {
    kind: 'kling_direct_primary',
    primaryProvider: 'kling_direct',
    fallbackProvider: 'fal',
    fallbackEnabled: true,
  });
});

test('Kling direct router falls back to existing Fal routing for public users and unsupported modes', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'kling-3-pro',
      mode: 't2v',
      isAdmin: false,
      env: {
        KLING_DIRECT_ENABLED: 'true',
        KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
        KLING_DIRECT_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'kling-3-pro',
      mode: 'v2v',
      isAdmin: true,
      env: {
        KLING_DIRECT_ENABLED: 'true',
        KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Kling direct payload maps MaxVideoAI slugs to explicit Kling routes', () => {
  const proRoute = resolveKlingDirectModelRoute('kling-3-pro');
  assert.equal(proRoute.engineId, 'kling-3-pro');
  assert.equal(proRoute.endpointFamily, 'video-v3');
  assert.equal(proRoute.providerModel, 'kling-v3');
  assert.equal(proRoute.mode, 'pro');
  assert.equal(resolveKlingDirectModelRoute('kling-3-standard').providerModel, 'kling-v3');
  assert.equal(resolveKlingDirectModelRoute('kling-3-4k').providerModel, 'kling-v3');

  const textPayload = buildKlingDirectPayload({
    engineId: 'kling-3-pro',
    jobId: 'job_123',
    mode: 't2v',
    prompt: 'A cinematic test',
    negativePrompt: 'low quality',
    durationSec: 8,
    aspectRatio: '16:9',
    audioEnabled: true,
    imageUrl: null,
    cfgScale: 0.45,
  });
  assert.equal(textPayload.createPath, '/v1/videos/text2video');
  assert.equal(textPayload.pollPathPrefix, '/v1/videos/text2video');
  assert.deepEqual(textPayload.body, {
    model_name: 'kling-v3',
    prompt: 'A cinematic test',
    negative_prompt: 'low quality',
    duration: '8',
    mode: 'pro',
    sound: 'on',
    aspect_ratio: '16:9',
    external_task_id: 'job_123',
    cfg_scale: 0.45,
  });

  const imagePayload = buildKlingDirectPayload({
    engineId: 'kling-3-standard',
    jobId: 'job_456',
    mode: 'i2v',
    prompt: 'Animate this frame',
    negativePrompt: null,
    durationSec: 5,
    aspectRatio: '9:16',
    audioEnabled: false,
    imageUrl: 'https://cdn.maxvideoai.com/source.jpg',
  });
  assert.equal(imagePayload.createPath, '/v1/videos/image2video');
  assert.equal(imagePayload.pollPathPrefix, '/v1/videos/image2video');
  assert.equal(imagePayload.body.model_name, 'kling-v3');
  assert.equal(imagePayload.body.image, 'https://cdn.maxvideoai.com/source.jpg');
  assert.equal(imagePayload.body.mode, 'std');
  assert.equal(imagePayload.body.sound, 'off');
});

test('Kling direct payload preserves advanced Kling V3 provider options', () => {
  const textPayload = buildKlingDirectPayload({
    engineId: 'kling-3-pro',
    jobId: 'job_multi',
    mode: 't2v',
    prompt: 'Fallback single prompt',
    durationSec: 8,
    audioEnabled: true,
    multiPrompt: [
      { prompt: 'Shot one', duration: 3 },
      { prompt: 'Shot two', duration: 5 },
    ],
    shotType: 'customize',
    voiceIds: ['voice_a', 'voice_b'],
    extraInputValues: {
      camera_control: { type: 'simple', config: { zoom: 4 } },
      watermark_info: { enabled: false },
      ignored: 'not-sent',
    },
  });

  assert.equal(textPayload.body.prompt, undefined);
  assert.equal(textPayload.body.multi_shot, true);
  assert.equal(textPayload.body.shot_type, 'customize');
  assert.deepEqual(textPayload.body.multi_prompt, [
    { index: 1, prompt: 'Shot one', duration: '3' },
    { index: 2, prompt: 'Shot two', duration: '5' },
  ]);
  assert.deepEqual(textPayload.body.voice_list, [{ voice_id: 'voice_a' }, { voice_id: 'voice_b' }]);
  assert.equal(textPayload.body.sound, 'on');
  assert.deepEqual(textPayload.body.camera_control, { type: 'simple', config: { zoom: 4 } });
  assert.deepEqual(textPayload.body.watermark_info, { enabled: false });
  assert.equal('ignored' in textPayload.body, false);

  const imagePayload = buildKlingDirectPayload({
    engineId: 'kling-3-4k',
    jobId: 'job_image',
    mode: 'i2v',
    prompt: 'Animate frame',
    durationSec: 5,
    imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
    endImageUrl: 'https://cdn.maxvideoai.com/end.jpg',
    extraInputValues: {
      static_mask: 'https://cdn.maxvideoai.com/mask.png',
      dynamic_masks: [{ mask: 'https://cdn.maxvideoai.com/motion.png', trajectories: [{ x: 10, y: 20 }] }],
      element_list: [{ element_id: 160 }],
    },
  });

  assert.equal(imagePayload.body.image, 'https://cdn.maxvideoai.com/start.jpg');
  assert.equal(imagePayload.body.image_tail, 'https://cdn.maxvideoai.com/end.jpg');
  assert.equal(imagePayload.body.mode, '4k');
  assert.equal(imagePayload.body.static_mask, 'https://cdn.maxvideoai.com/mask.png');
  assert.deepEqual(imagePayload.body.dynamic_masks, [
    { mask: 'https://cdn.maxvideoai.com/motion.png', trajectories: [{ x: 10, y: 20 }] },
  ]);
  assert.deepEqual(imagePayload.body.element_list, [{ element_id: 160 }]);
});

test('Kling direct fallback classification is limited to pre-acceptance safe submit errors', () => {
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('rate limited', { status: 429, code: '1302' })).fallbackEligible,
    true
  );
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('provider error', { status: 500, code: '5000' })).fallbackEligible,
    true
  );
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('missing task id', { code: 'KLING_TASK_ID_MISSING' })).fallbackEligible,
    true
  );
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('auth failed', { status: 401, code: '1001' })).fallbackEligible,
    false
  );
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('credits depleted', { status: 429, code: '1101' })).fallbackEligible,
    false
  );
  assert.equal(
    classifyKlingDirectError(new KlingDirectError('moderation', { status: 400, code: '1300' })).fallbackEligible,
    false
  );

  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: 'task_accepted',
      error: new KlingDirectError('provider error after acceptance', { status: 500, code: '5000' }),
      fallbackToFalEnabled: true,
    }),
    false
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: new KlingDirectError('provider error before acceptance', { status: 500, code: '5000' }),
      fallbackToFalEnabled: true,
    }),
    true
  );
});

test('generate route delegates Kling direct submission and does not build Kling payloads inline', () => {
  assert.match(generateRouteSource, /from '\.\/_lib\/video-provider-submission'/);
  assert.match(generateRouteSource, /submitGenerateProviderTask/);
  assert.match(providerSubmissionSource, /from '\.\/kling-direct-submission'/);
  assert.match(providerSubmissionSource, /submitKlingDirectGenerateTask/);
  assert.doesNotMatch(generateRouteSource, /model_name:\s*['"]kling-v3/);
  assert.doesNotMatch(generateRouteSource, /\/v1\/videos\/omni-video/);
  assert.doesNotMatch(providerSubmissionSource, /kling-v3-omni/);
});

test('job detail refresh does not poll Kling direct jobs through Fal APIs', () => {
  assert.match(
    jobDetailRouteSource,
    /shouldUseFalApis\(\)[\s\S]*\(job\.provider \?\? 'fal'\) === 'fal'[\s\S]*job\.provider_job_id/
  );
});
