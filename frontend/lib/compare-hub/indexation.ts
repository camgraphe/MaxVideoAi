import comparisonIndexation from '@/config/comparison-indexation.json';
import { locales, type AppLocale } from '@/i18n/locales';

const noindexByLocale: Record<AppLocale, ReadonlySet<string>> = {
  en: new Set(),
  fr: new Set(comparisonIndexation.noindexByLocale.fr),
  es: new Set(comparisonIndexation.noindexByLocale.es),
};

export function isComparisonIndexable(locale: AppLocale, canonicalSlug: string): boolean {
  return !noindexByLocale[locale].has(canonicalSlug);
}

export function getIndexableComparisonLocales(canonicalSlug: string): AppLocale[] {
  return locales.filter((locale) => isComparisonIndexable(locale, canonicalSlug));
}

export function getIndexableComparisonSlugs(
  locale: AppLocale,
  canonicalSlugs: readonly string[],
): string[] {
  return canonicalSlugs.filter((slug) => isComparisonIndexable(locale, slug));
}
