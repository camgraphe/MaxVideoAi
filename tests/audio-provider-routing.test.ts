import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AudioProviderError,
  getAudioProviderRoster,
  runAudioRoleWithFallback,
} from '../frontend/src/server/audio/providers';

test('audio provider routing keeps recent-first order for every role', () => {
  assert.deepEqual(
    getAudioProviderRoster('soundDesign').map((candidate) => candidate.model),
    ['mirelo-ai/sfx-v1.5/video-to-audio', 'fal-ai/thinksound/audio']
  );
  assert.deepEqual(
    getAudioProviderRoster('music').map((candidate) => candidate.model),
    ['fal-ai/lyria2']
  );
  assert.deepEqual(
    getAudioProviderRoster('tts').map((candidate) => candidate.model),
    ['fal-ai/minimax/speech-2.8-hd', 'fal-ai/minimax/speech-02-hd']
  );
});

test('audio provider routing stops after the first provider failure', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      runAudioRoleWithFallback(
        'tts',
        (candidate) => ({
          prompt: `render via ${candidate.key}`,
        }),
        {
          subscribe: async (model) => {
            calls.push(model);
            throw new Error('429 rate limited');
          },
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AudioProviderError);
      assert.deepEqual(calls, ['fal-ai/minimax/speech-2.8-hd']);
      assert.equal(error.role, 'tts');
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0]?.model, 'fal-ai/minimax/speech-2.8-hd');
      return true;
    }
  );
});

test('audio music routing does not fall back when the primary provider hangs', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      runAudioRoleWithFallback(
        'music',
        () => ({
          prompt: 'subtle underscore',
        }),
        {
          subscribe: async (model) => {
            calls.push(model);
            await new Promise((resolve) => setTimeout(resolve, 50));
            return {
              data: {
                audio_url: 'https://example.com/fallback-music.wav',
              },
              requestId: 'req_music_fallback',
            };
          },
          timeoutMs: 10,
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AudioProviderError);
      assert.deepEqual(calls, ['fal-ai/lyria2']);
      assert.equal(error.role, 'music');
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0]?.model, 'fal-ai/lyria2');
      return true;
    }
  );
});

test('audio provider routing surfaces the first provider failure when fallback is disabled', async () => {
  await assert.rejects(
    () =>
      runAudioRoleWithFallback(
        'soundDesign',
        () => ({ video_url: 'https://example.com/source.mp4' }),
        {
          subscribe: async (model) => {
            throw new Error(`provider failed: ${model}`);
          },
        }
      ),
    (error: unknown) => {
      assert.ok(error instanceof AudioProviderError);
      assert.equal(error.role, 'soundDesign');
      assert.equal(error.failures.length, 1);
      assert.deepEqual(
        error.failures.map((failure) => failure.model),
        ['mirelo-ai/sfx-v1.5/video-to-audio']
      );
      return true;
    }
  );
});
