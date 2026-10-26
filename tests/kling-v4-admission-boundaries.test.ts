import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { verifyResolvedGenerationReferencesForActor } from '../frontend/src/server/agent-api/resolve-generation-references';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { canonicalKlingV4PricingFacts } from '../frontend/src/server/agent-api/generation-kling-v4-pricing-facts';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import type { MaxVideoProviderElement } from '../frontend/src/lib/video-provider-elements';
import type { NormalizedAttachment } from '../frontend/app/api/generate/_lib/generation-attachment-types';

const candidate = {engine:KLING_V4_ENGINE,surface:'video' as const,publicModes:KLING_V4_ENGINE.modes,modeCaps:KLING_V4_ENGINE.modeCaps!};
const actor = {authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
function fixture(images=10,videos=5,videoSubjects=0,mode:'ref2v'|'v2v'='ref2v') {
  const subjects:Record<string,unknown>[] = [];
  const kinds:('image'|'video')[] = [];
  for(let i=0;i<7;i++) {
    const slot = kinds.length;
    if(i<videoSubjects) { kinds.push('video'); subjects.push({kind:'video',referenceSlot:slot}); }
    else { kinds.push('image','image','image','image'); subjects.push({kind:'image',frontalReferenceSlot:slot,referenceSlots:[slot+1,slot+2,slot+3]}); }
  }
  kinds.push(...Array.from({length:images},()=> 'image' as const),...Array.from({length:videos},()=> 'video' as const));
  const references = kinds.map((_,i)=>({kind:'asset',assetId:`asset-${i}`,role:'reference'}));
  if(mode==='v2v') references.unshift({kind:'asset',assetId:'source',role:'source'});
  const raw = {surface:'video',engineId:'kling-v4',mode,prompt:'A scene with seven subjects',settings:{durationSec:5,resolution:'1080p',...(mode==='ref2v'?{aspectRatio:'16:9'}:{})},references,subjects};
  const request = normalizeGenerationRequest(raw);
  const resolved:ResolvedReference[] = request.references.map(reference=>{
    const mediaKind = reference.role==='source' ? 'video' : kinds[reference.slot!];
    return {assetId:reference.kind==='asset'?reference.assetId:'',role:reference.role,slot:reference.slot,mediaKind,
      storageUrl:`https://media.maxvideoai.com/user-assets/${reference.kind==='asset'?reference.assetId:''}.${mediaKind==='image'?'png':'mp4'}`,
      width:1280,height:720,sizeBytes:1024,mimeType:`${mediaKind}/${mediaKind==='image'?'png':'mp4'}`,durationSec:mediaKind==='video'?3:null,...(mediaKind==='video'?{fps:30}:{})};
  });
  return {raw,request,resolved};
}
async function admitted(input:ReturnType<typeof fixture>) {
  validateCanonicalGenerationCapabilities(input.request,candidate,{resolvedReferences:input.resolved});
  const verified = await verifyResolvedGenerationReferencesForActor(input.request,actor,input.resolved);
  const body = buildPaidVideoRequestBody({request:input.request,resolvedReferences:verified,engine:KLING_V4_ENGINE,quoteId:'offline',canonicalPricing:{membershipTier:'member'}});
  const result = await validateNormalizedGenerationAttachments({engineId:'kling-v4',mode:input.request.mode as 'ref2v'|'v2v',userId:'owner',inputSchema:KLING_V4_ENGINE.inputSchema,
    attachments:body.inputs as NormalizedAttachment[],elements:body.elements as MaxVideoProviderElement[],trustedResolvedReferences:verified});
  assert.equal(result.ok,true,JSON.stringify(result));
  return {body,result};
}

test('43 actual owned originals traverse canonical and paid admission without flattening subjects into flat budgets',async()=>{
  const input=fixture();
  const {body,result}=await admitted(input);
  assert.equal(input.request.references.length,43);
  assert.equal((body.elements as MaxVideoProviderElement[]).length,7);
  assert.equal((body.inputs as unknown[]).length,15);
  assert.equal((body.referenceImages as string[]).length,10);
  if(result.ok) assert.equal(result.trustedMediaReferences?.length,43);
  assert.deepEqual(canonicalKlingV4PricingFacts(input.request,input.resolved),{hasVideoInput:true,inputVideoDurationSec:15});
  const reordered=normalizeGenerationRequest({...input.raw,subjects:[...input.raw.subjects].reverse()});
  assert.notEqual(hashCanonicalGenerationRequest(input.request),hashCanonicalGenerationRequest(reordered));
});

test('mixed video subjects retain each supplier occurrence; Modify admits 39 image/source members',async()=>{
  const mixed=fixture(10,5,3);
  const {result}=await admitted(mixed);
  if(result.ok) assert.equal(result.trustedMediaReferences?.length,34);
  assert.deepEqual(canonicalKlingV4PricingFacts(mixed.request,mixed.resolved),{hasVideoInput:true,inputVideoDurationSec:24});
  const edit=fixture(10,0,0,'v2v');
  const validated=await admitted(edit);
  if(validated.result.ok) assert.equal(validated.result.trustedMediaReferences?.length,39);
});

test('flat images/videos and opening-frame aggregation remain independently bounded',async()=>{
  for(const input of [fixture(11,0),fixture(0,6)]) {
    assert.throws(()=>validateCanonicalGenerationCapabilities(input.request,candidate,{resolvedReferences:input.resolved}));
    // Exercise the generate owner independently, after a valid reference materialization.
    const body=buildPaidVideoRequestBody({request:input.request,resolvedReferences:input.resolved,engine:KLING_V4_ENGINE,quoteId:'offline',canonicalPricing:{membershipTier:'member'}});
    const result=await validateNormalizedGenerationAttachments({engineId:'kling-v4',mode:'ref2v',userId:'owner',inputSchema:KLING_V4_ENGINE.inputSchema,attachments:body.inputs as NormalizedAttachment[],elements:body.elements as MaxVideoProviderElement[],trustedResolvedReferences:input.resolved});
    assert.equal(result.ok,false);
  }
  const input=fixture(10,0);
  const opening={...input.request.references[28],role:'first_frame' as const,slot:undefined};
  const request={...input.request,references:[...input.request.references,opening]};
  const resolved=[...input.resolved,{...input.resolved[28],role:'first_frame' as const,slot:undefined}];
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:resolved}));
});

