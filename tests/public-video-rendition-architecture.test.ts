import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const ROOT = new URL('../', import.meta.url);

test('public rendition state and media runtime keep their ownership split behind stable imports', async () => {
  const [stable, state, runtime, browser] = await Promise.all([
    readFile(new URL('frontend/scripts/_lib/public-video-renditions.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/scripts/_lib/public-video-rendition-state.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/scripts/_lib/public-video-renditions-runtime.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/lib/public-video-renditions.ts', ROOT), 'utf8'),
  ]);

  assert.match(stable, /from '\.\/public-video-rendition-state'/);
  assert.match(state, /function validatePublishedManifestState/);
  assert.match(state, /function persistActivatedStateFiles/);
  assert.doesNotMatch(state, /node:fs|server\/storage|ffmpeg/);
  assert.match(runtime, /function preparePublicVideoRenditions/);
  assert.match(runtime, /function probeMediaFile/);
  assert.doesNotMatch(runtime, /public-video-rendition-state/);
  assert.doesNotMatch(browser, /scripts\/|server\/|node:/);
});
