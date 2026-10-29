import assert from 'node:assert/strict';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime.ts';
import { buildAllModelComparisonScenarios, selectRepresentativeTariffScenario } from '../frontend/server/pricing-admin/policy-read-model.ts';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import { quoteCanonicalAdminScenarios } from '../frontend/server/pricing-admin/canonical-scenarios.ts';
import { filterProviderComparisonRows } from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts';

test('admin comparison inventory contains published models once while V4 keeps its separate native tariff', () => {
  const expected = listRuntimeModels().filter((model) => model.publication.app.published);
  const rows = buildAllModelComparisonScenarios();
  assert.equal(expected.length, 51);
  assert.equal(rows.length, expected.length);
  assert.deepEqual(new Set(rows.map(({ entry }) => entry.id)), new Set(expected.map((model) => model.id)));
  assert.equal(rows.filter(({entry})=>entry.id==='kling-v4').length,1);
  assert.equal(rows.filter(({entry})=>entry.id==='nano-banana-2-1').length,1);
  assert.ok(rows.some(({ entry }) => entry.id === 'lumaRay2'));
  assert.ok(rows.some(({ entry }) => entry.id === 'lumaRay2_flash'));
  assert.equal(new Set(expected.map((model) => model.family)).size, 15);
  assert.ok(rows.every(({ scenario }) => scenario.durationSec && scenario.resolution && scenario.mode));
  const quotes = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: rows.filter(({entry})=>entry.id!=='kling-v4').map(({ scenario }) => scenario) });
  assert.equal(quotes.filter((quote) => quote.status === 'quoted').length, 49);
  const [v4] = quoteCanonicalAdminScenarios({databaseRules:[],scenarios:[rows.find(({entry})=>entry.id==='kling-v4')!.scenario]});
  assert.equal(v4.status,'unsupported','V4 cannot acquire an old percentage-policy price');
  if(v4.status==='unsupported') {
    assert.equal(v4.reason,'product_policy_not_authoritative');
    assert.match(v4.warning,/approved customer tariffs/);
  }
  assert.ok(rows.some(({ entry }) => entry.id === 'flux-3-max'));
});

test('a percentage-policy preview cannot replace the fixed Nano21 customer image tariff', () => {
  const row = buildAllModelComparisonScenarios().find(({ entry }) => entry.id === 'nano-banana-2-1');
  assert.ok(row);
  const outcomes = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: [row.scenario] });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, 'unsupported');
  if (outcomes[0].status === 'unsupported') {
    assert.equal(outcomes[0].reason, 'product_policy_not_authoritative');
    assert.match(outcomes[0].warning, /fixed.*image.*tariff/i);
  }
});

test('representative admin quotes use catalog defaults instead of the cheapest enumerated option', () => {
  const comparisons = buildAllModelComparisonScenarios();
  const coverage = collectSellableManualTariffCoverage().scenarios;
  const pick = (modelId: string) => {
    const row = comparisons.find(({ entry }) => entry.id === modelId)!;
    return selectRepresentativeTariffScenario(row.entry, row.scenario,
      coverage.filter((candidate) => candidate.modelId === modelId));
  };
  assert.equal(pick('seedance-2-0-mini')?.selector.aspectRatio, '16:9');
  assert.equal(pick('gpt-image-2')?.selector.quality, 'high');
  assert.equal(pick('nano-banana-pro')?.selector.resolution, '2k');
});

test('family filter separates Luma video from Luma image models', () => {
  const rows = [
    { engineId: 'lumaRay2', familyId: 'luma', brandId: 'luma', mode: 't2v', resolution: '720p', scenarioId: 'ray', executionProvider: 'fal', mediaType: 'video' },
    { engineId: 'luma-uni-1', familyId: 'luma-uni', brandId: 'luma', mode: 't2i', resolution: '2K', scenarioId: 'uni', executionProvider: 'fal', mediaType: 'image' },
  ] as Parameters<typeof filterProviderComparisonRows>[0];
  const selected = filterProviderComparisonRows(rows, { brandId: 'luma-uni', executionProvider: 'all', mediaType: 'all', query: '' });
  assert.deepEqual(selected.map((row) => row.engineId), ['luma-uni-1']);
});
