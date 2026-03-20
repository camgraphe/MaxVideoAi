import assert from 'node:assert/strict';
import test from 'node:test';

import { AudioGenerationError, validateAudioGenerateRequest } from '../frontend/src/server/audio/generate-audio';

test('audio validation requires a source video reference', () => {
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

test('audio validation requires a script for cinematic voice renders', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        sourceVideoUrl: 'https://example.com/source.mp4',
        pack: 'cinematic_voice',
        mood: 'tense',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_script_required');
      assert.equal(error.field, 'script');
      return true;
    }
  );
});

test('audio validation normalizes source fields and clone voice mode', () => {
  const input = validateAudioGenerateRequest({
    sourceJobId: ' job_123 ',
    sourceVideoUrl: ' https://example.com/source.mp4 ',
    pack: ' cinematic_voice ',
    mood: ' Dark ',
    script: '  Trailer-ready narration.  ',
    voiceSampleUrl: ' https://example.com/voice.wav ',
    locale: ' fr-FR ',
  });

  assert.deepEqual(input, {
    sourceJobId: 'job_123',
    sourceVideoUrl: 'https://example.com/source.mp4',
    pack: 'cinematic_voice',
    mood: 'dark',
    script: 'Trailer-ready narration.',
    voiceSampleUrl: 'https://example.com/voice.wav',
    locale: 'fr-FR',
    voiceMode: 'clone',
  });
});
