import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateOwnedKlingElements } from '../frontend/lib/kling-owned-elements';
import { resolveGenerationReferencesForActor } from '../frontend/src/server/agent-api/resolve-generation-references';
import { generationOperationQuoteBinding } from '../frontend/src/server/agent-api/generation-operation-facts';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { studioVideoActionSchema } from '../frontend/lib/studio/conversation-media-contract';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
const input = { surface:'video', engineId:'kling-o3-standard', mode:'v2v', operation:'kling-edit', prompt:'Relight @Element1', settings:{resolution:'720p'},
 references:[{kind:'asset',assetId:'source',role:'source'},{kind:'asset',assetId:'front',role:'reference'},{kind:'asset',assetId:'side',role:'reference'}],
 elements:[{kind:'images',frontalSlot:0,referenceSlots:[1]}] };
const request=normalizeGenerationRequest(input);
const resolved=request.references.map(ref=>({assetId:ref.kind==='asset'?ref.assetId:'',role:ref.role,slot:ref.slot,mediaKind:ref.role==='source'?'video' as const:'image' as const,
 storageUrl:`https://example.com/${ref.kind==='asset'?ref.assetId:''}`,width:1280,height:720,durationSec:5,originalName:ref.role==='source'?'source.mp4':'image.png',mimeType:ref.role==='source'?'video/mp4':'image/png',sizeBytes:1000}));
test('strict owned composition rejects URLs, unknown keys, wrong tuples and duplicate slots',()=>{
 for(const override of [{elements:[{kind:'images',frontalSlot:0,referenceSlots:[1],providerElementId:'hijack'}]}, {elements:[{kind:'video',videoSlot:9}]}, {elements:[{kind:'images',frontalSlot:0,referenceSlots:[0]}]}, {engineId:'wan-3'}, {references:[input.references[0],{kind:'https',url:'https://example.com/front',mediaKind:'image',role:'reference'},input.references[2]]}]) assert.throws(()=>normalizeGenerationRequest({...input,...override}));
 assert.deepEqual(normalizeGenerationRequest(JSON.parse(JSON.stringify(request))),request);
 assert.notEqual(hashCanonicalGenerationRequest(request),hashCanonicalGenerationRequest({...request,elements:undefined}));
 assert.throws(()=>validateOwnedKlingElements(request,resolved.map(ref=>ref.assetId==='front'?{...ref,mediaKind:'video'}:ref)));
 assert.throws(()=>validateOwnedKlingElements(request,resolved.filter(ref=>ref.assetId!=='front')));
});
test('owned resolver checks every element asset and refuses a foreign owner',async()=>{
 const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
 const seen:string[]=[];
 await assert.rejects(resolveGenerationReferencesForActor(request,actor,{resolveOwnedReferenceAsset:async(principal,id)=>{
  assert.equal(principal.userId,'owner');seen.push(id);if(id==='side')throw new Error('not owned');return resolved.find(ref=>ref.assetId===id)!;
 }}),/not owned/);
 assert.deepEqual(seen,['source','front','side']);
});
test('real validation and paid builder consume owned Elements without treating their images as guidance',()=>{
 const engine=getFalEngineById(request.engineId)!.engine;
 validateCanonicalGenerationCapabilities(request,{engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps!},{resolvedReferences:resolved});
 const body=buildPaidVideoRequestBody({quoteId:'quote',request,engine,resolvedReferences:resolved,canonicalPricing:{membershipTier:'member'}});
 assert.deepEqual(body.elements,[{frontalImageUrl:'https://example.com/front',frontalAssetId:'front',referenceImageUrls:['https://example.com/side'],referenceAssetIds:['side']}]);
 assert.equal(body.referenceImages,undefined);
 assert.notDeepEqual(generationOperationQuoteBinding(request,resolved),generationOperationQuoteBinding(request,resolved.map(ref=>ref.assetId==='front'?{...ref,storageUrl:'https://example.com/replaced'}:ref)));
 const extras=Array.from({length:4},(_,i)=>({kind:'asset',assetId:`guide-${i}`,role:'reference'}));
 assert.throws(()=>normalizeGenerationRequest({...input,references:[...input.references,...extras]}),/Element/);
});
test('MCP and Studio accept the same typed composition and persist it without raw media URLs',()=>{
 assert.deepEqual(prepareGenerationInputSchema.parse(input).elements,request.elements);
 const action=studioVideoActionSchema.parse({action:'video.prepare',reply:'Review',prompt:'Relight',aspectRatio:'16:9',source:null,modelId:request.engineId,settings:[],operation:'kling-edit',elements:input.elements});
 assert.deepEqual(studioVideoActionSchema.parse(JSON.parse(JSON.stringify(action))).elements,request.elements);
});


test('shared quote preparation binds Element facts and Studio admits complete subject sets',async()=>{
 const {readGenerationPricing}=await import('../frontend/src/server/agent-api/generation-pricing-read');
 const {requireStudioGenerationRequest}=await import('../frontend/src/server/agent-api/generation-actor');
 const engine=getFalEngineById(request.engineId)!.engine;
 const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
 const result=await readGenerationPricing(request,actor,{
  listPublicEngines:async()=>[{engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps!}],
  resolveGenerationReferences:async()=>resolved,resolveRequestExecutability:()=>({executable:true,reason:'available'}),
  resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
  priceGeneration:async(current,_tier,context)=>{assert.deepEqual(current.elements,request.elements);assert.equal(context.resolvedReferences?.length,3);return {priceCents:125,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:125,currency:'USD',membershipTier:'member'}};},
 });
 assert.equal(result.pricingSnapshot.elementsFingerprint,generationOperationQuoteBinding(request,resolved).elementsFingerprint);
 const many=normalizeGenerationRequest({...input,references:[input.references[0],...Array.from({length:13},(_,i)=>({kind:'asset',assetId:`subject-${i}`,role:'reference'}))],elements:[0,4,8].map(i=>({kind:'images',frontalSlot:i,referenceSlots:[i+1,i+2,i+3]}))});
 assert.doesNotThrow(()=>requireStudioGenerationRequest(many));
});
