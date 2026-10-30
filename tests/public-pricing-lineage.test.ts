import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareMarketingSnapshot } from '../frontend/server/marketing-media/snapshot';
import { mapGalleryVideoRow, type VideoRow } from '../frontend/server/videos-normalization';

const publicPricing = {
  currency: 'USD', totalCents: 137, subtotalBeforeDiscountCents: 137,
  base: { seconds: 5, rate: 0.274, unit: 'sec', amountCents: 137 },
  addons: [], margin: { percent: 0, flatCents: 0, amountCents: 0 },
  meta: { customerTariffRevision: 'historical-revision', inputVideoDurationSec: 8 },
};
const recordedPricing = {
  ...publicPricing,
  lumaSource: { sourceJobId: 'private-luma-job', outputId: 'private-luma-output',
    fingerprint: 'private-luma-fingerprint', direction: 'forward', durationSec: 5, transport: 'luma_agents_direct' },
  fluxDraftSource: { sourceJobId: 'private-flux-job', outputId: 'private-flux-output',
    fingerprint: 'private-flux-fingerprint', durationSec: 8, expiry: 'unknown', supplierCostIsEstimate: true },
};
const settings = {
  schemaVersion: 1, surface: 'video', engineId: 'luma-ray-3-2', inputMode: 'extend',
  operation: 'luma-extend', prompt: 'Continue the scene',
  core: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' }, refs: {},
};

function videoRow(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    job_id: 'public-copy', user_id: null, engine_id: 'luma-ray-3-2', engine_label: 'Luma', duration_sec: 5,
    prompt: settings.prompt, thumb_url: 'https://media.example/poster.jpg',
    video_url: 'https://media.example/output.mp4', preview_video_url: null, keyframe_urls: null,
    aspect_ratio: '16:9', generation_mode: 'extend', generation_operation: 'luma-extend', has_audio: false,
    can_upscale: false, created_at: '2026-10-30T00:00:00Z', visibility: 'public', indexable: true,
    featured: false, featured_order: null, final_price_cents: 137, currency: 'USD',
    pricing_snapshot: recordedPricing, settings_snapshot: settings, ...overrides,
  };
}

test('marketing publication removes source receipt bindings while retaining historical amounts and current-price inputs', () => {
  const source = { job: { job_id: 'public-copy', user_id: 'private-owner', engine_id: 'luma-ray-3-2',
    status: 'completed', surface: 'video', video_url: 'https://media.example/output.mp4',
    final_price_cents: 137, currency: 'USD', pricing_snapshot: recordedPricing, settings_snapshot: settings } };
  const before = structuredClone(source);
  const plan = prepareMarketingSnapshot(source);
  assert.deepEqual(plan.publication.pricing_snapshot, publicPricing);
  assert.equal(plan.publication.final_price_cents, 137);
  assert.equal(plan.publication.currency, 'USD');
  assert.deepEqual(plan.recreationSnapshot, settings, 'creative settings still describe the current quote scenario');
  assert.deepEqual(plan.sourceSnapshot, settings);
  assert.deepEqual(source, before, 'publication cannot rewrite the personal receipt');
});

test('public rows remove private receipt bindings for legacy videos and existing publications', () => {
  for (const overrides of [{}, { visibility: 'private', recreation_snapshot: settings }]) {
    const row = videoRow(overrides);
    const before = structuredClone(row);
    const video = mapGalleryVideoRow(row);
    assert.deepEqual(video.pricingSnapshot, publicPricing);
    assert.equal(video.finalPriceCents, 137);
    assert.deepEqual(video.settingsSnapshot, settings);
    assert.equal(video.generationMode, 'extend');
    assert.equal(video.operation, 'luma-extend');
    assert.deepEqual(row, before, 'read projection cannot mutate stored receipts or settings');
    assert.doesNotMatch(JSON.stringify(video.pricingSnapshot), /private-luma|private-flux/);
  }
});

test('private personal video projection retains its original source receipt bindings', () => {
  const row = videoRow({ user_id: 'private-owner', visibility: 'private' });
  const before = structuredClone(row);
  const video = mapGalleryVideoRow(row);
  assert.deepEqual(video.pricingSnapshot, recordedPricing);
  assert.deepEqual(row, before);
});
