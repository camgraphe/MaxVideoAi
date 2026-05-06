import { CURRENCY_LOCALE } from '@/lib/intl';

export function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatCurrencyLocal(amount: number, currencyCode?: string): string {
  const safeCurrency = currencyCode ?? 'USD';
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE, { style: 'currency', currency: safeCurrency }).format(amount);
  } catch {
    return `${safeCurrency} ${amount.toFixed(2)}`;
  }
}

export function formatRunway(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds >= 3600) {
    return `${(seconds / 3600).toFixed(1)}h`;
  }
  if (seconds >= 60) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${Math.round(seconds)}s`;
}

