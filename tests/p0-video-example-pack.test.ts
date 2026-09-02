import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID,
  P0_VIDEO_EXAMPLE_MODEL_IDS,
} from '../frontend/config/model-launch-readiness-schema.ts';
import {
  MODEL_LAUNCH_WAVES,
} from '../frontend/config/model-launch-waves.ts';
import {
  type ModelLaunchSourceByWave,
  buildModelLaunchProjectionsFromSources,
  validateP0VideoExamplePackDocument,
} from '../frontend/server/model-launch-assets-validation.ts';

const manifestPath = 'docs/model-launch/p0-video-example-pack.json';
const reviewPath = 'docs/model-launch/p0-video-example-review.md';

function configuredLaunchSources(): ModelLaunchSourceByWave {
  return Object.fromEntries(MODEL_LAUNCH_WAVES.map((wave) => [
    wave.id,
    existsSync(wave.sourceManifest) ? readFileSync(wave.sourceManifest, 'utf8') : null,
  ])) as ModelLaunchSourceByWave;
}

test('the P0 example pack contains two accepted durable and attached assets per model', () => {
  assert.equal(existsSync(manifestPath), true, `${manifestPath} must exist`);
  const source = readFileSync(manifestPath, 'utf8');
  const document = JSON.parse(source) as unknown;
  const result = validateP0VideoExamplePackDocument(document);
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join('\n'));
  if (!result.ok) return;

  assert.equal(result.assets.length, 14);
  for (const modelId of P0_VIDEO_EXAMPLE_MODEL_IDS) {
    const familyId = P0_VIDEO_EXAMPLE_FAMILY_BY_MODEL_ID[modelId];
    const accepted = result.assets.filter((asset) => asset.modelId === modelId);
    assert.equal(accepted.length, 2, modelId);
    assert.deepEqual(new Set(accepted.map(({ mode }) => mode)), new Set(['t2v', 'i2v']), modelId);
    for (const asset of accepted) {
      assert.equal(asset.publicationState, 'gallery_only', `${modelId} must first follow normal gallery publication`);
      assert.equal(asset.watchPageCandidate, false, `${modelId} SEO promotion belongs to the admin workflow`);
      assert.deepEqual(
        new Set(asset.playlistSlugs),
        new Set([`family-${familyId}`, `examples-${modelId}`]),
        `${modelId}/${asset.assetId}`,
      );
      assert.equal(new URL(asset.videoUrl).hostname, 'media.maxvideoai.com');
      assert.equal(new URL(asset.thumbnailUrl).hostname, 'media.maxvideoai.com');
    }
  }
});

test('the committed launch projections are generated from the exact accepted manifest', () => {
  const expected = buildModelLaunchProjectionsFromSources(configuredLaunchSources());
  const full = JSON.parse(readFileSync('frontend/server/model-launch-assets.generated.json', 'utf8')) as unknown;
  const readiness = JSON.parse(readFileSync('frontend/config/model-launch-readiness.generated.json', 'utf8')) as unknown;
  assert.deepEqual(full, expected.full);
  assert.deepEqual(readiness, expected.readiness);
});

test('the review record covers every accepted asset without private or temporary media references', () => {
  assert.equal(existsSync(reviewPath), true, `${reviewPath} must exist`);
  const manifestSource = readFileSync(manifestPath, 'utf8');
  const review = readFileSync(reviewPath, 'utf8');
  const document = JSON.parse(manifestSource) as { assets: Array<{ modelId: string; mode: string }> };

  for (const { modelId, mode } of document.assets) {
    assert.match(review, new RegExp(`^### ${modelId} — ${mode}$`, 'm'));
  }
  assert.doesNotMatch(`${manifestSource}\n${review}`, /(?:X-Amz-|token=|signed|fal\.media|localhost|127\.0\.0\.1)/i);
});
