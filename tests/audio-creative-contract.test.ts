import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAudioGenerateRequest } from '../frontend/src/server/audio/audio-generate-validation';
import { buildAudioVendorCostFacts } from '../frontend/src/lib/audio-generation';
import { generateSongTrack, generateAmbienceTrack, generateMinimaxVoiceTrack } from '../frontend/src/server/audio/providers/standalone';
import { assertExpectedAudioQuote, audioQuoteInputKey, assertAudioProviderConfigured, prepareAudioRun } from '../frontend/src/server/audio/prepare-audio';

test('song lyrics keep structure and never become a narration script or exact duration promise', () => {
  const lyrics = '[Verse]\nFirst line\nSecond line';
  const request = validateAudioGenerateRequest({ pack: 'song', prompt: 'Warm acoustic folk', lyrics });
  assert.equal(request.lyrics, lyrics);
  assert.equal(request.script, null);
  assert.equal(request.outputKind, 'audio');
  for (const patch of [{ lyrics: '' }, { script: 'spoken' }, { durationSec: 30 }, { sourceVideoUrl: 'https://example.com/a.mp4' }, { lyrics: 'a'.repeat(3501) }, { prompt: 'short' }]) {
    assert.throws(() => validateAudioGenerateRequest({ pack: 'song', prompt: 'Warm acoustic folk', lyrics, ...patch }));
  }
});
test('ambience is bounded and voice reference cannot silently become MiniMax cloning', () => {
  assert.equal(validateAudioGenerateRequest({ pack: 'ambience_only', prompt: 'Forest wind', durationSec: 90 }).durationSec, 90);
  for (const patch of [{ durationSec: 185 }, { sourceJobId: 'job' }, { lyrics: 'song words' }]) {
    assert.throws(() => validateAudioGenerateRequest({ pack: 'ambience_only', prompt: 'Forest wind', durationSec: 90, ...patch }));
  }
  assert.throws(() => validateAudioGenerateRequest({ pack: 'voice_only', voiceModel: 'minimax', script: 'Hello', voiceSampleUrl: 'https://example.com/ref.mp3' }));
});
test('factual costs identify the executed provider, not a Lyria estimate', () => {
  assert.equal(buildAudioVendorCostFacts({ pack: 'song', durationSec: 3 }).vendorSubtotalCents, 15);
  assert.equal(buildAudioVendorCostFacts({ pack: 'ambience_only', durationSec: 90 }).vendorSubtotalCents, 20);
  const voice = buildAudioVendorCostFacts({ pack: 'voice_only', voiceModel: 'minimax', script: 'a'.repeat(1000), durationSec: 50 });
  assert.equal(voice.vendorSubtotalCents, 10);
  assert.equal(voice.components[0].model, 'fal-ai/minimax/speech-02-hd');
});
test('exact adapters send provider-native fields and make only one attempt on failure', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const subscribe = async (model: string, input: Record<string, unknown>) => { calls.push({ model, input }); return { data: { audio: { url: 'https://fixture.example/original.mp3' } }, requestId: 'real-provider-id' }; };
  await generateSongTrack({ prompt: 'Soul with piano', lyrics: '[Verse]\nMy song' }, subscribe);
  assert.equal(calls[0].input.is_instrumental, false);
  assert.equal(calls[0].input.lyrics, '[Verse]\nMy song');
  assert.equal(calls[0].input.duration, undefined);
  await generateAmbienceTrack({ prompt: 'Steady ocean', durationSec: 60 }, subscribe);
  assert.equal(calls[1].input.seconds_total, 60);
  await generateMinimaxVoiceTrack(validateAudioGenerateRequest({ pack: 'voice_only', voiceModel: 'minimax', script: 'Hello there', seedAudioSpeed: 1.06 }), subscribe);
  assert.deepEqual(calls[2].input.voice_setting, { voice_id: 'English_FriendlyPerson', speed: 1.06, vol: 1, pitch: 0, emotion: 'neutral', english_normalization: false });
  let count = 0;
  await assert.rejects(generateSongTrack({ prompt: 'Soul with piano', lyrics: 'My song' }, async () => { count++; throw new Error('provider failure'); }));
  assert.equal(count, 1);
});
test('quote identity covers account and complete normalized settings; amount and expiry checked', () => {
  const normalized = validateAudioGenerateRequest({ pack: 'song', prompt: 'Warm acoustic folk', lyrics: 'My song' });
  const key = audioQuoteInputKey('user-a', normalized, 3);
  assert.notEqual(key, audioQuoteInputKey('user-b', normalized, 3));
  assert.notEqual(key, audioQuoteInputKey('user-a', { ...normalized, lyrics: 'Other' }, 3));
  const actual = { inputKey: key, pricing: { totalCents: 25, currency: 'USD' } };
  const expected = { inputKey: key, totalCents: 25, currency: 'USD', expiresAt: 61000 };
  assert.doesNotThrow(() => assertExpectedAudioQuote(expected, actual, 1000));
  for (const patch of [{ inputKey: 'old' }, { totalCents: 24 }, { currency: 'EUR' }, { expiresAt: 999 }]) assert.throws(() => assertExpectedAudioQuote({ ...expected, ...patch }, actual, 1000));
  assert.throws(() => assertAudioProviderConfigured(normalized, {}));
});

