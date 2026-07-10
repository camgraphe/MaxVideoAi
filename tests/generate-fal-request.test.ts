import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildFalInputs, buildFalRequestParts } from '../frontend/app/api/generate/_lib/fal-request';
import { resolveFalModelSlug } from '../frontend/src/lib/fal-model-helpers';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/attachments';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/fal-request.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const attachment = (overrides: Partial<NormalizedAttachment>): NormalizedAttachment => ({
  name: 'asset',
  type: 'application/octet-stream',
  size: 0,
  ...overrides,
});

function baseFalRequest(overrides: Partial<Parameters<typeof buildFalRequestParts>[0]> = {}) {
  return buildFalRequestParts({
    attachments: [],
    engineId: 'generic-engine',
    prompt: 'Generate a cinematic shot',
    mode: 't2v',
    apiKey: undefined,
    jobId: 'job_123',
    localKey: null,
    needsImage: false,
    needsFirstLastFrames: false,
    initialImageUrl: undefined,
    resolvedFirstFrameUrl: undefined,
    lastFrameUrl: undefined,
    resolvedAudioUrl: undefined,
    normalizedReferenceImages: [],
    videoUrls: [],
    audioUrls: [],
    soraRequest: null,
    isLumaRay2: false,
    loop: false,
    multiPrompt: null,
    shotType: null,
    seed: null,
    cameraFixed: null,
    safetyChecker: null,
    voiceIds: [],
    elements: null,
    endImageUrl: null,
    extraInputValues: {},
    supportsDuration: true,
    durationSec: 8,
    durationOption: '8',
    numFrames: null,
    supportsAspectRatio: true,
    aspectRatio: '16:9',
    supportsResolution: true,
    resolution: '1080p',
    audioEnabled: undefined,
    supportsFps: true,
    fps: undefined,
    cfgScale: undefined,
    ...overrides,
  });
}

