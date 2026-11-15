import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  P0_VIDEO_MODEL_IDS,
  P0_VIDEO_PRICING_SCENARIOS,
} from '../frontend/src/lib/pricing-audit/p0-video-scenarios.ts';

const collectorPath = 'frontend/src/lib/pricing-audit/legacy-collectors.ts';
const fixturePath = 'tests/fixtures/pricing-parity.v1.json';
const launchAdditionsFixturePath = 'tests/fixtures/pricing-shadow-additions.v1.json';
const P1_PUBLIC_VIDEO_MODEL_IDS = [
  'flux-3-max',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;
const LAUNCHED_IMAGE_MODEL_IDS = [
  'flux-3-draft',
  'flux-3',
  'gpt-image-2-5-flare',
  'gpt-image-2-5-sunburst',
] as const;

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
  assert.equal(
    additions.rows.length,
    LAUNCHED_IMAGE_MODEL_IDS.length * 4
      + P0_VIDEO_PRICING_SCENARIOS.length
      + P0_VIDEO_MODEL_IDS.length * 4
      + P1_PUBLIC_VIDEO_MODEL_IDS.length * 4,
  );
  assert.deepEqual(
    additions.rows.filter((row) => /(?:billing|estimator):(minimax-h3|seedance-2-5):/.test(row.scenarioId)).reduce<Record<string, number>>((counts, row) => {
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
  for (const engineId of P0_VIDEO_MODEL_IDS) {
    assert.equal(
      additions.rows.filter((row) =>
        row.scenarioId.startsWith(`billing:${engineId}:`) || row.scenarioId.startsWith(`estimator:${engineId}:`)
      ).length,
      4,
      engineId,
    );
  }
  for (const engineId of P1_PUBLIC_VIDEO_MODEL_IDS) {
    assert.equal(
      additions.rows.filter((row) =>
        row.scenarioId.startsWith(`billing:${engineId}:`) || row.scenarioId.startsWith(`estimator:${engineId}:`)
      ).length,
      4,
      engineId,
    );
  }
});

test('registry publication shadow additions are reproducible through the canonical audit generator', () => {
  const result = spawnSync('pnpm', ['--silent', 'pricing:shadow-additions'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('the pricing audit reports the reviewed Gemini refresh without failing the release gate', () => {
  const result = spawnSync('pnpm', ['--silent', 'pricing:audit'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /4 approved changes; 0 mismatches/u);
});

test('the real offline audit CLI replays every frozen Pika row while current admission remains closed', async () => {
  const { getFalEngineById } = await import('../frontend/src/config/falEngines');
  const { getRuntimeModelById } = await import('../frontend/config/model-runtime');
  const { buildPricingAuditScenarios } = await import('../frontend/src/lib/pricing-audit/scenarios');
  const { resolvePublicModelScenario } = await import('../frontend/server/pricing/quote-public-model-scenario');
  const { collectCanonicalPricingOutputs } = await import('../frontend/src/lib/pricing-audit/canonical-collectors');
  type AuditRow = Parameters<typeof collectCanonicalPricingOutputs>[0][number];
  type Matrix = Awaited<ReturnType<typeof import('../frontend/src/lib/pricing-audit/matrix').buildPricingAuditMatrix>>;
  const frozen = [...readFixtureRows<AuditRow>(fixturePath), ...readFixtureRows<AuditRow>(launchAdditionsFixturePath)];
  const historicalPika = frozen.filter(row => row.scenarioId.includes(':pika-text-to-video:'));
  assert.equal(frozen.length, 270);
  assert.equal(historicalPika.length, 14);
  const assertClosed = () => {
    const model = getRuntimeModelById('pika-text-to-video')!;
    const entry = getFalEngineById(model.id)!;
    assert.equal(model.publication.app.published, false);
    assert.equal(model.publication.pricing.published, false);
    assert.equal(entry.surfaces.app.enabled, false);
    assert.equal(entry.surfaces.pricing.includeInEstimator, false);
    assert.equal(resolvePublicModelScenario({ modelId: model.id, mode: 't2v', durationSec: 5, resolution: '720p' }), null);
  };
  assertClosed();
  assert.equal(buildPricingAuditScenarios().some(row => row.engineId === 'pika-text-to-video'), false);
  assert.deepEqual(
    buildPricingAuditScenarios({ scope: 'historical' }).filter(row => row.engineId === 'pika-text-to-video').map(row => row.id).sort(),
    historicalPika.map(row => row.scenarioId).sort(),
  );
  const result = spawnSync('pnpm', ['--silent', 'pricing:audit', '--', '--json'], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'postgresql://offline-audit-must-not-connect.invalid/test' },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const matrix = JSON.parse(result.stdout) as Matrix;
  assert.deepEqual(matrix.summary, { scenarios: 270, matches: 266, approvedChanges: 4, mismatches: 0, compatibilityProfiles: 4 });
  assert.deepEqual(new Set(matrix.rows.map(row => row.scenarioId)), new Set(frozen.map(row => row.scenarioId)));
  for (const expected of historicalPika) {
    const actual = matrix.rows.find(row => row.scenarioId === expected.scenarioId)!;
    assert.equal(actual.status, 'match');
    assert.equal(actual.currentTotalCents, expected.customerTotalCents);
    assert.equal(actual.canonicalTotalCents, expected.customerTotalCents);
    assert.deepEqual(actual.fieldDeltas, {});
  }
  assertClosed();
});

test('historical Sora and Seedance 1.5 billing and estimator evidence remains independently reproducible after retirement', async () => {
  const { collectCanonicalPricingOutputs } = await import('../frontend/src/lib/pricing-audit/canonical-collectors');
  const { buildPricingAuditScenarios } = await import('../frontend/src/lib/pricing-audit/scenarios');
  const { quoteHistoricalCanonicalAuditScenarios } = await import('../frontend/server/pricing-admin/canonical-scenarios');
  type AuditRow = Parameters<typeof collectCanonicalPricingOutputs>[0][number];
  const frozen = [
    ...readFixtureRows<AuditRow>(fixturePath),
    ...readFixtureRows<AuditRow>(launchAdditionsFixturePath),
  ];
  const historical = frozen.filter((row) => /^(billing|estimator):(sora-2(?:-pro)?|seedance-1-5-pro):/.test(row.scenarioId));
  assert.equal(historical.length, 12);
  const scenarios = buildPricingAuditScenarios().filter((row) => ['sora-2', 'sora-2-pro', 'seedance-1-5-pro'].includes(row.engineId));
  const quotes = new Map(quoteHistoricalCanonicalAuditScenarios({ databaseRules: [], scenarios })
    .map((row) => [row.scenarioId, row]));
  const reproduced = new Map(collectCanonicalPricingOutputs(frozen).map((row) => [row.scenarioId, row]));
  for (const expected of historical) {
    assert.equal(quotes.get(expected.scenarioId)?.status, 'quoted', 'historical evidence must be calculated, not copied by the unsupported fallback');
    const actual = reproduced.get(expected.scenarioId);
    assert.ok(actual, expected.scenarioId);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(actual[field as keyof typeof actual], value, `${expected.scenarioId}.${field}`);
    }
  }
});

test('canonical shadow quotes match frozen outputs except the Omni 1.2 supplier-cost projection refresh', async () => {
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
  assert.equal(matrix.summary.approvedChanges, 4);
  assert.equal(matrix.summary.mismatches, 0);
  assert.deepEqual(
    matrix.rows
      .filter((row) => row.status !== 'match')
      .map((row) => ({
        scenarioId: row.scenarioId,
        currentTotalCents: row.currentTotalCents,
        canonicalTotalCents: row.canonicalTotalCents,
        deltaCents: row.deltaCents,
        status: row.status,
      })),
    [
      {
        scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:member',
        currentTotalCents: 130,
        canonicalTotalCents: 91,
        deltaCents: -39,
        status: 'approved-change',
      },
      {
        scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:plus',
        currentTotalCents: 123,
        canonicalTotalCents: 86,
        deltaCents: -37,
        status: 'approved-change',
      },
      {
        scenarioId: 'billing:gemini-omni-flash:t2v:10:720p:pro',
        currentTotalCents: 117,
        canonicalTotalCents: 82,
        deltaCents: -35,
        status: 'approved-change',
      },
      {
        scenarioId: 'estimator:gemini-omni-flash:10:720p',
        currentTotalCents: 130,
        canonicalTotalCents: 91,
        deltaCents: -39,
        status: 'approved-change',
      },
    ]
  );
});

test('canonical audit delegates to the explicit historical projector without changing the live admin default', () => {
  const collectorSource = readFileSync('frontend/src/lib/pricing-audit/canonical-collectors.ts', 'utf8');
  const projectorSource = readFileSync('frontend/server/pricing-admin/canonical-scenarios.ts', 'utf8');

  assert.match(collectorSource, /quoteHistoricalCanonicalAuditScenarios/);
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
