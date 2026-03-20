import assert from 'node:assert/strict';
import test from 'node:test';

import { AudioGenerationError, validateAudioGenerateRequest } from '../frontend/src/server/audio/generate-audio';

test('audio validation requires a source video for cinematic modes', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'cinematic',
        mood: 'epic',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'source_video_required');
      assert.equal(error.field, 'sourceVideoUrl');
      return true;
    }
  );
});

test('audio validation allows voice-over-only without a source video', () => {
  const input = validateAudioGenerateRequest({
    pack: 'voice_only',
    script: '  Trailer-ready narration.  ',
    voiceSampleUrl: ' https://example.com/voice.wav ',
    locale: ' fr-FR ',
  });

  assert.deepEqual(input, {
    sourceJobId: null,
    sourceVideoUrl: null,
    pack: 'voice_only',
    mood: null,
    script: 'Trailer-ready narration.',
    voiceSampleUrl: 'https://example.com/voice.wav',
    durationSec: null,
    musicEnabled: false,
    exportAudioFile: false,
    locale: 'fr-FR',
    voiceMode: 'clone',
    outputKind: 'audio',
  });
});

test('audio validation requires a script for voice modes that include narration', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'voice_only',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_script_required');
      assert.equal(error.field, 'script');
      return true;
    }
  );
});

test('audio validation requires a duration for standalone music-only renders', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'music_only',
        mood: 'dreamy',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_duration_required');
      assert.equal(error.field, 'durationSec');
      return true;
    }
  );
});

test('audio validation normalizes cinematic voice settings', () => {
  const input = validateAudioGenerateRequest({
    sourceJobId: ' job_123 ',
    sourceVideoUrl: ' https://example.com/source.mp4 ',
    pack: ' cinematic_voice ',
    mood: ' Dark ',
    script: '  Trailer-ready narration.  ',
    voiceSampleUrl: ' https://example.com/voice.wav ',
    musicEnabled: false,
    exportAudioFile: true,
    locale: ' fr-FR ',
  });

  assert.deepEqual(input, {
    sourceJobId: 'job_123',
    sourceVideoUrl: 'https://example.com/source.mp4',
    pack: 'cinematic_voice',
    mood: 'dark',
    script: 'Trailer-ready narration.',
    voiceSampleUrl: 'https://example.com/voice.wav',
    durationSec: null,
    musicEnabled: false,
    exportAudioFile: true,
    locale: 'fr-FR',
    voiceMode: 'clone',
    outputKind: 'both',
  });
});
