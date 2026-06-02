import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  buildKlingDirectElementList,
} from '../frontend/src/lib/video-provider-elements';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import {
  classifyKlingDirectError,
  KlingDirectError,
  shouldFallbackFromKlingDirectSubmit,
} from '../frontend/src/server/video-providers/kling-direct/errors';
import {
  buildKlingDirectPayload,
} from '../frontend/src/server/video-providers/kling-direct/payload';
import { estimateKlingDirectCost } from '../frontend/src/server/video-providers/kling-direct/cost';
import {
  isKlingDirectEngine,
  resolveKlingDirectModelRoute,
} from '../frontend/src/server/video-providers/kling-direct/model-map';
import {
  resolveVideoProviderRoutingPlan,
  shouldRouteKlingDirectSourceElementsToFal,
} from '../frontend/src/server/video-providers/router';
import {
  getKlingDirectRouteCapabilities,
  isKlingDirectFalFallbackCompatible,
  sanitizeKlingDirectFalFallbackPayload,
} from '../frontend/src/server/video-providers/kling-direct/capabilities';
import { resolveKlingDirectSubmissionMediaInputs } from '../frontend/app/api/generate/_lib/kling-direct-submission';

const root = process.cwd();
const generateRouteSource = readFileSync(join(root, 'frontend/app/api/generate/route.ts'), 'utf8');
const providerSubmissionSource = readFileSync(join(root, 'frontend/app/api/generate/_lib/video-provider-submission.ts'), 'utf8');
const jobDetailRouteSource = readFileSync(join(root, 'frontend/app/api/jobs/[jobId]/route.ts'), 'utf8');

test('Kling direct router selects admin-only primary routing for V3 and O3 public engine slugs', () => {
  const klingEngineIds = [
    'kling-3-standard',
    'kling-3-pro',
    'kling-3-4k',
    'kling-o3-standard',
    'kling-o3-pro',
    'kling-o3-4k',
  ];
  const engines = listFalEngines().filter((engine) => klingEngineIds.includes(engine.id));
  assert.deepEqual(engines.map((engine) => engine.id).sort(), klingEngineIds.sort());
  assert.ok(klingEngineIds.every(isKlingDirectEngine));

  for (const engineId of klingEngineIds) {
    const plan = resolveVideoProviderRoutingPlan({
      engineId,
      mode: 't2v',
      isAdmin: true,
      env: {
        KLING_DIRECT_ENABLED: 'true',
        KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
        KLING_DIRECT_ADMIN_ONLY: 'true',
        KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
        KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED: 'true',
      },
    });

    assert.deepEqual(plan, {
      kind: 'kling_direct_primary',
      primaryProvider: 'kling_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
      elementRegistrationEnabled: false,
    });
  }
});

