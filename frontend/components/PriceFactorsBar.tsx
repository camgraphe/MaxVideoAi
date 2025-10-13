'use client';

import clsx from 'clsx';
import Image from 'next/image';
import { useMemo } from 'react';
import type { ItemizationLine, PreflightResponse } from '@/types/engines';

export type PriceFactorKind =
  | 'base'
  | 'duration'
  | 'resolution'
  | 'upscale4k'
  | 'audio'
  | 'discount'
  | 'margin'
  | 'fee'
  | 'tax'
  | (string & {});

interface PriceFactorsBarProps {
  preflight: PreflightResponse | null;
  currency?: string;
  isLoading?: boolean;
  onNavigate?: (kind: PriceFactorKind) => void;
  iterations?: number;
}

interface PriceFactorItem {
  id: string;
  kind: PriceFactorKind;
  label: string;
  amount: number;
  icon?: string;
  tooltip?: string;
  emphasizeSign?: boolean;
}

const AMOUNT_EPSILON = 0.00001;
const ICONS: Record<string, string | undefined> = {
  base: '/assets/icons/price-before.svg',
  upscale4k: '/assets/icons/upscale.svg',
  audio: '/assets/icons/audio.svg',
  discount: '/assets/icons/member-plus.svg',
  margin: '/assets/icons/wallet.svg',
  tax: '/assets/icons/wallet.svg',
};

