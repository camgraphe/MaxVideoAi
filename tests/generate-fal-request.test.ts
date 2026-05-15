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

test('Fal request body strips Kling direct-only provider extras', () => {
  const result = buildFalGenerationRequest(
    {
      engineId: 'kling-3-pro',
      prompt: 'Fallback prompt',
      mode: 'i2v',
      durationSec: 5,
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
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
});
