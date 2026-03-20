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
    ['beatoven/music-generation', 'fal-ai/lyria2']
  );
  assert.deepEqual(
    getAudioProviderRoster('tts').map((candidate) => candidate.model),
    ['fal-ai/minimax/speech-2.8-hd', 'fal-ai/minimax/speech-02-hd']
  );
});

test('audio provider routing falls back to the next provider when the first one fails', async () => {
  const calls: string[] = [];
  const result = await runAudioRoleWithFallback(
    'tts',
    (candidate) => ({
      prompt: `render via ${candidate.key}`,
    }),
    {
      subscribe: async (model) => {
        calls.push(model);
        if (model === 'fal-ai/minimax/speech-2.8-hd') {
          throw new Error('429 rate limited');
        }
        return {
          data: {
            audio_url: 'https://example.com/fallback-voice.wav',
          },
          requestId: 'req_fallback',
        };
      },
    }
  );

  assert.deepEqual(calls, ['fal-ai/minimax/speech-2.8-hd', 'fal-ai/minimax/speech-02-hd']);
  assert.equal(result.providerKey, 'minimax_speech_02_hd');
  assert.equal(result.model, 'fal-ai/minimax/speech-02-hd');
  assert.equal(result.url, 'https://example.com/fallback-voice.wav');
});

test('audio music routing falls back when the primary provider hangs', async () => {
  const calls: string[] = [];
  const result = await runAudioRoleWithFallback(
    'music',
    () => ({
      prompt: 'subtle underscore',
    }),
    {
      subscribe: async (model) => {
        calls.push(model);
        if (model === 'beatoven/music-generation') {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return {
          data: {
            audio_url: 'https://example.com/fallback-music.wav',
          },
          requestId: 'req_music_fallback',
        };
      },
      timeoutMs: 10,
    }
  );

  assert.deepEqual(calls, ['beatoven/music-generation', 'fal-ai/lyria2']);
  assert.equal(result.providerKey, 'google_lyria2');
  assert.equal(result.url, 'https://example.com/fallback-music.wav');
});

test('audio provider routing surfaces every provider failure when the role exhausts', async () => {
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
      assert.equal(error.failures.length, 2);
      assert.deepEqual(
        error.failures.map((failure) => failure.model),
        ['mirelo-ai/sfx-v1.5/video-to-audio', 'fal-ai/thinksound/audio']
      );
      return true;
    }
  );
});
