import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>;
};

test('public pricing has an explicit read-only baseline and intentional generation command', () => {
  assert.equal(
    existsSync('frontend/scripts/pricing-public-baseline.ts'),
    true,
    'the exhaustive public pricing baseline collector should exist'
  );
  assert.equal(
    existsSync('tests/fixtures/pricing-public-projections.v1.json'),
    true,
    'the exhaustive public pricing fixture should exist'
  );
  assert.equal(
    packageJson.scripts?.['pricing:public-baseline'],
    'tsx --tsconfig frontend/tsconfig.json frontend/scripts/pricing-public-baseline.ts'
  );
  assert.equal(
    packageJson.scripts?.['pricing:public-baseline:generate'],
    'tsx --tsconfig frontend/tsconfig.json frontend/scripts/pricing-public-baseline.ts --write'
  );
});

type PublicProjectionFixture = {
  version: number;
  generatedFrom?: string;
  rows: Array<{
    id: string;
    surface: string;
    engineId: string;
    status: 'exact' | 'unavailable';
    currency?: string;
    customerTotalCents?: number;
    quantity?: number;
    structuredDataAmount?: string;
    compatibilityProfile?: string;
  }>;
};

test('public pricing baseline exhaustively covers eligible catalog and public surfaces', () => {
  const fixture = JSON.parse(
    readFileSync('tests/fixtures/pricing-public-projections.v1.json', 'utf8')
  ) as PublicProjectionFixture;
  assert.equal(fixture.version, 1);
  assert.equal(fixture.generatedFrom, 'legacy-authoritative-public-pricing-paths');
  assert.ok(fixture.rows.length >= 250, `expected at least 250 public projection rows, got ${fixture.rows.length}`);

  const ids = fixture.rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'public projection scenario ids must be unique');

  const requiredSurfaces = new Set([
    'pricing-hub-video',
    'pricing-hub-image',
    'pricing-hub-audio',
    'pricing-hub-tool',
    'model-page',
    'estimator',
    'price-chip',
    'json-ld',
    'workspace-preflight',
    'image-estimate',
  ]);
  const actualSurfaces = new Set(fixture.rows.map((row) => row.surface));
  for (const surface of requiredSurfaces) {
    assert.equal(actualSurfaces.has(surface), true, `missing public pricing surface ${surface}`);
  }

  for (const row of fixture.rows) {
    assert.ok(row.id.trim(), 'scenario id should not be empty');
    assert.ok(row.engineId.trim(), `${row.id}.engineId should not be empty`);
    if (row.status === 'exact') {
      assert.equal(Number.isInteger(row.customerTotalCents), true, `${row.id}.customerTotalCents`);
      assert.ok((row.customerTotalCents ?? -1) >= 0, `${row.id}.customerTotalCents should be non-negative`);
      assert.equal(row.currency, 'USD', `${row.id}.currency should stay USD`);
      assert.equal(typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity! > 0, true);
      assert.ok(row.compatibilityProfile?.trim(), `${row.id}.compatibilityProfile should be explicit`);
    }
    if (row.structuredDataAmount != null) {
      assert.match(row.structuredDataAmount, /^\d+\.\d{2}$/);
    }
  }

  const estimatorEngineIds = new Set(
    fixture.rows.filter((row) => row.surface === 'estimator').map((row) => row.engineId)
  );
  const modelEngineIds = new Set(
    fixture.rows.filter((row) => row.surface === 'model-page').map((row) => row.engineId)
  );
  for (const entry of listFalEngines()) {
    if (entry.surfaces.pricing.includeInEstimator) {
      assert.equal(estimatorEngineIds.has(entry.id), true, `missing estimator baseline for ${entry.id}`);
    }
    if (entry.surfaces.modelPage.indexable) {
      assert.equal(modelEngineIds.has(entry.id), true, `missing model-page baseline for ${entry.id}`);
    }
  }
});

test('public pricing baseline ignores machine-specific pricing environment overrides', () => {
  const result = spawnSync('pnpm', ['--silent', 'pricing:public-baseline'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://baseline-must-not-connect.invalid/maxvideoai',
      LUMARAY2_BASE_5S_540P_USD: '99.99',
      LUMARAY2_FLASH_BASE_5S_540P_USD: '88.88',
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /current \(492 rows\)/);
});
