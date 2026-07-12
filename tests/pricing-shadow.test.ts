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

test('canonical shadow quotes match every frozen current output', async () => {
  const matrixPath = 'frontend/src/lib/pricing-audit/matrix.ts';
  assert.equal(existsSync(matrixPath), true, `${matrixPath} should exist`);
  const { buildPricingAuditMatrix } = await import('../frontend/src/lib/pricing-audit/matrix.ts');
  const matrix = await buildPricingAuditMatrix();
  assert.equal(matrix.rows.length > 0, true);
  assert.deepEqual(
    matrix.rows.filter((row) => row.status !== 'match'),
    []
  );
});

test('every cross-surface pricing difference is explicitly profiled', async () => {
  const { collectLegacyPricingOutputs, findUnprofiledCrossSurfaceDifferences } = await import(
    '../frontend/src/lib/pricing-audit/legacy-collectors.ts'
  );
  const current = await collectLegacyPricingOutputs();
  assert.deepEqual(findUnprofiledCrossSurfaceDifferences(current), []);
});
