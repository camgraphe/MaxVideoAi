import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';

import { formatCurrencyForLocale } from '../../../pricing/_lib/pricingPageContent';
import { getPricingHubCopy } from '../../../pricing/_lib/pricingHubCopy';
import type { ModelDecisionPricingScenario } from './model-page-decision-pricing';
import { buildModelDecisionData } from './model-page-decision-data';
import { getModelPageTemplateConfig } from './model-page-template-registry';
import type { ModelPagePricingPreset } from './model-page-template-types';

function scenarioInput(entry: FalEngineEntry, preset: ModelPagePricingPreset): PublicModelQuoteInput | null {
  if (typeof preset.fixedValueKey === 'string') return null;
  if (typeof preset.imageResolution === 'string') {
    if ((preset.quantity ?? 1) !== 1) return null;
    return { modelId: entry.id, mode: preset.mode ?? 't2i', durationSec: 1,
      resolution: preset.imageResolution, quantity: 1,
      ...(preset.imageQuality ? { quality: preset.imageQuality } : {}),
      ...(preset.referenceImageCount ? { referenceImageCount: preset.referenceImageCount } : {}) };
  }
  if (typeof preset.seconds === 'number' && typeof preset.resolution === 'string') {
    return { modelId: entry.id, mode: preset.mode ?? 't2v', durationSec: preset.seconds,
      resolution: preset.resolution,
      ...(preset.audio !== undefined ? { audio: preset.audio } : {}),
      ...(preset.referenceImageCount ? { referenceImageCount: preset.referenceImageCount } : {}) };
  }
  return null;
}

function neutralImageNote(locale: AppLocale, quantity: number): string {
  return locale === 'fr' ? `${quantity} images` : locale === 'es' ? `${quantity} imágenes` : `${quantity} images`;
}

/** Only exact current quotes may populate numeric decision cards. */
export async function refreshModelDecisionPricingScenarios(
  entry: FalEngineEntry,
  locale: AppLocale,
  scenarios: ModelDecisionPricingScenario[],
  presets: ModelPagePricingPreset[],
  quote: (input: PublicModelQuoteInput) => Promise<PublicModelQuote> = quotePublicModelScenario,
): Promise<ModelDecisionPricingScenario[]> {
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  return Promise.all(scenarios.map(async (scenario) => {
    const preset = byId.get(scenario.id);
    if (!preset || typeof preset.fixedValueKey === 'string') return scenario;
    const input = scenarioInput(entry, preset);
    const current = input ? await quote(input) : { status: 'unavailable' as const };
    const note = /(?:\$\s*\d|\d[.,]\d{2}\s*\$)/.test(scenario.note) &&
      typeof preset.imageResolution === 'string'
      ? neutralImageNote(locale, preset.quantity ?? 1) : scenario.note;
    return { ...scenario, note, value: current.status === 'exact'
      ? formatCurrencyForLocale(locale, current.currency, current.amountCents / 100)
      : getPricingHubCopy(locale).liveQuote };
  }));
}

export async function buildCurrentModelDecisionData(
  entry: FalEngineEntry, locale: AppLocale, decisionContent: unknown,
) {
  const data = buildModelDecisionData({ engine: entry, locale, decisionContent });
  const config = data ? getModelPageTemplateConfig(entry.modelSlug) : null;
  return { config, data: data && config
    ? { ...data, pricing: { ...data.pricing,
      scenarios: await refreshModelDecisionPricingScenarios(entry, locale,
        data.pricing.scenarios, config.pricing.presets) } }
    : data };
}
