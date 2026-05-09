import type {
  AudioLanguage,
  AudioVoiceDelivery,
  AudioVoiceGender,
  AudioVoiceProfile,
} from '@/lib/audio-generation';
import { runAudioRoleWithFallback, subscribeFalModel } from './fal-runner';
import { findFileUrl } from './response';
import type { AudioProviderResult } from './types';
import {
  buildGeminiStyleInstructions,
  buildVoiceModify,
  buildVoiceSetting,
  resolveGeminiLanguageCode,
  resolveGeminiVoice,
  resolveLanguageBoost,
  resolveStandardVoiceId,
} from './voice-utils';

async function renderCustomVoiceTrackFromVoiceId(input: {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  customVoiceId: string;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  const result = await subscribeFalModel('fal-ai/minimax/speech-02-hd', {
    prompt: input.script,
    output_format: 'url',
    language_boost: resolveLanguageBoost(input.language, input.locale),
    voice_setting: buildVoiceSetting({
      voiceId: input.customVoiceId,
      voiceGender: input.voiceGender,
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
    voice_modify: buildVoiceModify({
      voiceGender: input.voiceGender,
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
  });
  const audioUrl = findFileUrl(result.data, 'audio');
  if (!audioUrl) {
    throw new Error('Custom voice rendering returned no audio URL.');
  }
  return {
    url: audioUrl,
    providerKey: 'minimax_custom_voice_render',
    providerLabel: 'MiniMax Custom Voice Render',
    model: 'fal-ai/minimax/speech-02-hd',
    requestId: result.requestId ?? null,
    customVoiceId: input.customVoiceId,
  };
}

export async function generateStandardVoiceTrack(input: {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback('tts', (candidate) => {
    if (candidate.key === 'gemini_3_1_flash_tts') {
      const languageCode = resolveGeminiLanguageCode(input.language, input.locale);
      return {
        prompt: input.script,
        style_instructions: buildGeminiStyleInstructions({
          voiceProfile: input.voiceProfile,
          voiceDelivery: input.voiceDelivery,
        }),
        voice: resolveGeminiVoice({
          voiceGender: input.voiceGender,
          voiceProfile: input.voiceProfile,
        }),
        ...(languageCode ? { language_code: languageCode } : {}),
        temperature: input.voiceDelivery === 'trailer' ? 0.9 : 1,
        output_format: 'mp3',
      };
    }
    return {
      prompt: input.script,
      output_format: 'url',
      language_boost: resolveLanguageBoost(input.language, input.locale),
      voice_setting: buildVoiceSetting({
        voiceId: resolveStandardVoiceId({
          providerKey: candidate.key,
          voiceGender: input.voiceGender,
        }),
        voiceGender: input.voiceGender,
        voiceProfile: input.voiceProfile,
        voiceDelivery: input.voiceDelivery,
      }),
      voice_modify: buildVoiceModify({
        voiceGender: input.voiceGender,
        voiceProfile: input.voiceProfile,
        voiceDelivery: input.voiceDelivery,
      }),
    };
  });
}

export async function generateClonedVoiceTrack(input: {
  script: string;
  voiceSampleUrl: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): Promise<AudioProviderResult> {
  const cloned = await runAudioRoleWithFallback('voiceClone', () => ({
    audio_url: input.voiceSampleUrl,
    prompt: input.script,
    output_format: 'url',
    language_boost: resolveLanguageBoost(input.language, input.locale),
    model: 'speech-02-hd',
    voice_setting: buildVoiceSetting({
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
    voice_modify: buildVoiceModify({
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    }),
  }));
  if (cloned.url) {
    return cloned;
  }
  if (cloned.customVoiceId) {
    return renderCustomVoiceTrackFromVoiceId({
      script: input.script,
      locale: input.locale,
      language: input.language,
      customVoiceId: cloned.customVoiceId,
      voiceGender: 'neutral',
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    });
  }
  throw new Error('Voice clone provider returned no usable output.');
}
