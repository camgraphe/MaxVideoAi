import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AudioProviderError,
  generateClonedVoiceTrack,
  generateMusicTrack,
  generateStandardVoiceTrack,
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
      'fal-ai/elevenlabs/music',
      'fal-ai/stable-audio-25/text-to-audio',
      'fal-ai/ace-step',
    ]
  );
  assert.deepEqual(
    getAudioProviderRoster('tts').map((candidate) => candidate.model),
    ['bytedance/seed-audio-1.0']
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

test('music routing can fall back to ElevenLabs Music with fal API controls', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  await generateMusicTrack(
    {
      durationSec: 45,
      mood: 'documentary',
      intensity: 'standard',
      prompt: 'Elegant brand film underscore.',
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        if (model !== 'fal-ai/elevenlabs/music') {
          throw new Error('provider unavailable');
        }
        return {
          data: {
            audio_url: 'https://example.com/elevenlabs-music.mp3',
          },
          requestId: 'req_elevenlabs_music',
        };
      },
    }
  );

  assert.equal(calls[1]?.model, 'fal-ai/elevenlabs/music');
  assert.equal(calls[1]?.input.music_length_ms, 45_000);
  assert.equal(calls[1]?.input.force_instrumental, true);
  assert.equal(calls[1]?.input.output_format, 'mp3_44100_128');
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
      assert.deepEqual(calls, ['bytedance/seed-audio-1.0']);
      assert.equal(error.role, 'tts');
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0]?.model, 'bytedance/seed-audio-1.0');
      return true;
    }
  );
});

test('standard voice renders through Seed Audio with preset voice controls', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  const result = await generateStandardVoiceTrack(
    {
      script: 'Launch the product with a calm, premium voice over.',
      locale: 'en-US',
      language: 'english',
      voiceGender: 'female',
      voiceProfile: 'warm',
      voiceDelivery: 'natural',
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: { audio: { url: 'https://example.com/seed-audio.mp3' } },
          requestId: 'req_seed_audio_voice',
        };
      },
    }
  );

  assert.equal(result.model, 'bytedance/seed-audio-1.0');
  assert.equal(calls[0]?.model, 'bytedance/seed-audio-1.0');
  assert.equal(calls[0]?.input.output_format, 'mp3');
  assert.equal(calls[0]?.input.sample_rate, 24000);
  assert.equal(calls[0]?.input.voice, 'mindy_en_es_id_pt_zh');
  assert.match(String(calls[0]?.input.prompt), /Launch the product/);
  assert.equal('audio_urls' in (calls[0]?.input ?? {}), false);
});

test('standard voice can use Seed Audio default voice by omitting voice', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  await generateStandardVoiceTrack(
    {
      script: 'Use the provider default narrator.',
      locale: 'en-US',
      language: 'english',
      voiceGender: 'female',
      voiceProfile: 'warm',
      voiceDelivery: 'natural',
      seedAudioVoice: 'default',
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: { audio: { url: 'https://example.com/seed-audio-default.mp3' } },
          requestId: 'req_seed_audio_default_voice',
        };
      },
    }
  );

  assert.equal(calls[0]?.model, 'bytedance/seed-audio-1.0');
  assert.equal('voice' in (calls[0]?.input ?? {}), false);
  assert.equal('audio_urls' in (calls[0]?.input ?? {}), false);
});

test('standard voice forwards Seed Audio API controls to fal', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  await generateStandardVoiceTrack(
    {
      script: 'Precise technical narration.',
      locale: 'en-US',
      language: 'english',
      voiceGender: 'female',
      voiceProfile: 'balanced',
      voiceDelivery: 'natural',
      seedAudioVoice: 'pearl_en_zh',
      seedAudioOutputFormat: 'wav',
      seedAudioSampleRate: 44100,
      seedAudioSpeed: 1.25,
      seedAudioVolume: 0.8,
      seedAudioPitch: -3,
    } as any,
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: { audio_url: 'https://example.com/seed-audio.wav' },
          requestId: 'req_seed_audio_controls',
        };
      },
    }
  );

  assert.equal(calls[0]?.model, 'bytedance/seed-audio-1.0');
  assert.equal(calls[0]?.input.voice, 'pearl_en_zh');
  assert.equal(calls[0]?.input.output_format, 'wav');
  assert.equal(calls[0]?.input.sample_rate, 44100);
  assert.equal(calls[0]?.input.speed, 1.25);
  assert.equal(calls[0]?.input.volume, 0.8);
  assert.equal(calls[0]?.input.pitch, -3);
});

test('reference voice renders through Seed Audio audio_urls with @Audio1 guidance', async () => {
  const calls: Array<{ model: string; input: Record<string, unknown> }> = [];
  await generateClonedVoiceTrack(
    {
      script: 'Read this line in the same cadence as the sample.',
      voiceSampleUrl: 'https://example.com/reference-voice.wav',
      locale: 'fr-FR',
      language: 'french',
      voiceProfile: 'deep',
      voiceDelivery: 'trailer',
    },
    {
      subscribe: async (model, input) => {
        calls.push({ model, input });
        return {
          data: { audio_url: 'https://example.com/reference-render.mp3' },
          requestId: 'req_seed_audio_reference',
        };
      },
    }
  );

  assert.equal(calls[0]?.model, 'bytedance/seed-audio-1.0');
  assert.deepEqual(calls[0]?.input.audio_urls, ['https://example.com/reference-voice.wav']);
  assert.match(String(calls[0]?.input.prompt), /@Audio1/);
  assert.match(String(calls[0]?.input.prompt), /Read this line/);
  assert.equal(calls[0]?.input.output_format, 'mp3');
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
        'fal-ai/elevenlabs/music',
        'fal-ai/stable-audio-25/text-to-audio',
        'fal-ai/ace-step',
      ]);
      assert.equal(error.role, 'music');
      assert.equal(error.failures.length, 5);
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
