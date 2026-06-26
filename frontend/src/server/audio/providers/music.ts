import type { AudioIntensity, AudioMood } from '@/lib/audio-generation';
import {
  generateGoogleVertexLyria3Track,
  GOOGLE_VERTEX_LYRIA3_PROVIDER_KEY,
  isGoogleVertexLyria3Configured,
  isGoogleVertexLyria3DurationSupported,
  selectGoogleVertexLyria3Model,
} from './google-vertex-lyria';
import { AudioProviderError } from './error';
import { runAudioRoleWithFallback } from './fal-runner';
import { buildMusicPrompt, limitProviderPrompt } from './prompts';
import { AUDIO_PROVIDER_ROSTER, ENABLE_AUDIO_PROVIDER_FALLBACK } from './roster';
import type { AudioProviderCandidate, AudioProviderResult, AudioProviderSubscribe } from './types';

function orderMusicProvidersForDuration(durationSec: number): AudioProviderCandidate[] {
  if (durationSec <= 20) return AUDIO_PROVIDER_ROSTER.music;
  const priority = new Map([
    ['stable_audio_25_music', 0],
    ['elevenlabs_music', 1],
    ['ace_step', 2],
    ['minimax_music_2_6', 3],
    ['google_lyria2', 4],
  ]);
  return [...AUDIO_PROVIDER_ROSTER.music].sort((a, b) => (priority.get(a.key) ?? 10) - (priority.get(b.key) ?? 10));
}

export async function generateMusicTrack(input: {
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
  prompt?: string | null;
}, options?: {
  subscribe?: AudioProviderSubscribe;
  timeoutMs?: number;
  preferLyria3?: boolean;
  generateGoogleVertexLyria3TrackFn?: typeof generateGoogleVertexLyria3Track;
}): Promise<AudioProviderResult> {
  let lyriaFailure: { providerKey: string; model: string; message: string } | null = null;
  const shouldTryLyria3 =
    options?.preferLyria3 !== false &&
    isGoogleVertexLyria3DurationSupported(input.durationSec) &&
    (Boolean(options?.generateGoogleVertexLyria3TrackFn) || isGoogleVertexLyria3Configured());

  if (shouldTryLyria3) {
    try {
      return await (options?.generateGoogleVertexLyria3TrackFn ?? generateGoogleVertexLyria3Track)(input);
    } catch (error) {
      lyriaFailure = {
        providerKey: GOOGLE_VERTEX_LYRIA3_PROVIDER_KEY,
        model: selectGoogleVertexLyria3Model(input.durationSec),
        message: error instanceof Error ? error.message : 'Unknown Google Vertex Lyria failure',
      };
      if (!ENABLE_AUDIO_PROVIDER_FALLBACK) {
        throw new AudioProviderError('music', [lyriaFailure]);
      }
    }
  }

  try {
    return await runAudioRoleWithFallback('music', (candidate) => {
      const prompt = limitProviderPrompt(buildMusicPrompt(input.mood, input.intensity, input.prompt));
      if (candidate.key === 'minimax_music_2_6') {
        return {
          prompt: limitProviderPrompt(
            `${prompt} Instrumental cinematic background music, no vocals, no lyrics, clean mix, duration around ${input.durationSec} seconds.`
          ),
          lyrics: '',
          lyrics_optimizer: false,
          is_instrumental: true,
        };
      }
      if (candidate.key === 'google_lyria2') {
        return {
          prompt: limitProviderPrompt(`${prompt} Instrumental only. Keep the score cinematic and non-vocal.`),
          negative_prompt: 'vocals, singing, speech, dialogue, harsh percussion, distortion, clipping',
        };
      }
      if (candidate.key === 'elevenlabs_music') {
        return {
          prompt: limitProviderPrompt(
            `${prompt} Instrumental cinematic background music, no vocals, no lyrics, clean mix, duration around ${input.durationSec} seconds.`
          ),
          music_length_ms: Math.round(input.durationSec * 1000),
          force_instrumental: true,
          output_format: 'mp3_44100_128',
        };
      }
      if (candidate.key === 'stable_audio_25_music') {
        return {
          prompt: limitProviderPrompt(`${prompt} Instrumental, no vocals, no speech, no dialogue.`),
          seconds_total: input.durationSec,
          num_inference_steps: input.intensity === 'intense' ? 10 : 8,
          guidance_scale: input.intensity === 'subtle' ? 0.9 : input.intensity === 'intense' ? 1.35 : 1.1,
        };
      }
      if (candidate.key === 'ace_step') {
        return {
          tags: `${input.mood}, cinematic, instrumental, ambient, underscore`,
          lyrics: '[instrumental]',
          duration: input.durationSec,
          number_of_steps: input.intensity === 'intense' ? 30 : 27,
        };
      }
      return {
        prompt,
        negative_prompt: 'vocals, dominant lead melody, harsh percussion, distortion, clipping',
        duration: input.durationSec,
        refinement: input.intensity === 'intense' ? 72 : input.intensity === 'subtle' ? 84 : 80,
        creativity: input.intensity === 'intense' ? 18 : input.intensity === 'subtle' ? 8 : 12,
      };
    }, {
      candidates: orderMusicProvidersForDuration(input.durationSec),
      subscribe: options?.subscribe,
      timeoutMs: options?.timeoutMs,
    });
  } catch (error) {
    if (lyriaFailure && error instanceof AudioProviderError) {
      throw new AudioProviderError('music', [lyriaFailure, ...error.failures]);
    }
    throw error;
  }
}