test('audio quotes remain available when provider credentials are temporarily unavailable', async () => {
  const requests = [
    { pack: 'voice_only' as const, script: 'A clear voice introduces the next scene.', voiceModel: 'minimax' as const },
    { pack: 'music_only' as const, prompt: 'Warm analog synths with a cinematic build', mood: 'dreamy' as const, durationSec: 120, musicModel: 'pro' as const, musicBpm: 110 as const },
    { pack: 'song' as const, prompt: 'Intimate acoustic folk', lyrics: '[Verse]\nCarry the morning home' },
    { pack: 'sfx_only' as const, prompt: 'A heavy metal door closes with a short echo.', durationSec: 8 },
    { pack: 'ambience_only' as const, prompt: 'Steady rain on leaves with distant wind.', durationSec: 60 },
  ];
  const pricingPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [], routingRules: [] }) };

  for (const request of requests) {
    const prepared = await prepareAudioRun(request, 'user-a', { env: {}, pricingPolicy });
    assert.ok(prepared.pricingSnapshot.totalCents > 0, request.pack);
    assert.throws(() => assertAudioProviderConfigured(prepared.normalized, {}), /unavailable/i);
  }
});

test('generation checks provider readiness before reserving an audio charge', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile('frontend/src/server/audio/generate-audio.ts', 'utf8');
  const readiness = source.indexOf('assertAudioProviderConfigured(prepared.normalized)');
  const reservation = source.indexOf('buildAudioRunReservation(prepared, params.userId)');
  const jobWrite = source.indexOf('createInitialAudioJob(reservation.initialJob)');
  assert.ok(readiness >= 0 && readiness < reservation && reservation < jobWrite);
});

test('standalone persistence uploads the exact original bytes and records probe duration', async () => {
  const { persistOriginalAudio } = await import('../frontend/src/server/audio/media');
  const bytes = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    Buffer.from('original-provider-audio-longer-than-estimate'),
  ]);
  let uploaded: Buffer | null = null;
  const result = await persistOriginalAudio({ userId: 'owner', jobId: 'aud_original', url: 'https://fixture.example/original.mp3' }, {
    fetchBuffer: async () => bytes,
    detectDuration: async (buffer) => { assert.equal(buffer, bytes); return 37.4; },
    upload: async (input) => { uploaded = input.data; assert.equal(input.mime, 'audio/mpeg'); return { url: 'https://fixture.example/stored.mp3' } as any; },
  });
  assert.equal(uploaded, bytes);
  assert.equal(result.durationSec, 37.4);
  assert.equal(result.audioUrl, 'https://fixture.example/stored.mp3');
  assert.equal(result.mimeType, 'audio/mpeg');
});

test('standalone persistence rejects analyzed bytes without a known audio container', async () => {
  const { persistOriginalAudio } = await import('../frontend/src/server/audio/media');
  let uploadCalls = 0;
  await assert.rejects(
    persistOriginalAudio({ userId: 'owner', jobId: 'aud_unknown', url: 'https://fixture.example/unknown.bin' }, {
      fetchBuffer: async () => Buffer.from('analyzable-but-not-an-audio-container'),
      detectDuration: async () => 3.5,
      upload: async () => {
        uploadCalls += 1;
        return { url: 'https://fixture.example/should-not-upload' } as never;
      },
    }),
    /unsupported generated audio container/i,
  );
  assert.equal(uploadCalls, 0);
});
