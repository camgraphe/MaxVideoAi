import { CURRENCY_LOCALE } from '@/lib/intl';
import type { AppLocale } from '@/i18n/locales';

export const HOMEPAGE_PRICE_PREFIX_BY_LOCALE: Record<AppLocale, string> = {
  en: 'from',
  fr: 'à partir de',
  es: 'desde',
};

const PRICE_FORMAT_LOCALE_BY_LOCALE: Record<AppLocale, string> = {
  en: CURRENCY_LOCALE,
  fr: 'fr-FR',
  es: 'es-ES',
};

const CURRENCY_CODE_BY_SYMBOL: Record<string, string> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
};

const PRICE_SUFFIX_PATTERN = /^(\/[a-z]+(?:-[a-z]+)?|per\s+[a-z]+(?:\s+[a-z]+)?)$/i;

function normalizePriceSuffix(rawSuffix: string | undefined): string {
  if (!rawSuffix) return '';
  const compact = rawSuffix.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (!PRICE_SUFFIX_PATTERN.test(compact)) return '';
  return compact.startsWith('/') ? compact.toLowerCase() : ` ${compact.toLowerCase()}`;
}

export function normalizeHomepageAdminPriceLabel(label: string, locale: AppLocale): string | null {
  const compactLabel = label.replace(/\s+/g, ' ').trim();
  if (!compactLabel) {
    return null;
  }

  const withoutPrefix = compactLabel.replace(/^(from|à partir de|desde)\s+/i, '').trim();
  const symbolMatch = withoutPrefix.match(
    /^([$€£])\s*([0-9]+(?:[.,][0-9]{1,2})?)(?:\s*(\/[a-z]+(?:-[a-z]+)?|per\s+[a-z]+(?:\s+[a-z]+)?))?$/i
  );
  const codeMatch = withoutPrefix.match(
    /^([0-9]+(?:[.,][0-9]{1,2})?)\s*(USD|EUR|GBP)(?:\s*(\/[a-z]+(?:-[a-z]+)?|per\s+[a-z]+(?:\s+[a-z]+)?))?$/i
  );
  const currency = symbolMatch
    ? CURRENCY_CODE_BY_SYMBOL[symbolMatch[1] ?? '']
    : codeMatch?.[2]?.toUpperCase() ?? null;
  const amountRaw = symbolMatch?.[2] ?? codeMatch?.[1] ?? null;
  const suffix = normalizePriceSuffix(symbolMatch?.[3] ?? codeMatch?.[3]);
  const amount = amountRaw ? Number(amountRaw.replace(',', '.')) : Number.NaN;

  if (!currency || !Number.isFinite(amount)) {
    return null;
  }

  const targetPrefix = HOMEPAGE_PRICE_PREFIX_BY_LOCALE[locale] ?? HOMEPAGE_PRICE_PREFIX_BY_LOCALE.en;
  const numberLocale = PRICE_FORMAT_LOCALE_BY_LOCALE[locale] ?? CURRENCY_LOCALE;
  const formattedAmount = new Intl.NumberFormat(numberLocale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${targetPrefix} ${formattedAmount}${suffix}`;
}
