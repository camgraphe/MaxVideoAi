import type { PricingSnapshot } from '@maxvideoai/pricing';

export const AUDIO_SURFACE = 'audio' as const;
export const AUDIO_MIN_DURATION_SEC = 3;
export const AUDIO_MAX_DURATION_SEC = 20;

export const AUDIO_PACK_VALUES = ['cinematic', 'cinematic_voice'] as const;
export type AudioPackId = (typeof AUDIO_PACK_VALUES)[number];

export const AUDIO_MOOD_VALUES = ['epic', 'tense', 'intimate', 'dark', 'dreamy', 'sci-fi', 'documentary'] as const;
export type AudioMood = (typeof AUDIO_MOOD_VALUES)[number];

export const AUDIO_VOICE_MODE_VALUES = ['standard', 'clone'] as const;
export type AudioVoiceMode = (typeof AUDIO_VOICE_MODE_VALUES)[number];

type AudioPackConfig = {
  engineId: string;
  billingProductKey: string;
  label: string;
  description: string;
  includesVoice: boolean;
  baseRateCents: number;
  minChargeCents: number;
  cloneAddonPerSecondCents: number;
};

const AUDIO_PACK_CONFIG: Record<AudioPackId, AudioPackConfig> = {
  cinematic: {
    engineId: 'audio-cinematic',
    billingProductKey: 'audio-cinematic',
    label: 'Cinematic Audio',
    description: 'Synced sound design, ambient layers, and a cinematic music bed.',
    includesVoice: false,
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
  script?: string;
  voiceSampleUrl?: string;
  locale?: string;
};

export type AudioGenerateResponse = {
  ok: true;
  jobId: string;
  videoUrl: string | null;
  thumbUrl: string | null;
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

export function coerceAudioVoiceMode(value: unknown): AudioVoiceMode | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIO_VOICE_MODE_VALUES.find((entry) => entry === normalized) ?? null;
}

export function resolveAudioVoiceMode(input: { pack: AudioPackId; voiceSampleUrl?: string | null }): AudioVoiceMode | null {
  if (input.pack !== 'cinematic_voice') return null;
  return input.voiceSampleUrl ? 'clone' : 'standard';
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

