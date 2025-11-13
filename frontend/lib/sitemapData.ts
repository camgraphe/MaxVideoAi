import type { AppLocale } from '@/i18n/locales';
import modelRoster from '@/config/model-roster.json';
import { BLOG_ENTRIES, normalizePathSegments } from '@/lib/i18n/paths';
import {
  HREFLANG_VARIANTS,
  buildAbsoluteLocalizedUrl,
  resolveLocalesForEnglishPath,
} from '@/lib/seo/alternateLocales';

export type SitemapEntry = {
  url: string;
  lastModified?: string;
  alternates?: Record<string, string>;
};

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://maxvideoai.com';
const SITE_URL =
  RAW_SITE_URL.startsWith('http://') || RAW_SITE_URL.startsWith('https://')
    ? RAW_SITE_URL.replace(/\/+$/, '')
    : `https://${RAW_SITE_URL.replace(/\/+$/, '')}`;

const MARKETING_CORE_PATHS = ['/', '/models', '/pricing', '/examples', '/about', '/contact', '/blog'];

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const entries = new Map<string, string | undefined>();
  const addPath = (candidate: string, lastmod?: string) => {
    const normalized = normalizePathSegments(candidate);
    if (!entries.has(normalized) || lastmod) {
      entries.set(normalized, lastmod ?? entries.get(normalized));
    }
  };

  MARKETING_CORE_PATHS.forEach((path) => addPath(path));

  modelRoster.forEach((entry) => {
    if (entry?.modelSlug) {
      addPath(`/models/${entry.modelSlug}`);
    }
  });

  BLOG_ENTRIES.forEach((entry) => addPath(`/blog/${entry.canonicalSlug}`, entry.lastModified));

  const sitemapEntries: SitemapEntry[] = [];
  for (const [pathKey, lastmod] of entries.entries()) {
    const availableLocales = resolveLocalesForEnglishPath(pathKey);
    sitemapEntries.push({
      url: buildAbsoluteUrl(pathKey),
      lastModified: lastmod,
      alternates: buildAlternateMap(pathKey, availableLocales),
    });
  }

  return sitemapEntries;
}

function buildAbsoluteUrl(pathname: string): string {
  const normalized = pathname === '/' ? '/' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized === '/' || normalized === '') {
    return SITE_URL;
  }
  return `${SITE_URL}${normalized}`;
}

function buildAlternateMap(englishPath: string, localesForPath: Set<AppLocale>): Record<string, string> {
  const alternates: Record<string, string> = {};
  HREFLANG_VARIANTS.forEach((variant) => {
    if (!localesForPath.has(variant.locale)) {
      return;
    }
    alternates[variant.hreflang] = buildAbsoluteLocalizedUrl(SITE_URL, variant.locale, englishPath);
  });
  alternates['x-default'] = buildAbsoluteLocalizedUrl(SITE_URL, 'en', englishPath);
  return alternates;
}
