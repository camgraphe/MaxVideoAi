import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { collectCanonicalPricingOutputs } from '../frontend/src/lib/pricing-audit/canonical-collectors';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectPublicPricingProjectionRows } from '../frontend/scripts/pricing-public-baseline-collector';

test('publishing Kling 4 pricing does not invent a historical percentage-policy baseline', async () => {
  const baseline = ['pricing-parity.v1.json', 'pricing-shadow-additions.v1.json']
    .flatMap((name) => JSON.parse(readFileSync(`tests/fixtures/${name}`, 'utf8')).rows);
  const rows = collectCanonicalPricingOutputs(baseline);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.engineId !== 'kling-v4'));
  const historicalPika = baseline.filter(row => row.scenarioId.includes(':pika-text-to-video:'));
  assert.equal(historicalPika.length, 14, 'every frozen Pika billing and public checkpoint stays covered');
  const byId = new Map(rows.map(row => [row.scenarioId, row]));
  for (const expected of historicalPika) {
    const actual = byId.get(expected.scenarioId);
    assert.ok(actual, expected.scenarioId);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(actual[field as keyof typeof actual], value, `${expected.scenarioId}.${field}`);
    }
  }
  const currentPika = getFalEngineById('pika-text-to-video')!;
  assert.equal(currentPika.surfaces.app.enabled, false);
  assert.equal(currentPika.surfaces.pricing.includeInEstimator, false, 'historical collection never opens current publication');
});

test('offline Kling 4 pricing projections expose availability without inventing a current quote', async () => {
  const rows = (await collectPublicPricingProjectionRows()).filter((row) => row.engineId === 'kling-v4');
  assert.equal(rows.length, 12);
  assert.equal(rows.filter((row) => row.surface === 'estimator').length, 3);
  assert.equal(rows.filter((row) => row.surface === 'pricing-hub-video').length, 7);
  assert.ok(rows.every((row) => row.status === 'unavailable'));
  assert.ok(rows.every((row) => Object.keys(row).sort().join(',') === 'engineId,id,status,surface'));
});
