import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { listActiveVideoInputFields } from '../frontend/src/lib/video-input-schema';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

const image = 'https://example.com/original.png';
const end = 'https://example.com/end.png';
const audio = 'https://example.com/original.mp3';
const base = { prompt: 'A cinematic transition', durationSec: 5, aspectRatio: '16:9', resolution: '1080p' };
function build(engineId: string, mode: string, extra: Partial<GeneratePayload> = {}) {
  const model = getFalEngineById(engineId)!.modes.find((entry) => entry.mode === mode)!.falModelId;
  return buildFalGenerationRequest({ ...base, engineId, mode, ...extra }, model);
}
function fields(engineId: string, mode: 'i2v' | 'a2v' | 't2v' | 'i2i') {
  return listActiveVideoInputFields(getFalEngineById(engineId)!.engine.inputSchema, mode).map((field) => field.id);
}
test('Kling 2.6 maps complete I2V payload and omits stale unsupported controls', () => {
  const extraInputValues = { negative_prompt: 'blur', cfg_scale: 0.4, seed: 42, voice_ids: ['voice'] };
  const result = build('kling-2-6-pro', 'i2v', { imageUrl: image, endImageUrl: end, cfgScale: 0.4, seed: 42, audio: false, safetyChecker: true, extraInputValues });
  assert.deepEqual(result, { model: 'fal-ai/kling-video/v2.6/pro/image-to-video', requestBody: {
    prompt: base.prompt, duration: '5', start_image_url: image, end_image_url: end,
    generate_audio: false, enable_safety_checker: true, negative_prompt: 'blur', voice_ids: ['voice'],
  } });
  assert.deepEqual(extraInputValues, { negative_prompt: 'blur', cfg_scale: 0.4, seed: 42, voice_ids: ['voice'] });
  assert.ok(fields('kling-2-6-pro', 'i2v').includes('end_image_url'));
  assert.ok(!fields('kling-2-6-pro', 'i2v').includes('cfg_scale'));
});
test('Kling 2.6 T2V preserves prompt, CFG, aspect, audio and safety', () => {
  assert.deepEqual(build('kling-2-6-pro', 't2v', { cfgScale: 0.4, audio: true, safetyChecker: false, extraInputValues: { negative_prompt: 'blur' } }).requestBody, {
    prompt: base.prompt, duration: '5', aspect_ratio: '16:9', cfg_scale: 0.4, generate_audio: true, enable_safety_checker: false, negative_prompt: 'blur',
  });
  assert.ok(fields('kling-2-6-pro', 't2v').includes('cfg_scale'));
});
test('Kling 2.5 Pro projects the existing end-image control to tail_image_url', () => {
  assert.deepEqual(build('kling-2-5-turbo', 'i2v', { imageUrl: image, endImageUrl: end, cfgScale: 0.6, safetyChecker: true, extraInputValues: { negative_prompt: 'blur' } }).requestBody, {
    prompt: base.prompt, duration: '5', image_url: image, tail_image_url: end, cfg_scale: 0.6, enable_safety_checker: true, negative_prompt: 'blur',
  });
  assert.ok(fields('kling-2-5-turbo', 'i2v').includes('end_image_url'));
  assert.ok(!fields('kling-2-5-turbo', 'i2i').includes('end_image_url'));
  assert.equal(build('kling-2-5-turbo', 'i2i', { imageUrl: image }).model, 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video');
});
for (const engineId of ['ltx-2-3', 'ltx-2-3-fast']) {
  test(`${engineId} I2V omits saved guidance while preserving the original frames`, () => {
    const extraInputValues = { guidance_scale: 9 };
    assert.deepEqual(build(engineId, 'i2v', { durationSec: 6, fps: 25, imageUrl: image, endImageUrl: end, audio: true, extraInputValues }).requestBody, {
      prompt: base.prompt, duration: 6, fps: 25, resolution: '1080p', aspect_ratio: '16:9', image_url: image, end_image_url: end, generate_audio: true,
    });
    assert.equal(extraInputValues.guidance_scale, 9);
    assert.ok(!fields(engineId, 'i2v').includes('guidance_scale'));
  });
}
test('LTX 2.3 A2V preserves valid guidance and optional image', () => {
  assert.deepEqual(build('ltx-2-3', 'a2v', { audioUrl: audio, imageUrl: image, extraInputValues: { guidance_scale: 9 } }).requestBody, {
    prompt: base.prompt, audio_url: audio, image_url: image, guidance_scale: 9,
  });
  assert.ok(fields('ltx-2-3', 'a2v').includes('guidance_scale'));
});
for (const engineId of ['ltx-2-5-pro', 'ltx-2-5-fast']) {
  test(`${engineId} A2V omits stale guidance and retains optional first frame`, () => {
    assert.deepEqual(build(engineId, 'a2v', { audioUrl: audio, imageUrl: image, safetyChecker: true, extraInputValues: { guidance_scale: 9 } }).requestBody, {
      prompt: base.prompt, audio_url: audio, image_url: image, aspect_ratio: '16:9', enable_safety_checker: true,
    });
    assert.ok(!fields(engineId, 'a2v').includes('guidance_scale'));
  });
}

// The compact evidence fixture is intentionally independent from the engine definitions.
const contracts = JSON.parse(readFileSync(new URL('./fixtures/video-provider-contracts-2026-10-24.json', import.meta.url), 'utf8')) as Array<{ endpoint: string; keys: string[]; required: string[] }>;
test('reviewed request bodies fit the dated provider contracts, including attachment input', () => {
  for (const [engineId, mode] of [
    ['kling-2-6-pro', 't2v'], ['kling-2-6-pro', 'i2v'],
    ['kling-2-5-turbo', 't2v'], ['kling-2-5-turbo', 'i2v'],
    ['ltx-2-3', 'i2v'], ['ltx-2-3-fast', 'i2v'], ['ltx-2-3', 'a2v'],
    ['ltx-2-5-pro', 'a2v'], ['ltx-2-5-fast', 'a2v'],
  ]) {
    const result = build(engineId, mode, {
      ...(mode === 'i2v' ? { inputs: [{ name: 'original', type: 'image/png', size: 1, kind: 'image', slotId: 'image_url', url: image }], endImageUrl: end } : {}),
      ...(mode === 'a2v' ? { audioUrl: audio } : {}),
      extraInputValues: engineId.startsWith('ltx') ? { guidance_scale: 9 } : { negative_prompt: 'blur' },
    });
    const contract = contracts.find((row) => row.endpoint === result.model)!;
    assert.ok(contract, result.model);
    for (const key of Object.keys(result.requestBody)) assert.ok(contract.keys.includes(key), `${result.model}: unexpected ${key}`);
    for (const key of contract.required) assert.ok(key in result.requestBody, `${result.model}: missing ${key}`);
    if (mode === 'i2v') assert.equal(result.requestBody[engineId === 'kling-2-6-pro' ? 'start_image_url' : 'image_url'], image);
  }
});