test('eighth subject, fourth video subject, Modify video subject, and aggregate video overflow fail',async()=>{
  const image=fixture(0,0);
  assert.throws(()=>normalizeGenerationRequest({...image.raw,subjects:[...image.raw.subjects,image.raw.subjects[0]]}));
  assert.throws(()=>fixture(0,0,4));
  assert.throws(()=>fixture(0,0,1,'v2v'));
  const mixed=fixture(10,5,3);
  mixed.resolved=mixed.resolved.map(reference=>reference.mediaKind==='video'?{...reference,durationSec:4}:reference);
  assert.throws(()=>validateCanonicalGenerationCapabilities(mixed.request,candidate,{resolvedReferences:mixed.resolved}));
  await assert.rejects(verifyResolvedGenerationReferencesForActor(mixed.request,actor,mixed.resolved),{code:'REFERENCE_INVALID'});
});

test('every member remains required: missing, mismatched and oversized subject originals cannot be admitted',async()=>{
  const input=fixture(0,0);
  for(const resolved of [input.resolved.slice(1),[{...input.resolved[0],sizeBytes:31*1024*1024},...input.resolved.slice(1)]]) {
    await assert.rejects(admitted({...input,resolved}));
  }
  const {body}=await admitted(input);
  const attachments=body.inputs as NormalizedAttachment[];
  const elements=body.elements as MaxVideoProviderElement[];
  for(const rows of [[],input.resolved.slice(1)]) {
    const result=await validateNormalizedGenerationAttachments({engineId:'kling-v4',mode:'ref2v',userId:'owner',inputSchema:KLING_V4_ENGINE.inputSchema,attachments,elements,
      mediaConstraintDeps:{queryFn:async<T>(sql:string,params?:readonly unknown[])=>{
        assert.match(sql,/user_id = \$1/);assert.match(sql,/status = 'ready'/);assert.equal(params?.[0],'owner');
        return rows.map(r=>({asset_id:r.assetId,url:r.storageUrl,mime_type:r.mimeType,size_bytes:r.sizeBytes,width:r.width,height:r.height})) as T[];
      }}});
    assert.equal(result.ok,false);
  }
});
