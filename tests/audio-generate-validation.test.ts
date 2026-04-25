import assert from 'node:assert/strict';
import test from 'node:test';

import { AUDIO_MAX_DURATION_SEC } from '../frontend/src/lib/audio-generation';
import { AudioGenerationError, resolveAudioRenderDuration, validateAudioGenerateRequest } from '../frontend/src/server/audio/generate-audio';

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
    voiceGender: ' male ',
    voiceProfile: ' warm ',
    voiceDelivery: ' trailer ',
    language: ' french ',
    locale: ' fr-FR ',
  });

  assert.deepEqual(input, {
    sourceJobId: null,
    sourceVideoUrl: null,
    pack: 'voice_only',
    prompt: null,
    mood: null,
    intensity: 'standard',
    script: 'Trailer-ready narration.',
    voiceSampleUrl: 'https://example.com/voice.wav',
    voiceGender: 'male',
    voiceProfile: 'warm',
    voiceDelivery: 'trailer',
    language: 'french',
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

test('audio validation requires a prompt for prompt-led modes', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'music_only',
        mood: 'dreamy',
        durationSec: 8,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_prompt_required');
      assert.equal(error.field, 'prompt');
      return true;
    }
  );
});

test('audio validation requires a duration for standalone music-only renders', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'music_only',
        prompt: 'Soft ambient bed for a product intro.',
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

test('audio validation accepts longer standalone music durations', () => {
  const input = validateAudioGenerateRequest({
    pack: 'music_only',
    prompt: 'Long cinematic ambient score with slow evolving pads.',
    mood: 'dreamy',
    intensity: 'subtle',
    durationSec: 120,
  });

  assert.equal(input.durationSec, 120);
});

test('audio validation rejects requested durations above provider-aligned limits instead of silently clamping', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'music_only',
        prompt: 'Long cinematic ambient score.',
        mood: 'dreamy',
        durationSec: AUDIO_MAX_DURATION_SEC + 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_duration_invalid');
      assert.equal(error.field, 'durationSec');
      assert.match(error.message, /3m10s/);
      return true;
    }
  );
});

test('audio validation normalizes cinematic voice settings', () => {
  const input = validateAudioGenerateRequest({
    sourceJobId: ' job_123 ',
    sourceVideoUrl: ' https://example.com/source.mp4 ',
    pack: ' cinematic_voice ',
    prompt: ' Optional sonic direction. ',
    mood: ' Dark ',
    intensity: ' intense ',
    script: '  Trailer-ready narration.  ',
    voiceSampleUrl: ' https://example.com/voice.wav ',
    voiceGender: ' female ',
    voiceProfile: ' deep ',
    voiceDelivery: ' intimate ',
    language: ' english ',
    musicEnabled: false,
    exportAudioFile: true,
    locale: ' fr-FR ',
  });

  assert.deepEqual(input, {
    sourceJobId: 'job_123',
    sourceVideoUrl: 'https://example.com/source.mp4',
    pack: 'cinematic_voice',
    prompt: 'Optional sonic direction.',
    mood: 'dark',
    intensity: 'intense',
    script: 'Trailer-ready narration.',
    voiceSampleUrl: 'https://example.com/voice.wav',
    voiceGender: 'female',
    voiceProfile: 'deep',
    voiceDelivery: 'intimate',
    language: 'english',
    durationSec: null,
    musicEnabled: false,
    exportAudioFile: true,
    locale: 'fr-FR',
    voiceMode: 'clone',
    outputKind: 'both',
  });
});

test('audio validation rejects voice options on non-voice modes', () => {
  assert.throws(
    () =>
      validateAudioGenerateRequest({
        pack: 'music_only',
        prompt: 'Dreamy music bed.',
        mood: 'dreamy',
        durationSec: 8,
        voiceGender: 'male',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'audio_voice_gender_not_supported');
      assert.equal(error.field, 'voiceGender');
      return true;
    }
  );
});

test('audio duration resolution allows music-only without a source video', () => {
  const duration = resolveAudioRenderDuration({
    pack: 'music_only',
    sourceVideoUrl: null,
    requiresVideo: false,
    probedDurationSec: null,
    requestedDurationSec: 8,
    script: null,
  });

  assert.equal(duration, 8);
});

test('audio duration resolution accepts longer source-backed renders within provider limits', () => {
  const duration = resolveAudioRenderDuration({
    pack: 'cinematic',
    sourceVideoUrl: 'https://example.com/source.mp4',
    requiresVideo: true,
    probedDurationSec: 120,
    requestedDurationSec: null,
    script: null,
  });

  assert.equal(duration, 120);
});

test('audio duration resolution rejects source videos above provider-aligned limits', () => {
  assert.throws(
    () =>
      resolveAudioRenderDuration({
        pack: 'cinematic',
        sourceVideoUrl: 'https://example.com/source.mp4',
        requiresVideo: true,
        probedDurationSec: AUDIO_MAX_DURATION_SEC + 1,
        requestedDurationSec: null,
        script: null,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'source_video_duration_invalid');
      assert.equal(error.field, 'sourceVideoUrl');
      return true;
    }
  );
});

test('audio duration resolution still requires a probed duration for cinematic packs', () => {
  assert.throws(
    () =>
      resolveAudioRenderDuration({
        pack: 'cinematic',
        sourceVideoUrl: 'https://example.com/source.mp4',
        requiresVideo: true,
        probedDurationSec: null,
        requestedDurationSec: null,
        script: null,
      }),
    (error: unknown) => {
      assert.ok(error instanceof AudioGenerationError);
      assert.equal(error.code, 'source_video_probe_failed');
      return true;
    }
  );
});
