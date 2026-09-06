import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);

test('public full-duration readers share source, fallback, and measurement ownership', async () => {
  const [hook, measurement, home, model, examples] = await Promise.all([
    readFile(new URL('frontend/components/media/usePublicVideoPlayback.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/lib/public-video-playback.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/components/marketing/home/useHeroVideoPlayback.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/components/marketing/ModelHeroMedia.client.tsx', ROOT), 'utf8'),
    readFile(new URL('frontend/components/examples/ExamplesHeroVideo.client.tsx', ROOT), 'utf8'),
  ]);

  for (const reader of [home, model, examples]) {
    assert.match(reader, /usePublicVideoPlayback/);
    assert.doesNotMatch(reader, /resolvePublicVideoRendition|public-video-renditions\.generated/);
  }
  assert.match(hook, /selectPublicVideoPlaybackRendition/);
  assert.match(hook, /dispatchAnalyticsEvent/);
  assert.match(measurement, /requestVideoFrameCallback/);
  assert.doesNotMatch(measurement, /setInterval|requestAnimationFrame/);
});

test('watch, comparisons and card previews keep shared lifecycle and original URL boundaries', async () => {
  const read = (path: string) => readFile(new URL(path, ROOT), 'utf8');
  const [controls, watch, comparison, card, cardPlayback, comparisonMedia, watchContent] = await Promise.all([
    read('frontend/components/media/usePublicVideoControls.ts'),
    read('frontend/components/watch/WatchVideoPlayer.tsx'),
    read('frontend/components/media/PublicVideoPlayer.client.tsx'),
    read('frontend/components/examples/ExampleGalleryCard.tsx'),
    read('frontend/components/examples/useExampleCardPlayback.ts'),
    read('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_components/CompareShowdownMedia.tsx'),
    read('frontend/app/(core)/video/[id]/_components/VideoWatchContent.tsx'),
  ]);
  for (const reader of [watch, comparison]) assert.match(reader, /usePublicVideoControls/);
  for (const owner of [controls, cardPlayback]) {
    assert.match(owner, /usePublicVideoPlayback/);
    assert.doesNotMatch(owner, /resolvePublicVideoRendition|public-video-renditions\.generated/);
  }
  assert.match(comparison, /usePublicVideoControls\(src, 'comparison', 'original'\)/);
  assert.match(comparisonMedia, /buildPublicVideoPosterUrl\(side.posterUrl\)/);
  assert.match(card, /video.previewVideoUrl \?\? video.videoUrl/);
  assert.match(card, /useExampleCardPlayback/);
  assert.match(card, /preload="none"/);
  assert.doesNotMatch(card, /poster=\{/);
  assert.doesNotMatch(watchContent, /public-video-renditions|usePublicVideoControls/);
  assert.match(watchContent, /contentUrl: videoUrl/);
});
