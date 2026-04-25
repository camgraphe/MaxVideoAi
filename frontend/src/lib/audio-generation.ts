import type { PricingSnapshot } from '@maxvideoai/pricing';

export const AUDIO_SURFACE = 'audio' as const;
export const AUDIO_MIN_DURATION_SEC = 3;
export const AUDIO_MAX_DURATION_SEC = 190;
export const AUDIO_PROMPT_MAX_LENGTH = 2000;
export const AUDIO_SCRIPT_MAX_LENGTH = 5000;
export const AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE = 150;
export const AUDIO_MUSIC_DURATION_OPTIONS_SEC = [3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 190] as const;
export const AUDIO_PRICING_MARGIN_PERCENT = 0.6;
export const AUDIO_TTS_CHARS_PER_BILLING_UNIT = 1000;
export const AUDIO_LONG_MUSIC_BILLING_BLOCK_SEC = 30;

const AUDIO_PRICE_MINIMAX_MUSIC_2_6_CENTS_PER_AUDIO = 15;
const AUDIO_PRICE_STABLE_AUDIO_25_CENTS_PER_AUDIO = 20;
const AUDIO_PRICE_MIRELO_SFX_CENTS_PER_SECOND = 1;
const AUDIO_PRICE_GEMINI_TTS_CENTS_PER_1000_CHARS = 15;
const AUDIO_PRICE_MINIMAX_VOICE_CLONE_CENTS_PER_REQUEST = 150;
const AUDIO_PRICE_MINIMAX_VOICE_CLONE_PREVIEW_CENTS_PER_1000_CHARS = 30;

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
  },
};

export type AudioGenerateRequestBody = {
  sourceVideoUrl?: string;
  sourceJobId?: string;
  pack?: string;
  prompt?: string;
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
  return normalizeAudioDuration(estimatedSeconds);
}

function computeRoundedUpMarginCents(baseCents: number): number {
  const normalizedBase = Number.isFinite(baseCents) ? Math.max(0, Math.round(baseCents)) : 0;
  if (normalizedBase <= 0) return 0;
  return Math.max(1, Math.ceil(normalizedBase * AUDIO_PRICING_MARGIN_PERCENT - 1e-9));
}

function countAudioBillingCharacters(script?: string | null, fallbackDurationSec?: number | null): number {
  const characterCount = script?.trim().length ?? 0;
  if (characterCount > 0) return characterCount;
  if (typeof fallbackDurationSec === 'number' && Number.isFinite(fallbackDurationSec) && fallbackDurationSec > 0) {
    return Math.max(1, Math.round((fallbackDurationSec / 60) * AUDIO_VOICE_ESTIMATE_WORDS_PER_MINUTE * 6));
  }
  return 1;
}

function countCharacterBillingUnits(script?: string | null, fallbackDurationSec?: number | null): number {
  return Math.max(1, Math.ceil(countAudioBillingCharacters(script, fallbackDurationSec) / AUDIO_TTS_CHARS_PER_BILLING_UNIT));
}

function buildMusicVendorCostComponent(durationSec: number) {
  if (durationSec <= 20) {
    return {
      type: 'music_minimax_music_2_6',
      label: 'MiniMax Music 2.6',
      model: 'fal-ai/minimax-music/v2.6',
      unit: 'audio',
      amountCents: AUDIO_PRICE_MINIMAX_MUSIC_2_6_CENTS_PER_AUDIO,
    };
  }
  const billingBlocks = Math.max(1, Math.ceil(durationSec / AUDIO_LONG_MUSIC_BILLING_BLOCK_SEC));
  return {
    type: 'music_stable_audio_25',
    label: 'Stable Audio 2.5',
    model: 'fal-ai/stable-audio-25/text-to-audio',
    unit: '30_sec_block',
    units: billingBlocks,
    amountCents: billingBlocks * AUDIO_PRICE_STABLE_AUDIO_25_CENTS_PER_AUDIO,
  };
}

