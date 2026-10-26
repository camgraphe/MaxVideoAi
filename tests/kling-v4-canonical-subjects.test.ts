import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeGenerationRequest,hashCanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';
import {prepareGenerationInputSchema} from '../frontend/src/server/mcp/tools/prepare-generation';
import {KLING_V4_ENGINE} from '../frontend/src/config/fal-engines/kling-v4';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';
const candidate={engine:KLING_V4_ENGINE,surface:'video' as const,publicModes:KLING_V4_ENGINE.modes,modeCaps:KLING_V4_ENGINE.modeCaps!};
const references=Array.from({length:28},(_,index)=>({kind:'asset',assetId:`subject-${index}`,role:'reference'}));
const subjects=Array.from({length:7},(_,index)=>({kind:'image',frontalReferenceSlot:index*4,referenceSlots:[index*4+1,index*4+2,index*4+3]}));
const raw=(patch:Record<string,unknown>={})=>({surface:'video',engineId:'kling-v4',mode:'ref2v',prompt:'The seven subjects meet',settings:{durationSec:5,resolution:'1080p',aspectRatio:'16:9'},references,subjects,...patch});
const request=()=>normalizeGenerationRequest(raw());
const facts=():ResolvedReference[]=>request().references.map(ref=>({assetId:ref.kind==='asset'?ref.assetId:'',role:ref.role,slot:ref.slot,mediaKind:'image',storageUrl:`https://media.example/${ref.kind==='asset'?ref.assetId:''}.png`,width:1280,height:720,durationSec:null,mimeType:'image/png',sizeBytes:1024}));
test('seven canonical subjects retain ordered owned identities in hashes and paid element projection',()=>{
 const current=request();const resolved=facts();
 assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(current,candidate,{resolvedReferences:resolved}));
 assert.notEqual(hashCanonicalGenerationRequest(current),hashCanonicalGenerationRequest(normalizeGenerationRequest(raw({subjects:[...subjects].reverse()}))));
 const body=buildPaidVideoRequestBody({request:current,resolvedReferences:resolved,engine:KLING_V4_ENGINE,quoteId:'test',canonicalPricing:{membershipTier:'member'}});
 const elements=body.elements as {frontalAssetId:string;referenceAssetIds:string[];frontalImageUrl:string}[];
 assert.equal(elements.length,7);assert.equal(elements[0].frontalAssetId,'subject-0');assert.deepEqual(elements[6].referenceAssetIds,['subject-25','subject-26','subject-27']);
 assert.equal(body.referenceImages,undefined);assert.equal((body.inputs as unknown[]).length,0);
 assert.throws(()=>buildPaidVideoRequestBody({request:current,resolvedReferences:resolved.slice(1),engine:KLING_V4_ENGINE,quoteId:'test',canonicalPricing:{membershipTier:'member'}}));
});
test('subjects reject URL injection, unverified voices, bad identities, unsupported modes and overflows',()=>{
 for(const patch of [
  {engineId:'kling-3-pro'}, {mode:'t2v'}, {subjects:[...subjects,subjects[0]]},
  {subjects:[{...subjects[0],voiceId:'arbitrary-fal-id'}]}, {subjects:[{...subjects[0],voiceBinding:{provider:'fal',voiceId:'arbitrary'}}]},
  {subjects:[{kind:'image',frontalReferenceSlot:0,referenceSlots:[99]}]}, {subjects:[{kind:'image',frontalReferenceSlot:0,referenceSlots:[]}]},
  {subjects:[{...subjects[0],frontalImageUrl:'https://media.example/injected.png'}]},
  {references:[{kind:'https',url:'https://media.example/a.png',mediaKind:'image',role:'reference'},...references.slice(1)]},
  {subjects:[{kind:'video',referenceSlot:0}],mode:'v2v'},
  {subjects:Array.from({length:4},(_,referenceSlot)=>({kind:'video',referenceSlot}))},
 ])assert.throws(()=>normalizeGenerationRequest(raw(patch)),JSON.stringify(patch));
 assert.equal(prepareGenerationInputSchema.safeParse(raw()).success,true);
 assert.equal(prepareGenerationInputSchema.safeParse(raw({subjects:[{...subjects[0],voiceId:'raw'}]})).success,false);
});
test('resolved subject types, dimensions and budgets are checked before pricing',()=>{
 const current=request();const resolved=facts();
 assert.throws(()=>validateCanonicalGenerationCapabilities(current,candidate,{resolvedReferences:[{...resolved[0],mediaKind:'video',durationSec:5},...resolved.slice(1)]}));
 assert.throws(()=>validateCanonicalGenerationCapabilities(current,candidate,{resolvedReferences:[{...resolved[0],width:200},...resolved.slice(1)]}));
});

