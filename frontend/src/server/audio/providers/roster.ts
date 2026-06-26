import type { AudioPipelineRole, AudioProviderCandidate } from './types';

export const AUDIO_PROVIDER_ROSTER: Record<AudioPipelineRole, AudioProviderCandidate[]> = {
  soundDesign: [
    {
      key: 'mirelo_sfx_v1_5',
      label: 'Mirelo SFX V1.5',
      model: 'mirelo-ai/sfx-v1.5/video-to-audio',
    },
    {
      key: 'thinksound',
      label: 'ThinkSound',
      model: 'fal-ai/thinksound/audio',
    },
    {
      key: 'mmaudio_v2_text',
      label: 'MMAudio V2',
      model: 'fal-ai/mmaudio-v2/text-to-audio',
    },
    {
      key: 'stable_audio_25_sfx',
      label: 'Stable Audio 2.5',
      model: 'fal-ai/stable-audio-25/text-to-audio',
    },
  ],
  music: [
    {
      key: 'minimax_music_2_6',
      label: 'MiniMax Music 2.6',
      model: 'fal-ai/minimax-music/v2.6',
    },
    {
      key: 'google_lyria2',
      label: 'Google Lyria 2',
      model: 'fal-ai/lyria2',
    },
    {
      key: 'elevenlabs_music',
      label: 'ElevenLabs Music',
      model: 'fal-ai/elevenlabs/music',
    },
    {
      key: 'stable_audio_25_music',
      label: 'Stable Audio 2.5',
      model: 'fal-ai/stable-audio-25/text-to-audio',
    },
    {
      key: 'ace_step',
      label: 'ACE-Step',
      model: 'fal-ai/ace-step',
    },
  ],
  tts: [
    {
      key: 'seed_audio_1_0',
      label: 'Seed Audio 1.0',
      model: 'bytedance/seed-audio-1.0',
    },
  ],
  voiceClone: [
    {
      key: 'seed_audio_1_0_reference',
      label: 'Seed Audio 1.0 Reference Voice',
      model: 'bytedance/seed-audio-1.0',
    },
  ],
};

export const ENABLE_AUDIO_PROVIDER_FALLBACK = process.env.AUDIO_PROVIDER_FALLBACK !== '0';

export const AUDIO_PROVIDER_TIMEOUT_MS: Record<AudioPipelineRole, number> = {
  soundDesign: 600_000,
  music: 600_000,
  tts: 300_000,
  voiceClone: 300_000,
};

export function getAudioProviderRoster(role: AudioPipelineRole): AudioProviderCandidate[] {
  return AUDIO_PROVIDER_ROSTER[role].map((candidate) => ({ ...candidate }));
}
