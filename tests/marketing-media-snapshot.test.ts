import assert from 'node:assert/strict';
import test from 'node:test';
import { completeMarketingSnapshot, prepareMarketingSnapshot } from '../frontend/server/marketing-media/snapshot';

export function sourceFixture() {
  return {
    job: {
      job_id: 'existing-watch-id',
      user_id: 'owner',
      status: 'completed',
      surface: 'video',
      visibility: 'public',
      indexable: true,
      engine_id: 'luma-ray-3-2',
      engine_label: 'Luma',
      duration_sec: 5,
      prompt: 'Preserve this exact prompt.\nSecond line.',
      video_url: 'https://media.example/original.mp4',
      thumb_url: 'https://media.example/poster.jpg',
      preview_video_url: 'https://media.example/preview.mp4',
      created_at: '2026-10-22T12:00:00Z',
      aspect_ratio: '9:16',
      has_audio: true,
      final_price_cents: 100,
      settings_snapshot: {
        schemaVersion: 1,
        surface: 'video',
        engineId: 'luma-ray-3-2',
        engineLabel: 'Luma',
        inputMode: 'v2v',
        prompt: 'Preserve this exact prompt.\nSecond line.',
        negativePrompt: 'no blur',
        core: { durationSec: 5, resolution: '1080p', aspectRatio: '9:16', fps: 24, audio: true },
        advanced: { seed: 123, extraInputValues: { strength: 0.65, keyframe_times: [0, 3.2] } },
        refs: {
          videoUrls: ['https://media.example/reference.mov'],
          inputs: [
            null,
            {
              slotId: 'video_url',
              kind: 'video',
              url: 'https://media.example/reference.mov',
              assetId: 'private-owner-asset',
              segment: { start: 2, end: 7 },
            },
          ],
        },
        meta: { memberTier: 'Pro' },
        providerRequest: { apiKey: 'never-public' },
        receipt: 'never-public',
      },
    },
    output: { width: 1080, height: 1920 },
  };
}

test('marketing copy preserves exact generation settings and stable video identity while detaching all media references', () => {
  const source = sourceFixture();
  const before = structuredClone(source);
  const plan = prepareMarketingSnapshot(source);
  assert.equal(plan.media.length, 4, 'reference repeated in inputs is copied once');
  const copies = plan.media.map((item, index) => ({
    sourceUrl: item.sourceUrl,
    url: `https://media.example/marketing-media/copy/${index}`,
    key: `marketing-media/copy/${index}`,
    sizeBytes: 100,
    mime: item.kind + '/fixture',
    sha256: 'a'.repeat(64),
  }));
  const result = completeMarketingSnapshot(plan, copies);
  assert.equal(result.publication.job_id, 'existing-watch-id');
  assert.equal(result.publication.visibility, 'public');
  assert.equal(result.publication.indexable, true);
  assert.equal(result.publication.prompt, 'Preserve this exact prompt.\nSecond line.');
  assert.equal(result.publication.user_id, null, 'site copy has no customer quota owner');
  assert.deepEqual(result.recreationSnapshot.core, {
    durationSec: 5,
    resolution: '1080p',
    aspectRatio: '9:16',
    fps: 24,
    audio: true,
  });
  assert.deepEqual(result.recreationSnapshot.advanced, {
    seed: 123,
    extraInputValues: { strength: 0.65, keyframe_times: [0, 3.2] },
  });
  assert.equal(result.recreationSnapshot.negativePrompt, 'no blur');
  const refs = result.recreationSnapshot.refs as any;
  assert.equal(refs.inputs[0], null);
  assert.equal(refs.inputs[1].slotId, 'video_url');
  assert.deepEqual(refs.inputs[1].segment, { start: 2, end: 7 });
  assert.equal(refs.inputs[1].url, refs.videoUrls[0]);
  assert.match(refs.videoUrls[0], /marketing-media/);
  assert.equal(refs.inputs[1].assetId, undefined, 'reuse must not claim another account’s asset ID');
  assert.doesNotMatch(
    JSON.stringify(result.recreationSnapshot),
    /private-owner|never-public|memberTier|reference\.mov/,
  );
  assert.deepEqual(plan.sourceSnapshot, source.job.settings_snapshot, 'private provenance remains complete');
  assert.deepEqual(source, before, 'promotion never mutates the customer record');
});

test('unavailable references or incomplete settings cannot silently become a ready marketing copy', () => {
  const plan = prepareMarketingSnapshot(sourceFixture());
  assert.throws(() => completeMarketingSnapshot(plan, []), /incomplete/i);
  assert.throws(
    () => prepareMarketingSnapshot({ job: { ...sourceFixture().job, settings_snapshot: null } }),
    /settings/i,
  );
  assert.throws(() => prepareMarketingSnapshot({ job: { ...sourceFixture().job, status: 'running' } }), /completed/i);
  const source = sourceFixture();
  (source.job.settings_snapshot.refs as any).firstFrameUrl = 'blob:gone';
  assert.throws(() => prepareMarketingSnapshot(source), /reference/i);
  const remoteState = sourceFixture();
  (remoteState.job.settings_snapshot.advanced.extraInputValues as any).previous_interaction_id =
    'provider-private-state';
  assert.throws(() => prepareMarketingSnapshot(remoteState), /interaction/i);
});

test('media values in model-specific inputs are copied while literal prompt text remains intact', () => {
  const source = sourceFixture();
  (source.job.settings_snapshot.advanced.extraInputValues as any).edit_keyframe_urls = [
    'https://media.example/frame.png',
  ];
  source.job.settings_snapshot.prompt = source.job.prompt = 'Describe https://example.com without changing this text';
  const plan = prepareMarketingSnapshot(source);
  assert.ok(plan.media.some((item) => item.sourceUrl === 'https://media.example/frame.png'));
  assert.ok(!plan.media.some((item) => item.sourceUrl === 'https://example.com'));
  const reordered = { ...source, job: Object.fromEntries(Object.entries(source.job).reverse()) };
  assert.equal(
    prepareMarketingSnapshot(reordered).fingerprint,
    plan.fingerprint,
    'JSONB object order cannot invalidate a source',
  );
});

test('promotion retains existing public prompt text while recreation uses the exact saved inputs', () => {
  const source = sourceFixture();
  source.job.prompt = 'Existing published description';
  const plan = prepareMarketingSnapshot(source);
  assert.equal(plan.publication.prompt, 'Existing published description');
  assert.equal(plan.recreationSnapshot.prompt, source.job.settings_snapshot.prompt);
});

test('nested credentials in model-specific settings cannot enter a public recreation payload', () => {
  const source = sourceFixture();
  (source.job.settings_snapshot.advanced.extraInputValues as any).configuration = { access_token: 'private' };
  assert.throws(() => prepareMarketingSnapshot(source), /credentials/i);
});

test('registered authored demos require their explicit rendition-preserving migration', () => {
  const source = sourceFixture();
  source.job.video_url =
    'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/6e299d72-22dd-46f4-8260-4d6887777558.mp4';
  assert.throws(() => prepareMarketingSnapshot(source), /authored demo/i);
});
