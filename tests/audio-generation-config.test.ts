import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_LYRIA3_BPM_VALUES,
  AUDIO_LYRIA3_MODEL_VALUES,
  AUDIO_MUSIC_DURATION_OPTIONS_SEC,
  AUDIO_MIN_DURATION_SEC,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  AUDIO_SEED_AUDIO_VOICE_VALUES,
  clampAudioDuration,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioLyria3Bpm,
  coerceAudioLyria3Model,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  coerceSeedAudioVoice,
  DEFAULT_SEED_AUDIO_VOICE,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  normalizeAudioDuration,
  resolveAudioOutputKind,
  resolveAudioVoiceMode,
} from '../frontend/src/lib/audio-generation';
import { quotePublicAudioPricingSnapshot } from '../frontend/src/lib/pricing-public-quote';

test('audio pricing charges 2.5x provider cost for Lyria 3 Clip music renders', () => {
  const pricing = quotePublicAudioPricingSnapshot({
    pack: 'music_only',
    mood: 'epic',
    durationSec: 30,
    musicModel: 'clip',
    musicBpm: 110,
  });

  assert.equal(pricing.vendorShareCents, 4);
  assert.equal(pricing.platformFeeCents, 6);
  assert.equal(pricing.totalCents, 10);
  assert.equal(pricing.base.amountCents, 4);
  assert.equal(pricing.margin.amountCents, 6);
  assert.equal(pricing.margin.percentApplied, 1.5);
  assert.deepEqual(pricing.meta, {
    surface: 'audio',
    pack: 'music_only',
    mood: 'epic',
    voiceMode: null,
    pricingModel: 'audio_provider_cost_plus_margin',
    vendorCostCents: 4,
    marginPercent: 1.5,
    musicModel: 'clip',
    musicBpm: 110,
    musicEnabled: null,
    scriptBillingCharacters: undefined,
    vendorCostComponents: [
      {
        type: 'music_google_lyria3_clip',
        label: 'Google Lyria 3 Clip',
        model: 'lyria-3-clip-preview',
        unit: '30_sec_clip',
        amountCents: 4,
      },
    ],
  });
});

test('audio pricing uses Lyria 3 Pro song pricing for long music renders', () => {
  const pricing = quotePublicAudioPricingSnapshot({
    pack: 'music_only',
    mood: 'epic',
    durationSec: 180,
    musicModel: 'pro',
  });

  assert.equal(pricing.vendorShareCents, 8);
  assert.equal(pricing.platformFeeCents, 12);
  assert.equal(pricing.totalCents, 20);
  assert.deepEqual(pricing.meta.vendorCostComponents, [
    {
      type: 'music_google_lyria3_pro',
      label: 'Google Lyria 3 Pro',
      model: 'lyria-3-pro-preview',
      unit: 'song',
      amountCents: 8,
    },
  ]);
});

test('audio pricing uses voice clone request and preview costs', () => {
  const pricing = quotePublicAudioPricingSnapshot({
    pack: 'voice_only',
    durationSec: 20,
    voiceMode: 'clone',
    script: 'Short cloned narration.',
  });

  assert.equal(pricing.vendorShareCents, 7);
  assert.equal(pricing.totalCents, 18);
  assert.equal(pricing.base.amountCents, 7);
  assert.deepEqual(pricing.addons, []);
  assert.equal(pricing.margin.amountCents, 11);
  assert.deepEqual(pricing.meta.vendorCostComponents, [
    {
      type: 'voice_seed_audio_1_0',
      label: 'Seed Audio 1.0',
      model: 'bytedance/seed-audio-1.0',
      unit: 'minute',
      units: 0.33,
      amountCents: 7,
    },
  ]);
});

