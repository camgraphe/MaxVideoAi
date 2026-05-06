import type { LocalizedLinkHref } from '@/i18n/navigation';
import { locales, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { getExamplesHref } from '@/lib/examples-links';

export const SITE = SITE_ORIGIN.replace(/\/$/, '');

export const MODELS_BASE_PATH_MAP = buildSlugMap('models');
export const COMPARE_BASE_PATH_MAP = buildSlugMap('compare');
export const COMPARE_EXCLUDED_SLUGS = new Set(['nano-banana', 'nano-banana-pro', 'nano-banana-2', 'gpt-image-2']);

export const CANONICAL_ONLY_COMPARE_SLUGS = new Set([
  'pika-text-to-video-vs-sora-2-pro',
  'pika-text-to-video-vs-wan-2-6',
  'pika-text-to-video-vs-veo-3-1-fast',
  'pika-text-to-video-vs-seedance-1-5-pro',
]);

const LOCALE_PREFIX_PATTERN = /^\/(fr|es)(?=\/)/i;
const NON_LOCALIZED_PREFIXES = [
  '/app',
  '/dashboard',
  '/jobs',
  '/billing',
  '/settings',
  '/generate',
  '/login',
  '/auth',
  '/video',
];

export function buildCanonicalComparePath({
  compareBase,
  pairSlug,
  orderSlug,
}: {
  compareBase: string;
  pairSlug: string;
  orderSlug?: string;
}): string {
  const sanitizedBase = compareBase.replace(/^\/+|\/+$/g, '');
  const normalizedPair = pairSlug ? pairSlug.replace(/^\/+/, '') : '';
  if (!normalizedPair) {
    return `/${sanitizedBase}`.replace(/\/{2,}/g, '/');
  }
  const parts = normalizedPair
    .split('-vs-')
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  let canonicalPair = normalizedPair;
  let orderParam = '';
  if (parts.length === 2) {
    const sorted = [...parts].sort();
    canonicalPair = `${sorted[0]}-vs-${sorted[1]}`;
    if (orderSlug && sorted.includes(orderSlug) && orderSlug !== sorted[0]) {
      orderParam = `?order=${encodeURIComponent(orderSlug)}`;
    }
  } else if (orderSlug) {
    orderParam = `?order=${encodeURIComponent(orderSlug)}`;
  }
  return `/${sanitizedBase}/${canonicalPair}${orderParam}`.replace(/\/{2,}/g, '/');
}

function stripLocalePrefix(pathname: string): string {
  return pathname.replace(LOCALE_PREFIX_PATTERN, '');
}

export function resolveExamplesHrefFromRaw(rawHref?: string | null): LocalizedLinkHref | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
  } catch {
    const [pathPart, queryPart] = rawHref.split('?');
    pathname = pathPart || rawHref;
    search = queryPart ? `?${queryPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!normalizedPath.startsWith('/examples')) {
    return null;
  }
  const segments = normalizedPath.split('/').filter(Boolean);
  const modelSlug = segments[1];
  const params = new URLSearchParams(search);
  const engineSlug = params.get('engine');
  const candidate = modelSlug || engineSlug;
  return candidate ? getExamplesHref(candidate) : { pathname: '/examples' };
}

export function resolveNonLocalizedHref(rawHref?: string | null): string | null {
  if (!rawHref) return null;
  let pathname = rawHref;
  let search = '';
  let hash = '';
  try {
    const url = new URL(rawHref, SITE);
    pathname = url.pathname || rawHref;
    search = url.search || '';
    hash = url.hash || '';
  } catch {
    const [pathPart, hashPart] = rawHref.split('#');
    const [pathOnly, queryPart] = pathPart.split('?');
    pathname = pathOnly || rawHref;
    search = queryPart ? `?${queryPart}` : '';
    hash = hashPart ? `#${hashPart}` : '';
  }
  const normalizedPath = stripLocalePrefix(pathname);
  if (!NON_LOCALIZED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return null;
  }
  return `${normalizedPath}${search}${hash}`;
}

export function getDefaultSecondaryModelHref(slug: string): string {
  if (slug === 'sora-2') return '/models/sora-2-pro';
  if (slug === 'seedance-2-0') return '/models/seedance-2-0-fast';
  if (slug === 'seedance-2-0-fast') return '/models/seedance-2-0';
  return '/models/seedance-2-0';
}

export function buildDetailSlugMap(slug: string) {
  return locales.reduce<Record<AppLocale, string>>((acc, locale) => {
    const base = MODELS_BASE_PATH_MAP[locale] ?? 'models';
    acc[locale] = `${base}/${slug}`;
    return acc;
  }, {} as Record<AppLocale, string>);
}

export function toAbsoluteUrl(url?: string | null): string {
  if (!url) return `${SITE}/og/price-before.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

