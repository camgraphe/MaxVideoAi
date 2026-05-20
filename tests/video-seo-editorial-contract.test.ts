import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { VIDEO_SEO_WATCHLIST } from '../frontend/config/video-seo-watchlist.ts';
import {
  VIDEO_SEO_EDITORIAL_ENTRIES,
  getVideoSeoEditorialEntry,
} from '../frontend/config/video-seo-editorial.ts';
import {
  getDuplicateVideoObjectNames,
  isVideoSeoEditorialApproved,
  validateVideoSeoEditorialEntry,
} from '../frontend/lib/video-seo-editorial-qa.ts';

const deriveSource = readFileSync('frontend/server/watch-page-signals/derive.ts', 'utf8');
const canonicalSignalsSource = readFileSync('frontend/server/watch-page-signals/canonical.ts', 'utf8');
const sitemapRouteSource = readFileSync('frontend/server/sitemaps/video.ts', 'utf8');
const sitemapXmlSource = readFileSync('frontend/server/sitemaps/video-xml.ts', 'utf8');
const contentSource = readFileSync('frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx', 'utf8');
const pageSource = readFileSync('frontend/app/(core)/video/[id]/page.tsx', 'utf8');
const editorialSource = readFileSync('frontend/config/video-seo-editorial.ts', 'utf8');

const removedFromSitemap = new Set([
  'job_685fb5c2-6f2a-4da3-a246-19ed5829e1c4',
  'job_2c958e35-92e7-4c0f-8828-ec49476c8c4e',
  'job_71905754-c5e6-4078-864d-f17cd7f62d95',
]);
const validPromptFixture =
  'This representative video prompt has enough editorial detail to satisfy the quality gate for approved SEO watch pages, including subject, camera movement, timing, setting, visual style, output format and production intent.';

function assertCleanEditorialText(label: string, value: string) {
  assert.doesNotMatch(value, /\b(examples hero|model hero)\b/i, `${label} must not use rollout labels`);
  assert.doesNotMatch(value, /…/, `${label} must not contain ellipsis`);
  assert.doesNotMatch(value.trim(), /\b(the|a|an|in|of|with|and)$/i, `${label} must not look truncated`);
}

test('every watchlist video has an explicit editorial SEO entry', () => {
  assert.equal(VIDEO_SEO_EDITORIAL_ENTRIES.length, VIDEO_SEO_WATCHLIST.length);

  for (const watchVideo of VIDEO_SEO_WATCHLIST) {
    const editorial = getVideoSeoEditorialEntry(watchVideo.id);
    assert.ok(editorial, `${watchVideo.id} should have editorial SEO config`);
  }
});

test('editorial SEO config uses status, not a direct sitemap toggle', () => {
  assert.doesNotMatch(editorialSource, /keepInVideoSitemap/);

  for (const entry of VIDEO_SEO_EDITORIAL_ENTRIES) {
    assert.ok(['candidate', 'draft', 'needs_edits', 'approved', 'disabled'].includes(entry.seoStatus));
    assert.ok(entry.targetKeyword.trim().length > 0, `${entry.id} should have a target keyword`);
  }
});

