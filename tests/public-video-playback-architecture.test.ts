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
