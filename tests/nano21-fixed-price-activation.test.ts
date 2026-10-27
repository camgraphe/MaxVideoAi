import test from 'node:test';
import assert from 'node:assert/strict';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveImageGenerationRequestContext } from '../frontend/src/server/images/image-generation-request-context';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import tariffDocument from '../frontend/config/customer-tariffs.json';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { isWorkspaceModelCertifiedForBlock } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';

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

test('a raw undeclared size alias cannot price a different image than the requested resolution', () => {
  const body={engineId:'nano-banana-2-1',mode:'t2i',prompt:'A still.',resolution:'4k',imageSize:'1K'};
  assert.throws(()=>resolveImageGenerationRequestContext(body as Parameters<typeof resolveImageGenerationRequestContext>[0]),/imageSize|unsupported/i);
});

test('the normal publication switch still closes a forced new Nano21 generation during rollback',()=>{
  const app=getFalEngineById('nano-banana-2-1')!.surfaces.app as {enabled:boolean};
  const before=app.enabled;
  try{
    app.enabled=false;
    assert.throws(()=>resolveImageGenerationRequestContext({engineId:'nano-banana-2-1',mode:'t2i',prompt:'A still.'}),/unavailable/i);
  }finally{app.enabled=before;}
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

test('public model pricing resolves the same three one-image scenarios as charging',()=>{
  for(const resolution of ['1k','2k','4k']){
    const scenario=resolvePublicModelScenario({modelId:'nano-banana-2-1',mode:'t2i',durationSec:1,resolution});
    assert.ok(scenario,`missing public image price ${resolution}`);
    assert.equal(scenario.context.referenceImageCount,0);
  }
});

test('the same admitted Nano21 model is available to Studio image creation and editing',()=>{
  for(const presetId of ['generate-image','modify-image'] as const){
    assert.equal(isWorkspaceModelCertifiedForBlock({modelId:'nano-banana-2-1',presetId}),true);
  }
});

test('public and admin supplier facts admit Nano21 while keeping variable provider cost incomplete', () => {
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  for (const [resolution, imageOnlyCents] of [['1K', 3.36], ['2K', 5.04], ['4K', 11.34]] as const) {
    for (const referenceImageCount of [0, 14]) {
      const context = { engine, resolution, durationSec: 1, referenceImageCount,
        mode: referenceImageCount ? 'i2i' as const : 't2i' as const,
        maxOutputTokens: 4096, thinkingLevel: 'HIGH', enableWebSearch: true, enableImageSearch: true };
      const billing = buildBillingPricingFacts(context, undefined, 'USD');
      const publicFacts = buildPublicPricingFacts(context);
      const { metadata: _manualSelectorMetadata, ...billingSupplierFacts } = billing.facts;
      assert.deepEqual(publicFacts.facts, billingSupplierFacts);
      if (!referenceImageCount) assert.ok(Math.abs(publicFacts.facts.vendorSubtotalExactCents - imageOnlyCents) < 1e-9);
      assert.equal(publicFacts.base.unit, 'image');
      assert.equal(publicFacts.meta.providerCostIncomplete, true);
      assert.equal(publicFacts.meta.providerInvoiceCostUsd, null);
      assert.equal(publicFacts.meta.providerConfiguredOutputTokenLimit, 4096);
      assert.deepEqual(buildPublicPricingFacts({ ...context, useStandardDefinitionFacts: true }).facts, billingSupplierFacts);
    }
  }
});


test('Nano fixed tariffs never enter the historical percentage-policy audit', async () => {
  const { collectCanonicalPricingOutputs } = await import('../frontend/src/lib/pricing-audit/canonical-collectors');
  const frozen = await import('./fixtures/pricing-parity.v1.json');
  const additions = await import('./fixtures/pricing-shadow-additions.v1.json');
  const rows = collectCanonicalPricingOutputs([...frozen.rows, ...additions.rows]);
  assert.ok(rows.length > 178, 'the existing audit coverage remains intact');
  assert.equal(rows.some(row => row.engineId === 'nano-banana-2-1'), false,
    'Native fixed customer tariffs have no historical percentage-policy or complete invoice baseline.');
});


test('offline public Nano projections use fixed customer quotes and reject unsupported batches', async () => {
  const { collectPublicPricingProjectionRows } = await import('../frontend/scripts/pricing-public-baseline-collector');
  const rows = (await collectPublicPricingProjectionRows()).filter(row => row.engineId === 'nano-banana-2-1');
  assert.equal(rows.length, 9);
  for (const row of rows) {
    if (row.id.endsWith(':quantity-4')) { assert.equal(row.status, 'unavailable'); continue; }
    assert.equal(row.status, 'exact', row.id);
    assert.equal(row.customerTotalCents, row.id.endsWith(':high') ? 23 : 7, row.id);
  }
});


test('the public estimator exposes all three Nano image sizes without a percentage-derived customer hint', async () => {
  const { buildEngineOption, PER_IMAGE_ENGINE_IDS } = await import('../frontend/components/marketing/price-estimator/price-estimator-options');
  const { getPricingKernel } = await import('../frontend/src/lib/pricing-kernel');
  const entry = getFalEngineById('nano-banana-2-1')!;
  const option = buildEngineOption(entry, entry.engine, entry.engine, getPricingKernel(), {});
  assert.ok(option, 'Nano21 must be selectable in the public estimator');
  assert.equal(PER_IMAGE_ENGINE_IDS.has(entry.id), true);
  assert.equal(option.rateUnit, '/image');
  assert.deepEqual(option.resolutions.map(row => [row.value, row.rate]), [['1k', 0.07], ['2k', 0.11], ['4k', 0.23]]);
});