test('generate route delegates Fal request building', () => {
  assert.ok(existsSync(helperPath), 'Fal request building should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/fal-request'/);
  assert.doesNotMatch(routeSource, /const falInputs\s*=/, 'Fal attachment mapping belongs in fal-request.ts');
  assert.doesNotMatch(routeSource, /const falInputSummary\s*=/, 'Fal input summary belongs in fal-request.ts');
  assert.doesNotMatch(routeSource, /isLtxFastLong/, 'LTX FPS clamping belongs in fal-request.ts');
  assert.doesNotMatch(routeSource, /Parameters<typeof generateVideo>\[0\]/, 'Fal payload typing belongs in fal-request.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2060, `/api/generate route should stay below 2060 lines after Fal request extraction, got ${lineCount}`);
});

test('Fal request helper exposes the route contract', () => {
  assert.match(helperSource, /export type FalInputSummary/, 'Fal input summary type should be exported');
  assert.match(helperSource, /export function buildFalInputs/, 'buildFalInputs should be exported');
  assert.match(helperSource, /export function buildFalRequestParts/, 'buildFalRequestParts should be exported');
});

test('Fal request helper maps normalized attachments to provider inputs', () => {
  assert.deepEqual(
    buildFalInputs([
      attachment({
        name: 'source',
        type: 'video/mp4',
        size: 42,
        kind: 'video',
        slotId: 'video_url',
        label: 'Source clip',
        url: 'https://cdn.maxvideoai.com/source.mp4',
        width: null,
        height: 720,
        durationSec: 18.7,
        assetId: 'asset_123',
      }),
    ]),
    [
      {
        name: 'source',
        type: 'video/mp4',
        size: 42,
        kind: 'video',
        slotId: 'video_url',
        label: 'Source clip',
        url: 'https://cdn.maxvideoai.com/source.mp4',
        width: undefined,
        height: 720,
        durationSec: 18.7,
        assetId: 'asset_123',
      },
    ]
  );

  assert.equal(buildFalInputs([]), undefined);
});

test('Fal request helper builds payload, input summary, and LTX long FPS clamp', () => {
  const result = baseFalRequest({
    attachments: [
      attachment({ kind: 'image', slotId: 'image_url', url: 'https://cdn.maxvideoai.com/image.png' }),
      attachment({ kind: 'audio', slotId: 'audio_url', url: 'https://cdn.maxvideoai.com/audio.mp3' }),
    ],
    engineId: 'ltx-2-fast',
    mode: 'i2v',
    apiKey: 'secret',
    localKey: 'local_123',
    needsImage: true,
    initialImageUrl: 'https://cdn.maxvideoai.com/image.png',
    resolvedAudioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref.png'],
    audioUrls: ['https://cdn.maxvideoai.com/audio.mp3'],
    durationSec: 12,
    durationOption: 12,
    audioEnabled: false,
    fps: 12,
    cfgScale: 5.5,
    multiPrompt: [{ prompt: 'Shot one', duration: 6 }],
    shotType: 'intelligent',
    seed: 123,
    cameraFixed: true,
    safetyChecker: false,
    voiceIds: ['voice_1'],
    elements: [{ frontalImageUrl: 'https://cdn.maxvideoai.com/face.png' }],
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    extraInputValues: { style_strength: 0.6 },
  });

  assert.equal(result.clampedFps, 25);
  assert.equal(result.falDurationOption, 12);
  assert.deepEqual(result.falInputSummary, {
    primaryImageUrl: 'https://cdn.maxvideoai.com/image.png',
    primaryAudioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    referenceImageCount: 1,
    referenceVideoCount: 0,
    referenceAudioCount: 1,
    hasFirstFrame: false,
    hasLastFrame: false,
    inputSlots: [
      { slotId: 'image_url', kind: 'image', hasUrl: true },
      { slotId: 'audio_url', kind: 'audio', hasUrl: true },
    ],
  });
  assert.deepEqual(result.falPayload, {
    engineId: 'ltx-2-fast',
    prompt: 'Generate a cinematic shot',
    mode: 'i2v',
    apiKey: 'secret',
    idempotencyKey: 'job_123',
    imageUrl: 'https://cdn.maxvideoai.com/image.png',
    audioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    referenceImages: ['https://cdn.maxvideoai.com/ref.png'],
    inputs: result.falInputs,
    soraRequest: undefined,
    jobId: 'job_123',
    localKey: 'local_123',
    loop: undefined,
    multiPrompt: [{ prompt: 'Shot one', duration: 6 }],
    shotType: 'customize',
    seed: 123,
    cameraFixed: true,
    safetyChecker: false,
    voiceIds: ['voice_1'],
    elements: [{ frontalImageUrl: 'https://cdn.maxvideoai.com/face.png' }],
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    extraInputValues: { style_strength: 0.6 },
    durationSec: 12,
    durationOption: 12,
    numFrames: null,
    aspectRatio: '16:9',
    resolution: '1080p',
    audio: false,
    fps: 25,
    cfgScale: 5.5,
  });
});

test('Fal request helper uses first frame URL for first-last-frame payloads', () => {
  const result = baseFalRequest({
    mode: 'fl2v',
    needsFirstLastFrames: true,
    resolvedFirstFrameUrl: 'https://cdn.maxvideoai.com/first.png',
    lastFrameUrl: 'https://cdn.maxvideoai.com/last.png',
    supportsFps: false,
    fps: 24,
  });

  assert.equal(result.falPayload.imageUrl, 'https://cdn.maxvideoai.com/first.png');
  assert.equal(result.falPayload.fps, undefined);
  assert.equal(result.falInputSummary.hasFirstFrame, true);
  assert.equal(result.falInputSummary.hasLastFrame, true);
});

test('Fal request body normalizes legacy Seedance 1.5 duration suffixes', () => {
  const result = buildFalGenerationRequest(
    {
      engineId: 'seedance-1-5-pro',
      prompt: 'The woman seen from behind is walking',
      mode: 'i2v',
      durationSec: 5,
      durationOption: '5s',
      resolution: '720p',
      aspectRatio: '9:16',
      audio: false,
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
    },
    'fal-ai/bytedance/seedance/v1.5/pro/image-to-video'
  );

  assert.equal(result.requestBody.duration, '5');
});

test('Fal request body routes Veo 3.1 Fast reference-to-video with image_urls only', () => {
  const payload = {
    engineId: 'veo-3-1-fast',
    prompt: 'Keep wardrobe, identity, and product silhouette consistent.',
    mode: 'ref2v',
    durationOption: '8s',
    resolution: '1080p',
    aspectRatio: '16:9',
    audio: true,
    imageUrl: 'https://cdn.maxvideoai.com/start-should-not-be-sent.png',
    referenceImages: [
      'https://cdn.maxvideoai.com/ref-1.png',
      'https://cdn.maxvideoai.com/ref-2.png',
    ],
  };

  const model = resolveFalModelSlug(payload, 'fal-ai/veo3.1/fast');
  assert.equal(model, 'fal-ai/veo3.1/fast/reference-to-video');

  const result = buildFalGenerationRequest(payload, model ?? '');
  assert.equal(result.model, 'fal-ai/veo3.1/fast/reference-to-video');
  assert.equal(result.requestBody.image_url, undefined);
  assert.deepEqual(result.requestBody.image_urls, [
    'https://cdn.maxvideoai.com/ref-1.png',
    'https://cdn.maxvideoai.com/ref-2.png',
  ]);
  assert.equal(result.requestBody.duration, '8s');
  assert.equal(result.requestBody.resolution, '1080p');
  assert.equal(result.requestBody.aspect_ratio, '16:9');
  assert.equal(result.requestBody.generate_audio, true);
});

test('Fal request body routes Happy Horse 1.1 reference-to-video with image_urls only', () => {
  const payload = {
    engineId: 'happy-horse-1-1',
    prompt: 'Use character1 and character2 in a studio product demo.',
    mode: 'ref2v',
    durationOption: 5,
    resolution: '1080p',
    aspectRatio: '5:4',
    imageUrl: 'https://cdn.maxvideoai.com/start-should-not-be-sent.png',
    referenceImages: [
      'https://cdn.maxvideoai.com/character-1.png',
      'https://cdn.maxvideoai.com/character-2.png',
    ],
  };

  const model = resolveFalModelSlug(payload, 'alibaba/happy-horse/v1.1/text-to-video');
  assert.equal(model, 'alibaba/happy-horse/v1.1/reference-to-video');

  const result = buildFalGenerationRequest(payload, model ?? '');
  assert.equal(result.model, 'alibaba/happy-horse/v1.1/reference-to-video');
  assert.equal(result.requestBody.image_url, undefined);
  assert.equal(result.requestBody.reference_image_urls, undefined);
  assert.deepEqual(result.requestBody.image_urls, [
    'https://cdn.maxvideoai.com/character-1.png',
    'https://cdn.maxvideoai.com/character-2.png',
  ]);
  assert.equal(result.requestBody.duration, 5);
  assert.equal(result.requestBody.resolution, '1080p');
  assert.equal(result.requestBody.aspect_ratio, '5:4');
});

test('Fal request body only sends Happy Horse 1.1 fields supported by Fal schemas', () => {
  const cases = [
    {
      mode: 't2v',
      model: 'alibaba/happy-horse/v1.1/text-to-video',
      payload: {
        engineId: 'happy-horse-1-1',
        prompt: 'A cinematic presenter shot with native audio.',
        mode: 't2v',
        durationOption: 15,
        resolution: '1080p',
        aspectRatio: '9:21',
        fps: 24,
        seed: 2147483647,
        safetyChecker: false,
      },
      expected: {
        prompt: 'A cinematic presenter shot with native audio.',
        duration: 15,
        resolution: '1080p',
        aspect_ratio: '9:21',
        seed: 2147483647,
        enable_safety_checker: false,
      },
    },
    {
      mode: 'i2v',
      model: 'alibaba/happy-horse/v1.1/image-to-video',
      payload: {
        engineId: 'happy-horse-1-1',
        prompt: 'Animate the product naturally.',
        mode: 'i2v',
        durationOption: 3,
        resolution: '720p',
        aspectRatio: '9:21',
        fps: 24,
        seed: 0,
        safetyChecker: true,
        inputs: [
          attachment({
            kind: 'image',
            slotId: 'image_url',
            url: 'https://cdn.maxvideoai.com/start.png',
          }),
        ],
      },
      expected: {
        prompt: 'Animate the product naturally.',
        duration: 3,
        resolution: '720p',
        image_url: 'https://cdn.maxvideoai.com/start.png',
        seed: 0,
        enable_safety_checker: true,
      },
    },
    {
      mode: 'ref2v',
      model: 'alibaba/happy-horse/v1.1/reference-to-video',
      payload: {
        engineId: 'happy-horse-1-1',
        prompt: 'Use character1 and character2 in a product demo.',
        mode: 'ref2v',
        durationOption: 12,
        resolution: '1080p',
        aspectRatio: '4:5',
        fps: 24,
        referenceImages: [
          'https://cdn.maxvideoai.com/character-1.png',
          'https://cdn.maxvideoai.com/character-2.png',
        ],
      },
      expected: {
        prompt: 'Use character1 and character2 in a product demo.',
        duration: 12,
        resolution: '1080p',
        aspect_ratio: '4:5',
        image_urls: [
          'https://cdn.maxvideoai.com/character-1.png',
          'https://cdn.maxvideoai.com/character-2.png',
        ],
      },
    },
  ];

  cases.forEach(({ mode, model, payload, expected }) => {
    const result = buildFalGenerationRequest(payload, model);
    assert.equal(result.model, model);
    Object.entries(expected).forEach(([field, value]) => {
      assert.deepEqual(result.requestBody[field], value, `${mode}.${field}`);
    });
    assert.equal(result.requestBody.fps, undefined, `${mode} must not send unsupported fps`);
    assert.equal(result.requestBody.video_url, undefined, `${mode} must not send unsupported video_url`);
    if (mode === 'i2v') {
      assert.equal(result.requestBody.aspect_ratio, undefined, 'Happy Horse 1.1 I2V must not send aspect_ratio');
      assert.equal(result.requestBody.image_urls, undefined, 'Happy Horse 1.1 I2V must not send image_urls');
    }
  });
});

test('Fal request body clamps Veo 3.1 Extend resolution to 720p', () => {
  const cases = [
    ['veo-3-1', 'fal-ai/veo3.1', 'fal-ai/veo3.1/extend-video', '1080p'],
    ['veo-3-1-fast', 'fal-ai/veo3.1/fast', 'fal-ai/veo3.1/fast/extend-video', '4k'],
    ['veo-3-1-lite', 'fal-ai/veo3.1/lite', 'fal-ai/veo3.1/lite/extend-video', '1080p'],
  ] as const;

  for (const [engineId, fallbackModel, expectedModel, requestedResolution] of cases) {
    const payload = {
      engineId,
      prompt: 'Continue the source video with the same camera movement.',
      mode: 'extend',
      durationOption: '7s',
      resolution: requestedResolution,
      aspectRatio: '9:16',
      audio: false,
      inputs: [
        attachment({
          name: 'source.mp4',
          type: 'video/mp4',
          size: 1200,
          kind: 'video',
          slotId: 'video_url',
          url: 'https://cdn.maxvideoai.com/source.mp4',
        }),
      ],
    };

    const model = resolveFalModelSlug(payload, fallbackModel);
    assert.equal(model, expectedModel);

    const result = buildFalGenerationRequest(payload, model ?? '');
    assert.equal(result.model, expectedModel);
    assert.equal(result.requestBody.video_url, 'https://cdn.maxvideoai.com/source.mp4');
    assert.equal(result.requestBody.duration, '7s');
    assert.equal(result.requestBody.resolution, '720p');
    assert.equal(result.requestBody.aspect_ratio, '9:16');
    assert.equal(result.requestBody.generate_audio, false);
  }
});

test('Fal request body routes Kling 3.0 Omni reference images without promoting them to a start frame', () => {
  const payload = {
    engineId: 'kling-o3-pro',
    prompt: 'Use @Image1 as the storyboard composition and @Image2 as the character style.',
    mode: 'ref2v',
    durationOption: '5',
    aspectRatio: '16:9',
    audio: true,
    referenceImages: [
      'https://cdn.maxvideoai.com/storyboard-1.png',
      'https://cdn.maxvideoai.com/style-2.png',
    ],
    elements: [
      {
        frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
        referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
      },
    ],
  };

  const model = resolveFalModelSlug(payload, 'fal-ai/kling-video/o3/pro/text-to-video');
  assert.equal(model, 'fal-ai/kling-video/o3/pro/reference-to-video');

  const result = buildFalGenerationRequest(payload, model ?? '');
  assert.equal(result.model, 'fal-ai/kling-video/o3/pro/reference-to-video');
  assert.equal(result.requestBody.image_url, undefined);
  assert.equal(result.requestBody.start_image_url, undefined);
  assert.deepEqual(result.requestBody.image_urls, [
    'https://cdn.maxvideoai.com/storyboard-1.png',
    'https://cdn.maxvideoai.com/style-2.png',
  ]);
  assert.deepEqual(result.requestBody.elements, [
    {
      frontal_image_url: 'https://cdn.maxvideoai.com/front.png',
      reference_image_urls: ['https://cdn.maxvideoai.com/ref.png'],
      video_url: undefined,
    },
  ]);
  assert.equal(result.requestBody.duration, '5');
  assert.equal(result.requestBody.aspect_ratio, '16:9');
  assert.equal(result.requestBody.generate_audio, true);
});

test('Fal request body sends Kling 3.0 Omni optional reference start frame explicitly', () => {
  const payload = {
    engineId: 'kling-o3-pro',
    prompt: 'Use @Image1 as style guidance, then open from the supplied start frame.',
    mode: 'ref2v',
    durationOption: '5',
    inputs: [
      attachment({
        name: 'start.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'start_image_url',
        url: 'https://cdn.maxvideoai.com/start-frame.png',
      }),
      attachment({
        name: 'reference.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'image_urls',
        url: 'https://cdn.maxvideoai.com/reference.png',
      }),
    ],
  };

  const result = buildFalGenerationRequest(payload, 'fal-ai/kling-video/o3/pro/reference-to-video');

  assert.equal(result.requestBody.image_url, undefined);
  assert.equal(result.requestBody.start_image_url, 'https://cdn.maxvideoai.com/start-frame.png');
  assert.deepEqual(result.requestBody.image_urls, ['https://cdn.maxvideoai.com/reference.png']);
});

test('Fal request body maps Kling 3.0 Omni reference image_url slot to start_image_url', () => {
  const payload = {
    engineId: 'kling-o3-standard',
    prompt: 'Use @Image1 as style guidance, then animate between the supplied start and end frames.',
    mode: 'ref2v',
    durationOption: '11',
    inputs: [
      attachment({
        name: 'legacy-start.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'image_url',
        url: 'https://cdn.maxvideoai.com/legacy-start.png',
      }),
      attachment({
        name: 'reference.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'image_urls',
        url: 'https://cdn.maxvideoai.com/reference.png',
      }),
      attachment({
        name: 'end.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'end_image_url',
        url: 'https://cdn.maxvideoai.com/end.png',
      }),
    ],
  };

  const result = buildFalGenerationRequest(payload, 'fal-ai/kling-video/o3/standard/reference-to-video');

  assert.equal(result.requestBody.image_url, undefined);
  assert.equal(result.requestBody.start_image_url, 'https://cdn.maxvideoai.com/legacy-start.png');
  assert.equal(result.requestBody.end_image_url, 'https://cdn.maxvideoai.com/end.png');
  assert.deepEqual(result.requestBody.image_urls, ['https://cdn.maxvideoai.com/reference.png']);
});

test('Fal request body sends Luma Ray 3.2 public controls and reference image URLs', () => {
  const payload = {
    engineId: 'luma-ray-3-2',
    prompt: 'Cinematic product reveal',
    mode: 't2v',
    durationOption: '5s',
    resolution: '720p',
    aspectRatio: '3:1',
    loop: true,
    referenceImages: ['https://cdn.maxvideoai.com/ref-normalized.png'],
    inputs: [
      attachment({
        name: 'style.png',
        type: 'image/png',
        size: 1200,
        kind: 'image',
        slotId: 'reference_image_urls',
        url: 'https://cdn.maxvideoai.com/ref-slot.png',
      }),
    ],
  };

  const model = resolveFalModelSlug(payload, 'luma/agent/ray/v3.2/text-to-video');
  assert.equal(model, 'luma/agent/ray/v3.2/text-to-video');

  const result = buildFalGenerationRequest(payload, model ?? '');
  assert.equal(result.requestBody.duration, '5s');
  assert.equal(result.requestBody.resolution, '720p');
  assert.equal(result.requestBody.aspect_ratio, '3:1');
  assert.equal(result.requestBody.loop, true);
  assert.equal(result.requestBody.image_url, undefined);
  assert.deepEqual(result.requestBody.reference_image_urls, [
    'https://cdn.maxvideoai.com/ref-slot.png',
    'https://cdn.maxvideoai.com/ref-normalized.png',
  ]);
  assert.equal(result.requestBody.reference_images, undefined);
});

test('Fal request helper includes Luma Ray 3.2 loop in fal payload', () => {
  const result = baseFalRequest({
    engineId: 'luma-ray-3-2',
    mode: 'i2v',
    needsImage: true,
    initialImageUrl: 'https://cdn.maxvideoai.com/start.png',
    normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref.png'],
    isLumaRay2: false,
    loop: true,
    durationSec: 5,
    durationOption: '5s',
    resolution: '540p',
    aspectRatio: '16:9',
  });

  assert.equal(result.falPayload.loop, true);
  assert.equal(result.falPayload.durationOption, '5s');
  assert.deepEqual(result.falPayload.referenceImages, ['https://cdn.maxvideoai.com/ref.png']);
});

test('Fal request body routes Kling 3.0 Omni video-to-video through the reference video endpoint', () => {
  const payload = {
    engineId: 'kling-o3-pro',
    prompt: 'Use @Video1 for motion language and @Image1 for watercolor styling.',
    mode: 'v2v',
    durationOption: '5',
    aspectRatio: '16:9',
    inputs: [
      attachment({
        name: 'source.mp4',
        type: 'video/mp4',
        size: 1200,
        kind: 'video',
        slotId: 'video_url',
        url: 'https://cdn.maxvideoai.com/source.mp4',
      }),
    ],
    referenceImages: ['https://cdn.maxvideoai.com/style.png'],
    extraInputValues: {
      keep_audio: false,
    },
  };

  const model = resolveFalModelSlug(payload, 'fal-ai/kling-video/o3/pro/text-to-video');
  assert.equal(model, 'fal-ai/kling-video/o3/pro/video-to-video/reference');

  const result = buildFalGenerationRequest(payload, model ?? '');
  assert.equal(result.model, 'fal-ai/kling-video/o3/pro/video-to-video/reference');
  assert.equal(result.requestBody.video_url, 'https://cdn.maxvideoai.com/source.mp4');
  assert.deepEqual(result.requestBody.image_urls, ['https://cdn.maxvideoai.com/style.png']);
  assert.equal(result.requestBody.reference_image_urls, undefined);
  assert.equal(result.requestBody.reference_images, undefined);
  assert.equal(result.requestBody.keep_audio, false);
  assert.equal(result.requestBody.duration, '5');
  assert.equal(result.requestBody.aspect_ratio, '16:9');
});

test('Kling 3 image-to-video keeps using start_image_url for the uploaded start frame', () => {
  const result = buildFalGenerationRequest(
    {
      engineId: 'kling-3-pro',
      prompt: 'Animate the opening frame with a slow dolly push.',
      mode: 'i2v',
      durationOption: '5',
      imageUrl: 'https://cdn.maxvideoai.com/start-frame.png',
    },
    'fal-ai/kling-video/v3/pro/image-to-video'
  );

  assert.equal(result.requestBody.image_url, undefined);
  assert.equal(result.requestBody.start_image_url, 'https://cdn.maxvideoai.com/start-frame.png');
});

test('Kling 3.0 Omni image-to-video keeps using image_url for the uploaded start frame', () => {
  const result = buildFalGenerationRequest(
    {
      engineId: 'kling-o3-pro',
      prompt: 'Animate the opening frame with a slow dolly push.',
      mode: 'i2v',
      durationOption: '5',
      imageUrl: 'https://cdn.maxvideoai.com/start-frame.png',
    },
    'fal-ai/kling-video/o3/pro/image-to-video'
  );

  assert.equal(result.requestBody.image_url, 'https://cdn.maxvideoai.com/start-frame.png');
  assert.equal(result.requestBody.start_image_url, undefined);
});

test('Fal request body strips Kling direct-only provider extras', () => {
  const result = buildFalGenerationRequest(
    {
      engineId: 'kling-3-pro',
      prompt: 'Fallback prompt',
      mode: 'i2v',
      durationSec: 5,
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
      elements: [
        {
          id: 'element_1',
          providerElementId: 160,
          frontalImageUrl: 'https://cdn.maxvideoai.com/front.png',
          referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
          frontalAssetId: 'asset_front',
          referenceAssetIds: ['asset_ref'],
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
    },
    'fal-ai/kling-video/v3/pro/image-to-video'
  );

  assert.equal(result.requestBody.camera_control, undefined);
  assert.equal(result.requestBody.static_mask, undefined);
  assert.equal(result.requestBody.dynamic_masks, undefined);
  assert.equal(result.requestBody.element_list, undefined);
  assert.equal(result.requestBody.watermark_enabled, undefined);
  assert.equal(result.requestBody.keep_for_fal, 'yes');
  assert.deepEqual(result.requestBody.elements, [
    {
      frontal_image_url: 'https://cdn.maxvideoai.com/front.png',
      reference_image_urls: ['https://cdn.maxvideoai.com/ref.png'],
      video_url: undefined,
    },
  ]);
});
