import type { MetadataRoute } from 'next';

import { getSitemapTimestamp } from '@/lib/sitemapTimestamp';
import { getSitemapEntries } from '@/lib/sitemapData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await getSitemapEntries();
  const canonicalEntries = entries.filter((entry) => !entry.url.includes('?') && !entry.url.includes('#'));
  const seen = new Set<string>();

  return canonicalEntries
    .filter((entry) => {
      const key = entry.url.replace(/\/+$/, '');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((entry) => ({
      url: entry.url,
      lastModified: getSitemapTimestamp(entry.lastModified),
      alternates: entry.alternates ? { languages: entry.alternates } : undefined,
    }));
}
