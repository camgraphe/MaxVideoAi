import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateAlibabaJobCost } from '../frontend/server/alibaba-job-accounting';
import { normalizeAlibabaTask } from '../frontend/src/server/video-providers/alibaba-model-studio/response';

const job = { engine_id: 'wan-3', duration_sec: 10,
  settings_snapshot: { inputMode: 'ref2v', core: { resolution: '1080p' } },
  pricing_snapshot: { totalCents: 1200, meta: { input_video_duration_sec: 5 } } };
const task = (usage?: object) => normalizeAlibabaTask({ output: { task_id: 'task', task_status: 'SUCCEEDED', video_url: 'https://provider.invalid/video.mp4' }, ...(usage ? { usage } : {}) });

test('missing Alibaba usage preserves the trusted input plus output cost instead of dropping the source', () => {
  const cost = estimateAlibabaJobCost(job, task());
  assert.equal(cost.providerCostUnits, 15);
  assert.equal(cost.providerCostUsd, 3);
  assert.equal(cost.inputVideoDurationSec, 5);
  assert.equal(cost.outputVideoDurationSec, 10);
  assert.equal(cost.status, 'list_estimate_from_verified_durations');
  assert.equal(job.pricing_snapshot.totalCents, 1200);
});

test('partial provider duration uses verified source metadata; complete usage overrides forecast', () => {
  const partial = estimateAlibabaJobCost(job, task({ output_video_duration: 9 }));
  assert.equal(partial.providerCostUnits, 14);
  assert.equal(partial.providerCostUsd, 2.8);
  const complete = estimateAlibabaJobCost(job, task({ input_video_duration: 4.5, output_video_duration: 9.5 }));
  assert.equal(complete.providerCostUnits, 14);
  assert.equal(complete.status, 'list_estimate_from_provider_usage');
  const aggregate = estimateAlibabaJobCost(job, task({ duration: 16, input_video_duration: 5, output_video_duration: 10 }));
  assert.equal(aggregate.providerCostUnits, 16);
  assert.equal(aggregate.providerCostUsd, 3.2);
});

test('unknown source duration has no invented supplier total; no-video modes and aggregate usage remain priceable', () => {
  const unknown = { ...job, pricing_snapshot: {} };
  for (const usage of [undefined, { output_video_duration: 10 }]) {
    const cost = estimateAlibabaJobCost(unknown, task(usage));
    assert.equal(cost.providerCostUsd, null);
    assert.equal(cost.providerCostUnits, null);
    assert.equal(cost.status, 'list_estimate_unavailable');
  }
  assert.equal(estimateAlibabaJobCost(unknown, task({ duration: 15 })).providerCostUsd, 3);
  const noVideo = { ...unknown, settings_snapshot: { inputMode: 't2v', core: { resolution: '1080p' } } };
  assert.equal(estimateAlibabaJobCost(noVideo, task()).providerCostUsd, 2);
  const fractional = { ...job, pricing_snapshot: { meta: { input_video_duration_sec: 4.25 } } };
  assert.equal(estimateAlibabaJobCost(fractional, task()).providerCostUsd, 2.85);
});
