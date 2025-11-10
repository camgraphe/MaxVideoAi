import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import modelRoster from '@/config/model-roster.json';
import {
  BLOG_ENTRIES,
  CONTENT_ROOT,
  LOCALES,
  buildLanguageAlternates,
  localizePathFromEnglish,
  normalizePathSegments,
} from '@/lib/i18n/paths';

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

  collectDocsSlugs().forEach(({ path, lastmod }) => addPath(path, lastmod));

  BLOG_ENTRIES.forEach((entry) => addPath(`/blog/${entry.canonicalSlug}`, entry.lastModified));

  const dynamicEntries = await collectDynamicDbPaths();
  dynamicEntries.forEach(({ path, lastmod }) => addPath(path, lastmod));

  const sitemapEntries: SitemapEntry[] = [];
  for (const [pathKey, lastmod] of entries.entries()) {
    const alternates = buildLanguageAlternates(pathKey, buildAbsoluteUrl);
    LOCALES.forEach((locale) => {
      const localizedPath = localizePathFromEnglish(locale, pathKey);
      const url = buildAbsoluteUrl(localizedPath);
      sitemapEntries.push({
        url,
        lastModified: lastmod,
        alternates,
      });
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

type DocEntry = { path: string; lastmod?: string };

function collectDocsSlugs(): DocEntry[] {
  const dir = path.join(CONTENT_ROOT, 'docs');
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => {
      const filePath = path.join(dir, entry.name);
      const stats = fs.statSync(filePath);
      const lastmod = stats.mtime ? stats.mtime.toISOString() : undefined;
      return {
        path: normalizePathSegments('/docs', entry.name.replace(/\.(md|mdx)$/i, '')),
        lastmod,
      };
    });
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
