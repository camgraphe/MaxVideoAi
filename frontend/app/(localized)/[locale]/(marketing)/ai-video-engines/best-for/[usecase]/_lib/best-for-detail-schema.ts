import type { AppLocale } from '@/i18n/locales';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import type {
  BestForEntry,
  RankedPick,
} from './best-for-detail-config';

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildBreadcrumbJsonLd(locale: AppLocale, entry: BestForEntry, title: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Best for',
        item: getLocalizedUrl(locale, '/ai-video-engines/best-for'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title || entry.title,
        item: canonicalUrl,
      },
    ],
  };
}

export function buildBestForItemListJsonLd(locale: AppLocale, picks: RankedPick[], canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Ranked AI video engines for ${canonicalUrl.split('/').pop()?.replace(/-/g, ' ') ?? 'this use case'}`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: picks.map((pick) => ({
      '@type': 'ListItem',
      position: pick.rank,
      name: pick.engine?.marketingName ?? pick.slug,
      url: getLocalizedUrl(locale, `/models/${pick.slug}`),
    })),
  };
}

export function buildBestForWebPageJsonLd(title: string, description: string, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    url: canonicalUrl,
    description,
  };
}
