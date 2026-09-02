import assert from 'node:assert/strict';
import test from 'node:test';
import { SITEMAP_MANUAL_TIMESTAMPS } from '../frontend/config/sitemap-timestamps.ts';
import { resolveVideoSitemapDates } from '../frontend/server/sitemaps/video-dates.ts';

test('video sitemap lastmod uses editorial modified date without changing publication date', () => {
  const dates = resolveVideoSitemapDates(
    {
      publishedAt: '2026-04-10T21:43:19.604Z',
      modifiedAt: '2026-05-18T22:28:08.165Z',
    },
    { createdAt: '2026-04-10T21:43:19.604Z' }
  );

  assert.equal(dates.lastModified, '2026-05-18');
  assert.equal(dates.publicationDate, '2026-04-10T21:43:19.604Z');
});

test('video sitemap dates fall back to published video date for static entries', () => {
  const dates = resolveVideoSitemapDates(
    {
      publishedAt: '2026-03-06T22:53:48.997Z',
    },
    { createdAt: '2026-03-06T22:53:48.997Z' }
  );

  assert.equal(dates.lastModified, '2026-03-06');
  assert.equal(dates.publicationDate, '2026-03-06T22:53:48.997Z');
});

test('P0 model and family pages receive the launch timestamp without pre-bumping video sitemaps', () => {
  assert.equal(SITEMAP_MANUAL_TIMESTAMPS.sitemaps?.['sitemap-video.xml'], undefined);
  assert.equal(SITEMAP_MANUAL_TIMESTAMPS.sitemaps?.['sitemap-video-pages.xml'], undefined);
  for (const route of [
    '/models/wan-3',
    '/models/wan-3-prime',
    '/models/ltx-2-5-fast',
    '/models/ltx-2-5-pro',
    '/models/grok-imagine-video-1-5',
    '/models/flux-3',
    '/models/flux-3-draft',
    '/examples/wan',
    '/examples/ltx',
    '/examples/grok',
    '/examples/flux',
  ]) {
    assert.equal(SITEMAP_MANUAL_TIMESTAMPS.routes?.[route], '2026-09-02', route);
  }
});
