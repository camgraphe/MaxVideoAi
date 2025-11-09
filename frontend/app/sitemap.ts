import type { MetadataRoute } from 'next';

import { getSitemapTimestamp } from '@/lib/sitemapTimestamp';
import { getSitemapEntries } from '@/lib/sitemapData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();

  return entries.map((entry) => ({
    url: entry.url,
    lastModified: getSitemapTimestamp(entry.lastModified),
    alternates: entry.alternates ? { languages: entry.alternates } : undefined,
  }));
}
