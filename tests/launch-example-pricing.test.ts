import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGalleryVideoRow, type VideoRow } from '../frontend/server/videos-normalization';
import archive from '../frontend/server/launch-example-pricing-records.json';
import accepted from '../frontend/server/model-launch-assets.generated.json';

function importedRow(overrides: Partial<VideoRow> = {}): VideoRow {
  return {
    job_id: 'a30e1f55-27ca-4cd5-9c6b-1cb990a5ca91',
    user_id: null,
    engine_id: 'ltx-2-5-pro',
    engine_label: 'LTX 2.5 Pro',
    duration_sec: 6,
    prompt: 'Public launch example',
    thumb_url: '',
    video_url: null,
    preview_video_url: null,
    keyframe_urls: null,
    aspect_ratio: '16:9',
    has_audio: false,
    can_upscale: false,
    created_at: '2026-09-02T15:44:24.524Z',
    visibility: 'public',
    indexable: true,
    featured: false,
    featured_order: null,
    final_price_cents: null,
    currency: 'USD',
    ...overrides,
  };
}

test('launch example display recovers the original recorded price without mutating billing data', () => {
  const row = importedRow();
  const video = mapGalleryVideoRow(row);
  assert.equal(video.finalPriceCents, 87);
  assert.equal(video.currency, 'USD');
  assert.equal(row.final_price_cents, null);
  assert.equal(video.pricingSnapshot, undefined);
});

test('the stored job price, including zero, takes precedence over the historical example receipt', () => {
  for (const cents of [0, 72, 99]) {
    assert.equal(mapGalleryVideoRow(importedRow({ final_price_cents: cents })).finalPriceCents, cents);
  }
});

test('a receipt cannot price another job, model, duration or currency', () => {
  for (const overrides of [
    { job_id: 'another-job' },
    { engine_id: 'ltx-2-5-fast' },
    { duration_sec: 7 },
    { currency: 'EUR' },
  ]) {
    assert.equal(mapGalleryVideoRow(importedRow(overrides)).finalPriceCents, undefined);
  }
});

test('the historical receipt supplies its currency when the imported currency is missing', () => {
  const video = mapGalleryVideoRow(importedRow({ currency: null }));
  assert.equal(video.finalPriceCents, 87);
  assert.equal(video.currency, 'USD');
});

test('archived prices belong to distinct accepted launch jobs with matching model identities', () => {
  const jobs = new Set<string>();
  assert.equal(archive.records.length, 14);
  for (const receipt of archive.records) {
    assert.equal(jobs.has(receipt.jobId), false);
    jobs.add(receipt.jobId);
    const asset = accepted.assets.find((item) => item.jobId === receipt.jobId);
    assert.ok(asset, `Missing accepted example ${receipt.jobId}`);
    assert.equal(asset.engineId, receipt.engineId);
    assert.equal(Math.round(asset.durationSec), receipt.durationSec);
    assert.ok(Number.isInteger(receipt.totalCents) && receipt.totalCents > 0);
    const video = mapGalleryVideoRow(importedRow({
      job_id: receipt.jobId,
      engine_id: receipt.engineId,
      duration_sec: receipt.durationSec,
    }));
    assert.equal(video.finalPriceCents, receipt.totalCents);
    assert.equal(video.currency, receipt.currency);
  }
});
