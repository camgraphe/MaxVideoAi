import fs from 'node:fs';
import path from 'node:path';
import { defaultLocale, type AppLocale } from '@/i18n/locales';
import modelRoster from '@/config/model-roster.json';
import {
  BLOG_ENTRIES,
  BLOG_SLUG_MAP,
  CONTENT_ROOT,
  localizePathFromEnglish,
} from '@/lib/i18n/paths';

export type SitemapEntry = {
  url: string;
  lastModified?: string;
};

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://maxvideoai.com';
const SITE_URL =
  RAW_SITE_URL.startsWith('http://') || RAW_SITE_URL.startsWith('https://')
    ? RAW_SITE_URL.replace(/\/+$/, '')
    : `https://${RAW_SITE_URL.replace(/\/+$/, '')}`;

const LOCALE_SITEMAP_PATHS: Record<AppLocale, string> = {
  en: '/sitemap-en.xml',
  fr: '/sitemap-fr.xml',
  es: '/sitemap-es.xml',
};

const LOCALES: AppLocale[] = ['en', 'fr', 'es'];
const MARKETING_PATHS = ['/', '/pricing', '/examples', '/about', '/contact', '/blog'];
const MODEL_CONTENT_ROOT = path.join(CONTENT_ROOT, 'models');

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function buildAbsoluteUrl(pathname: string): string {
  const normalized = pathname === '/' ? '/' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized === '/' || normalized === '') {
    return SITE_URL;
  }
  return `${SITE_URL}${normalized}`;
}

function hasModelLocale(slug: string, locale: AppLocale): boolean {
  if (locale === 'en') {
    return true;
  }
  const candidate = path.join(MODEL_CONTENT_ROOT, locale, `${slug}.json`);
  return fs.existsSync(candidate);
}

function hasBlogLocale(canonicalSlug: string, locale: AppLocale): boolean {
  if (locale === 'en') {
    return true;
  }
  const mapping = BLOG_SLUG_MAP.get(canonicalSlug);
  return Boolean(mapping?.[locale]);
}

function formatLastModified(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export async function getLocaleSitemapEntries(locale: AppLocale): Promise<SitemapEntry[]> {
  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];

  const addLocalizedPath = (englishPath: string, lastModified?: string) => {
    const localizedPath = localizePathFromEnglish(locale, englishPath);
    const url = buildAbsoluteUrl(localizedPath);
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    entries.push({ url, lastModified: formatLastModified(lastModified) });
  };

  MARKETING_PATHS.forEach((path) => addLocalizedPath(path));

  modelRoster.forEach((model) => {
    if (!model?.modelSlug) {
      return;
    }
    if (!hasModelLocale(model.modelSlug, locale)) {
      return;
    }
    addLocalizedPath(`/models/${model.modelSlug}`);
  });

  BLOG_ENTRIES.forEach((entry) => {
    if (!hasBlogLocale(entry.canonicalSlug, locale)) {
      return;
    }
    addLocalizedPath(`/blog/${entry.canonicalSlug}`, entry.lastModified);
  });

  return entries;
}

export async function buildLocaleSitemapXml(locale: AppLocale): Promise<string> {
  const entries = await getLocaleSitemapEntries(locale);
  const body = entries
    .map((entry) => {
      const lastmod = entry.lastModified ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(entry.url)}</loc>\n${lastmod ? `    ${lastmod}\n` : ''}  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export function buildSitemapIndexXml(): string {
  const sitemapUrls = LOCALES.map((locale) => buildAbsoluteUrl(LOCALE_SITEMAP_PATHS[locale])).concat(
    `${SITE_URL}/sitemap-video.xml`,
    `${SITE_URL}/sitemap-models.xml`
  );

  const body = sitemapUrls
    .map((url) => `  <sitemap>\n    <loc>${escapeXml(url)}</loc>\n  </sitemap>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`;
}

export async function buildModelsSitemapXml(): Promise<string> {
  const entries: string[] = [];

  modelRoster.forEach((model) => {
    if (!model?.modelSlug) {
      return;
    }
    const englishPath = `/models/${model.modelSlug}`;
    const localizedEntries = LOCALES.filter((locale) => hasModelLocale(model.modelSlug, locale)).map((locale) => ({
      locale,
      url: buildAbsoluteUrl(localizePathFromEnglish(locale, englishPath)),
    }));
    if (!localizedEntries.some((entry) => entry.locale === 'en')) {
      localizedEntries.push({ locale: 'en', url: buildAbsoluteUrl(englishPath) });
    }
    const xDefaultHref =
      localizedEntries.find((entry) => entry.locale === defaultLocale)?.url ?? localizedEntries[0]?.url ?? buildAbsoluteUrl(englishPath);
    localizedEntries.forEach((record) => {
      const alternateLinks = localizedEntries
        .map(
          (alt) =>
            `<xhtml:link rel="alternate" hreflang="${escapeXml(alt.locale)}" href="${escapeXml(alt.url)}" />`
        )
        .concat(
          xDefaultHref ? [`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(xDefaultHref)}" />`] : []
        )
        .join('\n    ');
      entries.push(`  <url>\n    <loc>${escapeXml(record.url)}</loc>\n    ${alternateLinks}\n  </url>`);
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join(
    '\n'
  )}\n</urlset>`;
}

export { LOCALES, LOCALE_SITEMAP_PATHS };
