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
      key: 'gemini_3_1_flash_tts',
      label: 'Gemini 3.1 Flash TTS',
      model: 'fal-ai/gemini-3.1-flash-tts',
    },
    {
      key: 'minimax_speech_2_8_hd',
      label: 'MiniMax Speech 2.8 HD',
      model: 'fal-ai/minimax/speech-2.8-hd',
    },
    {
      key: 'minimax_speech_02_hd',
      label: 'MiniMax Speech-02 HD',
      model: 'fal-ai/minimax/speech-02-hd',
    },
  ],
  voiceClone: [
    {
      key: 'minimax_voice_clone',
      label: 'MiniMax Voice Clone',
      model: 'fal-ai/minimax/voice-clone',
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
