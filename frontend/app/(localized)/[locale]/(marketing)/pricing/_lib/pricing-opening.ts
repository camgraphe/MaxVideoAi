import { getFalEngineById } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { buildExampleRecreationHref } from '@/lib/example-recreation';
import { getReadOnlyConfiguredEnginesByCategory } from '@/server/agent-api/read-only-engine-catalog';
import { createScopedPublicModelQuoter } from '@/server/pricing/quote-public-model-scenario';
import { buildCurrentPricingHubData } from './currentPricingHubData';
import { formatCurrencyForLocale } from './pricingPageContent';

const featuredModels = ['seedance-2-0-mini', 'kling-v4', 'seedance-2-5'] as const;
export const canyonVideoId = '71a6ecd6-2daf-490a-90e7-774a714e9cb3';
const settings = { durationSec: 5, resolution: '720p', aspectRatio: '16:9', audio: true, mode: 't2v' } as const;

export type OpeningRow = { id: string; anchor: string; name: string; price: string | null; href: string };

export async function readPricingOpening(locale: AppLocale) {
  const catalogue = getReadOnlyConfiguredEnginesByCategory('all');
  const quotedOn = new Date().toISOString().slice(0, 10);
  const configured = await catalogue.catch(() => null);
  const quote = createScopedPublicModelQuoter();
  const rows = await Promise.all(featuredModels.map(async (id): Promise<OpeningRow | null> => {
    const entry = getFalEngineById(id);
    if (!entry || !configured?.some(engine => engine.id === id)) return null;
    const result = await quote({ modelId: id, ...settings });
    return {
      id, anchor: entry.modelSlug + '-pricing', name: entry.marketingName || entry.engine.label,
      price: result.status === 'exact' ? formatCurrencyForLocale(locale, result.currency, result.amountCents / 100) : null,
      href: buildExampleRecreationHref(canyonVideoId, id, settings) + '&lang=' + locale,
    };
  }));
  return {
    rows: rows.filter((row): row is OpeningRow => row !== null),
    quotedOn,
    pricingHub: buildCurrentPricingHubData(locale, quote, undefined, () => catalogue),
  };
}
