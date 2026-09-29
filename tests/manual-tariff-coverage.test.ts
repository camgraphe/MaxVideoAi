import assert from 'node:assert/strict';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime.ts';
import {
  collectSellableManualTariffCoverage,
  collectEffectiveCustomerTariffBaseline,
} from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import type { PricingSnapshot } from '@maxvideoai/pricing';

test('coverage follows all 48 app-published models in 15 families, including pricing-hidden legacy variants', () => {
  const coverage = collectSellableManualTariffCoverage();
  const published = listRuntimeModels().filter((model) => model.publication.app.published);
  assert.equal(published.length, 48);
  assert.equal(new Set(published.map((model) => model.family)).size, 15);
  assert.deepEqual(new Set(coverage.scenarios.map((scenario) => scenario.modelId)), new Set(published.map((model) => model.id)));
  assert.ok(coverage.scenarios.some((scenario) => scenario.modelId === 'lumaRay2'));
  assert.ok(coverage.scenarios.some((scenario) => scenario.modelId === 'lumaRay2_flash'));
  assert.equal(new Set(coverage.scenarios.map((scenario) => scenario.id)).size, coverage.scenarios.length);
});

test('finite price-changing duration, resolution and audio boundaries are distinct; unsupported custom options are gaps', () => {
  const coverage = collectSellableManualTariffCoverage();
  const seedance = coverage.scenarios.filter((row) => row.modelId === 'seedance-2-5' && row.selector.mode === 't2v');
  assert.ok(seedance.some((row) => row.selector.durationSec === '4' && row.selector.resolution === '480p'));
  assert.ok(seedance.some((row) => row.selector.durationSec === '30' && row.selector.resolution === '1080p'));
  assert.ok(!coverage.scenarios.some((row) => row.modelId === 'seedance-2-0-mini' && row.selector.resolution === '1080p'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'gpt-image-2' && gap.reason.includes('custom')));
  assert.ok(!coverage.scenarios.some((row) => row.selector.aspectRatio === 'auto'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'wan-3' && gap.reason.includes('auto aspect')));
  const wanVideo = coverage.scenarios.filter((row) => row.modelId === 'wan-3' && row.selector.mode === 'v2v');
  assert.ok(wanVideo.some((row) => row.selector.inputVideoDurationSec === '1'));
  assert.ok(wanVideo.some((row) => row.selector.inputVideoDurationSec === '15'));
  assert.ok(wanVideo.every((row) => Number(row.selector.durationSec) + Number(row.selector.inputVideoDurationSec) <= 30));
  const omni = coverage.scenarios.filter((row) => row.modelId === 'gemini-omni-flash' && row.selector.mode === 'v2v');
  assert.ok(omni.some((row) => row.selector.inputVideoDurationSec === '3' && row.selector.inheritedDurationSec === '3'));
  assert.ok(coverage.scenarios.filter((row) => row.modelId === 'gemini-omni-flash' && row.selector.mode === 'fl2v')
    .every((row) => row.context.inputImageCount === 2 && row.selector.inputImageCount === '2'));
  const h3 = coverage.scenarios.filter((row) => row.modelId === 'minimax-h3-max' && row.selector.mode === 'ref2v');
  assert.ok(h3.some((row) => row.selector.referenceTokenBudget === '4096'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'minimax-h3-max' && gap.reason.includes('reference token')));
  const ltx = coverage.scenarios.filter((row) => row.modelId === 'ltx-2-5-fast' && row.selector.mode === 'a2v');
  assert.ok(ltx.some((row) => row.selector.inputAudioDurationSec === '9'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'ltx-2-5-fast' && gap.reason.includes('input audio')));
});

test('effective baseline collector records quote provenance and missing cells without inventing cents', async () => {
  const coverage = collectSellableManualTariffCoverage();
  const selected = coverage.scenarios.slice(0, 2);
  const baseline = await collectEffectiveCustomerTariffBaseline({
    at: '2026-09-29T00:00:00.000Z', registryHash: 'registry-test', databaseIdentity: 'production-matched',
    scenarios: selected,
    quote: async (scenario) => scenario === selected[0]
      ? { totalCents: 123, currency: 'USD', meta: { pricingPolicy: { source: 'database', sourceRuleId: 'db-rule' } } } as PricingSnapshot
      : Promise.reject(new Error('unavailable')),
  });
  assert.equal(baseline.rows.length, 1);
  assert.deepEqual(baseline.rows[0], { scenarioId: selected[0]?.id, customerCents: 123, currency: 'USD', policySource: 'database', ruleId: 'db-rule' });
  assert.deepEqual(baseline.gaps, [selected[1]?.id]);
});
