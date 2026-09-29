import assert from 'node:assert/strict';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime.ts';
import { buildAllModelComparisonScenarios } from '../frontend/server/pricing-admin/policy-read-model.ts';
import { quoteCanonicalAdminScenarios } from '../frontend/server/pricing-admin/canonical-scenarios.ts';
import { filterProviderComparisonRows } from '../frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts';

test('admin comparison inventory contains every app-published model, including pricing-hidden legacy Luma', () => {
  const expected = listRuntimeModels().filter((model) => model.publication.app.published);
  const rows = buildAllModelComparisonScenarios();
  assert.equal(expected.length, 48);
  assert.equal(rows.length, expected.length);
  assert.deepEqual(new Set(rows.map(({ entry }) => entry.id)), new Set(expected.map((model) => model.id)));
  assert.ok(rows.some(({ entry }) => entry.id === 'lumaRay2'));
  assert.ok(rows.some(({ entry }) => entry.id === 'lumaRay2_flash'));
  assert.equal(new Set(expected.map((model) => model.family)).size, 15);
  assert.ok(rows.every(({ scenario }) => scenario.durationSec && scenario.resolution && scenario.mode));
  const quotes = quoteCanonicalAdminScenarios({ databaseRules: [], scenarios: rows.map(({ scenario }) => scenario) });
  assert.equal(quotes.filter((quote) => quote.status === 'quoted').length, 48);
});

test('family filter separates Luma video from Luma image models', () => {
  const rows = [
    { engineId: 'lumaRay2', familyId: 'luma', brandId: 'luma', mode: 't2v', resolution: '720p', scenarioId: 'ray', executionProvider: 'fal', mediaType: 'video' },
    { engineId: 'luma-uni-1', familyId: 'luma-uni', brandId: 'luma', mode: 't2i', resolution: '2K', scenarioId: 'uni', executionProvider: 'fal', mediaType: 'image' },
  ] as Parameters<typeof filterProviderComparisonRows>[0];
  const selected = filterProviderComparisonRows(rows, { brandId: 'luma-uni', executionProvider: 'all', mediaType: 'all', query: '' });
  assert.deepEqual(selected.map((row) => row.engineId), ['luma-uni-1']);
});
