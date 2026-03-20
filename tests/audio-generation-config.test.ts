import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MIN_DURATION_SEC,
  buildAudioPricingSnapshot,
  clampAudioDuration,
  coerceAudioMood,
  coerceAudioPackId,
  resolveAudioVoiceMode,
} from '../frontend/src/lib/audio-generation';

test('audio pricing enforces cinematic minimum charge for short renders', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'epic',
    durationSec: 3,
  });

  assert.equal(pricing.totalCents, 99);
  assert.equal(pricing.base.amountCents, 36);
  assert.equal(pricing.margin.amountCents, 63);
  assert.deepEqual(pricing.meta, {
    surface: 'audio',
    pack: 'cinematic',
    mood: 'epic',
    voiceMode: null,
  });
});

test('audio pricing adds clone surcharge above minimum charge', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'cinematic_voice',
    mood: 'dark',
    durationSec: 20,
    voiceMode: 'clone',
  });

  assert.equal(pricing.totalCents, 520);
  assert.equal(pricing.base.amountCents, 360);
  assert.deepEqual(pricing.addons, [{ type: 'voice_clone', amountCents: 160 }]);
  assert.equal(pricing.margin.amountCents, 0);
});

test('audio helpers normalize packs, moods, voice mode, and duration bounds', () => {
  assert.equal(coerceAudioPackId(' cinematic_voice '), 'cinematic_voice');
  assert.equal(coerceAudioPackId('basic'), null);

  assert.equal(coerceAudioMood(' Sci-Fi '), 'sci-fi');
  assert.equal(coerceAudioMood('cheerful'), null);

  assert.equal(resolveAudioVoiceMode({ pack: 'cinematic', voiceSampleUrl: 'https://example.com/voice.wav' }), null);
  assert.equal(resolveAudioVoiceMode({ pack: 'cinematic_voice', voiceSampleUrl: null }), 'standard');
  assert.equal(resolveAudioVoiceMode({ pack: 'cinematic_voice', voiceSampleUrl: 'https://example.com/voice.wav' }), 'clone');

  assert.equal(clampAudioDuration(Number.NaN), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(1), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(24), AUDIO_MAX_DURATION_SEC);
  assert.equal(clampAudioDuration(7.6), 8);
});
