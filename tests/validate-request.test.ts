import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRequest } from '../frontend/app/api/generate/_lib/validate.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

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

test('Kling 3 prompt length is capped before provider submission', () => {
  const invalid = validateRequest('kling-3-pro', 't2v', {
    prompt: 'x'.repeat(2501),
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'prompt');

  const valid = validateRequest('kling-3-standard', 't2v', {
    prompt: 'x'.repeat(2500),
    duration: 5,
    resolution: '1080p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('Wan prompt length follows documented provider limits', () => {
  const invalid = validateRequest('wan-2-6', 't2v', {
    prompt: 'x'.repeat(801),
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error?.field, 'prompt');

  const valid = validateRequest('wan-2-5', 't2v', {
    prompt: 'x'.repeat(800),
    duration: 5,
    resolution: '720p',
    aspect_ratio: '16:9',
  });
  assert.deepEqual(valid, OK);
});

test('LTX 2.3 registry exposes unified mode mapping', () => {
  const registry = listFalEngines();
  const ltx23 = registry.find((entry) => entry.id === 'ltx-2-3');
  const ltx23Fast = registry.find((entry) => entry.id === 'ltx-2-3-fast');

  assert.ok(ltx23);
  assert.ok(ltx23Fast);
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/ltx-2.3/text-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'i2v')?.falModelId, 'fal-ai/ltx-2.3/image-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'a2v')?.falModelId, 'fal-ai/ltx-2.3/audio-to-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'extend')?.falModelId, 'fal-ai/ltx-2.3/extend-video');
  assert.equal(ltx23?.modes.find((mode) => mode.mode === 'retake')?.falModelId, 'fal-ai/ltx-2.3/retake-video');
  assert.equal(ltx23Fast?.modes.find((mode) => mode.mode === 't2v')?.falModelId, 'fal-ai/ltx-2.3/text-to-video/fast');
  assert.equal(ltx23Fast?.modes.find((mode) => mode.mode === 'i2v')?.falModelId, 'fal-ai/ltx-2.3/image-to-video/fast');
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'a2v'), false);
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'extend'), false);
  assert.equal(ltx23Fast?.modes.some((mode) => mode.mode === 'retake'), false);
});

test('Nano Banana 2 registry exposes image mappings and schema caps', () => {
  const registry = listFalEngines();
  const nanoBanana2 = registry.find((entry) => entry.id === 'nano-banana-2');

  assert.ok(nanoBanana2);
  assert.equal(nanoBanana2?.modes.find((mode) => mode.mode === 't2i')?.falModelId, 'fal-ai/nano-banana-2');
  assert.equal(nanoBanana2?.modes.find((mode) => mode.mode === 'i2i')?.falModelId, 'fal-ai/nano-banana-2/edit');
  assert.deepEqual(nanoBanana2?.engine.resolutions, ['0.5k', '1k', '2k', '4k']);
  assert.ok(nanoBanana2?.engine.aspectRatios.includes('4:1'));
  assert.ok(nanoBanana2?.engine.aspectRatios.includes('8:1'));
  const numImagesField = nanoBanana2?.engine.inputSchema?.optional?.find((field) => field.id === 'num_images');
  const imageUrlsField = nanoBanana2?.engine.inputSchema?.optional?.find(
    (field) => field.id === 'image_urls' && field.modes?.includes('i2i')
  );
  assert.equal(numImagesField?.max, 4);
  assert.equal(imageUrlsField?.maxCount, 14);
});

test('LTX 2.3 A2V requires audio input', () => {
  const missing = validateRequest('ltx-2-3', 'a2v', {});
  assert.equal(missing.ok, false);
  assert.equal(missing.error?.field, 'audio_url');

  const valid = validateRequest('ltx-2-3', 'a2v', {
    audio_url: 'https://example.com/audio.mp3',
  });
  assert.deepEqual(valid, OK);
});

test('LTX 2.3 extend and retake require a source video', () => {
  const missingExtend = validateRequest('ltx-2-3', 'extend', { duration: 5 });
  assert.equal(missingExtend.ok, false);
  assert.equal(missingExtend.error?.field, 'video_url');

  const validExtend = validateRequest('ltx-2-3', 'extend', {
    duration: 5,
    video_url: 'https://example.com/source.mp4',
  });
  assert.deepEqual(validExtend, OK);

  const missingRetake = validateRequest('ltx-2-3', 'retake', { duration: 5, prompt: 'Retake the shot' });
  assert.equal(missingRetake.ok, false);
  assert.equal(missingRetake.error?.field, 'video_url');

  const validRetake = validateRequest('ltx-2-3', 'retake', {
    duration: 5,
    prompt: 'Retake the shot',
    video_url: 'https://example.com/source.mp4',
  });
  assert.deepEqual(validRetake, OK);
});

test('LTX 2.3 image-to-video supports auto aspect ratio only on i2v', () => {
  const i2vValid = validateRequest('ltx-2-3', 'i2v', {
    prompt: 'Animate this still',
    image_url: 'https://example.com/frame.png',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: 'auto',
  });
  assert.deepEqual(i2vValid, OK);

  const t2vInvalid = validateRequest('ltx-2-3', 't2v', {
    prompt: 'Generate from text',
    duration: 6,
    resolution: '1080p',
    aspect_ratio: 'auto',
  });
  assert.equal(t2vInvalid.ok, false);
  assert.equal(t2vInvalid.error?.field, 'aspect_ratio');
});
