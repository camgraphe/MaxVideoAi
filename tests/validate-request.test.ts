import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRequest } from '../frontend/app/api/generate/_lib/validate.ts';

const OK = { ok: true } as const;

test('Pika 2.2 rejects duration under 5 seconds', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 4,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.field, 'duration');
});

test('Pika 2.2 accepts 5 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(result, OK);
});

test('Pika 2.2 accepts 10 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 10,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(result, OK);
});

test('Pika 2.2 rejects 8 second duration', () => {
  const result = validateRequest('pika-text-to-video', 't2v', {
    duration: 8,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(result.ok, false);
  assert.equal(result.error?.field, 'duration');
});

test('Sora image-to-video only allows 4/8/12 seconds', () => {
  const invalid = validateRequest('sora-2', 'i2v', {
    duration: 6,
    resolution: '720p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const valid = validateRequest('sora-2', 'i2v', {
    duration: 8,
    resolution: '720p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Sora 2 Pro enforces Pro duration and resolution options', () => {
  const invalidDuration = validateRequest('sora-2-pro', 't2v', {
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidDuration.ok, false);
  assert.equal(invalidDuration.error?.field, 'duration');

  const invalidResolution = validateRequest('sora-2-pro', 't2v', {
    duration: 8,
    resolution: '1440p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');

  const valid = validateRequest('sora-2-pro', 't2v', {
    duration: 8,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast T2V accepts string durations and audio toggle', () => {
  const valid = validateRequest('veo-3-1-fast', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: true,
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 T2V supports 4-8 second prompts', () => {
  const valid = validateRequest('veo-3-1', 't2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast T2V supports text prompts', () => {
  const valid = validateRequest('veo-3-1-fast', 't2v', {
    duration: '4s',
    resolution: '720p',
    aspect_ratio: '9:16',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 Fast I2V requires image_url', () => {
  const invalid = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate this still',
    duration: '8s',
    resolution: '720p',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'image_url');

  const valid = validateRequest('veo-3-1-fast', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/test.png',
    duration: '8s',
    resolution: '720p',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3.1 First/Last requires both frames', () => {
  const missing = validateRequest('veo-3-1-first-last', 'i2v', {
    prompt: 'Bridge frames',
    duration: '8s',
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'first_frame_url');

  const partial = validateRequest('veo-3-1-first-last', 'i2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    duration: '8s',
  });
  assert.equal(partial.ok, false);
  assert.equal(partial.error?.field, 'last_frame_url');

  const valid = validateRequest('veo-3-1-first-last', 'i2v', {
    prompt: 'Bridge frames',
    first_frame_url: 'https://example.com/frame1.png',
    last_frame_url: 'https://example.com/frame2.png',
    duration: '8s',
  });
  assert.deepEqual(valid, OK);
});

test('Veo 3 I2V rejects durations other than 8s', () => {
  const invalid = validateRequest('veo-3-1', 'i2v', {
    duration: '6s',
    resolution: '1080p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const valid = validateRequest('veo-3-1', 'i2v', {
    duration: '8s',
    resolution: '1080p',
    aspect_ratio: 'auto',
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Hailuo-02 Std enforces duration and resolution', () => {
  const invalid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 12,
    resolution: '1080p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'duration');

  const invalidResolution = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 6,
    resolution: '1080p',
    aspect_ratio: '16:9',
    image_url: 'https://example.com/frame.png',
  });
  assert.equal(invalidResolution.ok, false);
  assert.equal(invalidResolution.error?.field, 'resolution');

  const valid = validateRequest('minimax-hailuo-02-text', 'i2v', {
    duration: 10,
    resolution: '768P',
    _uploadedFileMB: 10,
    image_url: 'https://example.com/frame.png',
  });
  assert.deepEqual(valid, OK);
});

test('Wan 2.6 R2V requires reference videos', () => {
  const missing = validateRequest('wan-2-6', 'r2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'video_urls');

  const valid = validateRequest('wan-2-6', 'r2v', {
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
    video_urls: ['https://example.com/ref1.mp4'],
  });
  assert.deepEqual(valid, OK);

  const invalidLong = validateRequest('wan-2-6', 'r2v', {
    duration: 15,
    resolution: '1080p',
    aspect_ratio: '16:9',
    video_urls: ['https://example.com/ref1.mp4'],
  });
  assert.equal(invalidLong.ok, false);
  assert.equal(invalidLong.error?.field, 'duration');
});
