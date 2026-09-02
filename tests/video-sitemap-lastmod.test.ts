import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SITEMAP_MANUAL_TIMESTAMPS } from '../frontend/config/sitemap-timestamps.ts';
import { VIDEO_SEO_WATCHLIST } from '../frontend/config/video-seo-watchlist.ts';
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

test('P0 watch candidates use the accepted durable asset date as publication and lastmod', () => {
  const manifest = JSON.parse(readFileSync('docs/model-launch/p0-video-example-pack.json', 'utf8')) as {
    assets: Array<{ videoId: string; acceptedAt: string; watchPageCandidate: boolean }>;
  };
  const selected = manifest.assets.filter(({ watchPageCandidate }) => watchPageCandidate);
  assert.equal(selected.length, 7);

  for (const asset of selected) {
    const entry = VIDEO_SEO_WATCHLIST.find(({ id }) => id === asset.videoId);
    assert.ok(entry, asset.videoId);
    assert.equal(entry.publishedAt, asset.acceptedAt);
    assert.equal(entry.modifiedAt, asset.acceptedAt);
    assert.deepEqual(resolveVideoSitemapDates(entry, { createdAt: asset.acceptedAt }), {
      lastModified: '2026-09-02',
      publicationDate: asset.acceptedAt,
    });
  }
});

test('P0 model, family and video sitemaps receive the launch timestamp', () => {
  assert.equal(SITEMAP_MANUAL_TIMESTAMPS.sitemaps?.['sitemap-video.xml'], '2026-09-02');
  assert.equal(SITEMAP_MANUAL_TIMESTAMPS.sitemaps?.['sitemap-video-pages.xml'], '2026-09-02');
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
