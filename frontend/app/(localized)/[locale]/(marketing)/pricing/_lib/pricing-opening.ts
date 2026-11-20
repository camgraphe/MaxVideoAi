import type { AppLocale } from '@/i18n/locales';
import { getFalEngineById } from '@/config/falEngines';
import type { PublicModelQuoteInput, PublicModelQuote } from '@/lib/pricing-public-model-contract';
import { PRICING_COMPARISON_MODELS, PRICING_COMPARISON_PRESETS } from '@/lib/video/pricing-presets';
import { getReadOnlyConfiguredEnginesByCategory } from '@/server/agent-api/read-only-engine-catalog';
import { createScopedPublicModelQuoter } from '@/server/pricing/quote-public-model-scenario';
import { buildCurrentPricingHubData } from './currentPricingHubData';
import { VIDEO_PRICE_PRESETS, getExactVideoPresetInput } from './pricingHubData';
import { formatCurrencyForLocale } from './pricingPageContent';

export type OpeningRow = {
  id: string;
  name: string;
  prices: Array<{ display: string; href: string; amountCents: number; currency: string } | null>;
};

/** The four opening cells and the full catalogue use one availability read and one pricing policy. */
export async function readPricingOpening(locale: AppLocale) {
  const catalogue = getReadOnlyConfiguredEnginesByCategory('all');
  const quotedOn = new Date().toISOString().slice(0, 10);
  // A failed catalogue read still allows the public header and navigation to render.
  const configured = await catalogue.catch(() => null);
  if (!configured) {
    return { rows: [], filmPrice: null, quotedOn, pricingHub: buildCurrentPricingHubData(locale, undefined, undefined, () => catalogue) };
  }
  const quote = createScopedPublicModelQuoter();
  const openingQuotes = new Map<string, Promise<PublicModelQuote>>();
  // The published Night Run example is a 15-second text-to-video render with native audio.
  const filmQuote = configured.some(engine => engine.id === 'kling-3-standard')
    ? quote({ modelId: 'kling-3-standard', mode: 't2v', durationSec: 15, resolution: '1080p', aspectRatio: '16:9', audio: true })
    : Promise.resolve(null);
  const comparisonRows = Promise.all(PRICING_COMPARISON_MODELS.map(async (id): Promise<OpeningRow | null> => {
    const entry = getFalEngineById(id);
    const engine = configured.find(candidate => candidate.id === id);
    if (!entry || !engine) return null;
    const prices = await Promise.all(PRICING_COMPARISON_PRESETS.map(async presetId => {
      const preset = VIDEO_PRICE_PRESETS.find(candidate => candidate.id === presetId)!;
      const input = getExactVideoPresetInput({ ...entry, engine }, preset, locale);
      if (!input || input.mode !== 't2v' || input.audio !== preset.audio) return null;
      const pending = quote(input);
      openingQuotes.set(JSON.stringify(input), pending);
      const result = await pending;
      if (result.status !== 'exact') return null;
      const params = new URLSearchParams({ engine: id, mode: input.mode, pricingPreset: presetId, lang: locale });
      return { amountCents: result.amountCents, currency: result.currency, display: formatCurrencyForLocale(locale, result.currency, result.amountCents / 100), href: `/app?${params}` };
    }));
    return prices.some(Boolean) ? { id, name: entry.marketingName || engine.label, prices } : null;
  }));
  const [rows, film] = await Promise.all([comparisonRows, filmQuote]);
  const reuseOpeningQuote = (input: PublicModelQuoteInput) => openingQuotes.get(JSON.stringify(input)) ?? quote(input);
  return {
    rows: rows.filter((row): row is OpeningRow => row !== null),
    quotedOn,
    filmPrice: film?.status === 'exact' ? formatCurrencyForLocale(locale, film.currency, film.amountCents / 100) : null,
    pricingHub: buildCurrentPricingHubData(locale, reuseOpeningQuote, undefined, async () => configured),
  };
}
