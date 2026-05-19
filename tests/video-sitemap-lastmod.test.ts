import assert from 'node:assert/strict';
import test from 'node:test';
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