test('Kling direct routes source subject references to Fal unless element registration is enabled', () => {
  const disabledPlan = resolveVideoProviderRoutingPlan({
    engineId: 'kling-3-pro',
    mode: 'i2v',
    isAdmin: true,
    env: {
      KLING_DIRECT_ENABLED: 'true',
      KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
      KLING_DIRECT_ADMIN_ONLY: 'true',
      KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
    },
  });
  assert.equal(shouldRouteKlingDirectSourceElementsToFal({ providerRoutingPlan: disabledPlan, elementCount: 1 }), true);

  const enabledPlan = resolveVideoProviderRoutingPlan({
    engineId: 'kling-3-pro',
    mode: 'i2v',
    isAdmin: true,
    env: {
      KLING_DIRECT_ENABLED: 'true',
      KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
      KLING_DIRECT_ADMIN_ONLY: 'true',
      KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
      KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED: 'true',
    },
  });
  assert.equal(
    shouldRouteKlingDirectSourceElementsToFal({ providerRoutingPlan: enabledPlan, elementCount: 1 }),
    false
  );
  if (enabledPlan.kind !== 'kling_direct_primary') {
    throw new Error('Expected Kling direct plan');
  }
  assert.equal(enabledPlan.elementRegistrationEnabled, true);
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

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'kling-o3-4k',
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

  const omniRoute = resolveKlingDirectModelRoute('kling-o3-pro');
  assert.equal(omniRoute.engineId, 'kling-o3-pro');
  assert.equal(omniRoute.endpointFamily, 'video-o3-omni');
  assert.equal(omniRoute.providerModel, 'kling-v3-omni');
  assert.equal(omniRoute.mode, 'pro');
  assert.equal(omniRoute.createPaths.v2v, '/v1/videos/omni-video');

  const omniVideoPayload = buildKlingDirectPayload({
    engineId: 'kling-o3-pro',
    jobId: 'job_o3_v2v',
    mode: 'v2v',
    prompt: 'Use @Video1 for camera motion, @Image1 for style, and keep @Element1 consistent.',
    durationSec: 5,
    aspectRatio: '16:9',
    audioEnabled: true,
    imageUrl: 'https://cdn.maxvideoai.com/ignored-opening.png',
    startImageUrl: 'https://cdn.maxvideoai.com/ignored-start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/ignored-end.png',
    sourceVideoUrl: 'https://cdn.maxvideoai.com/source.mp4',
    referenceImageUrls: ['https://cdn.maxvideoai.com/style.png'],
    elements: [{ providerElementId: 160 }],
    extraInputValues: { keep_audio: false },
  });
  assert.equal(omniVideoPayload.createPath, '/v1/videos/omni-video');
  assert.equal(omniVideoPayload.pollPathPrefix, '/v1/videos/omni-video');
  assert.deepEqual(omniVideoPayload.body, {
    model_name: 'kling-v3-omni',
    prompt:
      'Use <<<video_1>>> for camera motion, <<<image_1>>> for style, and keep <<<element_1>>> consistent.',
    duration: '5',
    mode: 'pro',
    sound: 'off',
    aspect_ratio: '16:9',
    external_task_id: 'job_o3_v2v',
    image_list: [{ image_url: 'https://cdn.maxvideoai.com/style.png' }],
    video_list: [
      {
        video_url: 'https://cdn.maxvideoai.com/source.mp4',
        refer_type: 'feature',
        keep_original_sound: 'no',
      },
    ],
    element_list: [{ element_id: 160 }],
  });
});

test('Kling direct capabilities cover Kling V3 and Kling 3.0 Omni without enabling O1 routes', () => {
  const standard = getKlingDirectRouteCapabilities(resolveKlingDirectModelRoute('kling-3-standard'));
  const pro = getKlingDirectRouteCapabilities(resolveKlingDirectModelRoute('kling-3-pro'));
  const fourK = getKlingDirectRouteCapabilities(resolveKlingDirectModelRoute('kling-3-4k'));
  const omniPro = getKlingDirectRouteCapabilities(resolveKlingDirectModelRoute('kling-o3-pro'));

  assert.equal(standard.providerModel, 'kling-v3');
  assert.equal(pro.providerModel, 'kling-v3');
  assert.equal(fourK.providerModel, 'kling-v3');
  assert.equal(omniPro.providerModel, 'kling-v3-omni');
  assert.equal(JSON.stringify([standard, pro, fourK, omniPro]).includes('kling-video-o1'), false);

  assert.equal(pro.t2v.multiShot, true);
  assert.equal(pro.t2v.voiceControl, false);
  assert.equal(pro.t2v.cameraControl, false);
  assert.equal(pro.i2v.startEndFrame, true);
  assert.equal(pro.i2v.elementList, true);
  assert.equal(pro.i2v.motionBrush, true);
  assert.equal(pro.i2v.cameraControl, true);
  assert.equal(fourK.i2v.motionBrush, false);
  assert.equal(fourK.i2v.cameraControl, false);
  assert.equal(omniPro.ref2v?.elementList, true);
  assert.equal(omniPro.ref2v?.startEndFrame, true);
  assert.equal(omniPro.v2v?.audio, false);
  assert.equal(omniPro.v2v?.elementList, true);
  assert.equal(omniPro.v2v?.startEndFrame, false);
});

