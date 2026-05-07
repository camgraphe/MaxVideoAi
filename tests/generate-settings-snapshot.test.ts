import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { buildGenerationSettingsSnapshot } from '../frontend/app/api/generate/_lib/settings-snapshot';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/settings-snapshot.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates settings snapshot building', () => {
  assert.ok(existsSync(helperPath), 'settings snapshot building should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/settings-snapshot'/);
  assert.doesNotMatch(routeSource, /schemaVersion:\s*1/, 'settings schema version belongs in settings-snapshot.ts');
  assert.doesNotMatch(routeSource, /negativePrompt\s*=/, 'negative prompt normalization belongs in settings-snapshot.ts');
  assert.doesNotMatch(routeSource, /memberTier/, 'membership tier snapshot belongs in settings-snapshot.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2050, `/api/generate route should stay below 2050 lines after settings snapshot extraction, got ${lineCount}`);
});

test('settings snapshot helper exposes the route contract', () => {
  assert.match(helperSource, /export type GenerationSettingsSnapshot/, 'settings snapshot type should be exported');
  assert.match(helperSource, /export function buildGenerationSettingsSnapshot/, 'buildGenerationSettingsSnapshot should be exported');
  assert.match(helperSource, /function trimmedStringOrNull/, 'string trimming should stay private');
});

test('settings snapshot helper builds core, advanced, refs, and meta snapshots', () => {
  const snapshot = buildGenerationSettingsSnapshot({
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    mode: 'i2v',
    prompt: 'Create a shot',
    negativePrompt: '  blur  ',
    membershipTier: ' pro ',
    durationSec: 8,
    durationOption: '8',
    numFrames: null,
    aspectRatio: '16:9',
    resolution: '1080p',
    clampedFps: 25,
    rawFps: 12,
    iterationCount: 2,
    audioEnabled: true,
    cfgScale: 5.5,
    isLumaRay2: true,
    loop: true,
    shotType: 'customize',
    seed: 123,
    cameraFixed: false,
    safetyChecker: true,
    voiceIds: ['voice_1'],
    voiceControl: true,
    multiPrompt: [{ prompt: 'Shot one', duration: 4 }],
    extraInputValues: { style_strength: 0.6 },
    initialImageUrl: 'https://cdn.maxvideoai.com/image.png',
    resolvedFirstFrameUrl: 'https://cdn.maxvideoai.com/first.png',
    resolvedAudioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
    normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref.png'],
    videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    lastFrameUrl: 'https://cdn.maxvideoai.com/last.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    elements: [{ frontalImageUrl: 'https://cdn.maxvideoai.com/face.png' }],
    falInputs: [
      {
        name: 'image',
        type: 'image/png',
        size: 10,
        kind: 'image',
        slotId: 'image_url',
        url: 'https://cdn.maxvideoai.com/image.png',
      },
    ],
  });

  assert.deepEqual(snapshot, {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    inputMode: 'i2v',
    prompt: 'Create a shot',
    negativePrompt: 'blur',
    core: {
      durationSec: 8,
      durationOption: '8',
      numFrames: null,
      aspectRatio: '16:9',
      resolution: '1080p',
      fps: 25,
      iterationCount: 2,
      audio: true,
    },
    advanced: {
      cfgScale: 5.5,
      loop: true,
      shotType: 'customize',
      seed: 123,
      cameraFixed: false,
      safetyChecker: true,
      voiceIds: ['voice_1'],
      voiceControl: true,
      multiPrompt: [{ prompt: 'Shot one', duration: 4 }],
      extraInputValues: { style_strength: 0.6 },
    },
    refs: {
      imageUrl: 'https://cdn.maxvideoai.com/image.png',
      audioUrl: 'https://cdn.maxvideoai.com/audio.mp3',
      referenceImages: ['https://cdn.maxvideoai.com/ref.png'],
      videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
      firstFrameUrl: 'https://cdn.maxvideoai.com/first.png',
      lastFrameUrl: 'https://cdn.maxvideoai.com/last.png',
      endImageUrl: 'https://cdn.maxvideoai.com/end.png',
      elements: [{ frontalImageUrl: 'https://cdn.maxvideoai.com/face.png' }],
      inputs: [
        {
          name: 'image',
          type: 'image/png',
          size: 10,
          kind: 'image',
          slotId: 'image_url',
          url: 'https://cdn.maxvideoai.com/image.png',
        },
      ],
    },
    meta: {
      memberTier: 'pro',
    },
  });
});

test('settings snapshot helper normalizes empty optional values', () => {
  const snapshot = buildGenerationSettingsSnapshot({
    engineId: 'generic',
    engineLabel: 'Generic',
    mode: 't2v',
    prompt: 'Prompt',
    negativePrompt: '',
    membershipTier: '',
    durationSec: 4,
    durationOption: null,
    numFrames: null,
    aspectRatio: null,
    resolution: '720p',
    clampedFps: undefined,
    rawFps: 24,
    iterationCount: null,
    audioEnabled: undefined,
    cfgScale: 'invalid',
    isLumaRay2: false,
    loop: true,
    shotType: null,
    seed: null,
    cameraFixed: null,
    safetyChecker: null,
    voiceIds: [],
    voiceControl: false,
    multiPrompt: null,
    extraInputValues: {},
    initialImageUrl: undefined,
    resolvedFirstFrameUrl: undefined,
    resolvedAudioUrl: undefined,
    normalizedReferenceImages: [],
    videoUrls: [],
    lastFrameUrl: undefined,
    endImageUrl: null,
    elements: null,
    falInputs: undefined,
  });

  assert.equal((snapshot as { negativePrompt: unknown }).negativePrompt, null);
  assert.deepEqual((snapshot as { core: { fps: number } }).core.fps, 24);
  assert.deepEqual((snapshot as { advanced: { loop: unknown; extraInputValues: unknown } }).advanced.loop, null);
  assert.deepEqual((snapshot as { advanced: { loop: unknown; extraInputValues: unknown } }).advanced.extraInputValues, null);
  assert.deepEqual((snapshot as { refs: { videoUrls: unknown; inputs: unknown } }).refs.videoUrls, null);
  assert.deepEqual((snapshot as { refs: { videoUrls: unknown; inputs: unknown } }).refs.inputs, null);
  assert.deepEqual((snapshot as { meta: { memberTier: unknown } }).meta.memberTier, null);
});
