import type { FalEngineEntry } from '@/config/falEngines';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import type { EngineCaps } from '@/types/engines';

import { resolveModelOfferScenario, type ModelPublicOffer } from './model-page-schema';

/** One exact current amount feeds both the visible offer and Product JSON-LD. */
export async function resolveCurrentModelPublicOffer(
  engine: FalEngineEntry,
  pricingEngine: EngineCaps,
  quote: (input: PublicModelQuoteInput) => Promise<PublicModelQuote> = quotePublicModelScenario,
): Promise<ModelPublicOffer | null> {
  if (!engine.surfaces.app.enabled) return null;
  const scenario = resolveModelOfferScenario(engine, pricingEngine);
  if (!scenario) return null;
  const current = await quote({
    modelId: engine.id,
    mode: scenario.mode,
    durationSec: scenario.durationSeconds,
    resolution: scenario.resolution,
    audio: scenario.audio,
    ...(scenario.quality ? { quality: scenario.quality } : {}),
    ...(scenario.aspectRatio ? { aspectRatio: scenario.aspectRatio } : {}),
    quantity: scenario.quantity,
  });
  return current.status === 'exact'
    ? { amountCents: current.amountCents, currency: current.currency, scenario }
    : null;
}
