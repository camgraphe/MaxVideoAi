import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {compareGenerationPrices} from '../frontend/src/server/agent-api/generation-price-comparison';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationComparisonRequest,
  normalizeGenerationRequest,
  orderedGenerationReferenceRole,
} from '../frontend/src/server/agent-api/generation-normalization';

const references = Array.from({length:14},(_,slot)=>({
  kind:'asset',role:'reference',slot,assetId:'ma_'+(14-slot).toString(16).padStart(32,'0'),
}));
const request = {surface:'image',engineId:'nano-banana-2-1',mode:'i2i',prompt:'Keep the ordered synthetic subjects.',
  settings:{resolution:'2K',thinkingLevel:'HIGH',maxOutputTokens:4096},references};

test('Studio composition preserves all fourteen ordered Nano 2.1 references and native settings',()=>{
  assert.equal(orderedGenerationReferenceRole('i2i','nano-banana-2-1'),'reference');
  const normalized=normalizeGenerationRequest(request);
  assert.deepEqual(normalized.references,references);
  assert.equal(normalized.settings.thinkingLevel,'high');
  assert.equal(normalized.settings.maxOutputTokens,4096);
  assert.deepEqual(normalizeGenerationComparisonRequest(request),normalized);
  const reversed=normalizeGenerationRequest({...request,references:[...references].reverse().map((ref,slot)=>({...ref,slot}))});
  assert.notEqual(hashCanonicalGenerationRequest(normalized),hashCanonicalGenerationRequest(reversed));
});

test('Nano comparison adaptation does not relax canonical purchase reference validation',()=>{
  assert.throws(()=>normalizeGenerationRequest({...request,engineId:'gpt-image-2'}),/unsupported field/i);
  assert.throws(()=>normalizeGenerationRequest({...request,references:[{...references[0],slot:1},...references.slice(1)]}),/slot/i);
  assert.throws(()=>normalizeGenerationRequest({...request,references:[...references,{...references[0],slot:14,assetId:'ma_'+'f'.repeat(32)}]}),/Nano|scenario/i);
  assert.throws(()=>normalizeGenerationRequest({...request,references:[{kind:'https',role:'reference',mediaKind:'image',url:'https://example.com/synthetic.png'}]}),/Nano|scenario/i);
});

for(const count of [2,14])for(const authoredSlots of [false,true])
test(`Nano i2i comparison without a baseline preserves ${count} owned references, authoredSlots=${authoredSlots}`,async()=>{
  const entry=getFalEngineById('nano-banana-2-1')!;
  const priced:ReturnType<typeof normalizeGenerationRequest>[]=[];
  const selected=references.slice(0,count).map(value=>{
    const reference:{kind:string;role:string;assetId:string;slot?:number}={...value};
    if(!authoredSlots)delete reference.slot;
    return reference;
  });
  const result=await compareGenerationPrices({surface:'image',mode:'i2i',prompt:request.prompt,
    settings:request.settings,references:selected,candidateModelIds:['nano-banana-2-1']},
  {authMethod:'studio-session',userId:'synthetic-owner',projectId:'synthetic-project',clientId:null},{
    listPublicEngines:async()=>[{engine:entry.engine,surface:'image',publicModes:entry.engine.modes,
      modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    resolveGenerationReferences:async candidate=>candidate.references.map(reference=>({
      assetId:reference.kind==='asset'?reference.assetId:'unexpected',role:reference.role,slot:reference.slot,mediaKind:'image',
      storageUrl:'https://cdn.maxvideoai.com/synthetic.png',mimeType:'image/png',width:1280,height:720,durationSec:null,sizeBytes:1024,
    })),
    priceGeneration:async(candidate,tier)=>{
      priced.push(candidate);
      return {priceCents:70,currency:'USD',membershipTier:tier,pricingSnapshot:{totalCents:70,currency:'USD',membershipTier:tier}};
    },
  });
  assert.deepEqual(result.options.map(option=>option.modelId),['nano-banana-2-1']);
  assert.deepEqual(result.unavailable,[]);
  assert.deepEqual(priced[0]?.references,references.slice(0,count));
  assert.equal(result.baseline,null);
});
