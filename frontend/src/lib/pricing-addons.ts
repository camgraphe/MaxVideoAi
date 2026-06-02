import type { EngineCaps, Mode } from '@/types/engines';

const KLING_ENGINE_ID = 'kling-2-5-turbo';
const HAPPY_HORSE_ENGINE_ID = 'happy-horse-1-0';
const KLING_O3_V2V_PRICING: Record<
  string,
  { pricingDetails: EngineCaps['pricingDetails']; pricing: EngineCaps['pricing'] }
> = {
  'kling-o3-standard': {
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        default: 12.6,
        byResolution: {
          '1080p': 12.6,
        },
      },
    },
    pricing: {
      unit: 'USD/s',
      base: 0.126,
      byResolution: {
        '1080p': 0.126,
      },
      currency: 'USD',
      notes: 'Fal video-input rate: $0.126/s for Kling 3.0 Omni Standard V2V.',
    },
  },
  'kling-o3-pro': {
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        default: 16.8,
        byResolution: {
          '1080p': 16.8,
        },
      },
    },
    pricing: {
      unit: 'USD/s',
      base: 0.168,
      byResolution: {
        '1080p': 0.168,
      },
      currency: 'USD',
      notes: 'Fal video-input rate: $0.168/s for Kling 3.0 Omni Pro V2V.',
    },
  },
};
const AUDIO_ADDON_KEYS = ['audio_off', 'audio'] as const;
const VOICE_CONTROL_KEY = 'voice_control';

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

const HAPPY_HORSE_V2V_PRICING_DETAILS: EngineCaps['pricingDetails'] = {
  currency: 'USD',
  perSecondCents: {
    default: 28,
    byResolution: {
      '720p': 28,
      '1080p': 56,
    },
  },
};

const HAPPY_HORSE_V2V_PRICING: EngineCaps['pricing'] = {
  unit: 'USD/s',
  base: 0.28,
  byResolution: {
    '720p': 0.28,
    '1080p': 0.56,
  },
  currency: 'USD',
  notes: 'Fal video-edit rate: $0.28/s for 720p and $0.56/s for 1080p.',
};

export function applyEngineVariantPricing(engine: EngineCaps, mode?: Mode): EngineCaps {
  if (engine.id === KLING_ENGINE_ID && mode === 'i2i') {
    return {
      ...engine,
      pricingDetails: KLING_STANDARD_PRICING_DETAILS,
      pricing: KLING_STANDARD_PRICING,
    };
  }
  if (engine.id === HAPPY_HORSE_ENGINE_ID && mode === 'v2v') {
    return {
      ...engine,
      pricingDetails: HAPPY_HORSE_V2V_PRICING_DETAILS,
      pricing: HAPPY_HORSE_V2V_PRICING,
    };
  }
  if (mode === 'v2v' && KLING_O3_V2V_PRICING[engine.id]) {
    const override = KLING_O3_V2V_PRICING[engine.id];
    return {
      ...engine,
      pricingDetails: override.pricingDetails,
      pricing: override.pricing,
    };
  }
  return engine;
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
