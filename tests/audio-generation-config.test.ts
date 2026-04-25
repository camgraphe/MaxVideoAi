import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_MAX_DURATION_SEC,
  AUDIO_MUSIC_DURATION_OPTIONS_SEC,
  AUDIO_PRICING_MARGIN_PERCENT,
  AUDIO_MIN_DURATION_SEC,
  AUDIO_PROMPT_MAX_LENGTH,
  AUDIO_SCRIPT_MAX_LENGTH,
  buildAudioPricingSnapshot,
  clampAudioDuration,
  coerceAudioIntensity,
  coerceAudioLanguage,
  coerceAudioMood,
  coerceAudioPackId,
  coerceAudioVoiceDelivery,
  coerceAudioVoiceGender,
  coerceAudioVoiceProfile,
  estimateVoiceScriptDurationSec,
  formatAudioDurationLabel,
  normalizeAudioDuration,
  resolveAudioOutputKind,
  resolveAudioVoiceMode,
} from '../frontend/src/lib/audio-generation';

test('audio pricing applies provider cost plus 60 percent margin for short music renders', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'music_only',
    mood: 'epic',
    durationSec: 3,
  });

  assert.equal(pricing.vendorShareCents, 15);
  assert.equal(pricing.platformFeeCents, 9);
  assert.equal(pricing.totalCents, 24);
  assert.equal(pricing.base.amountCents, 15);
  assert.equal(pricing.margin.amountCents, 9);
  assert.equal(pricing.margin.percentApplied, 0.6);
  assert.deepEqual(pricing.meta, {
    surface: 'audio',
    pack: 'music_only',
    mood: 'epic',
    voiceMode: null,
    pricingModel: 'audio_provider_cost_plus_margin',
    vendorCostCents: 15,
    marginPercent: 0.6,
    musicEnabled: null,
    scriptBillingCharacters: undefined,
    vendorCostComponents: [
      {
        type: 'music_minimax_music_2_6',
        label: 'MiniMax Music 2.6',
        model: 'fal-ai/minimax-music/v2.6',
        unit: 'audio',
        amountCents: 15,
      },
    ],
  });
});

test('audio pricing scales long music renders by started 30 second blocks', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'music_only',
    mood: 'epic',
    durationSec: 180,
  });

  assert.equal(pricing.vendorShareCents, 120);
  assert.equal(pricing.platformFeeCents, 72);
  assert.equal(pricing.totalCents, 192);
  assert.deepEqual(pricing.meta.vendorCostComponents, [
    {
      type: 'music_stable_audio_25',
      label: 'Stable Audio 2.5',
      model: 'fal-ai/stable-audio-25/text-to-audio',
      unit: '30_sec_block',
      units: 6,
      amountCents: 120,
    },
  ]);
});

test('audio pricing uses voice clone request and preview costs', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'voice_only',
    durationSec: 20,
    voiceMode: 'clone',
    script: 'Short cloned narration.',
  });

  assert.equal(pricing.vendorShareCents, 180);
  assert.equal(pricing.totalCents, 288);
  assert.equal(pricing.base.amountCents, 150);
  assert.deepEqual(pricing.addons, [{ type: 'voice_clone_preview_minimax', amountCents: 30 }]);
  assert.equal(pricing.margin.amountCents, 108);
});

test('audio helpers normalize packs, moods, voice mode, output kind, and duration bounds', () => {
  assert.equal(coerceAudioPackId(' music_only '), 'music_only');
  assert.equal(coerceAudioPackId(' cinematic_voice '), 'cinematic_voice');
  assert.equal(coerceAudioPackId('basic'), null);

  assert.equal(coerceAudioMood(' Sci-Fi '), 'sci-fi');
  assert.equal(coerceAudioMood('cheerful'), null);
  assert.equal(coerceAudioIntensity(' intense '), 'intense');
  assert.equal(coerceAudioIntensity('loud'), null);
  assert.equal(coerceAudioVoiceProfile(' deep '), 'deep');
  assert.equal(coerceAudioVoiceProfile('hero'), null);
  assert.equal(coerceAudioVoiceGender(' male '), 'male');
  assert.equal(coerceAudioVoiceGender('robot'), null);
  assert.equal(coerceAudioVoiceDelivery(' trailer '), 'trailer');
  assert.equal(coerceAudioVoiceDelivery('dramatic'), null);
  assert.equal(coerceAudioLanguage(' french '), 'french');
  assert.equal(coerceAudioLanguage('italian'), null);

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
  assert.equal(AUDIO_MAX_DURATION_SEC, 190);
  assert.equal(AUDIO_PRICING_MARGIN_PERCENT, 0.6);
  assert.ok(AUDIO_MUSIC_DURATION_OPTIONS_SEC.includes(190));

  assert.equal(clampAudioDuration(Number.NaN), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(1), AUDIO_MIN_DURATION_SEC);
  assert.equal(clampAudioDuration(24), 24);
  assert.equal(clampAudioDuration(240), AUDIO_MAX_DURATION_SEC);
  assert.equal(normalizeAudioDuration(240), 240);
  assert.equal(formatAudioDurationLabel(190), '3m10s');
  assert.equal(formatAudioDurationLabel(120), '2m');
  assert.equal(clampAudioDuration(7.6), 8);
});

test('audio pricing does not cap voice script estimates at the music duration limit', () => {
  const longScript = Array.from({ length: 1000 }, () => 'word').join(' ');
  const estimatedDuration = estimateVoiceScriptDurationSec(longScript);
  const pricing = buildAudioPricingSnapshot({
    pack: 'voice_only',
    durationSec: estimatedDuration,
    voiceMode: 'standard',
    script: longScript,
  });

  assert.equal(estimatedDuration, 400);
  assert.equal(pricing.base.seconds, 400);
  assert.equal(pricing.vendorShareCents, 75);
  assert.equal(pricing.margin.amountCents, 45);
  assert.equal(pricing.totalCents, 120);
});

test('audio pricing includes sound design and optional music for cinematic renders', () => {
  const withMusic = buildAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 30,
    musicEnabled: true,
  });
  const withoutMusic = buildAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 30,
    musicEnabled: false,
  });

  assert.equal(withMusic.vendorShareCents, 50);
  assert.equal(withMusic.margin.amountCents, 30);
  assert.equal(withMusic.totalCents, 80);
  assert.equal(withoutMusic.vendorShareCents, 30);
  assert.equal(withoutMusic.margin.amountCents, 18);
  assert.equal(withoutMusic.totalCents, 48);
});

test('audio pricing rounds fractional 60 percent margins up to the next cent', () => {
  const pricing = buildAudioPricingSnapshot({
    pack: 'cinematic',
    mood: 'tense',
    durationSec: 3,
    musicEnabled: false,
  });

  assert.equal(pricing.vendorShareCents, 3);
  assert.equal(pricing.margin.amountCents, 2);
  assert.equal(pricing.totalCents, 5);
});