function buildAudioVendorCostComponents(input: {
  pack: AudioPackId;
  durationSec: number;
  voiceMode?: AudioVoiceMode | null;
  script?: string | null;
  musicEnabled?: boolean | null;
}) {
  const config = getAudioPackConfig(input.pack);
  const durationSec = normalizeAudioDuration(input.durationSec);
  const components: Array<{
    type: string;
    label: string;
    model: string;
    unit: string;
    units?: number;
    amountCents: number;
  }> = [];

  if (input.pack === 'cinematic' || input.pack === 'cinematic_voice') {
    components.push({
      type: 'sound_design_mirelo_sfx_v1_5',
      label: 'Mirelo SFX V1.5',
      model: 'mirelo-ai/sfx-v1.5/video-to-audio',
      unit: 'sec',
      units: durationSec,
      amountCents: durationSec * AUDIO_PRICE_MIRELO_SFX_CENTS_PER_SECOND,
    });
  }

  const shouldPriceMusic =
    input.pack === 'music_only' ||
    ((input.pack === 'cinematic' || input.pack === 'cinematic_voice') && (input.musicEnabled ?? config.defaultMusicEnabled));
  if (shouldPriceMusic) {
    components.push(buildMusicVendorCostComponent(durationSec));
  }

  if (config.includesVoice) {
    const characterUnits = countCharacterBillingUnits(input.script, durationSec);
    if (input.voiceMode === 'clone') {
      components.push({
        type: 'voice_clone_minimax',
        label: 'MiniMax Voice Clone',
        model: 'fal-ai/minimax/voice-clone',
        unit: 'request',
        units: 1,
        amountCents: AUDIO_PRICE_MINIMAX_VOICE_CLONE_CENTS_PER_REQUEST,
      });
      components.push({
        type: 'voice_clone_preview_minimax',
        label: 'MiniMax Voice Clone preview',
        model: 'fal-ai/minimax/voice-clone',
        unit: '1000_chars',
        units: characterUnits,
        amountCents: characterUnits * AUDIO_PRICE_MINIMAX_VOICE_CLONE_PREVIEW_CENTS_PER_1000_CHARS,
      });
    } else {
      components.push({
        type: 'tts_gemini_3_1_flash',
        label: 'Gemini 3.1 Flash TTS',
        model: 'fal-ai/gemini-3.1-flash-tts',
        unit: '1000_chars',
        units: characterUnits,
        amountCents: characterUnits * AUDIO_PRICE_GEMINI_TTS_CENTS_PER_1000_CHARS,
      });
    }
  }

  return components.length ? components : [buildMusicVendorCostComponent(durationSec)];
}

export function buildAudioPricingSnapshot(input: {
  pack: AudioPackId;
  durationSec: number;
  voiceMode?: AudioVoiceMode | null;
  mood?: AudioMood | null;
  script?: string | null;
  musicEnabled?: boolean | null;
}): PricingSnapshot {
  const durationSec = normalizeAudioDuration(input.durationSec);
  const voiceMode = input.voiceMode ?? null;
  const vendorCostComponents = buildAudioVendorCostComponents({
    pack: input.pack,
    durationSec,
    voiceMode,
    script: input.script,
    musicEnabled: input.musicEnabled,
  });
  const baseComponent = vendorCostComponents[0]!;
  const addonComponents = vendorCostComponents.slice(1);
  const vendorSubtotalCents = vendorCostComponents.reduce((sum, component) => sum + component.amountCents, 0);
  const marginAmountCents = computeRoundedUpMarginCents(vendorSubtotalCents);
  const totalCents = vendorSubtotalCents + marginAmountCents;
  const rate = durationSec > 0 ? Number((vendorSubtotalCents / 100 / durationSec).toFixed(4)) : vendorSubtotalCents / 100;

  return {
    currency: 'USD',
    totalCents,
    subtotalBeforeDiscountCents: totalCents,
    base: {
      seconds: durationSec,
      rate,
      unit: baseComponent.unit,
      amountCents: baseComponent.amountCents,
    },
    addons: addonComponents.map((component) => ({
      type: component.type,
      amountCents: component.amountCents,
    })),
    margin: {
      amountCents: marginAmountCents,
      percentApplied: AUDIO_PRICING_MARGIN_PERCENT,
      flatCents: 0,
    },
    membershipTier: 'member',
    platformFeeCents: marginAmountCents,
    vendorShareCents: vendorSubtotalCents,
    meta: {
      surface: AUDIO_SURFACE,
      pack: input.pack,
      mood: input.mood ?? null,
      voiceMode,
      pricingModel: 'audio_provider_cost_plus_margin',
      vendorCostCents: vendorSubtotalCents,
      marginPercent: AUDIO_PRICING_MARGIN_PERCENT,
      musicEnabled: input.musicEnabled ?? null,
      scriptBillingCharacters: getAudioPackConfig(input.pack).includesVoice
        ? countAudioBillingCharacters(input.script, durationSec)
        : undefined,
      vendorCostComponents,
    },
  };
}

export function clampAudioDuration(durationSec: number): number {
  return Math.min(AUDIO_MAX_DURATION_SEC, normalizeAudioDuration(durationSec));
}

export function normalizeAudioDuration(durationSec: number): number {
  if (!Number.isFinite(durationSec)) return AUDIO_MIN_DURATION_SEC;
  return Math.max(AUDIO_MIN_DURATION_SEC, Math.round(durationSec));
}

export function formatAudioDurationLabel(durationSec: number): string {
  const seconds = normalizeAudioDuration(durationSec);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m${remainder.toString().padStart(2, '0')}s` : `${minutes}m`;
}