test('Kling 3 engine schemas expose current direct V3 options conservatively', () => {
  const enginesById = new Map(listFalEngines().map((entry) => [entry.id, entry.engine]));
  const optionalIds = (engineId: string) =>
    new Set((enginesById.get(engineId)?.inputSchema?.optional ?? []).map((field) => field.id));

  assert.deepEqual(
    ['kling-3-standard', 'kling-3-pro'].map((engineId) => optionalIds(engineId).has('camera_control')),
    [true, true]
  );
  assert.deepEqual(
    ['kling-3-standard', 'kling-3-pro'].map((engineId) => optionalIds(engineId).has('static_mask')),
    [true, true]
  );
  assert.deepEqual(
    ['kling-3-standard', 'kling-3-pro'].map((engineId) => optionalIds(engineId).has('dynamic_masks')),
    [true, true]
  );
  assert.deepEqual(
    ['kling-3-standard', 'kling-3-pro', 'kling-3-4k'].map((engineId) =>
      optionalIds(engineId).has('element_list')
    ),
    [false, false, false]
  );
  assert.deepEqual(
    ['kling-3-standard', 'kling-3-pro', 'kling-3-4k'].map((engineId) =>
      optionalIds(engineId).has('watermark_enabled')
    ),
    [false, false, false]
  );

  assert.equal(optionalIds('kling-3-4k').has('camera_control'), false);
  assert.equal(optionalIds('kling-3-4k').has('static_mask'), false);
  assert.equal(optionalIds('kling-3-4k').has('dynamic_masks'), false);
});

test('Kling catalog separates V3 start-frame workflows from 3.0 Omni reference workflows', () => {
  const entriesById = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  const kling3Pro = entriesById.get('kling-3-pro');
  const klingO3Pro = entriesById.get('kling-o3-pro');
  assert.ok(kling3Pro);
  assert.ok(klingO3Pro);

  assert.equal(klingO3Pro.marketingName, 'Kling 3.0 Omni Pro');
  assert.equal(klingO3Pro.versionLabel, '3.0 Omni Pro');
  assert.equal(klingO3Pro.engine.label, 'Kling 3.0 Omni Pro');

  const v3ImageField = kling3Pro.engine.inputSchema?.required?.find((field) => field.id === 'image_url');
  assert.equal(v3ImageField?.label, 'Start frame');
  assert.equal(kling3Pro.engine.modes.includes('ref2v'), false);

  const o3Fields = [
    ...(klingO3Pro.engine.inputSchema?.required ?? []),
    ...(klingO3Pro.engine.inputSchema?.optional ?? []),
  ];
  const o3ReferenceField = o3Fields.find((field) => field.id === 'image_urls');
  const o3StartFrameField = klingO3Pro.engine.inputSchema?.optional?.find((field) => field.id === 'start_image_url');
  assert.equal(o3ReferenceField?.label, 'Reference / storyboard images');
  assert.equal(o3ReferenceField?.maxCount, 4);
  assert.equal(o3ReferenceField?.requiredInModes?.includes('ref2v') ?? false, false);
  assert.equal(o3StartFrameField?.label, 'Optional start frame');
  assert.equal(o3StartFrameField?.modes?.includes('ref2v'), true);
  assert.equal(klingO3Pro.engine.modes.includes('ref2v'), true);
  assert.equal(klingO3Pro.modes.find((mode) => mode.mode === 'ref2v')?.falModelId, 'fal-ai/kling-video/o3/pro/reference-to-video');
});

test('Kling 3.0 Omni catalog exposes video-to-video for Standard and Pro only', () => {
  const entriesById = new Map(listFalEngines().map((entry) => [entry.id, entry]));

  [
    ['kling-o3-standard', 'fal-ai/kling-video/o3/standard/video-to-video/reference'],
    ['kling-o3-pro', 'fal-ai/kling-video/o3/pro/video-to-video/reference'],
  ].forEach(([engineId, expectedEndpoint]) => {
    const entry = entriesById.get(engineId);
    assert.ok(entry, `${engineId} should be registered`);
    assert.equal(entry.engine.modes.includes('v2v'), true);
    assert.equal(entry.modes.find((mode) => mode.mode === 'v2v')?.falModelId, expectedEndpoint);

    const fields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
    const sourceVideoField = fields.find((field) => field.id === 'video_url');
    const referenceImageField = fields.find((field) => field.id === 'image_urls');
    const keepAudioField = fields.find((field) => field.id === 'keep_audio');

    assert.equal(sourceVideoField?.type, 'video');
    assert.equal(sourceVideoField?.requiredInModes?.includes('v2v'), true);
    assert.equal(sourceVideoField?.maxCount, 1);
    assert.equal(sourceVideoField?.maxDurationSec, 10);
    assert.equal(referenceImageField?.modes?.includes('v2v'), true);
    assert.equal(referenceImageField?.maxCount, 4);
    assert.equal(keepAudioField?.modes?.includes('v2v'), true);
    assert.equal(entry.engine.modeCaps?.v2v?.modes.includes('v2v'), true);
  });

  const native4k = entriesById.get('kling-o3-4k');
  assert.ok(native4k);
  assert.equal(native4k.engine.modes.includes('v2v'), false);
  assert.equal(native4k.modes.some((mode) => mode.mode === 'v2v'), false);
});

