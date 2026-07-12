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

test('matrix validation rejects missing scenarios and invalid quote fields with stable codes', async () => {
  const { PricingAuditError, buildPricingAuditMatrixFromOutputs } = await import(
    '../frontend/src/lib/pricing-audit/matrix.ts'
  );
  const current = {
    scenarioId: 'one',
    surface: 'billing' as const,
    currency: 'USD',
    vendorSubtotalCents: 10,
    marginCents: 3,
    surchargeCents: 0,
    customerTotalCents: 13,
    unit: 'run',
    quantity: 1,
  };
  const canonical = {
    ...current,
    engineId: 'engine-a',
    policySource: 'versioned' as const,
    policyRuleId: 'default',
  };

  assert.throws(
    () => buildPricingAuditMatrixFromOutputs([current], []),
    (error: unknown) => error instanceof PricingAuditError && error.code === 'missing_scenario'
  );
  assert.throws(
    () =>
      buildPricingAuditMatrixFromOutputs(
        [{ ...current, customerTotalCents: Number.NaN }],
        [{ ...canonical, customerTotalCents: Number.NaN }]
      ),
    (error: unknown) => error instanceof PricingAuditError && error.code === 'invalid_quote'
  );
});

test('matrix validation rejects unapproved compatibility profiles', async () => {
  const { PricingAuditError, buildPricingAuditMatrixFromOutputs } = await import(
    '../frontend/src/lib/pricing-audit/matrix.ts'
  );
  const current = {
    scenarioId: 'one',
    surface: 'billing' as const,
    currency: 'USD',
    vendorSubtotalCents: 10,
    marginCents: 3,
    surchargeCents: 0,
    customerTotalCents: 13,
    unit: 'run',
    quantity: 1,
    compatibilityProfile: 'unapproved',
  };
  assert.throws(
    () =>
      buildPricingAuditMatrixFromOutputs(
        [current],
        [{ ...current, engineId: 'engine-a', policySource: 'versioned', policyRuleId: 'default' }],
        new Set(['standard'])
      ),
    (error: unknown) => error instanceof PricingAuditError && error.code === 'unapproved_compatibility_profile'
  );
});
