import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';

import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';
import { buildPopularChecks, buildPricingHubData, buildVideoHighlights,
  DEFAULT_VIDEO_PRICE_PRESET_ID, getExactVideoPresetInput, getImagePricePresetInput, markCheapestQuotes,
  orderPricingRows, VIDEO_PRICE_PRESETS, type PricingHubData, type PresetQuote,
  type VideoPricePresetId, type VideoPricingRow } from './pricingHubData';

/** Keep server-rendered Pricing amounts on the same database-aware quote as a new charge. */
export async function buildCurrentPricingHubData(
  locale: AppLocale,
  quote: (input: PublicModelQuoteInput) => Promise<PublicModelQuote> = quotePublicModelScenario,
): Promise<PricingHubData> {
  const base = buildPricingHubData(locale);
  const entries = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  const copy = getPricingHubCopy(locale);
  const rows: VideoPricingRow[] = base.video.rows.map((row) => ({ ...row,
    quotes: Object.fromEntries(VIDEO_PRICE_PRESETS.map((preset) => [preset.id,
      { ...row.quotes[preset.id], isCheapest: false }])) as Record<VideoPricePresetId, PresetQuote> }));
  const tasks: Array<() => Promise<void>> = [];
  for (const row of rows) {
    const entry = entries.get(row.id);
    if (!entry) continue;
    for (const preset of VIDEO_PRICE_PRESETS) {
      const old = row.quotes[preset.id];
      if (old.status !== 'exact') continue;
      const input = getExactVideoPresetInput(entry, preset, locale);
      tasks.push(async () => {
        const result = input ? await quote(input) : { status: 'unavailable' as const };
        row.quotes[preset.id] = result.status === 'exact'
          ? { ...old, amountCents: result.amountCents,
              display: formatCurrencyForLocale(locale, result.currency, result.amountCents / 100),
              rateDisplay: copy.quote.perSecond(formatCurrencyForLocale(locale, result.currency,
                result.amountCents / input!.durationSec / 100)),
              sortValue: result.amountCents, isCheapest: false }
          : { status: 'live_quote', display: copy.liveQuote, note: old.note,
              sortValue: Number.POSITIVE_INFINITY };
      });
    }
  }
  const imageRows = base.otherSurfaces.imageRows.map((row) => ({ ...row }));
  for (const row of imageRows) {
    const entry = entries.get(row.id);
    if (!entry) continue;
    for (const [highQuality, field] of [[false, 'standardImage'], [true, 'highQualityImage']] as const) {
      tasks.push(async () => {
        const result = await quote(getImagePricePresetInput(entry, highQuality));
        row[field] = result.status === 'exact'
          ? formatCurrencyForLocale(locale, result.currency, result.amountCents / 100)
          : copy.liveQuote;
      });
    }
  }
  let nextTask = 0;
  await Promise.all(Array.from({ length: Math.min(8, tasks.length) }, async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask++];
      if (task) await task();
    }
  }));
  rows.forEach((row, index) => {
    const quotes = row.quotes;
    const defaultQuote = quotes[DEFAULT_VIDEO_PRICE_PRESET_ID];
    const exactRank = defaultQuote.status === 'exact' ? 0 : defaultQuote.status === 'closest' ? 1 : 2;
    const amount = typeof defaultQuote.amountCents === 'number' ? defaultQuote.amountCents : 99_999;
    row.sortValue = (row.pricingGroup === 'legacy' ? 1 : 0) * 1_000_000_000 +
      exactRank * 1_000_000 + amount * 100 + index;
  });
  const currentRows = markCheapestQuotes(orderPricingRows(rows));
  return { ...base,
    video: { ...base.video, rows: currentRows, highlights: buildVideoHighlights(currentRows, locale) },
    popularChecks: buildPopularChecks(locale, currentRows, imageRows,
      base.otherSurfaces.audioRows, base.otherSurfaces.toolRows),
    otherSurfaces: { ...base.otherSurfaces, imageRows } };
}
