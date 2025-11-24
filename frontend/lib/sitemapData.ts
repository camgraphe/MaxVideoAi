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
import { getContentEntries } from '@/lib/content/markdown';

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
const MODEL_CONTENT_ROOT = path.join(CONTENT_ROOT, 'models');
const APP_ROOT = path.join(process.cwd(), 'app');
const LOCALIZED_APP_ROOT = path.join(APP_ROOT, '(localized)', '[locale]');
const PAGE_FILE_PATTERN = /^page\.(?:mdx|tsx?|ts|jsx?|js)$/i;
const IGNORED_ROUTE_TEMPLATES = new Set(['/404', '/video/[videoId]', '/v/[videoId]']);

type CanonicalPathEntry = {
  englishPath: string;
  lastModified?: string;
  locales?: AppLocale[];
};

type RouteTemplate = {
  template: string;
  isDynamic: boolean;
};

type DynamicRouteGenerator = () => Promise<CanonicalPathEntry[]>;

const parsedTolerance = Number(process.env.SITEMAP_LOCALE_TOLERANCE ?? '3');
const LOCALE_MISMATCH_TOLERANCE = Number.isFinite(parsedTolerance) && parsedTolerance >= 0 ? parsedTolerance : 3;
const FAIL_ON_LOCALE_MISMATCH = process.env.SITEMAP_LOCALE_FAIL_ON_MISMATCH === 'true';

let canonicalEntryPromise: Promise<CanonicalPathEntry[]> | null = null;

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
  const canonicalEntries = await getCanonicalPathEntries();

  const addLocalizedPath = (englishPath: string, lastModified?: string, availableLocales?: AppLocale[]) => {
    if (availableLocales && !availableLocales.includes(locale)) {
      return;
    }
    const localizedPath = localizePathFromEnglish(locale, englishPath);
    const url = buildAbsoluteUrl(localizedPath);
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    entries.push({ url, lastModified: formatLastModified(lastModified) });
  };

  canonicalEntries.forEach((entry) => {
    addLocalizedPath(entry.englishPath, entry.lastModified, entry.locales);
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

async function getCanonicalPathEntries(): Promise<CanonicalPathEntry[]> {
  if (!canonicalEntryPromise) {
    canonicalEntryPromise = resolveCanonicalPathEntries();
  }
  return canonicalEntryPromise;
}

async function resolveCanonicalPathEntries(): Promise<CanonicalPathEntry[]> {
  const templates = discoverLocalizedRouteTemplates();
  const entries: CanonicalPathEntry[] = [];
  const seen = new Set<string>();
  const dynamicTemplates = new Set<string>();

  templates.forEach((template) => {
    if (template.isDynamic) {
      dynamicTemplates.add(template.template);
      return;
    }
    if (seen.has(template.template)) {
      return;
    }
    seen.add(template.template);
    entries.push({ englishPath: template.template });
  });

  for (const template of Array.from(dynamicTemplates)) {
    const generator = DYNAMIC_ROUTE_GENERATORS[template];
    if (!generator) {
      console.warn(`[sitemap] No generator registered for dynamic route ${template}, skipping.`);
      continue;
    }
    let generated: CanonicalPathEntry[] = [];
    try {
      generated = await generator();
    } catch (error) {
      console.error(`[sitemap] Failed to build entries for ${template}`, error);
      continue;
    }
    generated.forEach((entry) => {
      if (!entry?.englishPath || seen.has(entry.englishPath)) {
        return;
      }
      seen.add(entry.englishPath);
      entries.push(entry);
    });
  }

  entries.sort((a, b) => comparePaths(a.englishPath, b.englishPath));
  validateLocaleCounts(entries);
  return entries;
}

function discoverLocalizedRouteTemplates(): RouteTemplate[] {
  if (!fs.existsSync(LOCALIZED_APP_ROOT)) {
    return [];
  }
  const stack = [LOCALIZED_APP_ROOT];
  const map = new Map<string, RouteTemplate>();

  while (stack.length > 0) {
    const current = stack.pop() as string;
    const dirents = safeReadDir(current);
    dirents.forEach((entry) => {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        return;
      }
      if (!entry.isFile() || !PAGE_FILE_PATTERN.test(entry.name)) {
        return;
      }
      const normalized = buildEnglishPathFromDir(path.dirname(fullPath));
      if (!normalized || IGNORED_ROUTE_TEMPLATES.has(normalized)) {
        return;
      }
      map.set(normalized, { template: normalized, isDynamic: normalized.includes('[') });
    });
  }

  return Array.from(map.values()).sort((a, b) => comparePaths(a.template, b.template));
}

function buildEnglishPathFromDir(directory: string): string | null {
  const relative = path.relative(LOCALIZED_APP_ROOT, directory);
  if (relative.startsWith('..')) {
    return null;
  }
  const rawSegments = relative.split(path.sep).filter(Boolean);
  const segments = rawSegments.filter((segment) => !isRouteGroupSegment(segment) && !isParallelRouteSegment(segment));
  if (!segments.length) {
    return '/';
  }
  return `/${segments.join('/')}`;
}

function isRouteGroupSegment(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function isParallelRouteSegment(segment: string): boolean {
  return segment.startsWith('@');
}

function comparePaths(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a === '/') {
    return -1;
  }
  if (b === '/') {
    return 1;
  }
  return a.localeCompare(b);
}

function safeReadDir(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

const DYNAMIC_ROUTE_GENERATORS: Record<string, DynamicRouteGenerator> = {
  '/blog/[slug]': async () =>
    BLOG_ENTRIES.map((entry) => ({
      englishPath: `/blog/${entry.canonicalSlug}`,
      lastModified: entry.lastModified,
      locales: LOCALES.filter((locale) => hasBlogLocale(entry.canonicalSlug, locale)),
    })),
  '/docs/[slug]': async () => {
    const docs = await getContentEntries('content/docs');
    return docs.map((doc) => ({
      englishPath: `/docs/${doc.slug}`,
      lastModified: doc.updatedAt ?? doc.date,
    }));
  },
  '/models/[slug]': async () =>
    modelRoster
      .filter((model) => Boolean(model?.modelSlug))
      .map((model) => ({
        englishPath: `/models/${model.modelSlug}`,
        locales: LOCALES.filter((locale) => hasModelLocale(model.modelSlug, locale)),
      })),
};

function validateLocaleCounts(entries: CanonicalPathEntry[]): void {
  const counts: Record<AppLocale, number> = { en: 0, fr: 0, es: 0 };
  entries.forEach((entry) => {
    const availableLocales = entry.locales ?? LOCALES;
    availableLocales.forEach((locale) => {
      counts[locale] = (counts[locale] ?? 0) + 1;
    });
  });

  const englishCount = counts.en ?? 0;
  LOCALES.forEach((locale) => {
    if (locale === 'en') {
      return;
    }
    const localeCount = counts[locale] ?? 0;
    const difference = Math.abs(englishCount - localeCount);
    if (difference > LOCALE_MISMATCH_TOLERANCE) {
      const warningMessage = `[sitemap] ${locale.toUpperCase()} sitemap has ${localeCount} URLs vs EN ${englishCount} (diff ${difference}).`;
      console.warn(warningMessage);
      if (FAIL_ON_LOCALE_MISMATCH) {
        throw new Error(warningMessage);
      }
    }
  });
}
