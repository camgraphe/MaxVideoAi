import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  P1_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID,
  P1_VIDEO_EXAMPLE_MODEL_IDS,
} from '../frontend/config/model-launch-readiness-schema.ts';
import { MODEL_LAUNCH_WAVES } from '../frontend/config/model-launch-waves.ts';
import { PREFERRED_MEDIA } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';
import {
  type ModelLaunchSourceByWave,
  buildModelLaunchProjectionsFromSources,
  validateModelLaunchWaveDocument,
} from '../frontend/server/model-launch-assets-validation.ts';

const manifestPath = 'docs/model-launch/p1-video-example-pack.json';
const reviewPath = 'docs/model-launch/p1-video-example-review.md';
const generationManifestPath = 'output/p1-model-launch/p1-generation-manifest.json';

function configuredLaunchSources(): ModelLaunchSourceByWave {
  return Object.fromEntries(MODEL_LAUNCH_WAVES.map((wave) => [
    wave.id,
    existsSync(wave.sourceManifest) ? readFileSync(wave.sourceManifest, 'utf8') : null,
  ])) as ModelLaunchSourceByWave;
}

test('the P1 pack records two accepted durable videos per model without enrolling video SEO', () => {
  assert.equal(existsSync(manifestPath), true, `${manifestPath} must exist`);
  const source = readFileSync(manifestPath, 'utf8');
  const result = validateModelLaunchWaveDocument('p1', JSON.parse(source) as unknown);
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join('\n'));
  if (!result.ok) return;

  assert.equal(result.assets.length, 8);
  assert.equal(new Set(result.assets.map(({ prompt }) => prompt)).size, 8);
  for (const modelId of P1_VIDEO_EXAMPLE_MODEL_IDS) {
    const familyId = P1_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[modelId];
    const accepted = result.assets.filter((asset) => asset.modelId === modelId);
    assert.equal(accepted.length, 2, modelId);
    assert.deepEqual(new Set(accepted.map(({ mode }) => mode)), new Set(['t2v']), modelId);
    assert.deepEqual(
      new Set([PREFERRED_MEDIA[modelId]?.hero, PREFERRED_MEDIA[modelId]?.demo]),
      new Set(accepted.map(({ videoId }) => videoId)),
      `${modelId} model page must select the reviewed pair`,
    );
    for (const asset of accepted) {
      assert.equal(asset.publicationState, 'gallery_only');
      assert.equal(asset.watchPageCandidate, false);
      assert.deepEqual(
        new Set(asset.playlistSlugs),
        new Set([`family-${familyId}`, `examples-${modelId}`]),
      );
      assert.equal(new URL(asset.videoUrl).hostname, 'media.maxvideoai.com');
      assert.equal(new URL(asset.thumbnailUrl).hostname, 'media.maxvideoai.com');
    }
  }
});

test('the P1 review covers each accepted job and keeps the SEO decision in the admin workflow', () => {
  assert.equal(existsSync(reviewPath), true, `${reviewPath} must exist`);
  const manifestSource = readFileSync(manifestPath, 'utf8');
  const review = readFileSync(reviewPath, 'utf8');
  const document = JSON.parse(manifestSource) as { assets: Array<{ jobId: string }> };
  const editorialSources = [
    readFileSync('frontend/config/video-seo-editorial.ts', 'utf8'),
    readFileSync('frontend/config/video-seo-watchlist.ts', 'utf8'),
  ].join('\n');

  for (const { jobId } of document.assets) {
    assert.match(review, new RegExp(jobId));
    assert.doesNotMatch(editorialSources, new RegExp(jobId));
  }
  assert.match(review, /private and non-indexable/i);
  assert.match(review, /admin SEO workflow/i);
  assert.doesNotMatch(
    `${manifestSource}\n${review}`,
    /(?:X-Amz-|token=|signed|fal\.media|videohub-uploads-us\.s3\.amazonaws\.com|localhost|127\.0\.0\.1)/i,
  );
});

test('the reviewed generation record preserves durable URLs and a pending admin publication decision', () => {
  const source = readFileSync(generationManifestPath, 'utf8');
  const manifest = JSON.parse(source) as {
    assets: Array<{ videoUrl: string; thumbnailUrl: string }>;
    productionPublication: { ready: boolean; reason: string };
  };

  assert.equal(manifest.assets.length, 8);
  for (const asset of manifest.assets) {
    assert.equal(new URL(asset.videoUrl).hostname, 'media.maxvideoai.com');
    assert.equal(new URL(asset.thumbnailUrl).hostname, 'media.maxvideoai.com');
  }
  assert.equal(manifest.productionPublication.ready, false);
  assert.match(manifest.productionPublication.reason, /private and non-indexable/i);
  assert.match(manifest.productionPublication.reason, /admin not-published queue/i);
  assert.doesNotMatch(source, /(?:X-Amz-|token=|videohub-uploads-us\.s3\.amazonaws\.com)/i);
});

test('the committed launch projections derive from the P1 manifest', () => {
  const expected = buildModelLaunchProjectionsFromSources(configuredLaunchSources());
  const full = JSON.parse(readFileSync('frontend/server/model-launch-assets.generated.json', 'utf8')) as unknown;
  const readiness = JSON.parse(readFileSync('frontend/config/model-launch-readiness.generated.json', 'utf8')) as unknown;
  assert.deepEqual(full, expected.full);
  assert.deepEqual(readiness, expected.readiness);
});