test('Kling direct is preferred for Kling 3.0 Omni video-to-video with Fal fallback', () => {
  assert.equal(isKlingDirectEngine('kling-o3-pro'), true);
  assert.equal(resolveKlingDirectModelRoute('kling-o3-pro').providerModel, 'kling-v3-omni');
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'kling-o3-pro',
      mode: 'v2v',
      isAdmin: true,
      env: {
        KLING_DIRECT_ENABLED: 'true',
        KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
        KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'kling_direct_primary',
      primaryProvider: 'kling_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      fallbackOnCreditsDepletedEnabled: false,
      elementRegistrationEnabled: false,
    }
  );
});

test('Kling direct submission extracts O3 video and reference inputs from MaxVideoAI payloads', () => {
  const mediaInputs = resolveKlingDirectSubmissionMediaInputs({
    imageUrl: null,
    falPayload: {
      engineId: 'kling-o3-pro',
      prompt: 'Use @Video1 and @Image1.',
      mode: 'v2v',
      referenceImages: ['https://cdn.maxvideoai.com/style-from-payload.png'],
      inputs: [
        {
          name: 'source.mp4',
          type: 'video/mp4',
          size: 1200,
          kind: 'video',
          slotId: 'video_url',
          url: 'https://cdn.maxvideoai.com/source.mp4',
        },
        {
          name: 'style-from-input.png',
          type: 'image/png',
          size: 400,
          kind: 'image',
          slotId: 'image_urls',
          url: 'https://cdn.maxvideoai.com/style-from-input.png',
        },
        {
          name: 'start.png',
          type: 'image/png',
          size: 400,
          kind: 'image',
          slotId: 'start_image_url',
          url: 'https://cdn.maxvideoai.com/start.png',
        },
      ],
      extraInputValues: { keep_audio: false },
    },
  });

  assert.equal(mediaInputs.sourceVideoUrl, 'https://cdn.maxvideoai.com/source.mp4');
  assert.deepEqual(mediaInputs.referenceImageUrls, [
    'https://cdn.maxvideoai.com/style-from-payload.png',
    'https://cdn.maxvideoai.com/style-from-input.png',
  ]);
  assert.equal(mediaInputs.startImageUrl, 'https://cdn.maxvideoai.com/start.png');
  assert.equal(mediaInputs.keepAudio, false);
});

test('Kling direct submission treats unified O3 opening frame slot as a reference start frame', () => {
  const mediaInputs = resolveKlingDirectSubmissionMediaInputs({
    imageUrl: null,
    falPayload: {
      engineId: 'kling-o3-pro',
      prompt: 'Use @Image1 as style guidance, then open from the supplied frame.',
      mode: 'ref2v',
      inputs: [
        {
          name: 'opening.png',
          type: 'image/png',
          size: 400,
          kind: 'image',
          slotId: 'image_url',
          url: 'https://cdn.maxvideoai.com/opening.png',
        },
        {
          name: 'style.png',
          type: 'image/png',
          size: 400,
          kind: 'image',
          slotId: 'image_urls',
          url: 'https://cdn.maxvideoai.com/style.png',
        },
      ],
    },
  });

  assert.equal(mediaInputs.startImageUrl, 'https://cdn.maxvideoai.com/opening.png');
  assert.deepEqual(mediaInputs.referenceImageUrls, ['https://cdn.maxvideoai.com/style.png']);
});

test('Kling direct O3 cost estimates align with Fal visible rates', () => {
  const standardAudioOn = estimateKlingDirectCost({
    engineId: 'kling-o3-standard',
    mode: 't2v',
    durationSec: 5,
    audioEnabled: true,
  });
  const standardAudioOff = estimateKlingDirectCost({
    engineId: 'kling-o3-standard',
    mode: 't2v',
    durationSec: 5,
    audioEnabled: false,
  });
  const standardV2v = estimateKlingDirectCost({
    engineId: 'kling-o3-standard',
    mode: 'v2v',
    durationSec: 5,
    audioEnabled: false,
  });
  const proAudioOn = estimateKlingDirectCost({
    engineId: 'kling-o3-pro',
    mode: 't2v',
    durationSec: 5,
    audioEnabled: true,
  });
  const proV2v = estimateKlingDirectCost({
    engineId: 'kling-o3-pro',
    mode: 'v2v',
    durationSec: 5,
    audioEnabled: false,
  });
  const proAudioOff = estimateKlingDirectCost({
    engineId: 'kling-o3-pro',
    mode: 't2v',
    durationSec: 5,
    audioEnabled: false,
  });

  assert.equal(standardAudioOn.providerCostUsd, 0.63);
  assert.equal(standardAudioOff.providerCostUsd, 0.42);
  assert.equal(standardV2v.providerCostUsd, 0.63);
  assert.equal(proAudioOn.providerCostUsd, 0.84);
  assert.equal(proV2v.providerCostUsd, 0.84);
  assert.equal(proAudioOff.providerCostUsd, 0.56);
});

