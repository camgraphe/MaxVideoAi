import assert from 'node:assert/strict';
import test from 'node:test';
import { getAudioPackConfig, type AudioPackId } from '../frontend/src/lib/audio-generation';
import { normalizeAudioGenerationRequest, hashCanonicalAudioRequest, audioRequestToGenerationBody } from '../frontend/src/server/agent-api/audio-normalization';
import { listAudioCapabilities } from '../frontend/src/server/agent-api/audio-capabilities';

function request(mode: AudioPackId, settings: Record<string, unknown> = {}, references: unknown[] = []) {
  return { schemaVersion: 1, surface: 'audio', engineId: getAudioPackConfig(mode).engineId, mode, prompt: 'A quiet forest at dawn', settings, references, outputCount: 1 };
}
const audio = { role: 'voice_sample', asset: { type: 'asset', assetId: 'voice-1', kind: 'audio' } };
const video = { role: 'source_video', asset: { type: 'job-output', jobId: 'video-1', outputId: 'output-2', kind: 'video' } };

test('all five Audio intents and legacy soundtracks normalize deterministically without dropping specialized settings', () => {
  for (const value of [
    request('voice_only', { script: 'Hello\n  world', voiceModel: 'seed', seedAudioOutputFormat: 'wav', seedAudioSampleRate: 48000, seedAudioSpeed: 1.13, seedAudioVolume: 0.8, seedAudioPitch: -2, language: 'french' }, [audio]),
    request('voice_only', { script: 'Hello world', voiceModel: 'minimax', minimaxVoiceId: 'Wise_Woman', seedAudioSpeed: 1.06 }),
    request('music_only', { mood: 'dreamy', musicModel: 'clip', durationSec: 30, musicBpm: 90 }),
    request('song', { lyrics: '[Verse]\nKeep these words\n[Chorus]\nSing them' }),
    request('sfx_only', { durationSec: 8, intensity: 'subtle' }), request('ambience_only', { durationSec: 184 }),
    request('cinematic', { mood: 'dark', musicEnabled: false, exportAudioFile: true }, [video]),
    request('cinematic_voice', { mood: 'dark', script: 'Hello', musicEnabled: true, musicModel: 'pro', musicBpm: 110, voiceModel: 'seed' }, [audio, video]),
  ]) {
    const normalized = normalizeAudioGenerationRequest(value);
    assert.deepEqual(normalized.settings, value.settings);
    assert.deepEqual(normalizeAudioGenerationRequest(normalized), normalized);
    const reordered = { ...value, settings: Object.fromEntries(Object.entries(value.settings).reverse()), references: [...value.references].reverse() };
    assert.equal(hashCanonicalAudioRequest(normalized), hashCanonicalAudioRequest(normalizeAudioGenerationRequest(reordered)));
    assert.doesNotMatch(JSON.stringify(normalized), /owned-source-video|owned-voice-sample/);
  }
});

test('strict Audio requests reject routing/payment fields, unsupported modes, raw URLs and reference conflicts', () => {
  const valid = request('sfx_only', { durationSec: 8 });
  for (const patch of [
    { token: 'private' }, { expectedQuote: {} }, { provider: 'fal' }, { surface: 'video' }, { outputCount: 2 }, { engineId: 'audio-song' },
    { settings: { durationSec: '8' } }, { settings: { durationSec: 31 } }, { settings: { durationSec: 8, model: 'unapproved' } },
    { settings: { durationSec: 8, sourceVideoUrl: 'https://example.com/a.mp4' } }, { references: [video] },
  ]) assert.throws(() => normalizeAudioGenerationRequest({ ...valid, ...patch }));
  assert.throws(() => normalizeAudioGenerationRequest(request('voice_only', { script: 'Hi', voiceModel: 'minimax' }, [audio])));
  assert.throws(() => normalizeAudioGenerationRequest(request('voice_only', { script: 'Hi', durationSec: 5 })));
  assert.throws(() => normalizeAudioGenerationRequest(request('voice_only', { script: 'Hi' }, [audio, audio])));
  assert.throws(() => normalizeAudioGenerationRequest(request('voice_only', { script: 'Hi' }, [{ ...audio, asset: { ...audio.asset, kind: 'video' } }])));
  assert.throws(() => normalizeAudioGenerationRequest(request('song', { lyrics: 'a song', durationSec: 30 })));
});

test('resolved original URLs are required only at the server execution boundary and affect no canonical identity', () => {
  const value = normalizeAudioGenerationRequest(request('voice_only', { script: 'Hello', voiceModel: 'seed' }, [audio]));
  assert.throws(() => audioRequestToGenerationBody(value), /resolved/);
  assert.deepEqual(audioRequestToGenerationBody(value, { voiceSampleUrl: 'https://fixture.example/original.wav' }), {
    pack: 'voice_only', prompt: value.prompt, script: 'Hello', voiceModel: 'seed', voiceSampleUrl: 'https://fixture.example/original.wav',
  });
  assert.throws(() => audioRequestToGenerationBody(value, { voiceSampleUrl: 'ref', sourceVideoUrl: 'unexpected' }), /Unexpected/);
  assert.notEqual(hashCanonicalAudioRequest(value), hashCanonicalAudioRequest(normalizeAudioGenerationRequest({ ...value, settings: { ...value.settings, script: 'Changed' } })));
});

test('capability discovery projects all packs and actual configured routes without enabling High quality', () => {
  const off = listAudioCapabilities({});
  assert.equal(off.modes.length, 7);
  assert.ok(off.modes.every(mode => !mode.available));
  const fal = listAudioCapabilities({ FAL_KEY: 'not-a-real-key' });
  assert.ok(fal.modes.find(mode => mode.mode === 'song')!.available);
  assert.ok(!fal.modes.find(mode => mode.mode === 'music_only')!.available);
  const video = fal.modes.find(mode => mode.mode === 'cinematic')!;
  assert.ok(video.variants.find(variant => variant.settings.musicEnabled === false)!.available);
  assert.ok(!video.variants.find(variant => variant.settings.musicEnabled === true)!.available);
  assert.equal(fal.modes.find(mode => mode.mode === 'sfx_only')!.duration.maxSeconds, 30);
  assert.equal(fal.modes.find(mode => mode.mode === 'voice_only')!.references.voiceSample, 'optional_seed_only');
  assert.equal(fal.quality.high, false);
  assert.notEqual(fal.revision, off.revision);
  assert.equal(fal.revision, listAudioCapabilities({ FAL_KEY: 'different-secret' }).revision);
  assert.doesNotMatch(JSON.stringify(fal), /not-a-real-key|different-secret/);
});
