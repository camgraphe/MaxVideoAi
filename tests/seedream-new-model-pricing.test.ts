import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import document from '../frontend/config/customer-tariffs.json';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { quoteSeedreamListCost } from '../frontend/server/byteplus-list-tariff';
import { normalBytePlusSupplierCost } from '../frontend/server/byteplus-normal-cost';
import { signedBytePlusContractCost } from '../frontend/server/byteplus-account-contract';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';

const at = '2026-11-13T12:00:00Z';
function context(id: 'seedream-5-5' | 'seedream-5-0-flash', extra: Partial<PricingContext> = {}): PricingContext {
  const existing = getFalEngineById(id)?.engine ?? getFalEngineById('seedream-5-0-pro')!.engine;
  return { engine: { ...existing, id, providerMeta: { provider: 'byteplus_modelark' } },
    mode: 't2i', durationSec: 1, resolution: '2K', aspectRatio: '1:1', ...extra };
}

test('Seedream 5.5 LIST charges every input and uses its exact published pixel boundary', () => {
  for (const [pixels, outputUsd] of [[2_601_123, 0.02], [2_601_124, 0.035], [4_194_304, 0.035]] as const) {
    const quote = quoteSeedreamListCost({ model: '5.5', outputPixels: [pixels], inputImages: 3 });
    assert.equal(quote.outputUsd, outputUsd);
    assert.equal(quote.inputUsd, 0.024);
    assert.equal(quote.totalUsd, Number((outputUsd + 0.024).toFixed(6)));
    assert.equal(quote.effectiveUsd, null);
    assert.equal(quote.source.checkedAt, '2026-11-13');
  }
  assert.equal(quoteSeedreamListCost({ model: '5.5', outputPixels: [], inputImages: 3 }).totalUsd, 0);
});

test('Seedream Flash LIST stays flat across the supported pixels and free input references', () => {
  for (const pixels of [1_048_576, 2_359_296, 4_194_304]) {
    const quote = quoteSeedreamListCost({ model: 'flash', outputPixels: [pixels], inputImages: 10 });
    assert.equal(quote.outputUsd, 0.018);
    assert.equal(quote.inputUsd, 0);
    assert.equal(quote.totalUsd, 0.018);
  }
});

test('new Seedream supplier facts and public facts include all 5.5 sources without a family discount', () => {
  const selected = context('seedream-5-5', { mode: 'i2i', resolution: '1.5K', inputImageCount: 1, referenceImageCount: 9 });
  const billing = buildBillingPricingFacts(selected, selected.engine.pricingDetails, 'USD');
  const publicFacts = buildPublicPricingFacts(selected);
  assert.equal(billing.facts.vendorSubtotalExactCents, 10);
  assert.equal(publicFacts.facts.vendorSubtotalExactCents, 10);
  const cost = normalBytePlusSupplierCost(selected, at);
  assert.equal(cost?.listAmountUsd, 0.1);
  assert.equal(cost?.amountUsd, 0.1);
  assert.equal(cost?.kind, 'published_list_estimate');
  assert.equal(cost?.usage.inputImages, 10);
  assert.equal(cost?.contract, undefined);
  assert.equal(signedBytePlusContractCost({ engineId: selected.engine.id, executionProvider: 'byteplus_modelark',
    resolution: '2K', step: 'normal', accountContractRegion: 'ap-southeast-1', inputImages: 10, outputPixels: [4_194_304] },
  { status: 'published_list', amountUsd: 0.115, unitPriceUsdPer1kTokens: null }, at), null);
});

test('5.5 tariffs distinguish the exact source total while free Flash references share a price', () => {
  const selectors = [1, 2, 10].map(inputImageCount => {
    const selected = context('seedream-5-5', { mode: 'i2i', inputImageCount, referenceImageCount: 0 });
    return buildManualTariffScenario(selected, buildBillingPricingFacts(selected, undefined, 'USD').facts).selector;
  });
  assert.deepEqual(selectors.map(selector => selector.inputImageCount), ['1', '2', '10']);
  const flash = [1, 10].map(inputImageCount => {
    const selected = context('seedream-5-0-flash', { mode: 'i2i', inputImageCount });
    return buildManualTariffScenario(selected, buildBillingPricingFacts(selected, undefined, 'USD').facts).selector;
  });
  assert.deepEqual(flash[0], flash[1]);
});