test('Kling direct payload preserves supported advanced Kling V3 provider options', () => {
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
      watermark_enabled: 'true',
      watermark_info: { enabled: true },
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
  assert.equal(textPayload.body.sound, 'on');
  assert.equal(textPayload.body.voice_list, undefined);
  assert.equal(textPayload.body.watermark_info, undefined);
  assert.equal('ignored' in textPayload.body, false);

  const imagePayload = buildKlingDirectPayload({
    engineId: 'kling-3-pro',
    jobId: 'job_image',
    mode: 'i2v',
    prompt: 'Animate frame',
    durationSec: 5,
    imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
    extraInputValues: {
      camera_control: '{"type":"simple","config":{"zoom":4}}',
    },
    elements: [
      {
        providerElementId: '160',
        frontalImageUrl: 'https://cdn.maxvideoai.com/subject-front.jpg',
        referenceImageUrls: ['https://cdn.maxvideoai.com/subject-side.jpg'],
      },
      {
        providerElementId: 161,
        videoUrl: 'https://cdn.maxvideoai.com/subject-video.mp4',
      },
    ],
  });

  assert.equal(imagePayload.body.image, 'https://cdn.maxvideoai.com/start.jpg');
  assert.equal(imagePayload.body.mode, 'pro');
  assert.deepEqual(imagePayload.body.camera_control, { type: 'simple', config: { zoom: 4 } });
  assert.deepEqual(imagePayload.body.element_list, [{ element_id: 160 }, { element_id: 161 }]);
});

test('Kling direct payload rejects unsupported or mutually exclusive V3 provider options before submit', () => {
  assert.throws(
    () =>
      buildKlingDirectPayload({
        engineId: 'kling-3-pro',
        jobId: 'job_conflict',
        mode: 'i2v',
        prompt: 'Animate frame',
        durationSec: 5,
        imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
        endImageUrl: 'https://cdn.maxvideoai.com/end.jpg',
        extraInputValues: {
          static_mask: 'https://cdn.maxvideoai.com/mask.png',
        },
      }),
    /mutually exclusive/
  );

  assert.throws(
    () =>
      buildKlingDirectPayload({
        engineId: 'kling-3-4k',
        jobId: 'job_4k_motion',
        mode: 'i2v',
        prompt: 'Animate frame',
        durationSec: 5,
        imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
        extraInputValues: {
          camera_control: '{"type":"simple","config":{"zoom":4}}',
        },
      }),
    /does not support camera_control/
  );

  assert.throws(
    () =>
      buildKlingDirectPayload({
        engineId: 'kling-3-pro',
        jobId: 'job_bad_camera_json',
        mode: 'i2v',
        prompt: 'Animate frame',
        durationSec: 5,
        imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
        extraInputValues: {
          camera_control: 'not json',
        },
      }),
    /camera_control must be valid JSON/
  );

  assert.throws(
    () =>
      buildKlingDirectPayload({
        engineId: 'kling-3-pro',
        jobId: 'job_bad_motion_json',
        mode: 'i2v',
        prompt: 'Animate frame',
        durationSec: 5,
        imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
        extraInputValues: {
          dynamic_masks: 'not json',
        },
      }),
    /dynamic_masks must be valid JSON/
  );
});

