import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import { formatPricePerUnit } from '@/lib/pricing-unit-display';

import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';
import { buildCurrentOtherPricing, type CurrentOtherPricingDependencies } from './current-other-pricing';
import { buildPopularChecks, buildPricingHubData, buildVideoHighlights,
  DEFAULT_VIDEO_PRICE_PRESET_ID, getExactVideoPresetInput, getImagePricePresetInput, markCheapestQuotes,
  orderPricingRows, VIDEO_PRICE_PRESETS, type PricingHubData, type PresetQuote,
  type VideoPricePresetId, type VideoPricingRow } from './pricingHubData';

/** Keep server-rendered Pricing amounts on the same database-aware quote as a new charge. */
export async function buildCurrentPricingHubData(
  locale: AppLocale,
  quote: (input: PublicModelQuoteInput) => Promise<PublicModelQuote> = quotePublicModelScenario,
  otherDependencies?: CurrentOtherPricingDependencies,
): Promise<PricingHubData> {
  const base = buildPricingHubData(locale);
  const entries = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  const copy = getPricingHubCopy(locale);
  const rows: VideoPricingRow[] = base.video.rows.map((row) => ({ ...row,
    quotes: Object.fromEntries(VIDEO_PRICE_PRESETS.map((preset) => [preset.id,
      { ...row.quotes[preset.id], isCheapest: false }])) as Record<VideoPricePresetId, PresetQuote> }));
  const tasks: Array<() => Promise<void>> = [];
  const quoteGroups = new Map<string, { input: PublicModelQuoteInput; apply: Array<(result: PublicModelQuote) => void> }>();
  const addQuote = (input: PublicModelQuoteInput, apply: (result: PublicModelQuote) => void) => {
    const key = JSON.stringify(input);
    const existing = quoteGroups.get(key);
    if (existing) {
      existing.apply.push(apply);
      return;
    }
    const group = { input, apply: [apply] };
    quoteGroups.set(key, group);
    tasks.push(async () => {
      const result = await quote(group.input);
      group.apply.forEach((project) => project(result));
    });
  };
  for (const row of rows) {
    const entry = entries.get(row.id);
    if (!entry) continue;
    for (const preset of VIDEO_PRICE_PRESETS) {
      const old = row.quotes[preset.id];
      if (old.status !== 'exact') continue;
      const input = getExactVideoPresetInput(entry, preset, locale);
      const apply = (result: PublicModelQuote) => {
        row.quotes[preset.id] = result.status === 'exact'
          ? { ...old, amountCents: result.amountCents,
              display: formatCurrencyForLocale(locale, result.currency, result.amountCents / 100),
              rateDisplay: copy.quote.perSecond(formatPricePerUnit(locale, result.currency,
                result.amountCents / input!.durationSec / 100)),
              sortValue: result.amountCents, isCheapest: false }
          : { status: 'live_quote', display: copy.liveQuote, note: old.note,
              sortValue: Number.POSITIVE_INFINITY };
      };
      if (input) addQuote(input, apply);
      else apply({ status: 'unavailable' });
    }
  }
  const imageRows = base.otherSurfaces.imageRows.map((row) => ({ ...row }));
  for (const row of imageRows) {
    const entry = entries.get(row.id);
    if (!entry) continue;
    for (const [highQuality, field] of [[false, 'standardImage'], [true, 'highQualityImage']] as const) {
      addQuote(getImagePricePresetInput(entry, highQuality), (result) => {
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
  const otherSurfaces = await buildCurrentOtherPricing({ ...base.otherSurfaces, imageRows }, locale, otherDependencies);
  return { ...base,
    video: { ...base.video, rows: currentRows, highlights: buildVideoHighlights(currentRows, locale) },
    popularChecks: buildPopularChecks(locale, currentRows, imageRows,
      otherSurfaces.audioRows, otherSurfaces.toolRows),
    otherSurfaces };
}
