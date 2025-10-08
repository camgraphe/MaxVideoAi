'use client';

import { useI18n } from '@/lib/i18n/I18nProvider';

interface PriceChipProps {
  amount: number;
  suffix?: string;
}

export function PriceChip({ amount, suffix }: PriceChipProps) {
  const { dictionary, t } = useI18n();
  const prefix = dictionary.pricing.priceChipPrefix ?? t('pricing.priceChipPrefix', 'This render');
  const chipSuffix = suffix ?? dictionary.pricing.priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.');

  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-accent/30 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-micro text-accent shadow-card">
      <span>{`${prefix} $${amount.toFixed(2)}`}</span>
      <span className="text-text-muted">{chipSuffix}</span>
    </span>
  );
}
