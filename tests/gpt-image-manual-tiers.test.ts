import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { buildAllModelComparisonScenarios, selectRepresentativeTariffScenario } from '../frontend/server/pricing-admin/policy-read-model';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

const models = ['gpt-image-2', 'gpt-image-2-5-flare', 'gpt-image-2-5-sunburst'];
const sizes = [
  ['1024x768', { width: 768, height: 1024 }, 'portrait_4_3'],
  ['1024x1024', { width: 1024, height: 1024 }, 'square_hd'],
  ['1024x1536', { width: 1536, height: 1024 }, 'portrait_16_9'],
  ['1920x1080', { width: 1920, height: 1088 }, 'landscape_16_9'],
  ['2560x1440', { width: 1440, height: 2560 }, '2560x1440'],
  ['3840x2160', { width: 2160, height: 3840 }, '3840x2160'],
] as const;
const policy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) };

function manual(context: PricingContext) {
  return buildManualTariffScenario(context, buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts);
}

test('GPT fixed, preset, custom and automatic sizes share six priced tiers without changing existing cents', async () => {
  const coverage = collectSellableManualTariffCoverage();
  for (const modelId of models) {
    const engine = getFalEngineById(modelId)!.engine;
    const rows = coverage.scenarios.filter(row => row.modelId === modelId);
    assert.deepEqual(new Set(rows.map(row => row.selector.resolution)), new Set(sizes.map(([key]) => key)));
    assert.ok(!coverage.gaps.some(gap => gap.modelId === modelId && /resolution|aspect/.test(gap.reason)));
    const choices = chooseCustomerTariffScenario(rows, { mode: 'i2i' }).choices;
    assert.equal(choices.find(choice => choice.key === 'resolution')?.options.length, 6);
    assert.ok(!choices.some(choice => choice.key === 'aspectRatio'), 'unpriced aspect is not a tariff choice');
    for (const mode of ['t2i', 'i2i'] as const) for (const quality of modelId === 'gpt-image-2'
      ? ['low', 'medium', 'high'] : ['low', 'medium', 'high', 'xhigh', 'max']) {
      for (const [resolution, customImageSize, preset] of sizes) {
        const base: PricingContext = { engine, mode, quality, resolution, durationSec: 4,
          ...(modelId !== 'gpt-image-2' && mode === 'i2i' ? { referenceImageCount: 16 } : {}) };
        const variants = [base, { ...base, resolution: preset, aspectRatio: '9:16' },
          { ...base, resolution: 'custom', customImageSize }, { ...base, resolution: 'auto', customImageSize }];
        const expected = manual(base).selector;
        const matches = rows.filter(row => JSON.stringify(row.selector) === JSON.stringify(expected));
        assert.equal(matches.length, 1, `${modelId}/${mode}/${quality}/${resolution}`);
        assert.equal(expected.customImageSize, undefined);
        assert.equal(expected.aspectRatio, undefined);
        const cents = (await computeCanonicalBillingSnapshot(base, { pricingPolicy: policy })).totalCents;
        for (const context of variants) {
          assert.deepEqual(manual(context).selector, expected);
          assert.equal((await computeCanonicalBillingSnapshot(context, { pricingPolicy: policy })).totalCents, cents);
        }
      }
    }
  }
});

