import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildSeedAudioVoiceOption,
  buildSeedAudioVoiceSamplePrompt,
  buildSeedAudioVoiceSampleScript,
  getSeedAudioVoiceSampleUrl,
  SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS,
  SEED_AUDIO_VOICE_SAMPLE_URLS,
} from '../frontend/app/(core)/(workspace)/app/audio/_lib/seed-audio-voice-metadata';
import { DEFAULT_AUDIO_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/audio/copy';
import { AUDIO_SEED_AUDIO_VOICE_VALUES } from '../frontend/src/lib/audio-generation';

const root = process.cwd();

test('seed audio voice metadata replaces language codes with flag labels', () => {
  const mindy = buildSeedAudioVoiceOption('mindy_en_es_id_pt_zh', 'Mindy');

  assert.equal(mindy.name, 'Mindy');
  assert.equal(mindy.mixed, false);
  assert.deepEqual(mindy.languages.map((language) => language.flag), ['🇺🇸', '🇪🇸', '🇮🇩', '🇵🇹', '🇨🇳']);
  assert.deepEqual(mindy.languages.map((language) => language.code), ['en', 'es', 'id', 'pt', 'zh']);
});

test('seed audio voice metadata preserves mixed voice information', () => {
  const vivi = buildSeedAudioVoiceOption('vivi_mixed_en_zh_ja_es_id', 'Vivi');

  assert.equal(vivi.mixed, true);
  assert.match(vivi.mixedTooltip, /blend/i);
});

test('seed audio voice metadata exposes provider default without requiring a sample', () => {
  const option = buildSeedAudioVoiceOption('default', 'Default');

  assert.equal(option.name, 'Default');
  assert.equal(option.mixed, false);
  assert.deepEqual(option.languages, []);
  assert.equal(option.sampleUrl, null);
});

test('seed audio voice metadata has one placed sample per voice', () => {
  for (const voice of AUDIO_SEED_AUDIO_VOICE_VALUES) {
    if (voice === 'default') continue;
    assert.ok(Object.hasOwn(SEED_AUDIO_VOICE_SAMPLE_URLS, voice), `${voice} should have a sample slot`);
    const sampleUrl = getSeedAudioVoiceSampleUrl(voice);
    assert.equal(sampleUrl, `/assets/audio/seed-audio/${voice}.mp3`);
    assert.ok(
      existsSync(join(root, 'frontend/public', sampleUrl.slice(1))),
      `${voice} sample should be available from public assets`
    );
  }
});

test('seed audio voice sample scripts introduce each voice and supported languages in English', () => {
  for (const voice of AUDIO_SEED_AUDIO_VOICE_VALUES) {
    const option = buildSeedAudioVoiceOption(voice, DEFAULT_AUDIO_WORKSPACE_COPY.controls.seedAudioVoices[voice]);
    const script = buildSeedAudioVoiceSampleScript(option);

    assert.match(script, new RegExp(`\\b${option.name}\\b`, 'i'), `${voice} script should include the voice name`);
    assert.match(script, /secret|night|store|story/i, `${voice} script should use confidential fiction language`);
    assert.match(script, /\.{3}| - /, `${voice} script should include natural written pauses`);
    assert.doesNotMatch(script, /<break/i, `${voice} script should avoid provider-specific SSML breaks`);
    assert.ok(script.split(/\s+/).length >= 30, `${voice} script should be long enough for a short sample`);
    assert.ok(script.split(/\s+/).length <= 55, `${voice} script should stay near a short natural read`);

    for (const language of option.languages) {
      assert.match(script, new RegExp(`\\b${language.label}\\b`, 'i'), `${voice} script should include ${language.label}`);
    }
  }
});

test('seed audio voice samples keep natural voice speed', () => {
  assert.equal(SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS.speed, 1);
  assert.equal(SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS.pitch, 0);
  assert.match(SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS.styleInstruction, /short natural pauses/i);
  assert.match(SEED_AUDIO_VOICE_SAMPLE_GENERATION_SETTINGS.styleInstruction, /Do not read punctuation/i);
});

test('seed audio voice sample prompt separates guidance from narrator text', () => {
  const vivi = buildSeedAudioVoiceOption(
    'vivi_mixed_en_zh_ja_es_id',
    DEFAULT_AUDIO_WORKSPACE_COPY.controls.seedAudioVoices.vivi_mixed_en_zh_ja_es_id
  );
  const prompt = buildSeedAudioVoiceSamplePrompt(vivi);

  assert.ok(prompt.indexOf('Guidance:') < prompt.indexOf('Text:'), 'guidance should come before text');
  assert.match(prompt, /confidential fiction narrator/i);
  assert.match(prompt, /sharing a secret/i);
  assert.match(prompt, /no trailer announcer/i);
  assert.match(prompt, /Text:\nI'm Vivi -/i);
});
