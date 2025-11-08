import type { MetadataRoute } from 'next';
import { getSitemapBuildTimestamp } from '@/lib/sitemapTimestamp';
import { fetchModelSlugs, type SitemapRow } from '@/lib/sitemapData';

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://maxvideoai.com').replace(/\/+$/, '');

export const revalidate = 60 * 60; // 1 hour

export default async function sitemapVideo(): Promise<MetadataRoute.Sitemap> {
  const fallbackLastModified = getSitemapBuildTimestamp();
  const models = await fetchModelSlugs();

  return mapRowsToEntries('models', models, fallbackLastModified);
}

function mapRowsToEntries(
  segment: string,
  rows: SitemapRow[],
  fallback: string
): MetadataRoute.Sitemap {
  return rows
    .filter((row) => typeof row.slug === 'string' && row.slug.trim().length > 0)
    .map((row) => ({
      url: `${BASE_URL}/${segment}/${encodeURIComponent(row.slug!.trim())}`,
      lastModified: formatLastModified(row.updated_at, fallback),
    }));
}

function formatLastModified(value: SitemapRow['updated_at'], fallback: string): string {
  if (!value) return fallback;
  try {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  } catch {
    return fallback;
  }
}
