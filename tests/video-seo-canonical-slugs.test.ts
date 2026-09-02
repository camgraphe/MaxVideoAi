import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDefaultVideoSeoCanonicalSlug,
  buildExpectedVideoCanonicalUrl,
  getVideoCanonicalRedirectPath,
  normalizeVideoSeoCanonicalSlug,
} from '../frontend/lib/video-seo-canonical.ts';
import { VIDEO_SEO_EDITORIAL_ENTRIES } from '../frontend/config/video-seo-editorial.ts';
import { validateVideoSeoEditorialUpdatePayload } from '../frontend/server/video-seo-editorial.ts';

const videoId = 'job_55bfb245-ea0f-44e1-a3d8-7a24039b3a9e';
const canonicalSlug = 'google-veo-3-1-fast-product-ad-example-futuristic-street-dancer';
const slugWithShortId = `${canonicalSlug}-55bfb245`;

const completeApprovedPayload = {
  seoStatus: 'approved',
  seoTitle: 'Google Veo 3.1 Fast product ad example: futuristic street dancer — MaxVideoAI',
  metaDescription:
    'Watch a complete Google Veo 3.1 Fast product ad example with public assets, prompt details and related video examples.',
  h1: 'Google Veo 3.1 Fast product ad example: futuristic street dancer',
  videoObjectName: 'Google Veo 3.1 Fast product ad example: futuristic street dancer',
  shortDescription:
    'This watch page shows a Google Veo 3.1 Fast product ad render with a neon street dancer, prompt details and related Veo examples.',
  targetKeyword: 'Veo 3.1 Fast product ad example',
  intent: 'product-ad',
  modelSlug: 'google-veo-3-1-fast',
  examplesSlug: 'veo',
  canonicalSlug,
};

const qaContext = {
  promptText:
    'A detailed cinematic product ad prompt with subject, neon lighting, camera movement, timing, audio cues, output format, commercial intent, scene continuity, pacing, visual style and final framing for a complete SEO validation fixture.',
  hasVideoAsset: true,
  hasThumbnailAsset: true,
  hasStableVideoAsset: true,
  hasStableThumbnailAsset: true,
  hasInternalLinkTargets: true,
  canonicalUrl: `https://maxvideoai.com/video/${canonicalSlug}`,
  expectedCanonicalUrl: `https://maxvideoai.com/video/${canonicalSlug}`,
  canonicalTargetIndexable: true,
  technicallyIndexable: true,
  duplicateVideoObjectNames: new Set<string>(),
};

test('video SEO canonical slugs normalize titles and strip redundant branding', () => {
  assert.equal(
    normalizeVideoSeoCanonicalSlug('  Google Veo 3.1 Fast: Futuristic Street Dancer — MaxVideoAI!! '),
    'google-veo-3-1-fast-futuristic-street-dancer'
  );
  assert.equal(
    buildDefaultVideoSeoCanonicalSlug({
      videoId,
      title: 'Google Veo 3.1 Fast product ad example: futuristic street dancer — MaxVideoAI',
    }),
    slugWithShortId
  );
});

test('video SEO canonical URL builder prefers the approved readable slug', () => {
  assert.equal(buildExpectedVideoCanonicalUrl(videoId, canonicalSlug), `https://maxvideoai.com/video/${canonicalSlug}`);
  assert.equal(buildExpectedVideoCanonicalUrl(videoId), `https://maxvideoai.com/video/${videoId}`);
});

test('video watch routing redirects legacy job URLs only after the slugged page is indexable', () => {
  assert.equal(
    getVideoCanonicalRedirectPath({
      requestedIdentifier: videoId,
      videoId,
      canonicalSlug,
      isEligible: true,
    }),
    `/video/${canonicalSlug}`
  );
  assert.equal(
    getVideoCanonicalRedirectPath({
      requestedIdentifier: canonicalSlug,
      videoId,
      canonicalSlug,
      isEligible: true,
    }),
    null
  );
  assert.equal(
    getVideoCanonicalRedirectPath({
      requestedIdentifier: videoId,
      videoId,
      canonicalSlug,
      isEligible: false,
    }),
    null
  );
});

test('video SEO editorial validation protects existing canonical slugs from accidental changes', () => {
  const existing = { ...completeApprovedPayload, id: videoId, canonicalSlug: 'existing-veo-canonical-slug' };

  const blocked = validateVideoSeoEditorialUpdatePayload({
    videoId,
    fallback: existing,
    payload: completeApprovedPayload,
    qaContext,
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Canonical slug is locked/i);

  const unchanged = validateVideoSeoEditorialUpdatePayload({
    videoId,
    fallback: existing,
    payload: { ...completeApprovedPayload, canonicalSlug: existing.canonicalSlug },
    qaContext: {
      ...qaContext,
      canonicalUrl: 'https://maxvideoai.com/video/existing-veo-canonical-slug',
      expectedCanonicalUrl: 'https://maxvideoai.com/video/existing-veo-canonical-slug',
    },
  });
  assert.equal(unchanged.ok, true);

  const confirmed = validateVideoSeoEditorialUpdatePayload({
    videoId,
    fallback: existing,
    payload: { ...completeApprovedPayload, allowCanonicalSlugChange: true },
    qaContext,
  });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.entry.canonicalSlug, canonicalSlug);
});

test('each P0 video model owns one approved readable watch-page canonical slug', () => {
  const expected = new Map([
    ['wan-3', 'wan-3-alpine-runner-multishot'],
    ['wan-3-prime', 'wan-3-prime-chef-multishot'],
    ['ltx-2-5-fast', 'ltx-2-5-fast-street-rhythm'],
    ['ltx-2-5-pro', 'ltx-2-5-pro-lantern-release'],
    ['grok-imagine-video-1-5', 'grok-1-5-lunar-barista'],
    ['flux-3', 'flux-3-season-shifting-station'],
    ['flux-3-draft', 'flux-3-draft-neon-cyclist'],
  ]);

  for (const [modelSlug, expectedCanonicalSlug] of expected) {
    const entries = VIDEO_SEO_EDITORIAL_ENTRIES.filter((entry) => entry.modelSlug === modelSlug);
    const approved = entries.filter((entry) => entry.seoStatus === 'approved');
    assert.equal(approved.length, 1, modelSlug);
    assert.equal(approved[0]?.canonicalSlug, expectedCanonicalSlug);
    assert.equal(normalizeVideoSeoCanonicalSlug(expectedCanonicalSlug), expectedCanonicalSlug);
  }
});
