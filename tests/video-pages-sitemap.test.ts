import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const videoSitemapPath = 'frontend/server/sitemaps/video.ts';
const videoPagesSitemapPath = 'frontend/server/sitemaps/video-pages.ts';
const sitemapFacadePath = 'frontend/lib/sitemapData.ts';
const sitemapIndexRoutePath = 'frontend/app/sitemap.xml/route.ts';
const localeSitemapSource = readFileSync('frontend/lib/sitemap/route-discovery.ts', 'utf8');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function firstTagValue(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<]+)</${tag}>`).exec(xml);
  return match?.[1] ?? null;
}

test('video pages sitemap route is separate from localized sitemaps', () => {
  assert.equal(existsSync(videoPagesSitemapPath), true, 'video pages sitemap builder should exist');

  const sitemapFacadeSource = read(sitemapFacadePath);
  const sitemapIndexRouteSource = read(sitemapIndexRoutePath);
  const videoSitemapSource = read(videoSitemapPath);
  const videoPagesSource = read(videoPagesSitemapPath);

  assert.match(localeSitemapSource, /IGNORED_ROUTE_TEMPLATES[\s\S]*'\/video\/\[videoId\]'/);
  assert.doesNotMatch(localeSitemapSource, /listEligibleSeoWatchVideos/);
  assert.match(sitemapFacadeSource, /videoPagesPath = '\/sitemap-video-pages\.xml'/);
  assert.match(sitemapIndexRouteSource, /dynamic = 'force-dynamic'/);
  assert.match(videoSitemapSource, /listEligibleSeoWatchVideos/);
  assert.match(videoSitemapSource, /buildVideoSitemapXml/);
  assert.match(videoPagesSource, /listEligibleSeoWatchVideos/);
  assert.match(videoPagesSource, /buildVideoPagesSitemapXml/);
  assert.doesNotMatch(videoPagesSource, /VIDEO_SEO_WATCHLIST|VIDEO_SEO_EDITORIAL_ENTRIES/);
});

test('video and video-pages sitemaps share canonical URLs and lastmod dates', async () => {
  assert.equal(existsSync(videoPagesSitemapPath), true, 'video pages sitemap builder should exist');

  const { buildVideoSitemapXml, buildVideoPagesSitemapXml } = await import('../frontend/server/sitemaps/video-xml.ts');

  const row = {
    entry: {
      id: 'job_test_video',
      engineFamily: 'seedance',
      publishedAt: '2026-05-10T10:48:29.287Z',
      modifiedAt: '2026-05-19T08:30:00.000Z',
    },
    video: {
      id: 'job_test_video',
      createdAt: '2026-05-10T10:48:29.287Z',
      videoUrl: 'https://media.maxvideoai.com/renders/test/video.mp4',
      thumbUrl: 'https://media.maxvideoai.com/renders/test/thumb.jpg',
      durationSec: 10,
      aspectRatio: '16:9',
    },
    signals: {
      canonicalUrl: 'https://maxvideoai.com/video/seedance-test-video',
      metaDescription: 'Watch a Seedance test video with stable media and approved editorial metadata.',
      durationSec: 10,
      videoObjectName: 'Seedance test video',
      engineLabel: 'Seedance',
      exampleFamilyLabel: 'Seedance',
      capabilityTags: ['text-to-video'],
      styleTags: ['cinematic'],
      aspectRatio: '16:9',
    },
    related: [],
  };

  const videoXml = buildVideoSitemapXml([row as any]);
  const videoPagesXml = buildVideoPagesSitemapXml([row as any]);

  assert.equal(firstTagValue(videoPagesXml, 'loc'), firstTagValue(videoXml, 'loc'));
  assert.equal(firstTagValue(videoPagesXml, 'lastmod'), firstTagValue(videoXml, 'lastmod'));
  assert.equal(firstTagValue(videoPagesXml, 'loc'), row.signals.canonicalUrl);
  assert.equal(firstTagValue(videoPagesXml, 'lastmod'), '2026-05-19');
  assert.match(videoXml, /<video:video>/);
  assert.doesNotMatch(videoPagesXml, /xmlns:video|<video:/);
});
