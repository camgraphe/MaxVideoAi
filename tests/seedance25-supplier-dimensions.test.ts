import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { expectedBytePlusTokens, estimateBytePlusProviderCostCents, buildBytePlusListCostBreakdown } from '../frontend/server/byteplus-accounting';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { buildProviderCostComparisonRows, providerComparisonInputFromScenario } from '../frontend/server/pricing-admin/provider-cost-comparison';
import type { BytePlusPendingJob } from '../frontend/server/byteplus-poll-types';

const at = '2026-10-01T12:00:00Z';
// Published Seedance 2.5 rasters; the tier does not mean a fixed short side.
const rasters = [
  ['480p', '16:9', 854, 480], ['480p', '4:3', 752, 560], ['480p', '1:1', 640, 640],
  ['480p', '3:4', 560, 752], ['480p', '9:16', 480, 854], ['480p', '21:9', 992, 432],
  ['720p', '16:9', 1280, 720], ['720p', '4:3', 1112, 834], ['720p', '1:1', 960, 960],
  ['720p', '3:4', 834, 1112], ['720p', '9:16', 720, 1280], ['720p', '21:9', 1470, 630],
  ['1080p', '16:9', 1920, 1080], ['1080p', '4:3', 1664, 1248], ['1080p', '1:1', 1440, 1440],
  ['1080p', '3:4', 1248, 1664], ['1080p', '9:16', 1080, 1920], ['1080p', '21:9', 2206, 946],
] as const;
const engine = getFalEngineById('seedance-2-5')!.engine;

test('Seedance 2.5 accounting, manual supplier facts and admin use the published rasters', () => {
  for (const [resolution, aspectRatio, width, height] of rasters) {
    const label = `${resolution} ${aspectRatio}`;
    const tokens = width * height * 4 * 24 / 1024;
    const rate = resolution === '1080p' ? 0.0117 : 0.0107;
    const amountUsd = Number((tokens * rate / 1000).toFixed(6));
    assert.equal(expectedBytePlusTokens({ engine_id: engine.id, duration_sec: 4,
      settings_snapshot: { core: { resolution, aspectRatio } } }), tokens, label);
    assert.equal(estimateBytePlusProviderCostCents({ engineId: engine.id, durationSec: 4,
      resolution, aspectRatio, billingInputType: 'no_video_input' }), Math.ceil(amountUsd * 100), label);
    const context = { engine: { ...engine, providerMeta: { ...engine.providerMeta, provider: 'byteplus_modelark' } },
      mode: 't2v' as const, durationSec: 4, resolution, aspectRatio, hasVideoInput: false };
    assert.equal(normalBytePlusSupplierCost(context, at)?.listAmountUsd, amountUsd, label);
    const input = providerComparisonInputFromScenario({ engine, context, executionProvider: 'byteplus_modelark',
      quote: null, brandId: 'bytedance', scenario: { id: label, engineId: engine.id, mode: 't2v',
        resolution, durationSec: 4, surface: 'billing', input: { aspectRatio } } });
    assert.equal(input.videoTokens, tokens, label);
    assert.equal(buildProviderCostComparisonRows([input], at)[0].supplierList.amountUsd, amountUsd, label);
  }
});

test('provider-reported 97-frame canary usage overrides the 96-frame estimate', () => {
  for (const [resolution, tokens, cost] of [['480p', 38800, 0.41516], ['1080p', 196425, 2.298173]] as const) {
    const job: BytePlusPendingJob = { job_id: 'owned-canary', user_id: 'owner', engine_id: engine.id,
      engine_label: engine.label, provider_job_id: 'provider-canary', status: 'completed', duration_sec: 4,
      settings_snapshot: { core: { resolution, aspectRatio: '1:1' }, inputMode: 't2v' }, has_audio: false,
      thumb_url: null, preview_video_url: null, keyframe_urls: null, aspect_ratio: '1:1',
      final_price_cents: null, pricing_snapshot: null, currency: 'USD', payment_status: 'paid', created_at: at, updated_at: at };
    const actual = buildBytePlusListCostBreakdown({ job, model: 'dreamina-seedance-2-5-260628', resolution,
      aspectRatio: '1:1', usage: { totalTokens: tokens, completionTokens: tokens } });
    assert.equal(actual.provider_cost_usd_list, cost);
    assert.equal(actual.provider_cost_status, 'list_estimate_from_provider_usage');
    assert.equal(actual.provider_cost_usd_observed, null);
    assert.equal(actual.provider_cost_usd_effective, null);
  }
});

test('admin Draft/final margins use the same square supplier facts as their independent manual quotes', () => {
  for (const [workflowStep, resolution, customerCents, cost, difference] of [
    ['draft', '480p', 58, 0.41088, 16.912], ['final', '1080p', 294, 2.27448, 66.552],
  ] as const) {
    const input = providerComparisonInputFromScenario({ engine, quote: null, brandId: 'bytedance',
      executionProvider: 'byteplus_modelark', context: { engine, mode: 't2v', durationSec: 4,
        resolution, aspectRatio: '1:1', hasVideoInput: false, workflowStep },
      scenario: { id: workflowStep, engineId: engine.id, mode: 't2v', resolution, durationSec: 4,
        surface: 'billing', input: { aspectRatio: '1:1' } } });
    input.customerQuote = { totalCents: customerCents, currency: 'USD', source: 'versioned',
      ruleId: 'reviewed-workflow', pricingMode: 'manual_tariff' };
    const row = buildProviderCostComparisonRows([input], at)[0];
    assert.equal(row.step, workflowStep);
    assert.equal(row.supplierList.amountUsd, cost);
    assert.equal(row.indicativeDifferenceVsListCents, difference);
    assert.equal(row.customerQuote?.totalCents, customerCents);
    assert.equal(row.supplierObserved.amountUsd, null);
  }
});
