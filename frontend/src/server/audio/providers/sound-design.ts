import type { AudioIntensity, AudioMood } from '@/lib/audio-generation';
import { runAudioRoleWithFallback } from './fal-runner';
import { buildSoundDesignPrompt, limitProviderPrompt } from './prompts';
import { AUDIO_PROVIDER_ROSTER } from './roster';
import type { AudioProviderCandidate, AudioProviderResult } from './types';

function orderSoundDesignProviders(sourceVideoUrl?: string | null): AudioProviderCandidate[] {
  if (sourceVideoUrl) return AUDIO_PROVIDER_ROSTER.soundDesign;
  return AUDIO_PROVIDER_ROSTER.soundDesign.filter((candidate) =>
    candidate.key === 'mmaudio_v2_text' || candidate.key === 'stable_audio_25_sfx'
  );
}

export async function generateSoundDesignTrack(input: {
  sourceVideoUrl?: string | null;
  durationSec: number;
  mood: AudioMood;
  intensity: AudioIntensity;
  prompt?: string | null;
}): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback('soundDesign', (candidate) => {
    const prompt = limitProviderPrompt(buildSoundDesignPrompt(input.mood, input.intensity, input.prompt));
    if (candidate.key === 'mirelo_sfx_v1_5') {
      return {
        video_url: input.sourceVideoUrl!,
        text_prompt: prompt,
        duration: input.durationSec,
        num_samples: 2,
      };
    }
    if (candidate.key === 'mmaudio_v2_text') {
      return {
        prompt,
        negative_prompt: 'vocals, speech, dialogue, singing, music bed, clipping, distortion',
        duration: input.durationSec,
        num_steps: input.intensity === 'intense' ? 30 : 25,
        cfg_strength: input.intensity === 'subtle' ? 3.6 : input.intensity === 'intense' ? 5.2 : 4.5,
      };
    }
    if (candidate.key === 'stable_audio_25_sfx') {
      return {
        prompt: limitProviderPrompt(`${prompt} Generate cinematic sound effects and ambience only, no speech or melody.`),
        seconds_total: input.durationSec,
        num_inference_steps: input.intensity === 'intense' ? 10 : 8,
        guidance_scale: input.intensity === 'subtle' ? 0.9 : input.intensity === 'intense' ? 1.35 : 1.1,
      };
    }
    return {
      video_url: input.sourceVideoUrl!,
      prompt,
      duration: input.durationSec,
    };
  }, {
    candidates: orderSoundDesignProviders(input.sourceVideoUrl),
  });
}