test('owned subject failures stop before membership/pricing and confirmation hashes bind subject view order',async()=>{
 const {readGenerationPricing}=await import('../frontend/src/server/agent-api/generation-pricing-read');
 const {AgentApiError}=await import('../frontend/src/server/agent-api/errors');
 const events:string[]=[];
 await assert.rejects(readGenerationPricing(request(),{authMethod:'studio-session',userId:'owner',projectId:'project',clientId:null},{
  listPublicEngines:async()=>[candidate],resolveGenerationReferences:async()=>{events.push('ownership');throw new AgentApiError('REFERENCE_INVALID','Not owned');},
  resolveMembershipPricing:async()=>{events.push('membership');throw new Error('unexpected');},
  priceGeneration:async()=>{events.push('price');throw new Error('unexpected');},
 }),{code:'REFERENCE_INVALID'});
 assert.deepEqual(events,['ownership']);
 const views=normalizeGenerationRequest(raw({subjects:[{kind:'image',frontalReferenceSlot:0,referenceSlots:[1,2]}]}));
 const reordered=normalizeGenerationRequest(raw({subjects:[{kind:'image',frontalReferenceSlot:0,referenceSlots:[2,1]}]}));
 assert.notEqual(hashCanonicalGenerationRequest(views),hashCanonicalGenerationRequest(reordered));
 assert.equal(hashCanonicalGenerationRequest(views),hashCanonicalGenerationRequest(JSON.parse(JSON.stringify(views))));
});

test('three video subjects share the exact thirty-second budget with flat videos, and Edit accepts image subjects only',()=>{
 const rawVideos=raw({references:references.slice(0,3),subjects:[0,1,2].map(referenceSlot=>({kind:'video',referenceSlot}))});
 const videoRequest=normalizeGenerationRequest(rawVideos);
 const videoFacts:ResolvedReference[]=videoRequest.references.map(ref=>({assetId:ref.kind==='asset'?ref.assetId:'',role:ref.role,slot:ref.slot,mediaKind:'video',storageUrl:`https://media.example/${ref.kind==='asset'?ref.assetId:''}.mp4`,width:1280,height:720,durationSec:10,mimeType:'video/mp4',sizeBytes:1024}));
 assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(videoRequest,candidate,{resolvedReferences:videoFacts}));
 assert.throws(()=>validateCanonicalGenerationCapabilities(videoRequest,candidate,{resolvedReferences:videoFacts.map((ref,i)=>({...ref,durationSec:i===2?11:10}))}));
 const edit=normalizeGenerationRequest(raw({mode:'v2v',settings:{durationSec:5,resolution:'1080p'},references:[{kind:'asset',assetId:'source',role:'source'},...references],subjects}));
 const owned=[{...videoFacts[0],assetId:'source',slot:undefined,role:'source' as const,durationSec:5},...facts()];
 assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(edit,candidate,{resolvedReferences:owned}));
 const body=buildPaidVideoRequestBody({request:edit,resolvedReferences:owned,engine:KLING_V4_ENGINE,quoteId:'local',canonicalPricing:{membershipTier:'member'}});
 assert.equal((body.elements as unknown[]).length,7);assert.equal((body.inputs as unknown[]).length,1);assert.equal(body.referenceImages,undefined);
});

test('canonical owned resolution verifies originals and exact FPS before returning quote-bound facts',async()=>{
 const {resolveGenerationReferencesForActor}=await import('../frontend/src/server/agent-api/resolve-generation-references');
 const videoRequest=normalizeGenerationRequest(raw({references:[references[0]],subjects:[{kind:'video',referenceSlot:0}]}));
 const original='https://media.maxvideoai.com/user-assets/subject.mp4';
 let probes=0;
 const deps={resolveOwnedReferenceAsset:async()=>({assetId:'subject-0',mediaKind:'video' as const,storageUrl:original,width:1,height:1,durationSec:1,mimeType:'video/mp4',sizeBytes:1024}),
  klingV4MediaDependencies:{detectVideoMetadataFn:async(url:string,options?:{requireExactFrameRate?:boolean})=>{assert.equal(url,original);assert.equal(options?.requireExactFrameRate,true);probes++;return {width:1280,height:720,durationSec:5.01,fps:24000/1001};}}};
 const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
 const result=await resolveGenerationReferencesForActor(videoRequest,actor,deps);
 assert.equal(probes,1);assert.equal(result[0].fps,24000/1001);assert.equal(result[0].durationSec,5.01);assert.equal(result[0].slot,0);assert.equal(result[0].width,1280);
 await assert.rejects(resolveGenerationReferencesForActor(videoRequest,actor,{...deps,klingV4MediaDependencies:{detectVideoMetadataFn:async()=>null}}),{code:'REFERENCE_INVALID'});
 const denied=()=>Promise.reject(new Error('ownership denied'));
 await assert.rejects(resolveGenerationReferencesForActor(videoRequest,actor,{...deps,resolveOwnedReferenceAsset:denied}));
 assert.equal(probes,1,'Unowned originals must never be probed.');
});

