import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { SITEMAP_MANUAL_TIMESTAMPS } from '../frontend/config/sitemap-timestamps.ts';

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));

test('the sitemap index never reports a date older than its locale or model children', async () => {
  const react = frontendRequire('react') as { cache?: (fn: unknown) => unknown };
  react.cache ??= (fn) => fn;
  const previousEnvironment = process.env.NODE_ENV;
  const originalDates = SITEMAP_MANUAL_TIMESTAMPS.sitemaps;
  // Supply video dates before initializing lastmod's config maps. The test
  // exercises the complete index builder without requiring a database.
  SITEMAP_MANUAL_TIMESTAMPS.sitemaps = Object.fromEntries(
    ['en', 'fr', 'es', 'models', 'video', 'video-pages'].map((name) => [`sitemap-${name}.xml`, '2020-01-01']),
  );
  process.env.NODE_ENV = 'development';
  try {
    const sitemap = await import('../frontend/lib/sitemapData.ts');
    const dates = await import('../frontend/lib/sitemap/lastmod.ts');
    const xml = await sitemap.buildSitemapIndexXml();
    const children: Record<string, string | undefined> = {};
    for (const locale of ['en', 'fr', 'es'] as const) {
      children[`sitemap-${locale}.xml`] = dates.getLatestEntryDate(await sitemap.getLocaleSitemapEntries(locale));
    }
    children['sitemap-models.xml'] = dates.getModelsSitemapLastModified();
    for (const [file, childDate] of Object.entries(children)) {
      const block = xml.split('<sitemap>').find((entry) => entry.includes(`/${file}</loc>`));
      const indexDate = block?.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
      assert.equal(indexDate, childDate, `${file} must reflect its newer child date`);
      assert.notEqual(indexDate, '2020-01-01');
    }
  } finally {
    SITEMAP_MANUAL_TIMESTAMPS.sitemaps = originalDates;
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});
