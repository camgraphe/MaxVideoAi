import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { klingV4FlashPricingUsage } from '../frontend/src/lib/kling-v4-flash-pricing';
import { estimateGptImage26OutputTokens, calculateGptImage26ListOutputComponents } from '../frontend/lib/image/gptImage26Pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { klingV4TariffScenarios } from '../frontend/lib/pricing-audit/kling-v4-tariff-scenario';
import { getImagePresetQuote } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';

test('three published identities retain exact OpenAI direct image mode IDs', () => {
  for (const id of ['kling-v4-flash', 'gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
    const model = getRuntimeModelById(id)!; assert.ok(model); assert.equal(model.publication.app.published, true); assert.equal(model.publication.pricing.published, true);
    const entry = getFalEngineById(id)!; assert.ok(entry); assert.equal(entry.surfaces.app.enabled, true);
    if (id !== 'kling-v4-flash') {
      assert.equal(entry.engine.providerMeta?.provider, 'openai_images');
      assert.deepEqual(entry.modes.map(mode => mode.mode), ['t2i', 'i2i']);
      assert.equal(entry.defaultFalModelId, id.replace('2-6', '2.6'));
    }
  }
  assert.equal(getRuntimeModelById('kling-v4')?.publication.app.published, true);
  assert.equal(getRuntimeModelById('gpt-image-2-5-flare')?.publication.app.published, true);
});

test('offline image presentation cannot turn partial GPT 2.6 supplier facts into a customer price', () => {
  for (const id of ['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst']) {
    const entry = getFalEngineById(id)!;
    const quote = getImagePresetQuote(entry, { id: 'launch', resolution: '1024x1024', quality: 'high', quantity: 1 }, 'en');
    assert.equal(quote.status, 'live_quote');
    assert.equal(quote.amountCents, undefined);
  }
});

test('Flash supplier cost uses exact aggregate input timing, with independent no-video and video classes', () => {
  assert.equal(klingV4FlashPricingUsage({ mode: 't2v', resolution: '720p', durationSec: 5 }).supplierExactCents, 47);
  const source = { mode: 'ref2v' as const, resolution: '720p', durationSec: 5, hasVideoInput: true, inputVideoDurationSec: 10.2501 };
  assert.equal(klingV4FlashPricingUsage(source).billableSeconds, 15.2501);
  assert.equal(klingV4FlashPricingUsage(source).supplierExactCents, 96.07563);
  assert.equal(klingV4FlashPricingUsage({ ...source, inputVideoDurationSec: 3 }).supplierExactCents, 63);
  for (const patch of [{ inputVideoDurationSec: 20.001 }, { durationSec: 21 }, { durationSec: 3.5 }, { resolution: '1080p' }, { mode: 'v2v' }, { inheritedDurationSec: 5 }]) assert.throws(() => klingV4FlashPricingUsage({ ...source, ...patch } as never));
  assert.throws(() => klingV4FlashPricingUsage({ mode: 'ref2v', resolution: '720p', durationSec: 5 }));
});

test('2.6 output estimates reproduce the current official calculator without treating unknown inputs as zero cost', () => {
  assert.equal(estimateGptImage26OutputTokens({ width: 1024, height: 1024, quality: 'low' }), 823);
  assert.equal(estimateGptImage26OutputTokens({ width: 1024, height: 1024, quality: 'medium' }), 1449);
  assert.equal(estimateGptImage26OutputTokens({ width: 1024, height: 1024, quality: 'high' }), 1756);
  const result = calculateGptImage26ListOutputComponents({ mode: 'i2i', resolution: '1024x1024', durationSec: 2, quality: 'low', referenceImageCount: 1 }, 'USD');
  assert.equal(result.partialListUsd, 0.04938);
  assert.equal(result.meta.providerCostIncomplete, true);
  assert.equal(result.meta.providerInvoiceCostUsd, null);
  assert.equal(result.meta.providerInputImageTokens, null);
  assert.throws(() => calculateGptImage26ListOutputComponents({ mode: 'i2i', resolution: '1024x1024', durationSec: 1 }, 'USD'));
});

test('Flash admin inventory and image tariffs never fall back to legacy percentage pricing', async () => {
  const flash = klingV4TariffScenarios('kling-v4-flash');
  assert.equal(flash.length, 72);
  assert.deepEqual([...new Set(flash.map(row => row.selector.mode))], ['t2v', 'i2v', 'ref2v']);
  const contexts = [flash[0].context, ...['gpt-image-2-6-flare', 'gpt-image-2-6-sunburst'].map(id => ({ engine: getFalEngineById(id)!.engine, mode: 't2i' as const, resolution: '1024x1024', durationSec: 1, quality: 'high' }))];
  for (const context of contexts) {
    const facts = buildBillingPricingFacts(context, undefined, 'USD');
    const scenario = buildManualTariffScenario(context, facts.facts);
    assert.equal(scenario.selector.engineId, context.engine.id);
    await assert.rejects(computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) }, loadCustomerTariffState: async () => ({ status: 'loaded', active: false, revision: 0, versionedCells: [], databaseCells: [] }) }));
  }
});

test('2.6 tariff identity is identical for defaulted and explicit image execution settings', () => {
  const context = { engine: getFalEngineById('gpt-image-2-6-flare')!.engine, mode: 'i2i' as const,
    resolution: '1024x1024', durationSec: 2, referenceImageCount: 3 };
  const facts = buildBillingPricingFacts(context, undefined, 'USD').facts;
  const expected = { engineId: context.engine.id, mode: 'i2i', resolution: '1024x1024', durationSec: '2', quality: 'high', referenceImageCount: '3' };
  assert.deepEqual(buildManualTariffScenario(context, facts).selector, expected);
  assert.deepEqual(buildManualTariffScenario({ ...context, quality: 'high', complexity: 'low',
    aspectRatio: '1:1', customImageSize: { width: 1024, height: 1024 } }, facts).selector, expected);
});
