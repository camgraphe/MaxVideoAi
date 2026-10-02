import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './fixtures/byteplus-video-minimums-2026-10-01.json';
import { estimateBytePlusBillableTokens, buildBytePlusListCostBreakdown, bytePlusInputVideoDurationSec } from '../frontend/server/byteplus-accounting';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { buildProviderCostComparisonRows, providerComparisonInputFromScenario } from '../frontend/server/pricing-admin/provider-cost-comparison';

test('supplier video-input minimums match every row of the independent public 2.0/2.5 tables', () => {
  assert.equal(fixture.rows.length, 531);
  for (const [series, resolution, aspectRatios, durationSec, minimum, width, height, fps] of fixture.rows) {
    const engineId = series === '25' ? 'seedance-2-5' : 'seedance-2-0';
    for (const aspectRatio of String(aspectRatios).split(',')) {
      const estimate = estimateBytePlusBillableTokens({ engineId, durationSec: Number(durationSec),
        resolution: String(resolution), aspectRatio, billingInputType: 'video_input', inputVideoDurationSec: 2 });
      assert.equal(estimate?.minimumTokens, minimum, `${engineId}/${resolution}/${aspectRatio}/${durationSec}`);
      assert.equal(estimate?.tokenCount, minimum);
      const long = estimateBytePlusBillableTokens({ engineId, durationSec: Number(durationSec),
        resolution: String(resolution), aspectRatio, billingInputType: 'video_input', inputVideoDurationSec: series === '25' ? 30 : 15 });
      assert.equal(long?.tokenCount, Math.max(Number(minimum),
        (Number(durationSec) + (series === '25' ? 30 : 15)) * Number(width) * Number(height) * Number(fps) / 1024));
    }
  }
});

test('admin and manual supplier facts count video input and use the same minimum, preserving customer cents', () => {
  const entry = getFalEngineById('seedance-2-0-mini')!;
  const engine = { ...entry.engine, providerMeta: { ...entry.engine.providerMeta, provider: 'byteplus_modelark' } };
  const context = { engine, mode: 'ref2v' as const, durationSec: 5, resolution: '720p',
    aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 2 };
  const cost = normalBytePlusSupplierCost(context, '2026-10-01T12:00:00Z');
  assert.equal(cost?.listAmountUsd, 0.40824);
  assert.equal(cost?.amountUsd, 0.163296);
  const input = providerComparisonInputFromScenario({ engine, context, executionProvider: 'byteplus_modelark',
    brandId: entry.brandId, quote: null, scenario: { id: 'reference', engineId: engine.id, mode: 'ref2v',
      resolution: '720p', durationSec: 5, surface: 'billing', input: { aspectRatio: '16:9' } } });
  input.accountContractRegion = 'ap-southeast-1';
  input.customerQuote = { totalCents: 95, currency: 'USD', source: 'database', ruleId: 'authored', pricingMode: 'manual_tariff' };
  const row = buildProviderCostComparisonRows([input], '2026-10-01T12:00:00Z')[0];
  assert.equal(row.supplierList.amountUsd, cost?.listAmountUsd);
  assert.equal(row.supplierEffective.amountUsd, cost?.amountUsd);
  assert.equal(row.customerQuote?.totalCents, 95);
  const missing = { ...context, inputVideoDurationSec: undefined };
  assert.equal(normalBytePlusSupplierCost(missing, '2026-10-01T12:00:00Z'), null);
  const missingInput = providerComparisonInputFromScenario({ engine, context: missing, executionProvider: 'byteplus_modelark',
    brandId: entry.brandId, quote: null, scenario: { id: 'missing', engineId: engine.id, mode: 'ref2v',
      resolution: '720p', durationSec: 5, surface: 'billing', input: { aspectRatio: '16:9' } } });
  const missingRow = buildProviderCostComparisonRows([missingInput], '2026-10-01T12:00:00Z')[0];
  assert.equal(missingRow.supplierList.amountUsd, null);
  assert.equal(missingRow.supplierList.reason, 'input_video_duration_unavailable');
});

test('owned video durations sum precisely and missing/overlong metadata is rejected', () => {
  assert.equal(bytePlusInputVideoDurationSec('seedance-2-5', [{ kind: 'image' }, { kind: 'video', durationSec: 8.5 }, { kind: 'video', durationSec: 12.25 }]), 20.75);
  assert.equal(bytePlusInputVideoDurationSec('seedance-2-0-mini', []), 0);
  for (const durationSec of [undefined, null, 0, -1, Infinity, NaN, 15.01]) {
    assert.throws(() => bytePlusInputVideoDurationSec('seedance-2-0-mini', [{ kind: 'video', durationSec }]));
  }
});

test('completion uses reported usage and never labels a partial video-input fallback as a full supplier cost', () => {
  const job = { job_id: 'owned-job', engine_id: 'seedance-2-0-mini', duration_sec: 5, has_audio: false,
    settings_snapshot: { inputMode: 'ref2v', core: { resolution: '720p', aspectRatio: '16:9' }, refs: { videoUrls: ['https://owned.invalid/video.mp4'] } } };
  const input = { job: job as never, model: 'mini', resolution: '720p', aspectRatio: '16:9', usage: null };
  const missing = buildBytePlusListCostBreakdown(input);
  assert.equal(missing.provider_cost_usd_list, null);
  assert.equal(missing.provider_cost_status, 'list_estimate_unavailable');
  const known = buildBytePlusListCostBreakdown({ ...input, job: { ...job, settings_snapshot: { ...job.settings_snapshot, byteplusInputVideoDurationSec: 2 } } as never });
  assert.equal(known.provider_cost_usd_list, 0.40824);
  assert.equal(known.total_tokens, 194400);
  const actual = buildBytePlusListCostBreakdown({ ...input, usage: { totalTokens: null, completionTokens: 250000 } });
  assert.equal(actual.provider_cost_usd_list, 0.525);
  assert.equal(actual.provider_cost_status, 'list_estimate_from_provider_usage');
  assert.equal(actual.provider_cost_usd_observed, null);
});
