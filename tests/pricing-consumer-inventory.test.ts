import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const guidePath = 'docs/engineering/pricing-engine.md';
const scenariosPath = 'frontend/src/lib/pricing-audit/scenarios.ts';

const requiredOwners = [
  'frontend/src/lib/pricing.ts',
  'frontend/src/lib/pricing-specialized-snapshots.ts',
  'frontend/src/lib/audio-generation.ts',
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
  'frontend/components/marketing/PriceEstimator.tsx',
  'frontend/components/marketing/PriceChip.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts',
] as const;

test('pricing audit inventory names every current pricing owner', () => {
  assert.equal(existsSync(guidePath), true, `${guidePath} should exist`);
  const guide = readFileSync(guidePath, 'utf8');
  for (const path of requiredOwners) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    assert.equal(guide.includes(path), true, `${guidePath} should inventory ${path}`);
  }
});

test('pricing audit scenarios cover every required surface', async () => {
  assert.equal(existsSync(scenariosPath), true, `${scenariosPath} should exist`);
  const { buildPricingAuditScenarios } = await import('../frontend/src/lib/pricing-audit/scenarios.ts');
  const scenarios = buildPricingAuditScenarios();
  const surfaces = new Set(scenarios.map((row) => row.surface));

  assert.equal(new Set(scenarios.map((row) => row.id)).size, scenarios.length, 'scenario ids must be unique');
  for (const surface of ['billing', 'pricing-hub', 'estimator', 'price-chip', 'model-page', 'json-ld', 'audio', 'tool']) {
    assert.equal(surfaces.has(surface), true, `${surface} should have at least one scenario`);
  }
});
