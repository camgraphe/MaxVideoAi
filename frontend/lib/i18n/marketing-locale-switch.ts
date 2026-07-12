import localizedSlugConfig from '../../config/localized-slugs.json';
import { resolveBlogCanonicalSlug, resolveLocalizedBlogSlug } from '../../config/blog-slugs';
import type { Locale } from './types';

type MarketingLocaleSwitchInput = {
  pathname: string;
  targetLocale: Locale;
  search?: string;
  hash?: string;
};

const LOCALE_PREFIXES: Record<Locale, string> = { en: '', fr: 'fr', es: 'es' };
const ENGLISH_SEGMENT_TO_LOCALIZED = new Map<string, Record<Locale, string>>();
const LOCALIZED_SEGMENT_TO_ENGLISH = new Map<string, string>();

Object.values(localizedSlugConfig as Record<string, Record<Locale, string>>).forEach((entry) => {
  const englishSegment = entry.en;
  if (!englishSegment) return;
  ENGLISH_SEGMENT_TO_LOCALIZED.set(englishSegment, entry);
  Object.values(entry).forEach((localizedSegment) => {
    if (localizedSegment) {
      LOCALIZED_SEGMENT_TO_ENGLISH.set(localizedSegment, englishSegment);
    }
  });
});

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePath(segments: string[]): string {
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function resolveMarketingLocaleFromPathname(
  pathname: string | null | undefined,
  fallback: Locale = 'en'
): Locale {
  if (!pathname) return fallback;
  const match = pathname.match(/^\/(en|fr|es)(?:\/|$)/i);
  return match ? (match[1].toLowerCase() as Locale) : 'en';
}

function resolveEnglishPath(pathname: string): string {
  const currentLocale = resolveMarketingLocaleFromPathname(pathname);
  const segments = pathname.split('?')[0].split('/').filter(Boolean);
  if (segments[0] === 'en' || segments[0] === 'fr' || segments[0] === 'es') {
    segments.shift();
  }
  if (!segments.length) return '/';

  const [first, ...rest] = segments;
  const englishFirst = LOCALIZED_SEGMENT_TO_ENGLISH.get(first) ?? first;
  if (englishFirst !== 'blog' || !rest.length) {
    return normalizePath([englishFirst, ...rest]);
  }

  const localizedSlug = decodePathSegment(rest[0]);
  const canonicalSlug =
    resolveBlogCanonicalSlug(currentLocale, localizedSlug) ??
    resolveBlogCanonicalSlug('en', localizedSlug) ??
    localizedSlug;
  return normalizePath([englishFirst, canonicalSlug, ...rest.slice(1)]);
}

function localizeEnglishPath(englishPath: string, targetLocale: Locale): string {
  const segments = englishPath.split('/').filter(Boolean);
  if (!segments.length) {
    return targetLocale === 'en' ? '/' : `/${LOCALE_PREFIXES[targetLocale]}`;
  }

  const [first, ...rest] = segments;
  const localizedFirst = ENGLISH_SEGMENT_TO_LOCALIZED.get(first)?.[targetLocale] ?? first;
  const localizedRest = [...rest];
  if (first === 'blog' && localizedRest.length) {
    localizedRest[0] = resolveLocalizedBlogSlug(decodePathSegment(localizedRest[0]), targetLocale) ?? localizedRest[0];
  }
  const prefix = LOCALE_PREFIXES[targetLocale];
  return normalizePath([prefix, localizedFirst, ...localizedRest].filter(Boolean));
}

export function buildMarketingLocaleSwitchHref({
  pathname,
  targetLocale,
  search = '',
  hash = '',
}: MarketingLocaleSwitchInput): string {
  const englishPath = resolveEnglishPath(pathname || '/');
  const targetPath = localizeEnglishPath(englishPath, targetLocale);
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  searchParams.delete('nolocale');
  searchParams.set('lang', targetLocale);
  const normalizedHash = hash && !hash.startsWith('#') ? `#${hash}` : hash;
  return `${targetPath}?${searchParams.toString()}${normalizedHash}`;
}
