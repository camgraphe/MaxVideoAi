import assert from 'node:assert/strict';
import test from 'node:test';
import { klingV4TariffScenarios } from '../frontend/lib/pricing-audit/kling-v4-tariff-scenario';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { continuousInputTariffDetail, prepareContinuousInputTariffChange } from '../frontend/server/pricing-admin/continuous-input-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { studioMediaIntentSchema } from '../frontend/lib/studio/conversation-media-contract';
const state={status:'loaded' as const,active:false,revision:0,versionedCells:[],databaseCells:[]};
const policy={status:'loaded' as const,rules:[]};

test('hidden V4 admin inventory covers four routes and fractional video inputs without a suggested price',async()=>{
 const scenarios=klingV4TariffScenarios();
 assert.deepEqual([...new Set(scenarios.map(s=>s.selector.mode))],['t2v','i2v','ref2v','v2v']);
 for(const mode of ['t2v','i2v','ref2v','v2v']) for(const resolution of ['720p','1080p']) for(const durationSec of ['3','30']) {
  assert.ok(scenarios.some(s=>s.selector.mode===mode&&s.selector.resolution===resolution&&s.selector.durationSec===durationSec));
 }
 const {scenario,choices}=chooseCustomerTariffScenario(scenarios,{mode:'ref2v',resolution:'720p',durationSec:'5',billingInputType:'video_input',inputVideoDurationSec:'10.2501'});
 assert.equal(scenario.selector.inputVideoDurationSec,'10.2501');assert.equal(scenario.quantities.billable_seconds,15.2501);
 assert.deepEqual(choices.find(c=>c.key==='inputVideoDurationSec')?.range,{minInclusive:3,max:30});
 const detail=await continuousInputTariffDetail(scenario,state,policy);
 assert.equal(detail?.price,null);assert.equal(detail?.prepared,false);
 await assert.rejects(computeCanonicalBillingSnapshot(scenario.context,{pricingPolicy:{loadOverrides:async()=>policy},loadCustomerTariffState:async()=>state}));
 const prepared=await prepareContinuousInputTariffChange({scenario,state,policy,proposal:{operation:'create',scenarioId:scenario.id,scope:'continuous_input',price:{kind:'kling_v4_billable',customerCentsPerBillableSecond:20}}});
 assert.equal(prepared.proposedCents,306);assert.equal(prepared.previousCell,null);
 assert.equal(prepared.proposedCell?.selector.billingInputType,'video_input');assert.equal(prepared.proposedCell?.selector.inputVideoDurationSec,'continuous');
 assert.deepEqual(state.databaseCells,[],'preview does not write or activate');
 await assert.rejects(prepareContinuousInputTariffChange({scenario,state,policy,proposal:{operation:'create',scenarioId:scenario.id,scope:'continuous_input',price:{kind:'kling_v4_billable',customerCentsPerBillableSecond:1}}}));
});

test('Studio accepts an explicit V4 shot plan with an empty main prompt and preserves other operation validation',()=>{
 const action={action:'video.prepare',reply:'Review',prompt:'',shotPlan:[{prompt:'A moving camera.',durationSec:3}],aspectRatio:'16:9',source:null,modelId:'kling-v4',mode:'t2v'};
 assert.equal(studioMediaIntentSchema.safeParse(action).success,true);
 assert.equal(studioMediaIntentSchema.safeParse({...action,modelId:'kling-3-pro'}).success,false);
});

test('Studio transport accommodates all seven four-view subjects plus the documented flat reference budget',async()=>{
 const {studioGenerationReferenceLimit}=await import('../frontend/src/server/studio/conversation-reference-limits');
 assert.equal(studioGenerationReferenceLimit('kling-v4','video','ref2v'),43);
 assert.equal(studioGenerationReferenceLimit('kling-v4','video','v2v'),39);
});
