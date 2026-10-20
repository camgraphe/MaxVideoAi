import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAudioCreationRequest, newAudioDraft, repairAudioCreationDraft } from '../frontend/src/lib/audio-creation';
import { validateAudioGenerateRequest } from '../frontend/src/server/audio/audio-generate-validation';
import { audioCreationReusePatch } from '../frontend/app/(core)/(workspace)/app/audio/_lib/audio-creation-reuse';
import { computeCanonicalAudioBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { AudioGenerateRequestBody, AudioPricingInput } from '../frontend/src/lib/audio-generation';
import * as adapters from '../frontend/src/server/audio/providers/standalone';

const brian = 'nPczCjzI2devNBz1zQrb';
const roger = 'CwhRBWXzGAHq8TQ4Fs17';
const voiceRequest = (patch = {}) => ({ pack: 'voice_only', voiceModel: 'eleven-v4', script: '[conversational] Hello. [pause] Welcome.', elevenVoiceId: roger, ...patch } as AudioGenerateRequestBody);

test('fresh narration uses Eleven v4 while saved MiniMax choices keep their provider', () => {
  const fresh = newAudioDraft('voice');
  assert.equal(fresh.voiceModel, 'eleven-v4');
  const request = buildAudioCreationRequest('voice', { ...fresh, script: 'Hello' }, 'en');
  assert.equal((request as any).elevenVoiceId, brian);
  assert.equal(request.seedAudioSpeed, undefined);
  assert.equal(request.seedAudioPitch, undefined);
  assert.equal(request.seedAudioVolume, undefined);
  const legacy = repairAudioCreationDraft('voice', { ...fresh, voiceModel: 'minimax' });
  assert.equal(buildAudioCreationRequest('voice', { ...legacy, script: 'Hello' }, 'en').voiceModel, 'minimax');
});

test('Eleven validates exact voices and its own controls before a provider or wallet call', () => {
  const normalized = validateAudioGenerateRequest(voiceRequest({ elevenStability: 0.25, elevenSimilarityBoost: 0.8, language: 'french' }));
  assert.equal((normalized as any).elevenVoiceId, roger);
  assert.equal((normalized as any).elevenStability, 0.25);
  assert.equal((normalized as any).elevenSimilarityBoost, 0.8);
  for (const patch of [
    { elevenVoiceId: 'unknown-private-voice' }, { elevenVoiceId: '' }, { elevenVoiceId: 0 }, { elevenVoiceId: null }, { elevenStability: 1.1 }, { elevenStability: '0.5' },
    { elevenSimilarityBoost: NaN }, { seedAudioSpeed: 1.06 }, { seedAudioVolume: 1 }, { seedAudioPitch: 0 },
    { seedAudioVoice: 'default' }, { voiceSampleUrl: 'https://example.com/reference.wav' },
    { minimaxVoiceId: 'Wise_Woman' },
  ]) assert.throws(() => validateAudioGenerateRequest(voiceRequest(patch)), JSON.stringify(patch));
  assert.throws(() => validateAudioGenerateRequest({ pack: 'voice_only', voiceModel: 'minimax', script: 'Hello', elevenVoiceId: roger } as AudioGenerateRequestBody));
});

test('Eleven quotes character cost through the existing canonical commercial rule', async () => {
  for (const [script, expected] of [['a'.repeat(1000), 25], ['a'.repeat(3289), 80], ['a'.repeat(5000), 120], ['😀'.repeat(1000), 25]] as const) {
    const quote = await computeCanonicalAudioBillingSnapshot({ pack: 'voice_only', voiceModel: 'eleven-v4', script, durationSec: 30 } as AudioPricingInput,
      { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }) } });
    assert.equal(quote.totalCents, expected);
    assert.equal((quote.meta?.vendorCostComponents as any[])[0].model, 'elevenlabs/tts/eleven-v4');
    assert.equal(quote.meta?.scriptBillingCharacters, Array.from(script).length);
  }
});

test('reusing an Eleven result restores its exact voice and controls instead of switching to Seed', () => {
  const patch = audioCreationReusePatch({ voiceModel: 'eleven-v4', elevenVoiceId: roger, elevenStability: 0.3, elevenSimilarityBoost: 0.9, script: 'Kept script' } as any, newAudioDraft('voice'), 'Reference');
  const request = buildAudioCreationRequest('voice', { ...newAudioDraft('voice'), ...patch }, 'en');
  assert.equal(request.voiceModel, 'eleven-v4');
  assert.equal((request as any).elevenVoiceId, roger);
  assert.equal((request as any).elevenStability, 0.3);
  assert.equal((request as any).elevenSimilarityBoost, 0.9);
});

test('Eleven adapter sends the selected ID and v4 fields, preserving directions without speed or paid fallback', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const subscribe = async (model: string, input: Record<string, unknown>) => {
    calls.push({ model, input });
    return { data: { audio: { url: 'https://fixture.example/original.mp3' }, timestamps: [{ characters: ['H'], character_start_times_seconds: [0], character_end_times_seconds: [0.3] }] }, requestId: 'existing-request' };
  };
  const run = (adapters as any).generateElevenVoiceTrack;
  const result = await run(validateAudioGenerateRequest(voiceRequest({ language: 'french' })), subscribe);
  assert.deepEqual(calls, [{ model: 'elevenlabs/tts/eleven-v4', input: {
    text: '[conversational] Hello. [pause] Welcome.', voice: roger, stability: 0.5, similarity_boost: 0.75,
    language_code: 'fr', output_format: 'mp3_44100_128', apply_text_normalization: 'auto', timestamps: true,
  } }]);
  assert.equal(result.requestId, 'existing-request');
  assert.deepEqual(result.timestamps, [{ characters: ['H'], character_start_times_seconds: [0], character_end_times_seconds: [0.3] }]);
  let attempts = 0;
  await assert.rejects(() => run(validateAudioGenerateRequest(voiceRequest()), async () => { attempts++; throw new Error('Provider unavailable'); }));
  assert.equal(attempts, 1);
});
