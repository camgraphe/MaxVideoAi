import { localeRegions, type AppLocale } from '@/i18n/locales';
import { HOMEPAGE_PRICE_PREFIX_BY_LOCALE } from '@/lib/homepage-price-label';
import type { Mode } from '@/types/engines';
import type { RedesignContent } from './types';

export function formatCurrency(
  locale: AppLocale,
  currency: string | null | undefined,
  cents: number | null | undefined
) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatStartingPrice(
  locale: AppLocale,
  currency: string | null | undefined,
  cents: number | null | undefined,
  durationSeconds?: number | null
) {
  const formatted = formatCurrency(locale, currency, cents);
  if (!formatted) return null;
  const prefix = HOMEPAGE_PRICE_PREFIX_BY_LOCALE[locale] ?? HOMEPAGE_PRICE_PREFIX_BY_LOCALE.en;
  return `${prefix} ${formatted}${durationSeconds ? ` / ${durationSeconds}s` : ''}`;
}

export function formatVideoTime(seconds: number | null | undefined) {
  const safeSeconds = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 5;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export function resolveModeLabel(mode: string | null | undefined, content: RedesignContent) {
  const normalized = (mode ?? 'unknown') as Mode | 'unknown';
  return content.modeLabels[normalized] ?? content.modeLabels.unknown ?? 'AI video';
}