test('V4 pricing/confirmation snapshot binds the resolved original, exact cadence and ordered facts for every actor',async()=>{
 const {buildGenerationPricingSnapshot}=await import('../frontend/src/server/agent-api/generation-pricing-read');
 const pricing={priceCents:100,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:100,currency:'USD',membershipTier:'member'}} as const;
 const member={tier:'member'} as never;
 const refs=facts();
 const snapshot=(resolved:ResolvedReference[])=>buildGenerationPricingSnapshot(pricing as never,request(),'catalog',member,resolved);
 const initial=snapshot(refs);
 assert.equal(typeof initial.klingV4ReferenceFingerprint,'string');
 for(const patch of [{fps:29.97},{width:1024},{storageUrl:'https://media.maxvideoai.com/changed.png'}])
  assert.notEqual(initial.klingV4ReferenceFingerprint,snapshot([{...refs[0],...patch},...refs.slice(1)]).klingV4ReferenceFingerprint);
 assert.notEqual(initial.klingV4ReferenceFingerprint,snapshot([...refs].reverse()).klingV4ReferenceFingerprint);
 assert.deepEqual(initial,snapshot(structuredClone(refs)));
});

test('canonical V4 refuses controlled URL-only references and preserves Edit input tolerance separately from ref2v total',()=>{
 const https=normalizeGenerationRequest(raw({subjects:undefined,references:[{kind:'https',url:'https://media.maxvideoai.com/reference.mp4',role:'reference',mediaKind:'video'}]}));
 assert.throws(()=>validateCanonicalGenerationCapabilities(https,candidate));
 const reference=normalizeGenerationRequest(raw({subjects:undefined,references:[references[0]]}));
 const video:ResolvedReference={assetId:'subject-0',role:'reference',slot:0,mediaKind:'video',storageUrl:'https://media.maxvideoai.com/reference.mp4',width:1280,height:720,durationSec:30.02,mimeType:'video/mp4',sizeBytes:1024,fps:30};
 assert.throws(()=>validateCanonicalGenerationCapabilities(reference,candidate,{resolvedReferences:[video]}));
 const edit=normalizeGenerationRequest(raw({mode:'v2v',subjects:undefined,settings:{durationSec:30,resolution:'1080p'},references:[{kind:'asset',assetId:'subject-0',role:'source'}]}));
 assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(edit,candidate,{resolvedReferences:[{...video,role:'source',slot:undefined}]}));
});

test('owned resolver allows Edit source tolerance while enforcing exact reference-generation total',async()=>{
 const {resolveGenerationReferencesForActor}=await import('../frontend/src/server/agent-api/resolve-generation-references');
 const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
 const owned={assetId:'source',mediaKind:'video' as const,storageUrl:'https://media.maxvideoai.com/user-assets/source.mp4',width:1280,height:720,durationSec:30.02,mimeType:'video/mp4',sizeBytes:1024};
 const deps={resolveOwnedReferenceAsset:async()=>owned,klingV4MediaDependencies:{detectVideoMetadataFn:async()=>({width:1280,height:720,durationSec:30.02,fps:30})}};
 const edit=normalizeGenerationRequest(raw({mode:'v2v',subjects:undefined,references:[{kind:'asset',assetId:'source',role:'source'}],settings:{resolution:'1080p',durationSec:30}}));
 assert.equal((await resolveGenerationReferencesForActor(edit,actor,deps))[0].durationSec,30.02);
 const ref=normalizeGenerationRequest(raw({subjects:undefined,references:[{kind:'asset',assetId:'source',role:'reference'}]}));
 await assert.rejects(resolveGenerationReferencesForActor(ref,actor,deps),{code:'REFERENCE_INVALID'});
});
