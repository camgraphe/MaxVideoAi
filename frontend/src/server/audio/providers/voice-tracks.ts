import {
  AUDIO_SEED_AUDIO_MODEL_ID,
  type AudioLanguage,
  type AudioSeedAudioOutputFormat,
  type AudioSeedAudioSampleRate,
  type AudioSeedAudioVoice,
  type AudioVoiceDelivery,
  type AudioVoiceGender,
  type AudioVoiceProfile,
} from '@/lib/audio-generation';
import { runAudioRoleWithFallback } from './fal-runner';
import type { AudioProviderResult, AudioProviderSubscribe } from './types';

type VoiceGenerationOptions = {
  subscribe?: AudioProviderSubscribe;
  timeoutMs?: number;
};

type SeedAudioVoiceInput = {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
  referenceAudioUrl?: string | null;
  seedAudioVoice?: AudioSeedAudioVoice | null;
  seedAudioOutputFormat?: AudioSeedAudioOutputFormat | null;
  seedAudioSampleRate?: AudioSeedAudioSampleRate | null;
  seedAudioSpeed?: number | null;
  seedAudioVolume?: number | null;
  seedAudioPitch?: number | null;
};

function resolveSeedAudioVoice(input: {
  language?: AudioLanguage | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
}): string {
  if (input.language === 'spanish') {
    return input.voiceGender === 'male' ? 'mindy_en_es_id_pt_zh' : 'tracy_es_zh';
  }
  if (input.voiceGender === 'male') {
    return input.voiceProfile === 'deep' || input.voiceDelivery === 'trailer' ? 'magnus_en_zh' : 'kian_en_zh';
  }
  if (input.voiceGender === 'neutral') {
    return input.voiceProfile === 'bright' ? 'opal_en_zh' : 'quentin_en_zh';
  }
  if (input.voiceProfile === 'bright') return 'sophie_en_zh';
  if (input.voiceProfile === 'deep') return 'nadia_en_zh';
  return 'mindy_en_es_id_pt_zh';
}

function resolveSeedAudioSpeed(delivery: AudioVoiceDelivery): number {
  if (delivery === 'trailer') return 0.94;
  if (delivery === 'intimate') return 0.92;
  if (delivery === 'cinematic') return 0.96;
  return 1;
}

function resolveSeedAudioPitch(profile: AudioVoiceProfile): number {
  if (profile === 'deep') return -2;
  if (profile === 'bright') return 2;
  return 0;
}

function languageInstruction(language?: AudioLanguage | null, locale?: string | null): string {
  if (language && language !== 'auto') {
    return `Use ${language} pronunciation and natural pacing.`;
  }
  if (locale?.trim()) {
    return `Infer the spoken language from locale ${locale.trim()} and the script text.`;
  }
  return 'Infer the spoken language from the script text.';
}

export function buildSeedAudioVoiceInput(input: SeedAudioVoiceInput): Record<string, unknown> {
  const script = input.script.replace(/\s+/g, ' ').trim();
  const referenceAudioUrl = input.referenceAudioUrl?.trim() || null;
  const prompt = [
    referenceAudioUrl ? 'Use @Audio1 as the reference voice for speaker character, cadence, and tone.' : null,
    `Voice over script: ${script}`,
    `Delivery: ${input.voiceDelivery}. Voice texture: ${input.voiceProfile}.`,
    languageInstruction(input.language, input.locale),
  ].filter(Boolean).join(' ');

  const presetVoice =
    input.seedAudioVoice ??
    resolveSeedAudioVoice({
      language: input.language,
      voiceGender: input.voiceGender,
      voiceProfile: input.voiceProfile,
      voiceDelivery: input.voiceDelivery,
    });

  return {
    prompt,
    output_format: input.seedAudioOutputFormat ?? 'mp3',
    sample_rate: input.seedAudioSampleRate ?? 24000,
    speed: input.seedAudioSpeed ?? resolveSeedAudioSpeed(input.voiceDelivery),
    volume: input.seedAudioVolume ?? 1,
    pitch: input.seedAudioPitch ?? resolveSeedAudioPitch(input.voiceProfile),
    ...(referenceAudioUrl
      ? { audio_urls: [referenceAudioUrl] }
      : presetVoice === 'default'
        ? {}
        : { voice: presetVoice }),
  };
}

export async function generateStandardVoiceTrack(input: {
  script: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceGender: AudioVoiceGender;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
  seedAudioVoice?: AudioSeedAudioVoice | null;
  seedAudioOutputFormat?: AudioSeedAudioOutputFormat | null;
  seedAudioSampleRate?: AudioSeedAudioSampleRate | null;
  seedAudioSpeed?: number | null;
  seedAudioVolume?: number | null;
  seedAudioPitch?: number | null;
}, options?: VoiceGenerationOptions): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback(
    'tts',
    () => buildSeedAudioVoiceInput(input),
    {
      subscribe: options?.subscribe,
      timeoutMs: options?.timeoutMs,
    }
  );
}

export async function generateClonedVoiceTrack(input: {
  script: string;
  voiceSampleUrl: string;
  locale?: string | null;
  language?: AudioLanguage | null;
  voiceProfile: AudioVoiceProfile;
  voiceDelivery: AudioVoiceDelivery;
  seedAudioOutputFormat?: AudioSeedAudioOutputFormat | null;
  seedAudioSampleRate?: AudioSeedAudioSampleRate | null;
  seedAudioSpeed?: number | null;
  seedAudioVolume?: number | null;
  seedAudioPitch?: number | null;
}, options?: VoiceGenerationOptions): Promise<AudioProviderResult> {
  return runAudioRoleWithFallback(
    'tts',
    () =>
      buildSeedAudioVoiceInput({
        script: input.script,
        locale: input.locale,
        language: input.language,
        voiceGender: 'neutral',
        voiceProfile: input.voiceProfile,
        voiceDelivery: input.voiceDelivery,
        referenceAudioUrl: input.voiceSampleUrl,
        seedAudioOutputFormat: input.seedAudioOutputFormat,
        seedAudioSampleRate: input.seedAudioSampleRate,
        seedAudioSpeed: input.seedAudioSpeed,
        seedAudioVolume: input.seedAudioVolume,
        seedAudioPitch: input.seedAudioPitch,
      }),
    {
      candidates: [
        {
          key: 'seed_audio_1_0_reference',
          label: 'Seed Audio 1.0 Reference Voice',
          model: AUDIO_SEED_AUDIO_MODEL_ID,
        },
      ],
      subscribe: options?.subscribe,
      timeoutMs: options?.timeoutMs,
    }
  );
}
