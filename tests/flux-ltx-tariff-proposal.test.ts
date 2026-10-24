import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareFluxLtxTariffProposal } from '../frontend/server/pricing/flux-ltx-tariff-proposal';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
const policy={status:'loaded' as const,rules:[{id:'default',marginPercent:.3,marginFlatCents:0,surchargeAudioPercent:0,surchargeUpscalePercent:0,currency:'USD'}]};
const state={status:'loaded' as const,active:true,revision:1798,databaseCells:[],versionedCells:[]};
test('proposal separates 4 continuous domains and 48 fixed keyframe cells, always unactivated',async()=>{
 const result=await prepareFluxLtxTariffProposal({state,policy});
 assert.equal(result.sourceRevision,1798);assert.equal(result.writes,false);assert.equal(result.activationReady,false);
 assert.equal(result.fixed.length,48);assert.equal(result.continuous.length,4);
 assert.deepEqual(result.continuous.map(p=>p.examples[0].customerCents),[20,189,65,130]);
 assert.equal(result.continuous.find(p=>p.selector.operation==='flux-draft-enhance')!.domain.maximum,21);
 assert.equal(result.continuous.find(p=>p.selector.operation==='flux-fast-edit')!.domain.maximumExclusive,true);
 assert.ok(result.fixed.every(p=>p.selector.operation==='flux-keyframes'&&!Object.hasOwn(p.selector,'audio')&&!Object.hasOwn(p.selector,'aspectRatio')));
 assert.equal(result.fixed.find(p=>p.selector.engineId==='flux-3-draft'&&p.selector.durationSec==='5')!.price.customerCents,39);
 assert.notEqual(result.fingerprint,(await prepareFluxLtxTariffProposal({state:{...state,revision:1799},policy})).fingerprint);
});
test('new operations fail closed without active exact cells; old requested/keyframe pricing constraints stay distinct',async()=>{
 for(const [engineId,mode,operation,resolution]of [['flux-3','v2v','flux-fast-edit','720p'],['flux-3-draft','v2v','flux-draft-enhance','1080p'],['ltx-2-3','reframe','ltx23-reframe','720p'],['flux-3','ref2v','flux-keyframes','720p']]as const){
  await assert.rejects(computeCanonicalBillingSnapshot({engine:getFalEngineById(engineId)!.engine,mode,operation,resolution,durationSec:5},{pricingPolicy:{loadOverrides:async()=>policy},loadCustomerTariffState:async()=>state}));
 }
 const engine=getFalEngineById('flux-3')!.engine;
 for(const durationSec of [4,5.5,21])assert.throws(()=>buildBillingPricingFacts({engine,mode:'ref2v',durationSec,resolution:'720p'},engine.pricingDetails,'USD'));
});

import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
test('keyframe free controls and image count never invent separate customer selectors',()=>{
 const engine=getFalEngineById('flux-3')!.engine;
 const context={engine,mode:'ref2v' as const,resolution:'720p',durationSec:5,operation:'flux-keyframes' as const};
 const selector=(value:typeof context)=>buildManualTariffScenario(value,buildBillingPricingFacts(value,engine.pricingDetails,'USD').facts).selector;
 const baseline=selector(context);
 for(const audio of [true,false])for(const aspectRatio of ['auto','16:9','9:16','2:1'])for(const referenceImageCount of [1,2,10])assert.deepEqual(selector({...context,addons:{audio},aspectRatio,referenceImageCount,inputImageCount:referenceImageCount}as typeof context),baseline);
 assert.deepEqual(baseline,{engineId:'flux-3',mode:'ref2v',operation:'flux-keyframes',transport:'fal',endpoint:'blackforestlabs/flux-3/keyframes-to-video',resolution:'720p',durationSec:'5'});
});
