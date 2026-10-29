import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { createScopedPublicModelQuoter } from '@/server/pricing/quote-public-model-scenario';
import { formatPricePerUnit } from '@/lib/pricing-unit-display';
import type { EngineCaps } from '@/types/engines';
import { getReadOnlyConfiguredEnginesByCategory } from '@/server/agent-api/read-only-engine-catalog';

import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';
import { buildCurrentOtherPricing, type CurrentOtherPricingDependencies } from './current-other-pricing';
import { buildPopularChecks, buildPricingHubData, buildVideoHighlights, buildVideoPricingRowsFromEntries,
  DEFAULT_VIDEO_PRICE_PRESET_ID, getExactVideoPresetInput, getImagePricePresetInput, markCheapestQuotes,
  orderPricingRows, VIDEO_PRICE_PRESETS, type PricingHubData, type PresetQuote,
  type VideoPricePresetId, type VideoPricingRow } from './pricingHubData';

type ModelQuoter = (input: PublicModelQuoteInput) => Promise<PublicModelQuote>;
type CatalogReader = () => Promise<readonly EngineCaps[]>;
export type CurrentVideoPricingData = Pick<PricingHubData, 'video'>;

/** Keep server-rendered Pricing amounts on the same database-aware quote as a new charge. */
export function buildCurrentPricingHubData(
  locale: AppLocale, quote?: ModelQuoter, otherDependencies?: CurrentOtherPricingDependencies,
  catalog?: CatalogReader,
): Promise<PricingHubData> {
  return buildCurrentPricingData('all', locale, quote, otherDependencies, catalog);
}

/** PAYG consumes only video quotes; never wait for unused image, audio or tool prices. */
export function buildCurrentVideoPricingData(locale: AppLocale, quote?: ModelQuoter, catalog?: CatalogReader): Promise<CurrentVideoPricingData> {
  return buildCurrentPricingData('video', locale, quote, undefined, catalog);
}

function buildCurrentPricingData(scope: 'all', locale: AppLocale, quote?: ModelQuoter, otherDependencies?: CurrentOtherPricingDependencies, catalog?: CatalogReader): Promise<PricingHubData>;
function buildCurrentPricingData(scope: 'video', locale: AppLocale, quote?: ModelQuoter, otherDependencies?: undefined, catalog?: CatalogReader): Promise<CurrentVideoPricingData>;
async function buildCurrentPricingData(
  scope: 'all' | 'video', locale: AppLocale, quote?: ModelQuoter, otherDependencies?: CurrentOtherPricingDependencies,
  catalog?: CatalogReader,
): Promise<PricingHubData | CurrentVideoPricingData> {
  // Read once per render. A failed availability read must not revive disabled models.
  const configured = new Map((await (catalog ? catalog() : getReadOnlyConfiguredEnginesByCategory(scope)))
    .map((engine) => [engine.id, engine]));
  const quoteModel = quote ?? createScopedPublicModelQuoter();
  const base = buildPricingHubData(locale);
  const entries = new Map(listFalEngines().filter((entry) => configured.has(entry.id))
    .map((entry) => [entry.id, { ...entry, engine: configured.get(entry.id)! }]));
  const copy = getPricingHubCopy(locale);
  const rows: VideoPricingRow[] = buildVideoPricingRowsFromEntries([...entries.values()], locale).map((row) => ({ ...row,
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
      const result = await quoteModel(group.input);
      group.apply.forEach((project) => project(result));
    });
  };
  for (const row of rows) {
    const entry = entries.get(row.id);
    if (!entry) continue;
    for (const preset of VIDEO_PRICE_PRESETS) {
      const old = row.quotes[preset.id];
      if (old.status !== 'exact' && old.status !== 'live_quote') continue;
      const input = getExactVideoPresetInput(entry, preset, locale);
      // A toggle may be supported even when audio has no separate price tier.
      const note = input?.audio === false
        ? [old.note?.split(' · ').filter((part) => part !== copy.quote.audioIncluded).join(' · '),
            copy.quote.audioOff].filter(Boolean).join(' · ')
        : old.note;
      const apply = (result: PublicModelQuote) => {
        row.quotes[preset.id] = result.status === 'exact'
          ? { ...old, status: 'exact', note, amountCents: result.amountCents,
              display: formatCurrencyForLocale(locale, result.currency, result.amountCents / 100),
              rateDisplay: copy.quote.perSecond(formatPricePerUnit(locale, result.currency,
                result.amountCents / input!.durationSec / 100)),
              sortValue: result.amountCents, isCheapest: false }
          : { status: 'live_quote', display: copy.liveQuote, note,
              sortValue: Number.POSITIVE_INFINITY };
      };
      if (input) addQuote(input, apply);
      else apply({ status: 'unavailable' });
    }
  }
  const imageRows = scope === 'all' ? base.otherSurfaces.imageRows.filter((row) => configured.has(row.id)).map((row) => ({ ...row })) : [];
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
  const modelWorkers = Array.from({ length: Math.min(8, tasks.length) }, async () => {
    while (nextTask < tasks.length) {
      const task = tasks[nextTask++];
      if (task) await task();
    }
  });
  // Observe every worker, even after an earlier rejection, before releasing its budget.
  const modelWorkersSettled = Promise.allSettled(modelWorkers).then(() => undefined);
  const otherPricing = scope === 'all'
    ? buildCurrentOtherPricing({ ...base.otherSurfaces, imageRows }, locale, otherDependencies, { modelWorkersSettled })
    : undefined;
  const [, otherSurfaces] = await Promise.all([Promise.all(modelWorkers), otherPricing]);
  rows.forEach((row, index) => {
    const quotes = row.quotes;
    const defaultQuote = quotes[DEFAULT_VIDEO_PRICE_PRESET_ID];
    const exactRank = defaultQuote.status === 'exact' ? 0 : defaultQuote.status === 'closest' ? 1 : 2;
    const amount = typeof defaultQuote.amountCents === 'number' ? defaultQuote.amountCents : 99_999;
    row.sortValue = (row.pricingGroup === 'legacy' ? 1 : 0) * 1_000_000_000 +
      exactRank * 1_000_000 + amount * 100 + index;
  });
  const currentRows = markCheapestQuotes(orderPricingRows(rows));
  const video = { ...base.video, rows: currentRows, highlights: buildVideoHighlights(currentRows, locale) };
  if (!otherSurfaces) return { video };
  return { ...base, video,
    popularChecks: buildPopularChecks(locale, currentRows, imageRows,
      otherSurfaces.audioRows, otherSurfaces.toolRows),
    otherSurfaces };
}
