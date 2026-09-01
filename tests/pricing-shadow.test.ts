import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { P0_VIDEO_PRICING_SCENARIOS } from '../frontend/src/lib/pricing-audit/p0-video-scenarios.ts';

const collectorPath = 'frontend/src/lib/pricing-audit/legacy-collectors.ts';
const fixturePath = 'tests/fixtures/pricing-parity.v1.json';
const launchAdditionsFixturePath = 'tests/fixtures/pricing-shadow-additions.v1.json';

function readFixtureRows<T>(path: string): T[] {
  return (JSON.parse(readFileSync(path, 'utf8')) as { rows: T[] }).rows;
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  let candidates: string[];
  if (specifier === '@maxvideoai/pricing') {
    candidates = [resolve('packages/pricing/src/index.ts')];
  } else if (specifier.startsWith('@maxvideoai/pricing/')) {
    candidates = [resolve('packages/pricing/src', specifier.slice('@maxvideoai/pricing/'.length))];
  } else if (specifier.startsWith('@/')) {
    candidates = [resolve('frontend/src', specifier.slice(2)), resolve('frontend', specifier.slice(2))];
  } else if (specifier.startsWith('.')) {
    candidates = [resolve(dirname(fromFile), specifier)];
  } else {
    return null;
  }
  for (const candidate of candidates) {
    for (const path of [candidate, `${candidate}.ts`, `${candidate}.tsx`, resolve(candidate, 'index.ts')]) {
      if (existsSync(path) && statSync(path).isFile()) return path;
    }
  }
  return null;
}

function collectLocalDependencies(entryFile: string): Set<string> {
  const visited = new Set<string>();
  const pending = [resolve(entryFile)];
  const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  while (pending.length) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const dependency = resolveLocalImport(file, match[1] ?? '');
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return visited;
}

test('committed pre-canonical pricing baseline is immutable after legacy deletion', () => {
  assert.equal(existsSync(collectorPath), false, `${collectorPath} should be deleted`);
  assert.equal(existsSync(fixturePath), true, `${fixturePath} should exist`);
  const frozen = JSON.parse(readFileSync(fixturePath, 'utf8')) as { generatedFrom: string; rows: unknown[] };
  assert.equal(frozen.generatedFrom, 'legacy-authoritative-pricing-paths');
  assert.equal(frozen.rows.length, 178);

  assert.equal(existsSync(launchAdditionsFixturePath), true, `${launchAdditionsFixturePath} should exist`);
  const additions = JSON.parse(readFileSync(launchAdditionsFixturePath, 'utf8')) as {
    generatedFrom: string;
    rows: Array<{ scenarioId: string }>;
  };
  assert.equal(additions.generatedFrom, 'registry-publication-shadow-additions');
  assert.equal(additions.rows.length, 8 + P0_VIDEO_PRICING_SCENARIOS.length);
  assert.deepEqual(
    additions.rows.filter((row) => !row.scenarioId.startsWith('billing:p0:')).reduce<Record<string, number>>((counts, row) => {
      const engineId = row.scenarioId.includes('minimax-h3') ? 'minimax-h3' : 'seedance-2-5';
      counts[engineId] = (counts[engineId] ?? 0) + 1;
      return counts;
    }, {}),
    { 'seedance-2-5': 4, 'minimax-h3': 4 },
  );
  assert.deepEqual(
    additions.rows
      .filter((row) => row.scenarioId.startsWith('billing:p0:'))
      .map((row) => row.scenarioId)
      .sort(),
    P0_VIDEO_PRICING_SCENARIOS.map((scenario) => `billing:p0:${scenario.id}`).sort(),
  );
});

test('P0 shadow additions are reproducible through the canonical audit generator', () => {
  const result = spawnSync('pnpm', ['--silent', 'pricing:shadow-additions'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('canonical shadow quotes match every frozen current output', async () => {
  const matrixPath = 'frontend/src/lib/pricing-audit/matrix.ts';
  assert.equal(existsSync(matrixPath), true, `${matrixPath} should exist`);
  const { buildPricingAuditMatrix } = await import('../frontend/src/lib/pricing-audit/matrix.ts');
  type AuditRows = Parameters<typeof buildPricingAuditMatrix>[0];
  const rows = [
    ...readFixtureRows<AuditRows[number]>(fixturePath),
    ...readFixtureRows<AuditRows[number]>(launchAdditionsFixturePath),
  ];
  const matrix = await buildPricingAuditMatrix(rows);
  assert.equal(matrix.rows.length > 0, true);
  assert.deepEqual(
    matrix.rows.filter((row) => row.status !== 'match'),
    []
  );
});

test('canonical audit delegates quote projection to the shared admin-safe projector', () => {
  const collectorSource = readFileSync('frontend/src/lib/pricing-audit/canonical-collectors.ts', 'utf8');
  const projectorSource = readFileSync('frontend/server/pricing-admin/canonical-scenarios.ts', 'utf8');

  assert.match(collectorSource, /quoteCanonicalAdminScenarios/);
  assert.doesNotMatch(collectorSource, /quoteCanonicalPricing|resolvePricingPolicy|buildCanonicalPricingFacts|collectLegacyPricingOutputs/);
  assert.match(projectorSource, /buildCanonicalPricingFacts/);
  assert.match(projectorSource, /quoteCanonicalPricing/);
  assert.doesNotMatch(projectorSource, /@\/lib\/db|pricing-rule-store|process\.env|collectLegacyPricingOutputs/);
});

test('canonical admin scenario projection has no transitive dependency on the broad ENV object', () => {
  const dependencies = collectLocalDependencies('frontend/server/pricing-admin/canonical-scenarios.ts');
  const envPath = resolve('frontend/src/lib/env.ts');

  assert.equal(dependencies.has(resolve('frontend/src/lib/pricing-audit/canonical-facts.ts')), true);
  assert.equal(dependencies.has(envPath), false, `canonical scenario dependency graph reaches ${envPath}`);
});

test('every cross-surface pricing difference is explicitly profiled', async () => {
  const { findUnprofiledCrossSurfaceDifferences } = await import('../frontend/src/lib/pricing-audit/matrix.ts');
  type AuditRows = Parameters<typeof findUnprofiledCrossSurfaceDifferences>[0];
  const rows = [
    ...readFixtureRows<AuditRows[number]>(fixturePath),
    ...readFixtureRows<AuditRows[number]>(launchAdditionsFixturePath),
  ];
  assert.deepEqual(findUnprofiledCrossSurfaceDifferences(rows), []);
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