test('audio helpers normalize packs, moods, voice mode, output kind, and duration bounds', () => {
  assert.equal(coerceAudioPackId(' music_only '), 'music_only');
  assert.equal(coerceAudioPackId(' cinematic_voice '), 'cinematic_voice');
  assert.equal(coerceAudioPackId('basic'), null);

  assert.equal(coerceAudioMood(' Sci-Fi '), 'sci-fi');
  assert.equal(coerceAudioMood('cheerful'), null);
  assert.equal(coerceAudioIntensity(' intense '), 'intense');
  assert.equal(coerceAudioIntensity('loud'), null);
  assert.equal(coerceAudioLyria3Model(' pro '), 'pro');
  assert.equal(coerceAudioLyria3Model('full'), null);
  assert.equal(coerceAudioLyria3Bpm('130'), 130);
  assert.equal(coerceAudioLyria3Bpm('128'), null);
  assert.equal(coerceAudioVoiceProfile(' deep '), 'deep');
  assert.equal(coerceAudioVoiceProfile('hero'), null);
  assert.equal(coerceAudioVoiceGender(' male '), 'male');
  assert.equal(coerceAudioVoiceGender('robot'), null);
  assert.equal(coerceAudioVoiceDelivery(' trailer '), 'trailer');
  assert.equal(coerceAudioVoiceDelivery('dramatic'), null);
  assert.equal(coerceAudioLanguage(' french '), 'french');
  assert.equal(coerceAudioLanguage('italian'), null);
  assert.equal(coerceSeedAudioVoice(' default '), 'default');
  assert.equal(DEFAULT_SEED_AUDIO_VOICE, 'default');
  assert.equal(AUDIO_SEED_AUDIO_VOICE_VALUES[0], 'default');

  assert.equal(resolveAudioVoiceMode({ pack: 'music_only', voiceSampleUrl: 'https://example.com/voice.wav' }), null);
  assert.equal(resolveAudioVoiceMode({ pack: 'voice_only', voiceSampleUrl: null }), 'standard');
  assert.equal(resolveAudioVoiceMode({ pack: 'voice_only', voiceSampleUrl: 'https://example.com/voice.wav' }), 'clone');
  assert.equal(resolveAudioVoiceMode({ pack: 'cinematic_voice', voiceSampleUrl: null }), 'standard');
  assert.equal(resolveAudioVoiceMode({ pack: 'cinematic_voice', voiceSampleUrl: 'https://example.com/voice.wav' }), 'clone');
  assert.equal(resolveAudioOutputKind({ pack: 'voice_only', exportAudioFile: false }), 'audio');
  assert.equal(resolveAudioOutputKind({ pack: 'cinematic', exportAudioFile: false }), 'video');
  assert.equal(resolveAudioOutputKind({ pack: 'cinematic_voice', exportAudioFile: true }), 'both');
  assert.equal(estimateVoiceScriptDurationSec('This is a short narration sample for pricing.'), AUDIO_MIN_DURATION_SEC);
  assert.equal(AUDIO_PROMPT_MAX_LENGTH, 2000);
  assert.equal(AUDIO_SCRIPT_MAX_LENGTH, 5000);
  assert.equal(AUDIO_MAX_DURATION_SEC, 184);
  assert.deepEqual([...AUDIO_LYRIA3_MODEL_VALUES], ['clip', 'pro']);
  assert.deepEqual([...AUDIO_LYRIA3_BPM_VALUES], [70, 90, 110, 130, 150]);
  assert.ok(AUDIO_MUSIC_DURATION_OPTIONS_SEC.includes(184));

  assert.equal(clampAudioDuration(Number.NaN), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(1), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(24), 24);
  assert.equal(clampAudioDuration(240), AUDIO_MAX_DURATION_SEC);
  assert.equal(normalizeAudioDuration(240), 240);
  assert.equal(formatAudioDurationLabel(184), '3m04s');
  assert.equal(formatAudioDurationLabel(120), '2m');
  assert.equal(clampAudioDuration(7.6), 8);
});

test('audio pricing does not cap voice script estimates at the music duration limit', () => {
  const longScript = Array.from({ length: 1000 }, () => 'word').join(' ');
  const estimatedDuration = estimateVoiceScriptDurationSec(longScript);
  const pricing = quotePublicAudioPricingSnapshot({
    pack: 'voice_only',
    durationSec: estimatedDuration,
    voiceMode: 'standard',
    script: longScript,
  });

  assert.equal(estimatedDuration, 400);
  assert.equal(pricing.base.seconds, 400);
  assert.equal(pricing.vendorShareCents, 125);
  assert.equal(pricing.margin.amountCents, 188);
  assert.equal(pricing.totalCents, 313);
});

test('audio pricing includes sound design and optional music for cinematic renders', () => {
  const withMusic = quotePublicAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 30,
    musicEnabled: true,
  });
  const withoutMusic = quotePublicAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 30,
    musicEnabled: false,
  });

  assert.equal(withMusic.vendorShareCents, 34);
  assert.equal(withMusic.margin.amountCents, 51);
  assert.equal(withMusic.totalCents, 85);
  assert.equal(withoutMusic.vendorShareCents, 30);
  assert.equal(withoutMusic.margin.amountCents, 45);
  assert.equal(withoutMusic.totalCents, 75);
});

test('audio pricing rounds fractional 150 percent margins up to the next cent', () => {
  const pricing = quotePublicAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 3,
    musicEnabled: false,
  });

  assert.equal(pricing.vendorShareCents, 3);
  assert.equal(pricing.margin.amountCents, 5);
  assert.equal(pricing.totalCents, 8);
});