export function PriceFactorsBar({ preflight, currency = 'USD', isLoading = false, onNavigate, iterations = 1 }: PriceFactorsBarProps) {
  const safeIterations = Math.max(1, Math.floor(iterations || 1));
  const formatter = useMemo(() => new Intl.NumberFormat('en-US', { style: 'currency', currency }), [currency]);

  const items = useMemo<PriceFactorItem[]>(() => {
    if (!preflight?.itemization) return [];

    const { base, addons = [], fees = [], discounts = [], taxes = [] } = preflight.itemization;
    const factors: PriceFactorItem[] = [];

    if (base && !isZero(base.subtotal)) {
      factors.push({
        id: 'base',
        kind: 'base',
        label: buildBaseLabel(base),
        amount: base.subtotal,
        icon: ICONS.base,
        tooltip: buildBaseTooltip(base, formatter),
        emphasizeSign: false,
      });
    }

    addons.forEach((addon, index) => {
      const amount = addon.subtotal ?? addon.amount ?? 0;
      if (isZero(amount)) return;
      const type = (addon.type ?? `addon-${index}`) as PriceFactorKind;
      factors.push({
        id: `addon-${index}`,
        kind: type,
        label: buildAddonLabel(addon),
        amount,
        icon: ICONS[type] ?? ICONS.base,
        tooltip: buildAddonTooltip(addon, amount, formatter),
        emphasizeSign: true,
      });
    });

    // Iterations multiplier (×N) — only if > 1
    if (safeIterations > 1) {
      factors.push({
        id: 'iterations',
        kind: 'duration',
        label: `×${safeIterations}`,
        amount: 0,
        icon: undefined,
        emphasizeSign: false,
      });
    }

    fees?.forEach((fee, index) => {
      const amount = fee.subtotal ?? fee.amount ?? 0;
      if (isZero(amount)) return;
      const kind = ((fee.type ?? 'margin').toLowerCase() || 'margin') as PriceFactorKind;
      factors.push({
        id: `fee-${index}`,
        kind,
        label: buildFeeLabel(fee),
        amount,
        icon: ICONS[kind] ?? ICONS.margin,
        tooltip: buildFeeTooltip(fee, formatter),
        emphasizeSign: true,
      });
    });

    discounts.forEach((discount, index) => {
      const amount = discount.amount ?? discount.subtotal ?? 0;
      if (isZero(amount)) return;
      factors.push({
        id: `discount-${index}`,
        kind: 'discount',
        label: buildDiscountLabel(discount),
        amount,
        icon: ICONS.discount,
        tooltip: buildDiscountTooltip(discount, formatter),
        emphasizeSign: true,
      });
    });

    taxes.forEach((tax, index) => {
      const amount = tax.subtotal ?? tax.amount ?? 0;
      if (isZero(amount)) return;
      const kind = ((tax.type ?? 'tax').toLowerCase() || 'tax') as PriceFactorKind;
      factors.push({
        id: `tax-${index}`,
        kind,
        label: buildTaxLabel(tax),
        amount,
        icon: ICONS[kind] ?? ICONS.tax,
        tooltip: buildTaxTooltip(tax, formatter),
        emphasizeSign: true,
      });
    });

    return sortFactors(factors);
  }, [preflight?.itemization, formatter, safeIterations]);

  if (isLoading && !items.length) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pr-2">
        {[0, 1, 2].map((key) => (
          <div
            key={key}
          className="h-[40px] min-w-[140px] rounded-[10px] border border-hairline bg-white"
          >
            <div className="skeleton h-full w-full rounded-[10px]" />
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return null;
  }

  const busy = isLoading && items.length > 0;
  const totalLabel = safeIterations > 1 ? 'Total for this batch' : 'This render';
  const memberDiscountTotal = safeIterations > 1
    ? Math.abs(
        (preflight?.itemization?.discounts ?? []).reduce(
          (sum, discount) => sum + (discount.amount ?? discount.subtotal ?? 0),
          0
        )
      )
    : 0;

  return (
    <div
      className={clsx(
        'flex items-center gap-2 overflow-x-auto pr-2',
        busy && 'pointer-events-none opacity-70'
      )}
      aria-busy={busy || undefined}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={onNavigate ? () => onNavigate(item.kind) : undefined}
          className="inline-flex items-center gap-2 rounded-[10px] border border-hairline bg-white px-3 py-2 text-[12px] leading-4 tracking-[0.08em] text-text-secondary transition hover:border-accentSoft/50 hover:bg-accentSoft/10 focus:outline-none focus:ring-2 focus:ring-ring"
          title={item.tooltip}
        >
          {item.icon && (
            <Image src={item.icon} alt="" width={16} height={16} className="h-4 w-4" aria-hidden />
          )}
          <span className="uppercase text-text-muted">{item.label}</span>
          <span
            className={clsx(
              'font-medium',
              item.amount < 0 ? 'text-emerald-600' : 'text-text-primary'
            )}
          >
            {formatAmount(item.amount, formatter, item.emphasizeSign)}
          </span>
        </button>
      ))}

      {typeof preflight?.total === 'number' && (
        <span className="ml-auto inline-flex items-center rounded-full bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
          {totalLabel}: {formatTotal((preflight.total || 0) * safeIterations, formatter)}
          {safeIterations > 1 && memberDiscountTotal > AMOUNT_EPSILON && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">
              Member saves {formatTotal(memberDiscountTotal, formatter)}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

function sortFactors(items: PriceFactorItem[]) {
  const order: Record<string, number> = {
    base: 0,
    duration: 1,
    resolution: 2,
    upscale4k: 3,
    audio: 4,
    margin: 5,
    fee: 5,
    discount: 6,
    tax: 7,
  };

  return [...items].sort((a, b) => {
    const rankA = order[a.kind] ?? 10;
    const rankB = order[b.kind] ?? 10;
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });
}

function isZero(value: number) {
  return Math.abs(value) < AMOUNT_EPSILON;
}

function centsToMajor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return amount / 100;
}

function formatAmount(amount: number, formatter: Intl.NumberFormat, emphasizeSign = true) {
  const value = centsToMajor(amount);
  if (!emphasizeSign) {
    return formatter.format(value);
  }
  const formatted = formatter.format(Math.abs(value));
  if (amount < 0) {
    return `−${formatted}`;
  }
  return `+${formatted}`;
}

function formatTotal(total: number, formatter: Intl.NumberFormat) {
  return formatter.format(centsToMajor(total));
}

function buildBaseLabel(base: ItemizationLine) {
  const seconds = typeof base.seconds === 'number' ? `${base.seconds}s` : undefined;
  const unit = base.unit ? prettifyUnit(base.unit) : undefined;
  if (unit && seconds) {
    return `Base ${unit} × ${seconds}`;
  }
  if (seconds) {
    return `Base × ${seconds}`;
  }
  return 'Base';
}

function buildBaseTooltip(base: ItemizationLine, formatter: Intl.NumberFormat) {
  const rate = typeof base.rate === 'number' ? formatter.format(base.rate) : undefined;
  const seconds = typeof base.seconds === 'number' ? base.seconds : undefined;
  if (rate && seconds) {
    return `${rate} per second for ${seconds}s`;
  }
  if (seconds) {
    return `${seconds} seconds`;
  }
  return 'Base cost';
}

function buildAddonLabel(addon: ItemizationLine) {
  const type = addon.type ?? 'Add-on';
  if (type === 'upscale4k') return 'Upscale';
  if (type === 'audio') return 'Audio';
  if (type === 'extend') return 'Extend';
  if (type === 'keyframes') return 'Keyframes';
  return titleCase(type);
}

function buildAddonTooltip(addon: ItemizationLine, amount: number, formatter: Intl.NumberFormat) {
  const label = buildAddonLabel(addon);
  const sign = amount > 0 ? '+' : '−';
  const price = formatter.format(Math.abs(centsToMajor(amount)));
  return `${label} ${sign}${price}`;
}

function buildDiscountLabel(discount: ItemizationLine) {
  if (discount.type === 'member') {
    const parts = ['Member'];
    if (discount.tier) {
      parts.push(discount.tier);
    }
    if (typeof discount.rate === 'number') {
      parts.push(`−${formatPercent(discount.rate)}`);
    }
    return parts.join(' ');
  }
  if (discount.type) {
    return `${titleCase(discount.type)} Discount`;
  }
  return 'Discount';
}

function buildDiscountTooltip(discount: ItemizationLine, formatter: Intl.NumberFormat) {
  const rate = typeof discount.rate === 'number' ? formatPercent(discount.rate) : undefined;
  const amount = discount.amount ?? discount.subtotal ?? 0;
  const price = formatter.format(Math.abs(centsToMajor(amount)));
  const tier = discount.tier ? `${discount.tier} tier` : undefined;
  const pieces = [rate ? `${rate} off` : 'Discount'];
  if (tier) pieces.unshift(tier);
  pieces.push(`${amount < 0 ? '−' : '+'}${price}`);
  return pieces.join(' · ');
}

function buildFeeLabel(fee: ItemizationLine) {
  if (fee.type === 'margin') return 'Platform margin';
  if (fee.type) return titleCase(fee.type);
  return 'Fee';
}

function buildFeeTooltip(fee: ItemizationLine, formatter: Intl.NumberFormat) {
  const amount = fee.subtotal ?? fee.amount ?? 0;
  const price = formatter.format(Math.abs(centsToMajor(amount)));
  if (fee.rateDisplay) {
    return `${fee.rateDisplay} · ${amount >= 0 ? '+' : '−'}${price}`;
  }
  return `Fee ${amount >= 0 ? '+' : '−'}${price}`;
}

function buildTaxLabel(tax: ItemizationLine) {
  if (tax.type) {
    return titleCase(tax.type);
  }
  return 'Tax';
}

function buildTaxTooltip(tax: ItemizationLine, formatter: Intl.NumberFormat) {
  const amount = tax.subtotal ?? tax.amount ?? 0;
  const formatted = formatter.format(Math.abs(centsToMajor(amount)));
  return `${buildTaxLabel(tax)} ${amount < 0 ? '−' : '+'}${formatted}`;
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b(\w)/g, (match) => match.toUpperCase());
}

function prettifyUnit(unit: string) {
  return unit.replace(/USD/i, '$');
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
