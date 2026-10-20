import assert from 'node:assert/strict';
import test from 'node:test';
import { VIDEO_SEO_EDITORIAL_ENTRIES } from '../frontend/config/video-seo-editorial.ts';
import { VIDEO_SEO_WATCHLIST } from '../frontend/config/video-seo-watchlist.ts';
import { resolveExampleCanonicalSlug } from '../frontend/lib/examples-links.ts';
import { getExampleFamilyPageConfig } from '../frontend/lib/model-families.ts';
import { deriveWatchPageSignals } from '../frontend/server/watch-page-signals.ts';
import type { GalleryVideo } from '../frontend/server/videos-normalization.ts';

const video = {
  id: 'family-link-fixture',
  engineId: 'minimax-h3',
  engineLabel: 'MiniMax H3',
  visibility: 'public',
  indexable: true,
  canUpscale: false,
  videoUrl: 'https://media.maxvideoai.com/fixture.mp4',
  thumbUrl: 'https://media.maxvideoai.com/fixture.jpg',
  prompt: 'A lighthouse keeper moves through four connected shots in a storm, with consistent identity, timed dialogue, cinematic camera motion and native stereo sound.',
  durationSec: 15,
  aspectRatio: '16:9',
  createdAt: '2026-08-08T00:00:00Z',
} as GalleryVideo;

test('stored editorial aliases cannot create a nonexistent examples route', () => {
  const editorial = { ...VIDEO_SEO_EDITORIAL_ENTRIES[0], id: video.id, examplesSlug: 'minimax' };
  const signals = deriveWatchPageSignals({ video, editorial });
  assert.equal(signals.parentPath, '/examples/hailuo');
  assert.equal(signals.exampleFamily, 'hailuo');
  assert.equal(signals.modelPath, '/models/minimax-h3');
  assert.equal(signals.canonicalSlug, editorial.canonicalSlug);
});

test('every authored watch example points to a real canonical family', () => {
  for (const entry of VIDEO_SEO_EDITORIAL_ENTRIES) {
    const family = resolveExampleCanonicalSlug(entry.modelSlug);
    assert.ok(family, entry.modelSlug);
    assert.ok(getExampleFamilyPageConfig(family), family);
    assert.equal(entry.examplesSlug, family, entry.id);
  }
  for (const entry of VIDEO_SEO_WATCHLIST) {
    if (entry.exampleFamily) assert.equal(entry.exampleFamily, resolveExampleCanonicalSlug(entry.engineSlug), entry.id);
  }
});
