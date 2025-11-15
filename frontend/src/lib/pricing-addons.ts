import type { EngineCaps, Mode } from '@/types/engines';

const FIRST_LAST_ENGINE_ID = 'veo-3-1-first-last';

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

export function applyEngineVariantPricing(engine: EngineCaps, mode?: Mode): EngineCaps {
  if (engine.id !== FIRST_LAST_ENGINE_ID) return engine;
  if (mode !== 'i2i') return engine;
  return {
    ...engine,
    pricingDetails: FAST_FIRST_LAST_PRICING_DETAILS,
    pricing: FAST_FIRST_LAST_PRICING,
  };
}
