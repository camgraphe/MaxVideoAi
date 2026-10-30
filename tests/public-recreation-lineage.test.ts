import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExtraInputValues } from '../frontend/app/api/generate/_lib/extra-input-values';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { completeMarketingSnapshot, prepareMarketingSnapshot } from '../frontend/server/marketing-media/snapshot';
import { mapGalleryVideoRow, type VideoRow } from '../frontend/server/videos-normalization';

function publicRecipeFixture() {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: 'luma-ray-3-2',
    inputMode: 'extend',
    operation: 'luma-extend',
    prompt: 'Keep source_job_id and sourceOutputId as literal prompt text.',
    core: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
    advanced: { seed: 42, extraInputValues: { extend_direction: 'forward' } },
    refs: { inputs: [{ slotId: 'video_url', kind: 'video', url: 'https://media.example/reference.mp4',
      segment: { start: 1, end: 4 }, description: 'source_job_id is literal description text.' }] },
  };
}

function privateRecipeFixture() {
  const recipe = publicRecipeFixture();
  return {
    ...recipe,
    sourceJobId: 'private-parent-job',
    sourceOutputId: 'private-parent-output',
    advanced: { ...recipe.advanced, extraInputValues: { ...recipe.advanced.extraInputValues,
      source_job_id: 'private-parent-job', source_output_id: 'private-parent-output' } },
    refs: { inputs: [{ ...recipe.refs.inputs[0], assetId: 'private-asset', sourceJobId: 'private-parent-job',
      sourceOutputId: 'private-parent-output', userId: 'private-user', owner_id: 'private-owner',
      job_id: 'private-parent-job', source_job_id: 'private-parent-job', source_output_id: 'private-parent-output',
      frontalAssetId: 'private-frontal', videoAssetId: 'private-video', referenceAssetIds: ['private-view'] }] },
  };
}

test('publishing a validated Luma Extend recipe removes nested owned-source bindings', () => {
  const engine = getBaseEnginesByCategory('video').find((candidate) => candidate.id === 'luma-ray-3-2');
  assert.ok(engine);
  const validation = validateExtraInputValues({ engine, mode: 'extend', rawExtraInputValues: {
    source_job_id: 'private-parent-job', extend_direction: 'forward',
  } });
  assert.equal(validation.ok, true, 'source_job_id is a real accepted model control');
  if (!validation.ok) throw new Error('Expected valid Luma Extend inputs');
  const saved = privateRecipeFixture();
  saved.advanced.extraInputValues = { ...saved.advanced.extraInputValues, ...validation.values };
  const source = { job: { job_id: 'public-copy', user_id: 'private-owner', engine_id: engine.id,
    status: 'completed', surface: 'video', video_url: 'https://media.example/output.mp4', settings_snapshot: saved } };
  const before = structuredClone(source);
  const plan = prepareMarketingSnapshot(source);
  const copied = completeMarketingSnapshot(plan, plan.media.map((file, index) => ({
    sourceUrl: file.sourceUrl, url: `https://media.example/marketing-media/copy/${index}`,
    key: `marketing-media/copy/${index}`, sizeBytes: 1, mime: `${file.kind}/fixture`, sha256: 'a'.repeat(64),
  })));
  const expected = publicRecipeFixture();
  assert.deepEqual(plan.recreationSnapshot, expected, 'only portable creative settings enter the public recipe');
  assert.deepEqual(plan.publication.settings_snapshot, expected);
  assert.doesNotMatch(JSON.stringify(copied.recreationSnapshot), /private-parent|private-asset|private-user|private-owner/);
  assert.equal(copied.recreationSnapshot.operation, 'luma-extend');
  assert.deepEqual(plan.sourceSnapshot, saved, 'admin provenance keeps owned-source identity');
  assert.deepEqual(source, before, 'personal settings remain complete and unmodified');
});

test('public row normalization removes private lineage from existing recipes without changing personal settings', () => {
  for (const recoverOperation of [false, true]) {
    const saved: Record<string, unknown> = privateRecipeFixture();
    if (recoverOperation) delete saved.operation;
    const row: VideoRow = {
      job_id: 'public-copy', user_id: null, engine_id: 'luma-ray-3-2', engine_label: 'Luma', duration_sec: 5,
      prompt: publicRecipeFixture().prompt, thumb_url: 'https://media.example/poster.jpg',
      video_url: 'https://media.example/output.mp4', preview_video_url: null, keyframe_urls: null,
      aspect_ratio: '16:9', generation_mode: 'extend', generation_operation: 'luma-extend', has_audio: false,
      can_upscale: false, created_at: '2026-10-30T00:00:00Z', visibility: 'public', indexable: true,
      featured: false, featured_order: null, final_price_cents: 100, currency: 'USD',
      recreation_snapshot: saved, settings_snapshot: saved,
    };
    const before = structuredClone(row);
    const video = mapGalleryVideoRow(row);
    assert.deepEqual(video.recreationSnapshot, publicRecipeFixture(), 'explicit and recovered operations retain safe controls and references');
    assert.deepEqual(video.settingsSnapshot, saved, 'the personal settings projection is not a public recipe sanitizer target');
    assert.deepEqual(row, before, 'stored recipes and personal provenance are never rewritten during reads');
    assert.equal(video.operation, 'luma-extend');
  }
});
