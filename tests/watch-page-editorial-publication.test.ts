import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VIDEO_SEO_STATUSES, type VideoSeoEditorialEntry } from '../frontend/config/video-seo-editorial';
import type { SeoWatchVideoConfig } from '../frontend/config/video-seo-watchlist';
import { getVideoCanonicalRedirectPath } from '../frontend/lib/video-seo-canonical';
import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals';
import { projectExampleWatchDetail } from '../frontend/server/example-watch-detail';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { ExampleReaderContent } from '../frontend/components/examples/ExampleReaderContent';
import { readerCopy } from '../frontend/components/examples/example-reader-copy';

const video: GalleryVideo = {
  id: 'editorial-publication-fixture', engineId: 'veo-3-1', engineLabel: 'Google Veo 3.1',
  prompt: 'A fully armored medieval knight walks through a quiet courtyard with a steady tracking camera, detailed weathered stone, soft evening light and synchronized footsteps as the scene moves continuously toward an open gate.',
  durationSec: 8, aspectRatio: '16:9', outputWidth: 1920, outputHeight: 1080,
  hasAudio: true, createdAt: '2026-10-01T00:00:00.000Z', visibility: 'public', indexable: true, canUpscale: false,
  videoUrl: 'https://media.maxvideoai.com/publication-fixture.mp4',
  thumbUrl: 'https://media.maxvideoai.com/publication-fixture.webp',
  settingsSnapshot: { surface: 'video', inputMode: 'i2v', prompt: 'A fully armored medieval knight walks through a quiet courtyard with a steady tracking camera, detailed weathered stone, soft evening light and synchronized footsteps as the scene moves continuously toward an open gate.',
    core: { durationSec: 8, aspectRatio: '16:9', resolution: '1080p', audio: true },
    refs: { imageUrl: 'https://media.maxvideoai.com/publication-reference.webp' } },
};
const editorial: VideoSeoEditorialEntry = {
  id: video.id, seoStatus: 'approved', modelSlug: 'veo-3-1', examplesSlug: 'veo', intent: 'image-to-video',
  canonicalSlug: 'knight-publication-fixture', showSourceImages: true,
  h1: 'EDITORIAL title', seoTitle: 'EDITORIAL metadata title', videoObjectName: 'EDITORIAL schema name',
  shortDescription: 'EDITORIAL introduction', metaDescription: 'EDITORIAL metadata description',
  editorialPromptBreakdown: 'EDITORIAL visual workflow context', targetKeyword: 'knight video',
};
// Direct watch metadata builds an entry from the persisted row, including its unapproved title.
const entry: SeoWatchVideoConfig = {
  id: video.id, engineSlug: 'veo-3-1', engineFamily: 'veo', engineLabel: 'Google Veo 3.1',
  sourceType: 'examples', sourcePath: '/examples/veo', sourceLabel: 'Veo examples',
  seoTitle: 'EDITORIAL entry title', intro: 'EDITORIAL entry introduction', reasonForSelection: 'Fixture',
  priority: 1, publishedAt: '2026-10-01T00:00:00.000Z', videoPrimaryIntent: 'image-to-video',
  seoTitleOverride: 'EDITORIAL title override', seoSummaryOverride: 'EDITORIAL summary override',
};

