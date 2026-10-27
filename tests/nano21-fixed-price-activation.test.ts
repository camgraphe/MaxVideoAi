import test from 'node:test';
import assert from 'node:assert/strict';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveImageGenerationRequestContext } from '../frontend/src/server/images/image-generation-request-context';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import tariffDocument from '../frontend/config/customer-tariffs.json';
import type { ManualTariffCell } from '@maxvideoai/pricing';

test('Nano21 has a separate factual engine and never aliases Nano2', () => {
  const engine = getFalEngineById('nano-banana-2-1');
  assert.ok(engine, 'Nano21 must exist in the ordinary model registry');
  assert.equal(engine.id, 'nano-banana-2-1');
  assert.equal(engine.defaultFalModelId, 'gemini-nano-banana-2.1');
  assert.notEqual(engine.defaultFalModelId, getFalEngineById('nano-banana-2')?.defaultFalModelId);
});

test('an explicit unknown image model cannot silently generate with the first engine', () => {
  assert.throws(() => resolveImageGenerationRequestContext({ engineId: 'unknown-nano-version', prompt: 'An original still.', mode: 't2i' }), /unavailable/i);
});

test('the canonical fixed Nano21 price covers every supported ratio, reasoning and reference count', async () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  for (const [resolution, cents] of [['1k',7],['2k',11],['4k',23]] as const) {
    for (const thinkingLevel of ['minimal','medium','high']) for (const aspectRatio of engine.aspectRatios) {
      for (const referenceImageCount of [0,1,7,14]) {
        const mode = referenceImageCount ? 'i2i' : 't2i';
        const context = { engine, mode, durationSec:1, resolution, thinkingLevel, aspectRatio, referenceImageCount,
          maxOutputTokens:32768, enableWebSearch:false, enableImageSearch:false } as const;
        const result = await computeCanonicalBillingSnapshot(context, {
          pricingPolicy:{loadOverrides:async()=>({status:'loaded',rules:[]})},
          loadCustomerTariffState:async()=>({status:'loaded',active:true,revision:4,versionedCells:tariffDocument.cells as ManualTariffCell[],databaseCells:[]}),
        });
        assert.equal(result.totalCents,cents, JSON.stringify({resolution,thinkingLevel,aspectRatio,referenceImageCount}));
      }
    }
  }
});

test('unpriced native controls remain quote facts without requiring more tariff cells', () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const selectors = [1,4096,32768].flatMap(maxOutputTokens => [false,true].map(search => {
    const context = {engine,mode:'t2i' as const,durationSec:1,resolution:'1k',thinkingLevel:'high',maxOutputTokens,
      aspectRatio:'21:9',referenceImageCount:0,enableWebSearch:search,enableImageSearch:search};
    return buildManualTariffScenario(context,buildBillingPricingFacts(context,undefined,'USD').facts).selector;
  }));
  assert.equal(new Set(selectors.map(selector=>JSON.stringify(selector))).size,1);
});
