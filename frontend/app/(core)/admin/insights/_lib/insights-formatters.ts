import type { DeltaSnapshot, SmallStat } from './insights-types';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

export function toneBadgeClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'bg-success-bg text-success';
  }
  if (tone === 'warning') {
    return 'bg-error-bg text-error';
  }
  return 'bg-surface-hover text-text-secondary';
}

export function toneValueClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'text-success';
  }
  if (tone === 'warning') {
    return 'text-error';
  }
  return 'text-text-primary';
}

export function formatDeltaLabel(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'Flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'New' : 'Flat';
  }
  if (delta.absoluteChange === 0) {
    return 'Flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

export function formatNarrativeDelta(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'up from a zero base' : 'flat';
  }
  if (delta.absoluteChange === 0) {
    return 'flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

export function resolveDeltaTone(delta: DeltaSnapshot, positiveIsGood = true): SmallStat['tone'] {
  if (delta.current === 0 && delta.previous === 0) {
    return 'default';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? (positiveIsGood ? 'success' : 'warning') : 'default';
  }
  if (delta.absoluteChange === 0) {
    return 'default';
  }
  const improved = positiveIsGood ? delta.absoluteChange > 0 : delta.absoluteChange < 0;
  return improved ? 'success' : 'warning';
}

export function formatCurrency(amount: number, options?: { precise?: boolean }) {
  if (options?.precise) {
    return preciseCurrencyFormatter.format(amount);
  }
  return currencyFormatter.format(amount);
}

export function formatSignedCurrency(amount: number) {
  if (!Number.isFinite(amount)) {
    return '$0';
  }
  if (amount === 0) {
    return '$0';
  }
  const absolute = formatCurrency(Math.abs(amount));
  return `${amount > 0 ? '+' : '-'}${absolute}`;
}

export function formatAverageTicket(totals: { amountUsd: number; count: number }) {
  return formatCurrency(totals.amountUsd / totals.count, { precise: true });
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return compactNumberFormatter.format(value);
  if (Number.isInteger(value)) return numberFormatter.format(value);
  return value.toFixed(1);
}

export function formatAxisCurrency(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `$${(value / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  }
  if (absolute >= 10) {
    return `$${Math.round(value)}`;
  }
  return `$${value.toFixed(1)}`;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return percentFormatter.format(value);
}

export function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${percentFormatter.format(Math.abs(value))}`;
}

export function formatDay(value: string) {
  return dayFormatter.format(new Date(value));
}

export function formatMonth(value: string) {
  return monthFormatter.format(new Date(value));
}

export function formatFullDate(value: string | null) {
  if (!value) return '—';
  return fullDateFormatter.format(new Date(value));
}

export function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} days`;
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0';
  }
  return value.toFixed(1);
}
