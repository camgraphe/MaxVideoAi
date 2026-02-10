import type { EngineCaps, Mode } from '@/types/engines';

const FIRST_LAST_ENGINE_ID = 'veo-3-1-first-last';
const KLING_ENGINE_ID = 'kling-2-5-turbo';
const AUDIO_ADDON_KEYS = ['audio_off', 'audio'] as const;
const VOICE_CONTROL_KEY = 'voice_control';

const FAST_FIRST_LAST_PRICING_DETAILS: EngineCaps['pricingDetails'] = {
  currency: 'USD',
  perSecondCents: {
    default: 15,
  },
  addons: {
    audio_off: {
      perSecondCents: -5,
    },
  },
};

const FAST_FIRST_LAST_PRICING: EngineCaps['pricing'] = {
  unit: 'USD/s',
  base: 0.15,
  currency: 'USD',
  notes: '$0.15/s with audio, $0.10/s audio off',
};

const KLING_STANDARD_PRICING_DETAILS: EngineCaps['pricingDetails'] = {
  currency: 'USD',
  perSecondCents: {
    default: 4.2,
  },
};

const KLING_STANDARD_PRICING: EngineCaps['pricing'] = {
  unit: 'USD/s',
  base: 0.042,
  currency: 'USD',
  notes: '$0.21 per 5s clip (Standard image mode)',
};

export function applyEngineVariantPricing(engine: EngineCaps, mode?: Mode): EngineCaps {
  if (engine.id === KLING_ENGINE_ID && mode === 'i2i') {
    return {
      ...engine,
      pricingDetails: KLING_STANDARD_PRICING_DETAILS,
      pricing: KLING_STANDARD_PRICING,
    };
  }
  if (engine.id !== FIRST_LAST_ENGINE_ID) return engine;
  if (mode !== 'i2i') return engine;
  return {
    ...engine,
    pricingDetails: FAST_FIRST_LAST_PRICING_DETAILS,
    pricing: FAST_FIRST_LAST_PRICING,
  };
}

export function resolveAudioAddonKey(engine: EngineCaps): string | null {
  const addons = engine.pricingDetails?.addons ?? engine.pricing?.addons;
  if (!addons) return null;
  for (const key of AUDIO_ADDON_KEYS) {
    if (key in addons) {
      return key;
    }
  }
  return null;
}

export function buildAudioAddonInput(
  engine: EngineCaps,
  audioEnabled: boolean | null | undefined
): Record<string, boolean> | undefined {
  return buildEngineAddonInput(engine, { audioEnabled });
}

export function supportsAudioPricingToggle(engine: EngineCaps): boolean {
  return Boolean(resolveAudioAddonKey(engine));
}

export function buildEngineAddonInput(
  engine: EngineCaps,
  options: {
    audioEnabled?: boolean | null;
    voiceControl?: boolean | null;
  } = {}
): Record<string, boolean> | undefined {
  const addons: Record<string, boolean> = {};
  const key = resolveAudioAddonKey(engine);
  const audioEnabled = options.audioEnabled;
  if (key && typeof audioEnabled === 'boolean') {
    if (key === 'audio_off') {
      if (!audioEnabled) {
        addons.audio_off = true;
      }
    } else if (key === 'audio') {
      if (audioEnabled) {
        addons.audio = true;
      }
    }
  }

  if (options.voiceControl && engine.pricingDetails?.addons && VOICE_CONTROL_KEY in engine.pricingDetails.addons) {
    addons[VOICE_CONTROL_KEY] = true;
  }

  return Object.keys(addons).length ? addons : undefined;
}