test('approved video SEO entries pass static editorial QA', () => {
  assert.deepEqual([...getDuplicateVideoObjectNames()], []);

  for (const entry of VIDEO_SEO_EDITORIAL_ENTRIES) {
    assertCleanEditorialText(`${entry.id} seoTitle`, entry.seoTitle);
    assertCleanEditorialText(`${entry.id} h1`, entry.h1);
    assertCleanEditorialText(`${entry.id} VideoObject.name`, entry.videoObjectName);

    if (entry.seoStatus !== 'approved') continue;

    const qa = validateVideoSeoEditorialEntry(entry, {
      promptText: validPromptFixture,
      hasVideoAsset: true,
      hasThumbnailAsset: true,
      hasStableVideoAsset: true,
      hasStableThumbnailAsset: true,
      hasInternalLinkTargets: true,
      canonicalUrl: `https://maxvideoai.com/video/${entry.id}`,
      expectedCanonicalUrl: `https://maxvideoai.com/video/${entry.id}`,
      canonicalTargetIndexable: true,
      technicallyIndexable: true,
      duplicateVideoObjectNames: getDuplicateVideoObjectNames(),
    });
    assert.equal(qa.passed, true, `${entry.id} should pass QA: ${qa.errors.join(', ')}`);
    assert.equal(isVideoSeoEditorialApproved(entry, {
      promptText: validPromptFixture,
      hasVideoAsset: true,
      hasThumbnailAsset: true,
      hasStableVideoAsset: true,
      hasStableThumbnailAsset: true,
      hasInternalLinkTargets: true,
      canonicalUrl: `https://maxvideoai.com/video/${entry.id}`,
      expectedCanonicalUrl: `https://maxvideoai.com/video/${entry.id}`,
      canonicalTargetIndexable: true,
      technicallyIndexable: true,
      duplicateVideoObjectNames: getDuplicateVideoObjectNames(),
    }), true);
  }
});

test('weak current pages are held out of the video sitemap', () => {
  for (const id of removedFromSitemap) {
    const entry = getVideoSeoEditorialEntry(id);
    assert.equal(entry?.seoStatus, 'needs_edits');
    assert.equal(isVideoSeoEditorialApproved(entry, {
      promptText: 'too short',
      hasVideoAsset: true,
      hasThumbnailAsset: true,
      technicallyIndexable: true,
      duplicateVideoObjectNames: getDuplicateVideoObjectNames(),
    }), false);
  }
});

test('watch page rendering and sitemap depend on editorial approval', () => {
  assert.match(deriveSource, /getVideoSeoEditorialEntry/, 'watch page signals should read editorial overrides');
  assert.match(deriveSource, /isVideoSeoEditorialApproved/, 'indexability should depend on editorial approval');
  assert.match(deriveSource, /isStablePublicMediaUrl/, 'watch page eligibility should block temporary media URLs');
  assert.match(deriveSource, /buildWatchPageCanonicalState/, 'watch page eligibility should delegate canonical state');
  assert.match(canonicalSignalsSource, /buildExpectedVideoCanonicalUrl/, 'watch page eligibility should build production watch canonicals');
  assert.match(canonicalSignalsSource, /validateVideoSeoCanonical/, 'watch page eligibility should validate canonical state');
  assert.match(deriveSource, /hasInternalLinkTargets/, 'watch page eligibility should require internal link targets');
  assert.match(deriveSource, /seoStatus/, 'watch page signals should expose SEO status');
  assert.match(deriveSource, /editorialQaErrors/, 'watch page signals should expose editorial QA errors');
  assert.match(contentSource, /name: signals\.videoObjectName/, 'VideoObject.name should use editorial copy');
  assert.match(contentSource, /description: signals\.metaDescription/, 'VideoObject.description should align with OG metadata');
  assert.match(contentSource, /page\.entry\?\.publishedAt \?\? video\.createdAt/, 'VideoObject.uploadDate should align with sitemap publication date');
  assert.match(contentSource, /const canonical = signals\.canonicalUrl/, 'VideoObject URL should use the derived production watch canonical');
  assert.match(pageSource, /getVideoCanonicalRedirectPath/, 'watch page should redirect legacy job URLs to approved canonical slugs');
  assert.match(pageSource, /page\?\.isEligible \? page\.signals\.canonicalUrl/, 'metadata canonical should use slugged canonicals for eligible pages');
  assert.match(sitemapXmlSource, /signals\.videoObjectName/, 'video sitemap title should align with VideoObject.name');
  assert.match(sitemapXmlSource, /signals\.metaDescription/, 'video sitemap description should align with page metadata');
  assert.match(sitemapXmlSource, /getVideoWatchSitemapEntries/, 'video sitemap loc should use the shared watch sitemap entry builder');
  assert.match(sitemapRouteSource, /listEligibleSeoWatchVideos/, 'sitemap should use eligible rows instead of a direct toggle');
});