test('Kling direct fallback to Fal strips direct-only extra params', () => {
  const sanitized = sanitizeKlingDirectFalFallbackPayload({
    engineId: 'kling-3-pro',
    prompt: 'Fallback prompt',
    elements: [
      {
        providerElementId: 160,
        frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
        referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
      },
    ],
    extraInputValues: {
      camera_control: '{"type":"simple","config":{"zoom":4}}',
      static_mask: 'https://cdn.maxvideoai.com/mask.png',
      dynamic_masks: '[{"mask":"https://cdn.maxvideoai.com/motion.png","trajectories":[]}]',
      element_list: '160,161',
      watermark_enabled: 'true',
      keep_for_fal: 'yes',
    },
  });

  assert.deepEqual(sanitized.extraInputValues, { keep_for_fal: 'yes' });
  assert.deepEqual(sanitized.elements, [
    {
      providerElementId: 160,
      frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
    },
  ]);
});

test('Kling direct fallback to Fal requires portable MaxVideoAI options', () => {
  assert.equal(
    isKlingDirectFalFallbackCompatible({
      engineId: 'kling-3-pro',
      prompt: 'Fallback prompt',
      elements: [
        {
          providerElementId: 160,
          frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
          referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
        },
      ],
    }),
    true
  );
  assert.equal(
    isKlingDirectFalFallbackCompatible({
      engineId: 'kling-3-pro',
      prompt: 'Fallback prompt',
      extraInputValues: { element_list: '160,161' },
    }),
    false
  );
  assert.equal(
    isKlingDirectFalFallbackCompatible({
      engineId: 'kling-3-pro',
      prompt: 'Fallback prompt',
      extraInputValues: { camera_control: '{"type":"simple","config":{"zoom":4}}' },
    }),
    false
  );
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
      fallbackOnCreditsDepletedEnabled: true,
    }),
    false
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: new KlingDirectError('provider error before acceptance', { status: 500, code: '5000' }),
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: false,
    }),
    true
  );
});

test('Kling direct can fall back on depleted prepaid credits only before provider acceptance', () => {
  const depletedPack = new KlingDirectError('prepaid resource pack depleted', { status: 429, code: '1102' });
  const accountArrears = new KlingDirectError('account in arrears', { status: 429, code: '1101' });

  assert.equal(classifyKlingDirectError(depletedPack).fallbackEligible, false);
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: depletedPack,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: false,
    }),
    false
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: depletedPack,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
    }),
    true
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: 'task_accepted',
      error: depletedPack,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
    }),
    false
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: accountArrears,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
    }),
    false
  );
});

test('MaxVideoAI element payload maps to Kling element_list and Fal elements without voice ids', () => {
  const elements = [
    {
      id: 'element_1',
      providerElementId: '160',
      frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref-a.png', 'https://cdn.maxvideoai.com/ref-b.png'],
      frontalAssetId: 'asset_front',
      referenceAssetIds: ['asset_ref_a', 'asset_ref_b'],
    },
    {
      id: 'element_2',
      providerElementId: 161,
      videoUrl: 'https://cdn.maxvideoai.com/element.mp4',
      videoAssetId: 'asset_video',
    },
  ];

  assert.deepEqual(buildKlingDirectElementList(elements), [{ element_id: 160 }, { element_id: 161 }]);

  const directPayload = buildKlingDirectPayload({
    engineId: 'kling-3-pro',
    jobId: 'job_elements',
    mode: 'i2v',
    prompt: 'Keep both source elements consistent',
    durationSec: 5,
    imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
    elements,
    voiceIds: ['voice_should_not_send'],
  });
  assert.deepEqual(directPayload.body.element_list, [{ element_id: 160 }, { element_id: 161 }]);
  assert.equal(directPayload.body.voice_list, undefined);

  const falRequest = buildFalGenerationRequest(
    {
      engineId: 'kling-3-pro',
      prompt: 'Keep both source elements consistent',
      mode: 'i2v',
      durationSec: 5,
      imageUrl: 'https://cdn.maxvideoai.com/start.jpg',
      elements,
      voiceIds: [],
    },
    'fal-ai/kling-video/v3/pro/image-to-video'
  );
  assert.deepEqual(falRequest.requestBody.elements, [
    {
      frontal_image_url: 'https://cdn.maxvideoai.com/front.png',
      reference_image_urls: ['https://cdn.maxvideoai.com/ref-a.png', 'https://cdn.maxvideoai.com/ref-b.png'],
      video_url: undefined,
    },
    {
      frontal_image_url: undefined,
      reference_image_urls: undefined,
      video_url: 'https://cdn.maxvideoai.com/element.mp4',
    },
  ]);
  assert.equal(falRequest.requestBody.voice_ids, undefined);
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
