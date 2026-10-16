import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';

type SearchParams = Record<string, string | string[] | undefined>;

/** Match the whole decimal value; parseInt would accept 2junk, 2.5 and repeated keys. */
export function parseExamplesPage(value: SearchParams[string]) {
  if (value === undefined) return { page: 1, invalid: false, redirect: false };
  const page = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
  const invalid = !Number.isSafeInteger(page) || page > Math.floor(Number.MAX_SAFE_INTEGER / 24);
  return { page: invalid ? 1 : page, invalid, redirect: invalid || page === 1 };
}

export function getExamplesPaginationSeo(searchParams: SearchParams) {
  const parsed = parseExamplesPage(searchParams.page);
  const hasViewParameters = Object.keys(searchParams).some(key =>
    key !== 'page' && key !== 'sort' && !/^(utm_.*|gclid|fbclid)$/i.test(key)
  );
  const hasSort = searchParams.sort !== undefined && searchParams.sort !== 'playlist';
  const index = !parsed.invalid && !hasViewParameters && !hasSort;
  // A different sort/filter is not the same slice of the default catalog.
  return { index, canonicalPage: index ? parsed.page : 1 };
}

export function examplesPageUrl(base: string, page: number): string {
  return page > 1 ? `${base}?page=${page}` : base;
}

/** Localize the path first: passing /examples?page=2 to path localization loses the gallery slug. */
export function withExamplesPaginationMetadata(
  metadata: Metadata,
  locale: AppLocale,
  englishPath: string,
  page: number,
): Metadata {
  const urls = buildMetadataUrls(locale, undefined, { englishPath });
  const canonical = examplesPageUrl(urls.canonical, page);
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical,
      languages: Object.fromEntries(Object.entries(urls.languages).map(([language, href]) => [language, examplesPageUrl(href, page)])),
    },
    openGraph: { ...metadata.openGraph, url: canonical },
  };
}
