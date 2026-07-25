import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const frontendRoot = join(root, 'frontend');
const sourceRoots = ['app', 'components', 'lib', 'messages', 'server', 'src'].map((directory) =>
  join(frontendRoot, directory)
);
const sourceExtensions = new Set(['.js', '.json', '.jsx', '.mjs', '.ts', '.tsx']);
const legacyPublicVideos = [
  'frontend/public/assets/gallery/adraga-beach.mp4',
  'frontend/public/assets/gallery/aerial-road.mp4',
  'frontend/public/assets/gallery/drone-snow.mp4',
  'frontend/public/assets/gallery/parking-portrait.mp4',
  'frontend/public/assets/gallery/robot-eyes.mp4',
  'frontend/public/assets/gallery/robot-look.mp4',
  'frontend/public/assets/gallery/swimmer.mp4',
  'frontend/public/hero/luma-dream.mp4',
  'frontend/public/hero/luma-ray2-flash.mp4',
  'frontend/public/hero/minimax-video01.mp4',
  'frontend/public/hero/pika-15.mp4',
  'frontend/public/hero/pika-22.mp4',
  'frontend/public/hero/runway-gen3.mp4',
  'frontend/public/hero/sora2.mp4',
  'frontend/public/hero/veo3.mp4',
] as const;
const legacyConstructionPoster = 'frontend/public/hero/showcase-seedance-2-0.webp';

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    const extension = path.slice(path.lastIndexOf('.'));
    return sourceExtensions.has(extension) ? [path] : [];
  });
}

test('construction fallback videos are absent from the public bundle and source data', () => {
  for (const path of legacyPublicVideos) {
    assert.equal(existsSync(join(root, path)), false, `${path} must not ship in the public bundle`);
  }
  assert.equal(
    existsSync(join(frontendRoot, 'public/assets/gallery/placeholders.json')),
    false,
    'the legacy gallery placeholder manifest must not ship'
  );

  const legacyReferencePattern =
    /\/assets\/gallery\/[^"'`\s]+\.(?:mp4|webm)|\/hero\/[^"'`\s]+\.(?:mp4|webm)/gi;
  const references = sourceRoots.flatMap((directory) =>
    collectSourceFiles(directory).flatMap((path) => {
      const matches = readFileSync(path, 'utf8').match(legacyReferencePattern) ?? [];
      return matches.map((match) => `${relative(root, path)}: ${match}`);
    })
  );

  assert.deepEqual(references, []);
});

test('the obsolete snow-car construction poster is absent from the public bundle and source data', () => {
  assert.equal(
    existsSync(join(root, legacyConstructionPoster)),
    false,
    `${legacyConstructionPoster} must not ship in the public bundle`
  );

  const legacyPosterReference = '/hero/showcase-seedance-2-0.webp';
  const references = sourceRoots.flatMap((directory) =>
    collectSourceFiles(directory).flatMap((path) =>
      readFileSync(path, 'utf8').includes(legacyPosterReference)
        ? [`${relative(root, path)}: ${legacyPosterReference}`]
        : []
    )
  );

  assert.deepEqual(references, []);
});

test('marketing media normalization rejects legacy local video paths', async () => {
  const { resolvePublicMarketingVideoUrl } = await import('../frontend/lib/media.ts');

  assert.equal(resolvePublicMarketingVideoUrl('/assets/gallery/drone-snow.mp4'), null);
  assert.equal(resolvePublicMarketingVideoUrl('https://maxvideoai.com/assets/gallery/robot-look.mp4'), null);
  assert.equal(resolvePublicMarketingVideoUrl('/hero/luma-dream.mp4'), null);
  assert.equal(
    resolvePublicMarketingVideoUrl('https://media.maxvideoai.com/renders/marketing/current.mp4'),
    'https://media.maxvideoai.com/renders/marketing/current.mp4'
  );
});