for (const seoStatus of VIDEO_SEO_STATUSES.filter(status => status !== 'approved')) {
  test(`${seoStatus} editorial prose cannot enter public watch, metadata or gallery context`, async () => {
    const unapproved = { ...editorial, seoStatus };
    const signals = deriveWatchPageSignals({ video, entry, editorial: unapproved });
    for (const text of [signals.title, signals.metaTitle, signals.intro, signals.metaDescription,
      signals.videoObjectName, signals.videoDescription, signals.seoPromptContext ?? '']) {
      assert.doesNotMatch(text, /EDITORIAL/, 'only approved editorial prose is public');
    }
    assert.match(signals.intro, /^This .*image to video example shows/);
    assert.equal(signals.seoPromptContext, null);
    assert.deepEqual(signals.sourceImages, []);
    assert.equal(signals.seoStatus, seoStatus, 'keep the real review status for audits');
    assert.equal(signals.indexable, false, 'unapproved selected pages retain noindex eligibility');
    assert.equal(signals.canonicalUrl, 'https://maxvideoai.com/video/knight-publication-fixture');
    assert.equal(getVideoCanonicalRedirectPath({ requestedIdentifier: video.id, videoId: video.id,
      canonicalSlug: signals.canonicalSlug, isEligible: false }), null);
    assert.equal(signals.mode, 'i2v');
    assert.equal(signals.durationSec, 8);
    assert.equal(signals.resolution, '1080p');
    assert.equal(signals.aspectRatio, '16:9');
    assert.equal(signals.hasAudio, true);
    assert.equal(signals.promptText, video.prompt);

    // Exercise the shared reader DTO with both the direct-page and gallery/API paths.
    for (const prepared of [signals, undefined]) {
      const detail = await projectExampleWatchDetail(video, unapproved, async () => ({ totalCents: 200, currency: 'USD' }), getBaseEngines(), prepared);
      assert.ok(detail);
      assert.doesNotMatch(JSON.stringify(detail.context), /EDITORIAL/);
      assert.equal(detail.videoUrl, video.videoUrl);
      assert.equal(detail.posterUrl, video.thumbUrl);
      assert.equal(detail.prompt, video.prompt);
      assert.ok(detail.context.details.length);
      assert.ok(detail.context.notes.length, 'useful prompt advice stays available');
    }
  });
}

test('approved editorial copy is still projected to titles, descriptions and visual context', () => {
  const signals = deriveWatchPageSignals({ video, entry, editorial });
  assert.equal(signals.title, 'EDITORIAL title');
  assert.equal(signals.metaTitle, 'EDITORIAL metadata title');
  assert.equal(signals.metaDescription, 'EDITORIAL metadata description');
  assert.equal(signals.videoDescription, 'EDITORIAL introduction');
  assert.equal(signals.videoObjectName, 'EDITORIAL schema name');
  assert.equal(signals.intro, 'EDITORIAL introduction');
  assert.equal(signals.seoPromptContext, 'EDITORIAL visual workflow context');
  assert.equal(signals.sourceImages.length, 1);
});

test('missing editorial copy retains the existing factual fallback', () => {
  const signals = deriveWatchPageSignals({ video, editorial: null });
  assert.match(signals.intro, /^This .*image to video example shows/);
  assert.equal(signals.seoStatus, null);
  assert.equal(signals.canonicalUrl, 'https://maxvideoai.com/video/editorial-publication-fixture');
});

test('the rendered draft reader keeps useful details, current quotes and their prompt-only disclaimer', async () => {
  const draft = { ...editorial, seoStatus: 'draft' as const,
    shortDescription: 'Draft watch-page candidate from the next SEO shortlist. Visual review is required before approval.' };
  const quote = async () => ({ totalCents: 200, currency: 'USD' });
  const detail = await projectExampleWatchDetail(video, draft, quote, getBaseEngines());
  const fallback = await projectExampleWatchDetail(video, null, quote, getBaseEngines());
  assert.ok(detail);
  assert.ok(detail.quotes.length > 0);
  assert.deepEqual(detail.quotes, fallback?.quotes, 'review status cannot change the quoted settings or amounts');
  assert.deepEqual(detail.scenario, fallback?.scenario);
  const savedReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, writable: true, value: React });
  try {
    const html = renderToStaticMarkup(React.createElement(ExampleReaderContent, { detail, copy: readerCopy('en'), locale: 'en', headingLevel: 'h1' }));
    assert.doesNotMatch(html, /Draft watch-page candidate|Visual review is required|EDITORIAL/);
    assert.match(html, /Video details &amp; tips/);
    assert.match(html, /Prompt improvement notes/);
    assert.match(html, /1080p/);
    assert.match(html, /Only the text prompt is reused; reference images and videos are not included/);
    assert.match(html, /Review the final price in the app before generating/);
  } finally {
    if (savedReact) Object.defineProperty(globalThis, 'React', savedReact);
    else Reflect.deleteProperty(globalThis, 'React');
  }
});
