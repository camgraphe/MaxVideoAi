import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, locales } from '@/i18n/locales';
import { getEntryBySlug } from '@/lib/content/markdown';
import {
  BEST_FOR_PAGES,
  type BestForEntry,
} from './best-for-detail-config';

export function getEntry(slug: string): BestForEntry | undefined {
  return BEST_FOR_PAGES.find((entry) => entry.slug === slug);
}

export async function getBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  const localized = await getEntryBySlug(localizedRoot, slug);
  if (localized) return localized;
  return getEntryBySlug('content/en/best-for', slug);
}

export async function getLocalizedBestForEntry(locale: AppLocale, slug: string) {
  const localizedRoot = locale === defaultLocale ? 'content/en/best-for' : `content/${locale}/best-for`;
  return getEntryBySlug(localizedRoot, slug);
}

export async function resolveAvailableLocales(slug: string): Promise<AppLocale[]> {
  const available = await Promise.all(
    locales.map(async (locale) => {
      const localized = await getEntryBySlug(`content/${locale}/best-for`, slug);
      if (localized) {
        return locale;
      }
      if (locale === 'en') {
        const fallback = await getEntryBySlug('content/en/best-for', slug);
        if (fallback) {
          return locale;
        }
      }
      return null;
    })
  );
  const filtered = available.filter((locale): locale is AppLocale => Boolean(locale));
  return filtered.length ? filtered : (['en'] as AppLocale[]);
}