test('an authored tier prices custom and automatic GPT requests identically and rejects an old raw selector', async () => {
  const engine = getFalEngineById('gpt-image-2-5-flare')!.engine;
  const base: PricingContext = { engine, mode: 'i2i', quality: 'high', durationSec: 2,
    resolution: '1920x1080', referenceImageCount: 3 };
  const selector = manual(base).selector;
  const cell = { id: 'gpt-tier', source: 'versioned' as const, version: 1, selector,
    currency: 'USD', effectiveFrom: '2026-09-28T00:00:00.000Z', price: { kind: 'fixed' as const, customerCents: 123 } };
  const state = { status: 'loaded' as const, active: true, revision: 21, versionedCells: [cell], databaseCells: [] };
  for (const resolution of ['1920x1080', 'landscape_16_9', 'custom', 'auto']) {
    const snapshot = await computeCanonicalBillingSnapshot({ ...base, resolution,
      customImageSize: { width: 1920, height: 1088 } }, { pricingPolicy: policy, loadCustomerTariffState: async () => state });
    assert.equal(snapshot.totalCents, 123);
    assert.equal(snapshot.meta?.customerTariffRevision, 21);
  }
  await assert.rejects(computeCanonicalBillingSnapshot(base, { pricingPolicy: policy,
    loadCustomerTariffState: async () => ({ ...state, versionedCells: [{ ...cell,
      selector: { ...selector, aspectRatio: 'default', customImageSize: JSON.stringify({ width: 1920, height: 1080 }) } }] }) }),
  /No active manual tariff/);
});

test('omitted GPT quality reaches the same manual cell as the factual high default', async () => {
  const rows = collectSellableManualTariffCoverage().scenarios;
  for (const modelId of models) for (const mode of ['t2i', 'i2i'] as const) {
    const engine = getFalEngineById(modelId)!.engine;
    const base: PricingContext = { engine, mode, resolution: '1024x768', durationSec: 1, quality: 'high',
      ...(modelId !== 'gpt-image-2' && mode === 'i2i' ? { referenceImageCount: 3 } : {}) };
    const selector = manual(base).selector;
    const selected = rows.find(row => JSON.stringify(row.selector) === JSON.stringify(selector));
    assert.ok(selected);
    for (const quality of [undefined, null, ' HIGH ']) {
      const context = { ...base, quality };
      assert.deepEqual(manual(context).selector, selector);
      const pricing = await computeCanonicalBillingSnapshot(context, { pricingPolicy: policy,
        loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 23,
          versionedCells: [{ id: 'default-quality', source: 'versioned', version: 1, selector,
            currency: 'USD', effectiveFrom: '2026-09-28T00:00:00.000Z', price: { kind: 'fixed', customerCents: 123 } }], databaseCells: [] }) });
      assert.equal(pricing.totalCents, 123);
      assert.equal(pricing.meta?.quality, 'high');
    }
  }
});

test('GPT inventory and default tier detail retain the preset-specific effective policy', async () => {
  const coverage = collectSellableManualTariffCoverage().scenarios;
  for (const modelId of models) {
    const representative = buildAllModelComparisonScenarios().find(row => row.entry.id === modelId)!;
    const rows = coverage.filter(row => row.modelId === modelId);
    const selected = selectRepresentativeTariffScenario(representative.entry, representative.scenario, rows)!;
    assert.equal(selected.selector.resolution, '1024x768');
    assert.equal(selected.context.resolution, 'landscape_4_3');
    const detail = chooseCustomerTariffScenario(rows, selected.selector).scenario;
    assert.equal(detail.context.resolution, 'landscape_4_3');
    const publicAlias = resolvePublicModelScenario({ modelId, mode: 't2i', durationSec: 1,
      resolution: 'landscape_4_3', quality: 'high' })!;
    const publicFixed = resolvePublicModelScenario({ modelId, mode: 't2i', durationSec: 1,
      resolution: '1024x768', quality: 'high' })!;
    const scopedPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [{
      id: 'preset-rule', engineId: modelId, mode: 't2i', resolution: 'landscape_4_3', marginPercent: 1, currency: 'USD' }] }) };
    const alias = await computeCanonicalBillingSnapshot(publicAlias.context, { pricingPolicy: scopedPolicy });
    const fixed = await computeCanonicalBillingSnapshot(publicFixed.context, { pricingPolicy: scopedPolicy });
    for (const scenario of [selected, detail]) {
      const admin = await computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: scopedPolicy });
      assert.equal(admin.totalCents, alias.totalCents);
      assert.equal((admin.meta?.pricingPolicy as { sourceRuleId: string }).sourceRuleId, 'preset-rule');
    }
    assert.notEqual(alias.totalCents, fixed.totalCents, 'a conflicting legacy alias remains visible to the activation parity gate');
  }
});
