'use client';

import { useMemo, useState } from 'react';
import { computePricingSnapshot, type MemberTier } from '@maxvideoai/pricing';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getModelByEngineId } from '@/lib/model-roster';
import { normalizeEngineId } from '@/lib/engine-alias';
import { selectPricingRule, type PricingRuleLite } from '@/lib/pricing-rules';

interface PriceChipProps {
  engineId: string;
  durationSec: number;
  resolution: string;
  memberTier?: MemberTier | string;
  suffix?: string;
  pricingRules?: PricingRuleLite[];
}

function formatCurrency(currency: string, cents: number) {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatPercentage(value: number | undefined) {
  if (typeof value !== 'number') return '';
  return `${Math.round(value * 100)}%`;
}

export function PriceChip({
  engineId,
  durationSec,
  resolution,
  memberTier = 'member',
  suffix,
  pricingRules,
}: PriceChipProps) {
  const { dictionary, t } = useI18n();
  const kernel = getPricingKernel();
  const [isOpen, setIsOpen] = useState(false);
  const canonicalId = normalizeEngineId(engineId) ?? engineId;

  const pricingRule = useMemo(
    () => selectPricingRule(pricingRules, canonicalId, resolution),
    [pricingRules, canonicalId, resolution]
  );

  const quote = useMemo(() => {
    const definition = kernel.getDefinition(canonicalId);
    if (!definition) return null;
    try {
      const adjusted = pricingRule
        ? {
            ...definition,
            platformFeePct: pricingRule.marginPercent ?? definition.platformFeePct,
            platformFeeFlatCents: pricingRule.marginFlatCents ?? definition.platformFeeFlatCents,
            currency: pricingRule.currency ?? definition.currency,
          }
        : definition;
      return computePricingSnapshot(adjusted, {
        engineId: canonicalId,
        durationSec,
        resolution,
        memberTier: (memberTier ?? 'member').toString().toLowerCase() as MemberTier,
      }).quote;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalId, durationSec, resolution, memberTier?.toString(), pricingRule]);

  if (!quote) {
    return null;
  }

  const snapshot = quote.snapshot;
  const definition = quote.definition;
  const rosterEntry = getModelByEngineId(canonicalId);
  const slug = rosterEntry?.modelSlug;
  const localizedMetaMap = (dictionary.models.meta ?? {}) as Record<string, { displayName?: string; versionLabel?: string }>;
  const localizedMeta = slug ? localizedMetaMap[slug] : undefined;
  const engineLabel = localizedMeta?.displayName ?? rosterEntry?.marketingName ?? definition.label ?? canonicalId;
  const engineVersion = localizedMeta?.versionLabel ?? rosterEntry?.versionLabel ?? (definition.version ? `v${definition.version}` : undefined);
  const formattedTotal = formatCurrency(snapshot.currency, snapshot.totalCents);
  const formattedDiscount = snapshot.discount
    ? `${formatPercentage(snapshot.discount.percentApplied)} · -${formatCurrency(snapshot.currency, snapshot.discount.amountCents)}`
    : t('pricing.noMemberDiscount', 'No member discount');
  const memberLabel = snapshot.membershipTier ? snapshot.membershipTier.toUpperCase() : 'MEMBER';

  const prefix = dictionary.pricing.priceChipPrefix ?? t('pricing.priceChipPrefix', 'This render');
  const chipSuffix = suffix ?? dictionary.pricing.priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.');

  return (
    <div className="relative inline-flex">
      <span className="inline-flex items-center gap-2 rounded-pill border border-accent/30 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-micro text-accent shadow-card">
        <span>{`${prefix} ${formattedTotal}`}</span>
        <span className="text-text-muted">{chipSuffix}</span>
        <button
          type="button"
          className="rounded-full border border-transparent bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent transition hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          onClick={() => setIsOpen((prev) => !prev)}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          aria-expanded={isOpen}
        >
          {t('pricing.breakdown', 'Breakdown')}
        </button>
      </span>
      {isOpen && (
        <div
          className="absolute right-0 top-full z-10 mt-2 w-64 rounded-card border border-hairline bg-white p-4 text-left text-xs text-text-secondary shadow-card"
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
                {snapshot.base.seconds}s · {resolution.toUpperCase()}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                {t('pricing.memberDiscount', 'Member discount')}
              </span>
              <p className="text-sm font-medium text-text-primary">{formattedDiscount}</p>
              <p className="text-[11px] text-text-muted">{t('pricing.memberTier', 'Tier')}: {memberLabel}</p>
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
