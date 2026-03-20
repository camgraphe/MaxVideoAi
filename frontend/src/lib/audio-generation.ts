import type { PricingSnapshot } from '@maxvideoai/pricing';

export const AUDIO_SURFACE = 'audio' as const;
export const AUDIO_MIN_DURATION_SEC = 3;
export const AUDIO_MAX_DURATION_SEC = 20;
export const AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE = 150;

export const AUDIO_PACK_VALUES = ['music_only', 'voice_only', 'cinematic', 'cinematic_voice'] as const;
export type AudioPackId = (typeof AUDIO_PACK_VALUES)[number];

export const AUDIO_MOOD_VALUES = ['epic', 'tense', 'intimate', 'dark', 'dreamy', 'sci-fi', 'documentary'] as const;
export type AudioMood = (typeof AUDIO_MOOD_VALUES)[number];

export const AUDIO_INTENSITY_VALUES = ['subtle', 'standard', 'intense'] as const;
export type AudioIntensity = (typeof AUDIO_INTENSITY_VALUES)[number];

export const AUDIO_VOICE_MODE_VALUES = ['standard', 'clone'] as const;
export type AudioVoiceMode = (typeof AUDIO_VOICE_MODE_VALUES)[number];

export const AUDIO_VOICE_PROFILE_VALUES = ['balanced', 'warm', 'bright', 'deep'] as const;
export type AudioVoiceProfile = (typeof AUDIO_VOICE_PROFILE_VALUES)[number];

export const AUDIO_VOICE_GENDER_VALUES = ['female', 'male', 'neutral'] as const;
export type AudioVoiceGender = (typeof AUDIO_VOICE_GENDER_VALUES)[number];

export const AUDIO_VOICE_DELIVERY_VALUES = ['natural', 'cinematic', 'trailer', 'intimate'] as const;
export type AudioVoiceDelivery = (typeof AUDIO_VOICE_DELIVERY_VALUES)[number];

export const AUDIO_LANGUAGE_VALUES = ['auto', 'english', 'french', 'spanish', 'german'] as const;
export type AudioLanguage = (typeof AUDIO_LANGUAGE_VALUES)[number];

export const AUDIO_OUTPUT_KIND_VALUES = ['audio', 'video', 'both'] as const;
export type AudioOutputKind = (typeof AUDIO_OUTPUT_KIND_VALUES)[number];

type AudioPackConfig = {
  engineId: string;
  billingProductKey: string;
  label: string;
  description: string;
  includesVoice: boolean;
  audioOnly: boolean;
  requiresVideo: boolean;
  requiresMood: boolean;
  requiresScript: boolean;
  supportsMusicToggle: boolean;
  supportsAudioExport: boolean;
  defaultMusicEnabled: boolean;
  baseRateCents: number;
  minChargeCents: number;
  cloneAddonPerSecondCents: number;
};

const AUDIO_PACK_CONFIG: Record<AudioPackId, AudioPackConfig> = {
  music_only: {
    engineId: 'audio-music-only',
    billingProductKey: 'audio-music-only',
    label: 'Music Only',
    description: 'Ambient or cinematic music bed as a standalone audio file.',
    includesVoice: false,
    audioOnly: true,
    requiresVideo: false,
    requiresMood: true,
    requiresScript: false,
    supportsMusicToggle: false,
    supportsAudioExport: false,
    defaultMusicEnabled: true,
    baseRateCents: 8,
    minChargeCents: 79,
    cloneAddonPerSecondCents: 0,
  },
  voice_only: {
    engineId: 'audio-voice-only',
    billingProductKey: 'audio-voice-only',
    label: 'Voice Over Only',
    description: 'Cinematic-grade narration or dialogue as a standalone audio file.',
    includesVoice: true,
    audioOnly: true,
    requiresVideo: false,
    requiresMood: false,
    requiresScript: true,
    supportsMusicToggle: false,
    supportsAudioExport: false,
    defaultMusicEnabled: false,
    baseRateCents: 10,
    minChargeCents: 99,
    cloneAddonPerSecondCents: 8,
  },
  cinematic: {
    engineId: 'audio-cinematic',
    billingProductKey: 'audio-cinematic',
    label: 'Cinematic Audio',
    description: 'Synced sound design, ambient layers, and a cinematic music bed.',
    includesVoice: false,
    audioOnly: false,
    requiresVideo: true,
    requiresMood: true,
    requiresScript: false,
    supportsMusicToggle: true,
    supportsAudioExport: true,
    defaultMusicEnabled: true,
    baseRateCents: 12,
    minChargeCents: 99,
    cloneAddonPerSecondCents: 0,
  },
  cinematic_voice: {
    engineId: 'audio-cinematic-voice',
    billingProductKey: 'audio-cinematic-voice',
    label: 'Cinematic + Voice',
    description: 'Cinematic sound design and music, plus narration or dialogue.',
    includesVoice: true,
    audioOnly: false,
    requiresVideo: true,
    requiresMood: true,
    requiresScript: true,
    supportsMusicToggle: true,
    supportsAudioExport: true,
    defaultMusicEnabled: true,
    baseRateCents: 18,
    minChargeCents: 149,
    cloneAddonPerSecondCents: 8,
  },
};

