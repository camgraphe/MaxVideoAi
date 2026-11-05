import rates from '@/config/published-supplier-rates.json';
import { klingV4FlashPricingUsage, KLING_V4_FLASH_PRICING_SOURCE } from '@/lib/kling-v4-flash-pricing';
import type { PricingContext } from '@/lib/pricing-context';
import type { CatalogSupplierReference } from './catalog-supplier-reference';

type PublishedRate = {
  engineId: string; mode: string; provider: string; sourceUrl: string; checkedAt: string;
  unit: 'second' | 'task';
  byResolution?: Record<string, { silent: number; audio: number }>;
  byResolutionAndDuration?: Record<string, Record<string, number>>;
};
export type PublishedSupplierEstimate = CatalogSupplierReference & { checkedAt: string };

/** Only source-verified mode/provider/options are projected as published LIST. No customer math. */
export function publishedSupplierEstimate(context: PricingContext, provider: string): PublishedSupplierEstimate | null {
  if (context.engine.id === 'kling-v4-flash' && provider === 'fal') {
    try {
      const usage = klingV4FlashPricingUsage(context);
      return { amountUsd: usage.supplierExactCents / 100, referenceProvider: provider, sourceLabel: 'Fal published LIST',
        sourceUrl: KLING_V4_FLASH_PRICING_SOURCE, checkedAt: '2026-11-05', versionedAt: null,
        rateBreakdown: [{ label: 'Kling 4.0 Flash billable seconds', quantity: usage.billableSeconds, unit: 'second', unitPriceUsd: usage.centsPerSecond / 100, amountUsd: usage.supplierExactCents / 100 }] };
    } catch { return null; }
  }
  const rate = (rates.rates as PublishedRate[]).find((item) => item.engineId === context.engine.id
    && item.mode === context.mode && item.provider === provider);
  if (!rate || !Number.isFinite(context.durationSec) || context.durationSec <= 0) return null;
  let unitPriceUsd: number | undefined;
  const quantity = rate.unit === 'second' ? context.durationSec : 1;
  if (rate.unit === 'second') {
    if (typeof context.addons?.audio !== 'boolean') return null;
    const resolutionRate = rate.byResolution?.[context.resolution.toLowerCase()];
    unitPriceUsd = context.addons.audio ? resolutionRate?.audio : resolutionRate?.silent;
  } else unitPriceUsd = rate.byResolutionAndDuration?.[context.resolution]?.[String(context.durationSec)];
  if (unitPriceUsd == null || !Number.isFinite(unitPriceUsd) || unitPriceUsd < 0) return null;
  const amountUsd = Number((quantity * unitPriceUsd).toFixed(9));
  return { amountUsd, referenceProvider: provider, sourceLabel: 'Fal published LIST', sourceUrl: rate.sourceUrl,
    checkedAt: rate.checkedAt, versionedAt: null,
    rateBreakdown: [{ label: `${context.durationSec}s · ${context.resolution}${typeof context.addons?.audio === 'boolean' ? context.addons.audio ? ' · audio' : ' · silent' : ''}`,
      quantity, unit: rate.unit, unitPriceUsd, amountUsd }] };
}
