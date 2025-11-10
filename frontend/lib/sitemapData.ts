import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { Pool } from 'pg';
import modelRoster from '@/config/model-roster.json';
import localizedSlugConfig from '@/config/localized-slugs.json';

type Locale = 'en' | 'fr' | 'es';

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

const LOCALES: Locale[] = ['en', 'fr', 'es'];
const LOCALE_PREFIXES: Record<Locale, string> = { en: '', fr: 'fr', es: 'es' };

const MARKETING_CORE_PATHS = [
  '/',
  '/models',
  '/examples',
  '/sitemap-video.xml',
  '/workflows',
  '/pricing',
  '/pricing-calculator',
  '/docs',
  '/blog',
  '/about',
  '/contact',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/changelog',
  '/status',
];

const CONTENT_ROOT = path.join(process.cwd(), 'content');
const BLOG_SLUG_MAP = buildBlogSlugMap();

type LocalizedSegmentConfig = Record<Locale, string> & { en: string };
const LOCALIZED_SEGMENT_MAP = new Map<string, Record<Locale, string>>(
  Object.values(localizedSlugConfig as Record<string, LocalizedSegmentConfig>).map((value) => [
    value.en,
    { en: value.en, fr: value.fr ?? value.en, es: value.es ?? value.en } as Record<Locale, string>,
  ])
);

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

  collectDocsSlugs().forEach((slug) => addPath(slug));

  BLOG_SLUG_MAP.forEach((_localeMap, canonicalSlug) => addPath(`/blog/${canonicalSlug}`));

  const dynamicEntries = await collectDynamicDbPaths();
  dynamicEntries.forEach(({ path, lastmod }) => addPath(path, lastmod));

  const sitemapEntries: SitemapEntry[] = [];
  for (const [pathKey, lastmod] of entries.entries()) {
    const url = buildAbsoluteUrl(pathKey);
    sitemapEntries.push({
      url,
      lastModified: lastmod,
      alternates: buildLanguageAlternates(pathKey),
    });
  }

  return sitemapEntries;
}

function buildAbsoluteUrl(pathname: string): string {
  const normalized = pathname === '/' ? '/' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized === '/') {
    return SITE_URL;
  }
  return `${SITE_URL}${normalized}`;
}

function buildLanguageAlternates(englishPath: string): Record<string, string> {
  const map: Record<string, string> = {};
  LOCALES.forEach((locale) => {
    const localized = localizePathFromEnglish(locale, englishPath);
    map[locale] = buildAbsoluteUrl(localized);
  });
  map['x-default'] = buildAbsoluteUrl(englishPath);
  return map;
}

function collectDocsSlugs(): string[] {
  const dir = path.join(CONTENT_ROOT, 'docs');
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => normalizePathSegments('/docs', entry.name.replace(/\.(md|mdx)$/i, '')));
}

function buildBlogSlugMap(): Map<string, Record<Locale, string>> {
  const map = new Map<string, Record<Locale, string>>();
  LOCALES.forEach((locale) => {
    const dir = path.join(CONTENT_ROOT, locale, 'blog');
    if (!fs.existsSync(dir)) return;
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name));
    entries.forEach((entry) => {
      const filePath = path.join(dir, entry.name);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(raw);
      const slug = (data.slug || entry.name.replace(/\.(md|mdx)$/i, '')).trim();
      const canonicalSlug = (data.canonicalSlug || (locale === 'en' ? slug : undefined) || slug).trim();
      if (!map.has(canonicalSlug)) {
        map.set(canonicalSlug, {} as Record<Locale, string>);
      }
      map.get(canonicalSlug)![locale] = slug;
    });
  });
  return map;
}

async function collectDynamicDbPaths(): Promise<Array<{ path: string; lastmod?: string }>> {
  const [models, examples, workflows] = await Promise.all([
    fetchSlugsFromDb('models', '/models'),
    fetchSlugsFromDb('examples', '/examples'),
    fetchSlugsFromDb('workflows', '/workflows'),
  ]);
  return [...models, ...examples, ...workflows];
}

function resolveDatabaseUrl(): string | null {
  return (
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    null
  );
}

async function fetchSlugsFromDb(
  tableName: string,
  basePath: string
): Promise<Array<{ path: string; lastmod?: string }>> {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    return [];
  }
  const pool = new Pool({ connectionString });
  try {
    const { rows } = await pool.query<{ slug: string | null; updated_at: string | Date | null }>(
      `SELECT slug, updated_at FROM ${tableName} WHERE slug IS NOT NULL`
    );
    return rows
      .filter((row) => typeof row.slug === 'string' && row.slug.trim().length > 0)
      .map((row) => {
        const slug = row.slug?.trim() ?? '';
        const lastmod = row.updated_at ? new Date(row.updated_at).toISOString() : undefined;
        return {
          path: normalizePathSegments(basePath, slug),
          lastmod,
        };
      });
  } catch (error) {
    console.warn(`[sitemap] skipped ${tableName} slugs`, error instanceof Error ? error.message : error);
    return [];
  } finally {
    try {
      await pool.end();
    } catch {}
  }
}

function localizePathFromEnglish(locale: Locale, englishPath: string): string {
  if (locale === 'en') {
    return englishPath;
  }
  const prefix = LOCALE_PREFIXES[locale];
  if (englishPath === '/') {
    return prefix ? `/${prefix}` : '/';
  }
  const segments = englishPath.split('/').filter(Boolean);
  if (!segments.length) {
    return prefix ? `/${prefix}` : '/';
  }
  const [firstSegment, ...rest] = segments;
  const localizedFirst = LOCALIZED_SEGMENT_MAP.get(firstSegment)?.[locale] ?? firstSegment;
  if (firstSegment === 'blog' && rest.length > 0) {
    const slug = rest[0];
    const localizedSlug = BLOG_SLUG_MAP.get(slug)?.[locale] ?? slug;
    return normalizePathSegments(prefix, 'blog', localizedSlug, ...rest.slice(1));
  }
  return normalizePathSegments(prefix, localizedFirst, ...rest);
}

function normalizePathSegments(...segments: Array<string | undefined | null>): string {
  const filtered = segments
    .flatMap((segment) => (segment ? String(segment).split('/') : []))
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!filtered.length) {
    return '/';
  }
  return `/${filtered.join('/')}`;
}
