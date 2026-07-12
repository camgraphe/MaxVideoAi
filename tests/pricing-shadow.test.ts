import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const collectorPath = 'frontend/src/lib/pricing-audit/legacy-collectors.ts';
const fixturePath = 'tests/fixtures/pricing-parity.v1.json';

test('committed pricing baseline exactly matches current authoritative outputs', async () => {
  assert.equal(existsSync(collectorPath), true, `${collectorPath} should exist`);
  assert.equal(existsSync(fixturePath), true, `${fixturePath} should exist`);
  const { collectLegacyPricingOutputs } = await import('../frontend/src/lib/pricing-audit/legacy-collectors.ts');
  const current = await collectLegacyPricingOutputs();
  const frozen = JSON.parse(readFileSync(fixturePath, 'utf8')) as { rows: unknown[] };
  assert.deepEqual(current, frozen.rows);
});
