import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { EngineCaps } from '@/types/engines';
import type { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import { refreshModelDecisionPricingScenarios } from './current-model-decision-pricing';
import { resolveCurrentModelPublicOffer } from './current-model-public-offer';
import type { ModelDecisionData } from './model-page-decision-data';
import type { buildModelPageSpecProjection } from './model-page-spec-projection';
import type { getModelPageTemplateConfig } from './model-page-template-registry';

export type ModelPagePricing = ReturnType<typeof buildModelPageSpecProjection> & { pricingEngine: EngineCaps };

/** One request's exact scenario results serve visible prices and native Product JSON-LD. */
export function prepareModelCommercialData({ engine, locale, pricing, templateData, templateConfig, quoteModel }: {
  engine: FalEngineEntry; locale: AppLocale; pricing: Promise<ModelPagePricing>;
  templateData: ModelDecisionData | null; templateConfig: ReturnType<typeof getModelPageTemplateConfig>;
  quoteModel: typeof quotePublicModelScenario;
}) {
  const result = pricing.then(async ({ pricingEngine }) => {
    const [scenarios, publicOffer] = await Promise.all([
      templateData && templateConfig
        ? refreshModelDecisionPricingScenarios(engine, locale, templateData.pricing.scenarios, templateConfig.pricing.presets, quoteModel)
        : null,
      resolveCurrentModelPublicOffer(engine, pricingEngine, quoteModel),
    ]);
    return { pricingEngine, scenarios, publicOffer };
  });
  // Server slots can be reached after sibling rendering. Observe rejection now, propagate it when awaited.
  void result.catch(() => undefined);
  return result;
}
export type ModelCommercialData = ReturnType<typeof prepareModelCommercialData>;
