import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { defaultLocale } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';

type ResolveLocalizedFallbackSeoOptions = {
  locale: AppLocale;
  hasLocalizedVersion: boolean;
  englishPath: string;
  availableLocales: AppLocale[];
};

type ResolveLocalizedFallbackSeoResult = {
  availableLocales: AppLocale[];
  canonicalOverride?: string;
  robots?: Metadata['robots'];
};

export function resolveLocalizedFallbackSeo({
  locale,
  hasLocalizedVersion,
  englishPath,
  availableLocales,
}: ResolveLocalizedFallbackSeoOptions): ResolveLocalizedFallbackSeoResult {
  const publishableLocales = Array.from(new Set<AppLocale>(availableLocales));
  if (!publishableLocales.includes(defaultLocale)) {
    publishableLocales.unshift(defaultLocale);
  }

  const shouldNoindexLocalizedFallback = locale !== defaultLocale && !hasLocalizedVersion;
  if (!shouldNoindexLocalizedFallback) {
    return {
      availableLocales: publishableLocales,
    };
  }

  return {
    availableLocales: publishableLocales,
    canonicalOverride: getLocalizedUrl(defaultLocale, englishPath),
    robots: { index: false, follow: true },
  };
}