test('new Seedream scenarios reject unsupported batch, resolution, mode and source counts before pricing', () => {
  for (const extra of [{ durationSec: 2 }, { resolution: '4K' }, { mode: 't2v' },
    { mode: 'i2i', inputImageCount: 11 }, { mode: 't2i', referenceImageCount: 1 }]) {
    const selected = context('seedream-5-5', extra as Partial<PricingContext>);
    assert.throws(() => buildBillingPricingFacts(selected, undefined, 'USD'), /Seedream|image|reference|resolution|output/i);
  }
});

test('new Seedream models fail closed without an active reviewed customer tariff', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(at) });
  for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
    await assert.rejects(computeCanonicalBillingSnapshot(context(id), {
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
      loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 0,
        versionedCells: [], databaseCells: [] }),
    }), /reviewed.*Seedream|Seedream.*tariff/i);
    await assert.rejects(computeCanonicalBillingSnapshot(context(id), {
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
      loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 1,
        versionedCells: [], databaseCells: [] }),
    }), /tariff|missing/i);
    await assert.rejects(computeCanonicalBillingSnapshot(context(id), {
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
      loadCustomerTariffState: async () => ({ status: 'unavailable' }),
    }), /database unavailable/i);
  }
});

test('versioned new-offer cells cover every supported Seedream size, ratio and source count', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(at) });
  const cells = document.cells as ManualTariffCell[];
  assert.equal(cells.filter(cell => ['seedream-5-5', 'seedream-5-0-flash'].includes(cell.selector.engineId)).length, 39);
  for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
    for (const resolution of ['1K', '1.5K', '2K']) for (const aspectRatio of ['auto', '1:1', '16:9', '3:4', '21:9']) {
      for (const inputImageCount of Array.from({ length: 11 }, (_, index) => index)) {
        const selected = context(id, { mode: inputImageCount ? 'i2i' : 't2i', resolution, aspectRatio, inputImageCount });
        const quote = await computeCanonicalBillingSnapshot(selected, {
          pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
          loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 4,
            versionedCells: cells, databaseCells: [] }),
        });
        assert.ok(quote.totalCents >= Math.ceil(Number(quote.meta?.providerCostListUsd) * 100));
        assert.equal(quote.meta?.pricingMode, 'manual_tariff');
        assert.equal(quote.meta?.providerCostKind, 'published_list_estimate');
        assert.equal(quote.meta?.providerCostContract, undefined);
        if (id === 'seedream-5-0-flash') assert.equal(quote.totalCents, 3);
      }
    }
  }
});


test('new Seedream public scenarios retain the exact additional-source count and cover the authored cells', () => {
  for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
    const coverage = collectSellableManualTariffCoverage({ modelId: id });
    assert.deepEqual(coverage.gaps, []);
    assert.equal(coverage.scenarios.length, id === 'seedream-5-5' ? 33 : 6);
    for (const resolution of ['1K', '1.5K', '2K']) for (let references = 0; references < 10; references += 1) {
      const scenario = resolvePublicModelScenario({ modelId: id, mode: 'i2i', durationSec: 1, resolution,
        aspectRatio: '16:9', referenceImageCount: references });
      assert.ok(scenario, `${id}:${resolution}:${references}`);
      assert.equal(scenario.context.inputImageCount, 1);
      assert.equal(scenario.context.referenceImageCount, references);
      assert.ok(coverage.scenarios.some(row => JSON.stringify(row.selector) === JSON.stringify(scenario.selector)));
      if (id === 'seedream-5-5') assert.equal(scenario.selector.inputImageCount, String(references + 1));
    }
    assert.equal(resolvePublicModelScenario({ modelId: id, mode: 'i2i', durationSec: 1,
      resolution: '2K', referenceImageCount: 10 }), null);
    assert.equal(resolvePublicModelScenario({ modelId: id, mode: 't2i', durationSec: 4, resolution: '2K' }), null);
  }
});

test('new Seedream estimator options use fixed customer rates per image across all supported tiers', async () => {
  const { buildEngineOption, PER_IMAGE_ENGINE_IDS } = await import('../frontend/components/marketing/price-estimator/price-estimator-options');
  const { getPricingKernel } = await import('../frontend/src/lib/pricing-kernel');
  for (const id of ['seedream-5-5', 'seedream-5-0-flash'] as const) {
    const entry = getFalEngineById(id)!;
    const option = buildEngineOption(entry, entry.engine, entry.engine, getPricingKernel(), {});
    assert.ok(option);
    assert.equal(PER_IMAGE_ENGINE_IDS.has(id), true);
    assert.equal(option.rateUnit, '/image');
    assert.deepEqual(option.resolutions.map(row => [row.value, row.rate]), [
      ['1K', 0.03], ['1.5K', 0.03], ['2K', id === 'seedream-5-5' ? 0.06 : 0.03],
    ]);
  }
});
