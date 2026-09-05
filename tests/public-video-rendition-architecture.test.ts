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

test('critical homepage coverage is an offline prebuild guard with a pure injected boundary', async () => {
  const [frontendPackage, command, coverage, browser, agents, mediaGuide, structureGuide] = await Promise.all([
    readFile(new URL('frontend/package.json', ROOT), 'utf8').then(JSON.parse),
    readFile(new URL('frontend/scripts/check-public-video-coverage.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/scripts/_lib/public-video-coverage.ts', ROOT), 'utf8'),
    readFile(new URL('frontend/lib/public-video-renditions.ts', ROOT), 'utf8'),
    readFile(new URL('AGENTS.md', ROOT), 'utf8'),
    readFile(new URL('docs/engineering/media-delivery.md', ROOT), 'utf8'),
    readFile(new URL('docs/engineering/project-structure.md', ROOT), 'utf8'),
  ]);

  assert.equal(
    frontendPackage.scripts.prebuild,
    'pnpm --dir .. model:registry:check && pnpm media:public-renditions:check',
  );
  assert.equal(
    frontendPackage.scripts['media:public-renditions:check'],
    'tsx --tsconfig tsconfig.scripts.json scripts/check-public-video-coverage.ts',
  );
  assert.match(command, /HERO_ENGINE_MEDIA/);
  assert.match(command, /HERO_VIDEO_ORDER/);
  assert.doesNotMatch(command, /server\/|fetch\(|ffmpeg|DATABASE|S3_/i);
  assert.doesNotMatch(coverage, /node:|server\/|fetch\(|ffmpeg/i);
  assert.doesNotMatch(browser, /scripts\/|server\/|node:/);
  for (const guide of [agents, mediaGuide, structureGuide]) {
    assert.match(guide, /frontend\/config\/public-video-sources\.json/);
    assert.match(guide, /media:public-renditions:check/);
  }
});
