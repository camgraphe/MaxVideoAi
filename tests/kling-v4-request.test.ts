import assert from 'node:assert/strict';
import test from 'node:test';
import { buildKlingV4FalRequest, getKlingV4ConstraintViolation } from '../frontend/src/lib/kling-v4';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

const base: GeneratePayload = { engineId: 'kling-v4', prompt: 'A projectionist hears applause in an empty cinema.', mode: 't2v' };
const image = 'https://media.example/frame.jpg';
const video = 'https://media.example/reference.mp4';

test('V4 maps documented defaults and uses the exact fal namespace', () => {
  assert.deepEqual(buildFalGenerationRequest(base, 'fal-ai/kling-video/v3/pro/text-to-video'), {
    model: 'kling/v4/text-to-video', requestBody: { prompt: base.prompt, duration: 5, resolution: '1080p', aspect_ratio: '16:9' },
  });
});

test('V4 preserves 30-second multi-shot plans without inherited six-shot truncation', () => {
  const shots = Array.from({ length: 10 }, (_, i) => ({ prompt: `Shot ${i + 1}: the light moves.`, duration: 3 }));
  const actual = buildKlingV4FalRequest({ ...base, prompt: '', durationSec: 30, multiPrompt: shots });
  assert.deepEqual(actual.requestBody.multi_prompt, shots);
  assert.equal(actual.requestBody.prompt, undefined);
  assert.throws(() => buildKlingV4FalRequest({ ...base, multiPrompt: shots, durationSec: 30 }), /prompt/i);
  assert.throws(() => buildKlingV4FalRequest({ ...base, prompt: '', multiPrompt: shots, durationSec: 29 }), /duration/i);
});

test('image mode maps start/end frames and never forwards a framing UI hint', () => {
  const result = buildKlingV4FalRequest({ ...base, mode: 'i2v', imageUrl: image, endImageUrl: image + '?end', aspectRatio: '16:9' });
  assert.equal(result.model, 'kling/v4/image-to-video');
  assert.equal(result.requestBody.start_image_url, image);
  assert.equal(result.requestBody.end_image_url, image + '?end');
  assert.equal(result.requestBody.aspect_ratio, undefined);
  assert.throws(() => buildKlingV4FalRequest({ ...base, mode: 'i2v' }), /start_image_url/i);
});

test('reference mode preserves seven elements and their per-character voice binding', () => {
  const elements = Array.from({ length: 7 }, (_, i) => ({ frontalImageUrl: `${image}?${i}`, referenceImageUrls: [image], ...(i < 3 ? { voiceId: `voice-${i}` } : {}) }));
  const result = buildKlingV4FalRequest({ ...base, mode: 'ref2v', elements, referenceImages: [image] });
  assert.equal((result.requestBody.elements as unknown[]).length, 7);
  assert.equal((result.requestBody.elements as Record<string, unknown>[])[2].voice_id, 'voice-2');
  assert.throws(() => buildKlingV4FalRequest({ ...base, mode: 'ref2v', elements: [...elements, elements[0]] }), /elements/i);
});

test('reference count includes the optional start frame; edit accepts only image elements', () => {
  assert.throws(() => buildKlingV4FalRequest({ ...base, mode: 'ref2v', imageUrl: image, referenceImages: Array(10).fill(image) }), /image/i);
  assert.throws(() => buildKlingV4FalRequest({ ...base, mode: 'ref2v', endImageUrl: image, referenceImages: [image] }), /end_image_url/i);
  const edited = buildKlingV4FalRequest({ ...base, mode: 'v2v', videoUrl: video, referenceImages: [image], durationSec: 30 });
  assert.equal(edited.model, 'kling/v4/video-to-video/edit');
  assert.equal(edited.requestBody.video_url, video);
  assert.equal(edited.requestBody.aspect_ratio, undefined);
  assert.throws(() => buildKlingV4FalRequest({ ...base, mode: 'v2v', videoUrl: video, elements: [{ videoUrl: video }] }), /elements/i);
});

test('unsupported controls and invalid provider boundaries fail before submission', () => {
  for (const patch of [{ durationSec: 31 }, { durationSec: 2 }, { durationOption: '3.5' }, { resolution: '4k' }, { fps: 60 }, { seed: 42 }, { audio: false }, { voiceIds: ['voice'] }, { extraInputValues: { keyframes: [] } }]) {
    assert.throws(() => buildKlingV4FalRequest({ ...base, ...patch }), /Kling V4/i);
  }
  for (const patch of [{ multi_prompt: [] }, { prompt: 'x'.repeat(26001) }, { video_urls: Array(6).fill(video) }, { elements: Array(4).fill({ video_url: video }) }, { elements: Array(4).fill({ frontal_image_url: image, reference_image_urls: [image], voice_id: 'v' }) }]) {
    assert.ok(getKlingV4ConstraintViolation('ref2v', { prompt: base.prompt, duration: 5, resolution: '720p', image_urls: [image], ...patch }));
  }
});

test('V4 rejects attachments it cannot consume instead of dropping the reference', () => {
  for (const input of [
    { kind: 'audio', slotId: 'audio_url', url: 'https://media.example/dialogue.wav' },
    { kind: 'image', slotId: 'middle_frame_url', url: image },
    { kind: 'video', slotId: 'image_url', url: video },
  ]) {
    assert.throws(() => buildKlingV4FalRequest({ ...base, inputs: [input] } as GeneratePayload), /attachment/i);
  }
});

test('V4 rejects contradictory explicit durations and preserves equivalent selectors', () => {
  assert.throws(() => buildKlingV4FalRequest({ ...base, durationSec: 30, durationOption: '5' }), /conflicting.*duration/i);
  assert.equal(buildKlingV4FalRequest({ ...base, durationSec: 30, durationOption: '30' }).requestBody.duration, 30);
});
