'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { listFalEngines } from '@/config/falEngines';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getModelByEngineId } from '@/lib/model-roster';
import { normalizeEngineId } from '@/lib/engine-alias';
import type { PricingRuleLite } from '@/lib/pricing-rules';
import type { PublicPricingMembershipTier } from '@/lib/pricing-public-quote';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { formatResolutionLabel } from '@/lib/resolution-labels';
import { Button } from '@/components/ui/Button';

interface PriceChipProps {
  engineId: string;
  durationSec: number;
  resolution: string;
  memberTier?: PublicPricingMembershipTier | string;
  suffix?: string;
  pricingRules?: PricingRuleLite[];
}

const PRICING_ENTRIES = listFalEngines();

async function fetchCurrentPrice(input: PublicModelQuoteInput): Promise<PublicModelQuote> {
  const response = await fetch('/api/pricing/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input), cache: 'no-store' });
  if (!response.ok) return { status: 'unavailable' };
  return response.json() as Promise<PublicModelQuote>;
}

function formatCurrency(currency: string, cents: number) {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}


export function PriceChip({
  engineId,
  durationSec,
  resolution,
  suffix,
}: PriceChipProps) {
  const { dictionary, t } = useI18n();
  const kernel = getPricingKernel();
  const [isOpen, setIsOpen] = useState(false);
  const canonicalId = normalizeEngineId(engineId) ?? engineId;

  const definition = kernel.getDefinition(canonicalId);
  const entry = PRICING_ENTRIES.find((candidate) => candidate.id === canonicalId || candidate.engine.id === canonicalId);
  const mode = entry?.engine.modes.includes('t2v') ? 't2v'
    : entry?.engine.modes.find((candidate) => candidate === 'i2v' || candidate === 't2i' || candidate === 'i2i');
  const input: PublicModelQuoteInput | null = definition && mode
    ? { modelId: canonicalId, mode, durationSec, resolution } : null;
  const { data: quote } = useSWR(input ? JSON.stringify(input) : null,
    () => fetchCurrentPrice(input!), { refreshInterval: 60_000 });

  if (!definition || quote?.status !== 'exact') {
    return null;
  }

  const rosterEntry = getModelByEngineId(canonicalId);
  const slug = rosterEntry?.modelSlug;
  const localizedMetaMap = (dictionary.models.meta ?? {}) as Record<string, { displayName?: string; versionLabel?: string }>;
  const localizedMeta = slug ? localizedMetaMap[slug] : undefined;
  const engineLabel = localizedMeta?.displayName ?? rosterEntry?.marketingName ?? definition.label ?? canonicalId;
  const engineVersion = localizedMeta?.versionLabel ?? rosterEntry?.versionLabel ?? (definition.version ? `v${definition.version}` : undefined);
  const displayResolution = formatResolutionLabel(canonicalId, resolution);
  const formattedTotal = formatCurrency(quote.currency, quote.amountCents);

  const prefix = dictionary.pricing.priceChipPrefix ?? t('pricing.priceChipPrefix', 'This render');
  const chipSuffix = suffix ?? dictionary.pricing.priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.');

  return (
    <div className="relative inline-flex">
      <span className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-micro text-brand shadow-card">
        <span>{`${prefix} ${formattedTotal}`}</span>
        <span className="text-text-muted">{chipSuffix}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-0 rounded-full border-transparent bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-brand hover:bg-surface-3"
          onClick={() => setIsOpen((prev) => !prev)}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          aria-expanded={isOpen}
        >
          {t('pricing.breakdown', 'Breakdown')}
        </Button>
      </span>
      {isOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-card border border-hairline bg-surface p-4 text-left text-xs text-text-secondary shadow-card"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">{t('pricing.engine', 'Engine')}</span>
              <p className="text-sm font-medium text-text-primary">
                {engineLabel}
                {engineVersion ? ` · ${engineVersion}` : ''}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                {t('pricing.durationResolution', 'Duration × Resolution')}
              </span>
              <p className="text-sm font-medium text-text-primary">
                {durationSec}s · {displayResolution.toUpperCase()}
              </p>
            </div>
            <div className="border-t border-hairline pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                {t('pricing.totalBeforeFees', 'Total (before taxes/fees)')}
              </span>
              <p className="text-sm font-semibold text-text-primary">{formattedTotal}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
