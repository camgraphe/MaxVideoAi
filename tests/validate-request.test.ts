import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRequest } from '../frontend/app/api/generate/_lib/validate';

const OK = { ok: true } as const;

test('Pika 2.2 rejects duration under 5 seconds', () => {
  const result = validateRequest('pika22', 't2v', {
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.field, 'duration');
});

test('Pika 2.2 accepts 5 second duration', () => {
  const result = validateRequest('pika22', 't2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(result, OK);
});

test('Sora image-to-video only allows 4/8/12 seconds', () => {
  const invalid = validateRequest('sora-2', 'i2v', {
    duration: 6,
    resolution: '720p',
    aspect_ratio: 'auto',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const valid = validateRequest('sora-2', 'i2v', {
    duration: 8,
    resolution: '720p',
    aspect_ratio: 'auto',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3 T2V accepts string durations and audio toggle', () => {
  const valid = validateRequest('veo3', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: true,
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3 I2V rejects durations other than 8s', () => {
  const invalid = validateRequest('veo3', 'i2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: 'auto',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');
});

test('Hailuo-02 Std enforces duration and resolution', () => {
  const invalid = validateRequest('minimax_hailuo_02_standard', 'i2v', {
    duration: 12,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const invalidResolution = validateRequest('minimax_hailuo_02_standard', 'i2v', {
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');

  const valid = validateRequest('minimax_hailuo_02_standard', 'i2v', {
    duration: 10,
    resolution: '768P',
    _uploadedFileMB: 10,
  });
  assert.deepEqual(valid, OK);
});

test('Hunyuan validates frame selections', () => {
  const invalid = validateRequest('hunyuan_video', 't2v', {
    num_frames: 90,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'num_frames');

  const valid = validateRequest('hunyuan_video', 't2v', {
    num_frames: 85,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Luma Ray 2 enforces duration and resolution options', () => {
  const valid = validateRequest('lumaRay2', 't2v', {
    duration: '5s',
    resolution: '540p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);

  const invalidDuration = validateRequest('lumaRay2', 't2v', {
    duration: '7s',
    resolution: '540p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidDuration.ok, false);
  assert.equal(invalidDuration.error?.field, 'duration');

  const invalidResolution = validateRequest('lumaRay2', 't2v', {
    duration: '5s',
    resolution: '4k',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');
});
