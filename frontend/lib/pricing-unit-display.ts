import { localeRegions, type AppLocale } from '@/i18n/locales';

/** Display a quoted total divided by its quantity, without rounding it to whole cents first. */
export function formatPricePerUnit(locale: AppLocale, currency: string, amount: number): string {
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(amount);
}