export type AudioGenerateRequestBody = {
  sourceVideoUrl?: string;
  sourceJobId?: string;
  pack?: string;
  mood?: string;
  intensity?: string;
  script?: string;
  voiceSampleUrl?: string;
  voiceGender?: string;
  voiceProfile?: string;
  voiceDelivery?: string;
  language?: string;
  durationSec?: number;
  musicEnabled?: boolean;
  exportAudioFile?: boolean;
  locale?: string;
};

export type AudioGenerateResponse = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
  audioUrl?: string | null;
  thumbUrl: string | null;
  outputKind: AudioOutputKind;
  status: 'pending' | 'completed' | 'failed';
  progress: number;
  pricing: PricingSnapshot;
  paymentStatus: string;
  sourceJobId?: string | null;
};

export function getAudioPackConfig(pack: AudioPackId): AudioPackConfig {
  return AUDIO_PACK_CONFIG[pack];
}

export function coerceAudioPackId(value: unknown): AudioPackId | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_PACK_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioMood(value: unknown): AudioMood | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_MOOD_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioIntensity(value: unknown): AudioIntensity | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_INTENSITY_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioVoiceMode(value: unknown): AudioVoiceMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_VOICE_MODE_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioVoiceProfile(value: unknown): AudioVoiceProfile | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_VOICE_PROFILE_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioVoiceGender(value: unknown): AudioVoiceGender | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_VOICE_GENDER_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioVoiceDelivery(value: unknown): AudioVoiceDelivery | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_VOICE_DELIVERY_VALUES.find((entry) => entry === normalized) ?? null;
}

export function coerceAudioLanguage(value: unknown): AudioLanguage | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_LANGUAGE_VALUES.find((entry) => entry === normalized) ?? null;
}

export function resolveAudioVoiceMode(input: { pack: AudioPackId; voiceSampleUrl?: string | null }): AudioVoiceMode | null {
  if (!getAudioPackConfig(input.pack).includesVoice) return null;
  return input.voiceSampleUrl ? 'clone' : 'standard';
}

export function resolveAudioOutputKind(input: {
  pack: AudioPackId;
  exportAudioFile?: boolean | null;
}): AudioOutputKind {
  const config = getAudioPackConfig(input.pack);
  if (config.audioOnly) return 'audio';
  return input.exportAudioFile ? 'both' : 'video';
}

export function estimateVoiceScriptDurationSec(script: string): number {
  const words = script
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (!words) return AUDIO_MIN_DURATION_SEC;
  const estimatedSeconds = Math.round((words / AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE) * 60);
  return clampAudioDuration(estimatedSeconds);
}

export function buildAudioPricingSnapshot(input: {
  pack: AudioPackId;
  durationSec: number;
  voiceMode?: AudioVoiceMode | null;
  mood?: AudioMood | null;
}): PricingSnapshot {
  const config = getAudioPackConfig(input.pack);
  const durationSec = clampAudioDuration(input.durationSec);
  const baseAmountCents = durationSec * config.baseRateCents;
  const voiceMode = input.voiceMode ?? null;
  const cloneAddonCents =
    voiceMode === 'clone' && config.cloneAddonPerSecondCents > 0 ? durationSec * config.cloneAddonPerSecondCents : 0;
  const subtotalBeforeMinCharge = baseAmountCents + cloneAddonCents;
  const totalCents = Math.max(config.minChargeCents, subtotalBeforeMinCharge);

  return {
    currency: 'USD',
    totalCents,
    subtotalBeforeDiscountCents: totalCents,
    base: {
      seconds: durationSec,
      rate: config.baseRateCents,
      unit: 'sec',
      amountCents: baseAmountCents,
    },
    addons: cloneAddonCents
      ? [
          {
            type: 'voice_clone',
            amountCents: cloneAddonCents,
          },
        ]
      : [],
    margin: {
      amountCents: Math.max(0, totalCents - subtotalBeforeMinCharge),
    },
    membershipTier: 'member',
    meta: {
      surface: AUDIO_SURFACE,
      pack: input.pack,
      mood: input.mood ?? null,
      voiceMode,
    },
  };
}

export function clampAudioDuration(durationSec: number): number {
  if (!Number.isFinite(durationSec)) return AUDIO_MIN_DURATION_SEC;
  return Math.min(AUDIO_MAX_DURATION_SEC, Math.max(AUDIO_MIN_DURATION_SEC, Math.round(durationSec)));
}
