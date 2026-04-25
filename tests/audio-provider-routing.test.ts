import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AudioProviderError,
  generateMusicTrack,
  getAudioProviderRoster,
  runAudioRoleWithFallback,
} from '../frontend/src/server/audio/providers';

test('audio provider routing keeps recent-first order for every role', () => {
  assert.deepEqual(
    getAudioProviderRoster('soundDesign').map((candidate) => candidate.model),
    [
      'mirelo-ai/sfx-v1.5/video-to-audio',
      'fal-ai/thinksound/audio',
      'fal-ai/mmaudio-v2/text-to-audio',
      'fal-ai/stable-audio-25/text-to-audio',
    ]
  );
  assert.deepEqual(
    getAudioProviderRoster('music').map((candidate) => candidate.model),
    [
      'fal-ai/minimax-music/v2.6',
      'fal-ai/lyria2',
      'fal-ai/stable-audio-25/text-to-audio',
      'fal-ai/ace-step',
    ]
  );
  assert.deepEqual(
    getAudioProviderRoster('tts').map((candidate) => candidate.model),
    ['fal-ai/gemini-3.1-flash-tts', 'fal-ai/minimax/speech-2.8-hd', 'fal-ai/minimax/speech-02-hd']
  );
});

test('audio provider routing does not expose beatoven for music', () => {
  assert.ok(
    getAudioProviderRoster('music').every((candidate) => !candidate.model.toLowerCase().includes('beatoven'))
  );
});

test('long music renders prioritize providers with explicit duration controls', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const result = await generateMusicTrack(
    {
      durationSec: 120,
      mood: 'dreamy',
      intensity: 'standard',
      prompt: 'Slow premium ambient product score.',
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: {
            audio_url: 'https://example.com/long-music.wav',
          },
          requestId: 'req_long_music',
        };
      },
    }
  );

  assert.equal(calls[0]?.model, 'fal-ai/stable-audio-25/text-to-audio');
  assert.equal(calls[0]?.input.seconds_total, 120);
  assert.equal(result.providerKey, 'stable_audio_25_music');
});

test('short music renders keep the recent-first music roster', async () => {
  const calls: string[] = [];
  await generateMusicTrack(
    {
      durationSec: 20,
      mood: 'epic',
      intensity: 'standard',
      prompt: 'Short cinematic logo sting.',
    },
    {
      subscribe: async (model) => {
        calls.push(model);
        return {
          data: {
            audio_url: 'https://example.com/short-music.wav',
          },
          requestId: 'req_short_music',
        };
      },
    }
  );

  assert.equal(calls[0], 'fal-ai/minimax-music/v2.6');
});

test('music provider prompts stay within the fal prompt limit after style guidance', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  await generateMusicTrack(
    {
      durationSec: 120,
      mood: 'documentary',
      intensity: 'subtle',
      prompt: 'a'.repeat(2000),
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: {
            audio_url: 'https://example.com/long-prompt.wav',
          },
          requestId: 'req_long_prompt',
        };
      },
    }
  );

  assert.equal(calls[0]?.model, 'fal-ai/stable-audio-25/text-to-audio');
  assert.ok(String(calls[0]?.input.prompt ?? '').length <= 2000);
});

test('audio provider routing falls back through TTS providers', async () => {
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
      assert.deepEqual(calls, [
        'fal-ai/gemini-3.1-flash-tts',
        'fal-ai/minimax/speech-2.8-hd',
        'fal-ai/minimax/speech-02-hd',
      ]);
      assert.equal(error.role, 'tts');
      assert.equal(error.failures.length, 3);
      assert.equal(error.failures[0]?.model, 'fal-ai/gemini-3.1-flash-tts');
      return true;
    }
  );
});

test('audio music routing falls back when providers hang', async () => {
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
      assert.deepEqual(calls, [
        'fal-ai/minimax-music/v2.6',
        'fal-ai/lyria2',
        'fal-ai/stable-audio-25/text-to-audio',
        'fal-ai/ace-step',
      ]);
      assert.equal(error.role, 'music');
      assert.equal(error.failures.length, 4);
      assert.equal(error.failures[0]?.model, 'fal-ai/minimax-music/v2.6');
      return true;
    }
  );
});

test('audio provider routing surfaces every provider failure when fallback is enabled', async () => {
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
      assert.equal(error.failures.length, 4);
      assert.deepEqual(
        error.failures.map((failure) => failure.model),
        [
          'mirelo-ai/sfx-v1.5/video-to-audio',
          'fal-ai/thinksound/audio',
          'fal-ai/mmaudio-v2/text-to-audio',
          'fal-ai/stable-audio-25/text-to-audio',
        ]
      );
      return true;
    }
  );
});
