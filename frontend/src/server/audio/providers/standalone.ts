import { AUDIO_AMBIENCE_MODEL_ID, AUDIO_MINIMAX_SPEECH_MODEL_ID, AUDIO_SONG_MODEL_ID } from '@/lib/audio-generation';
import type { ValidatedAudioGenerateRequest } from '../audio-generate-validation';
import { runAudioRoleWithFallback } from './fal-runner';
import type { AudioProviderSubscribe } from './types';
import { AUDIO_ELEVEN_V4_MODEL_ID } from '@/lib/audio-eleven-voices';

export async function generateElevenVoiceTrack(input: ValidatedAudioGenerateRequest, subscribe?: AudioProviderSubscribe) {
  const languageCodes: Record<string, string> = { english: 'en', french: 'fr', spanish: 'es', german: 'de' };
  return runAudioRoleWithFallback('tts', () => ({
    text: input.script, voice: input.elevenVoiceId, stability: input.elevenStability,
    similarity_boost: input.elevenSimilarityBoost,
    ...(input.language && input.language !== 'auto' ? { language_code: languageCodes[input.language] } : {}),
    output_format: 'mp3_44100_128', apply_text_normalization: 'auto', timestamps: true,
  }), { candidates: [{ key: 'eleven_v4', label: 'Eleven v4', model: AUDIO_ELEVEN_V4_MODEL_ID }], subscribe });
}

/** Exact routes: one candidate means no second paid generation after failure/timeout. */
export async function generateSongTrack(input: { prompt: string; lyrics: string }, subscribe?: AudioProviderSubscribe) {
  return runAudioRoleWithFallback('music', () => ({
    prompt: input.prompt, lyrics: input.lyrics, lyrics_optimizer: false, is_instrumental: false,
    audio_setting: { format: 'mp3', sample_rate: 44100, bitrate: 256000 },
  }), { candidates: [{ key: 'minimax_music_2_6', label: 'MiniMax Music 2.6', model: AUDIO_SONG_MODEL_ID }], subscribe });
}

export async function generateAmbienceTrack(input: { prompt: string; durationSec: number }, subscribe?: AudioProviderSubscribe) {
  return runAudioRoleWithFallback('soundDesign', () => ({
    prompt: `${input.prompt}\nContinuous environmental ambience. No music, speech or singing.`,
    seconds_total: input.durationSec, num_inference_steps: 8, guidance_scale: 1,
  }), { candidates: [{ key: 'stable_audio_25_ambience', label: 'Stable Audio 2.5', model: AUDIO_AMBIENCE_MODEL_ID }], subscribe });
}

export async function generateMinimaxVoiceTrack(input: ValidatedAudioGenerateRequest, subscribe?: AudioProviderSubscribe) {
  const language = input.language && input.language !== 'auto'
    ? input.language[0].toUpperCase() + input.language.slice(1) : 'auto';
  return runAudioRoleWithFallback('tts', () => ({
    text: input.script,
    voice_setting: { voice_id: input.minimaxVoiceId, speed: input.seedAudioSpeed ?? 1, vol: input.seedAudioVolume ?? 1,
      pitch: input.seedAudioPitch ?? 0, emotion: 'neutral', english_normalization: language === 'English' },
    audio_setting: { format: 'mp3', sample_rate: 44100, channel: 1 },
    language_boost: language, output_format: 'url',
  }), { candidates: [{ key: 'minimax_speech_02_hd', label: 'MiniMax Speech-02 HD', model: AUDIO_MINIMAX_SPEECH_MODEL_ID }], subscribe });
}
