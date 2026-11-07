import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { normalizeGenerationRequest, hashCanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { resolveAgentGenerationModeExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { isStudioConversationVideoModeCertified, isWorkspaceModelCertifiedForBlock } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { canonicalKlingV4PricingFacts } from '../frontend/src/server/agent-api/generation-kling-v4-pricing-facts';
import { studioGenerationReferenceLimit } from '../frontend/src/server/studio/conversation-reference-limits';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const candidate = (id: string) => { const entry=getFalEngineById(id)!; return {engine:entry.engine,surface:id.startsWith('gpt')?'image' as const:'video' as const,publicModes:entry.engine.modes,modeCaps:entry.engine.modeCaps ?? Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}; };
const asset = (assetId='reference',role='reference') => ({kind:'asset',assetId,role});
const flash = (mode='ref2v', patch:Record<string,unknown>={}) => normalizeGenerationRequest({surface:'video',engineId:'kling-v4-flash',mode,prompt:'A cinematic scene',settings:{durationSec:5,resolution:'720p',...(mode!=='i2v'?{aspectRatio:'16:9'}:{})},references:mode==='t2v'?[]:[asset('reference',mode==='i2v'?'first_frame':'reference')],...patch});
const facts = (request:ReturnType<typeof flash>,seconds=5):ResolvedReference[] => request.references.map(ref=>({assetId:ref.kind==='asset'?ref.assetId:'',role:ref.role,slot:ref.slot,mediaKind:'video',storageUrl:'https://media.maxvideoai.com/user-assets/ref.mp4',width:1280,height:720,durationSec:seconds,mimeType:'video/mp4',sizeBytes:1024,fps:30}));

test('GPT Image 2.6 rejects invalid owned reference metadata before a canonical quote', () => {
  const request = normalizeGenerationRequest({ surface: 'image', engineId: 'gpt-image-2-6-flare', mode: 'i2i', prompt: 'Change the background', references: [asset()], settings: {} });
  const original: ResolvedReference = { assetId: 'reference', role: 'reference', mediaKind: 'image', storageUrl: 'https://media.maxvideoai.com/user-assets/original.png', mimeType: 'image/png', sizeBytes: 1024, width: 1024, height: 1024, durationSec: null };
  const validate = (reference: ResolvedReference) => validateCanonicalGenerationCapabilities(request, candidate(request.engineId), { resolvedReferences: [reference] });
  validate(original);
  for (const patch of [{ mimeType: 'image/heic' }, { sizeBytes: 25 * 1024 * 1024 + 1 }, { sizeBytes: null }, { width: null }, { height: 0 }]) {
    assert.throws(() => validate({ ...original, ...patch }), /not executable/);
  }
});

for (const id of ['gpt-image-2-6-flare','gpt-image-2-6-sunburst']) for (const mode of ['t2i','i2i']) test(`${id}/${mode} preserves canonical raster controls and still requires provider credentials`,()=>{
  const raw={surface:'image',engineId:id,mode,prompt:'A product study',settings:{resolution:'1024x1024',quality:'max',complexity:'low',background:'transparent',outputFormat:'webp'},references:mode==='i2i'?[asset()]:[],outputCount:1};
  const request=normalizeGenerationRequest(raw);
  validateCanonicalGenerationCapabilities(request,candidate(id));
  assert.equal(request.settings.complexity,'low');
  assert.notEqual(hashCanonicalGenerationRequest(request),hashCanonicalGenerationRequest(normalizeGenerationRequest({...raw,settings:{...raw.settings,complexity:'high'}})));
  assert.equal(isWorkspaceModelCertifiedForBlock({modelId:id,presetId:mode==='t2i'?'generate-image':'modify-image'}),true);
  assert.equal(resolveAgentGenerationModeExecutability(candidate(id).engine,mode as 't2i'|'i2i',{bytePlusEnabled:false,bytePlusApiKey:undefined,falApiKey:'irrelevant',providerEnv:{}}).executable,false);
  assert.throws(()=>normalizeGenerationRequest({...raw,settings:{...raw.settings,outputFormat:'jpeg'}}));
  assert.throws(()=>normalizeGenerationRequest({...raw,references:[{kind:'https',url:'https://media.maxvideoai.com/ref.png',role:'reference',mediaKind:'image'}]}));
});

for (const mode of ['t2v','i2v','ref2v']) test(`Flash/${mode} has exact Studio capability and canonical payload`,()=>{
  const request=flash(mode,mode==='i2v'?{prompt:''}:{});
  const resolved=facts(request).map(ref=>mode==='i2v'?{...ref,mediaKind:'image' as const,mimeType:'image/png',durationSec:null}:ref);
  validateCanonicalGenerationCapabilities(request,candidate(request.engineId),{resolvedReferences:resolved});
  assert.equal(isStudioConversationVideoModeCertified(request.engineId,mode),true);
  assert.equal(isStudioConversationVideoModeCertified(request.engineId,'v2v'),false);
  assert.equal(resolveAgentGenerationModeExecutability(candidate(request.engineId).engine,mode as 't2v',{bytePlusEnabled:false,bytePlusApiKey:undefined,falApiKey:'key'}).executable,true);
  assert.throws(()=>validateCanonicalGenerationCapabilities(flash(mode,{settings:{durationSec:30,resolution:'1080p'}}),candidate(request.engineId)));
});

test('Flash subjects preserve slots and count repeated originals in the twenty-second budget',()=>{
  const request=flash('ref2v',{references:[asset('same'),asset('same')],subjects:[{kind:'video',referenceSlot:0}]});
  const resolved=facts(request,8);
  validateCanonicalGenerationCapabilities(request,candidate(request.engineId),{resolvedReferences:resolved});
  assert.equal(canonicalKlingV4PricingFacts(request,resolved).inputVideoDurationSec,16);
  const body=buildPaidVideoRequestBody({request,resolvedReferences:resolved,engine:candidate(request.engineId).engine,quoteId:'local',canonicalPricing:{membershipTier:'member'}});
  assert.equal((body.elements as unknown[]).length,1);
  assert.equal((body.referenceVideos as unknown[]).length,1);
  assert.throws(()=>validateCanonicalGenerationCapabilities(request,candidate(request.engineId),{resolvedReferences:facts(request,9)}));
  const excessive=flash('ref2v',{references:[asset('same'),asset('same'),asset('same')]});
  assert.throws(()=>validateCanonicalGenerationCapabilities(excessive,candidate(request.engineId),{resolvedReferences:facts(excessive,7)}));
  assert.equal(studioGenerationReferenceLimit('kling-v4-flash','video','ref2v'),15);
});

test('Studio selects each 2.6 variant explicitly with exact pixel framing and one output', async()=>{
  const { imageRequestFromDraft } = await import('../frontend/src/server/studio/image-conversation-service');
  for (const id of ['gpt-image-2-6-flare','gpt-image-2-6-sunburst']) for (const aspectRatio of ['1:1','3:2','2:3']) {
    const draft={reply:'Direction',image:{modelId:id,prompt:'A cobalt bottle',aspectRatio,settings:[{name:'complexity',value:'low'}]}};
    const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Create',references:[]};
    const result=imageRequestFromDraft(draft,input,[candidate(id)]);
    assert.equal(result.engineId,id); assert.equal(result.outputCount,1); assert.equal(result.settings.aspectRatio,undefined);
    assert.equal(result.settings.complexity,'low');
    assert.equal(imageRequestFromDraft({...draft,image:{...draft.image,aspectRatio:'16:9'}},input,[candidate(id)]).settings.resolution,'1536x864');
  }
});

test('App rejects inherited Flash controls before normalization and validates subjects before billing',async()=>{
  const { buildGenerateRequestOptions }=await import('../frontend/app/api/generate/_lib/request-options');
  const { validateRequest }=await import('../frontend/app/api/generate/_lib/validate');
  const engine=candidate('kling-v4-flash').engine;
  const options=(patch:Record<string,unknown>)=>buildGenerateRequestOptions({engine,mode:'t2v',isBytePlusV1a:false,body:{prompt:'Scene',durationSec:5,resolution:'720p',...patch}});
  assert.equal(options({}).ok,true);
  for (const patch of [{durationSec:3.5},{durationSec:21},{durationOption:'5s'},{resolution:'1080p'},{multiPrompt:[]},{fps:24},{audio:false},{cfgScale:0.5},{endImageUrl:'https://media.maxvideoai.com/end.png'}]) assert.equal(options(patch).ok,false,JSON.stringify(patch));
  assert.equal(validateRequest(engine.id,'t2v',{prompt:'Scene',duration:5,resolution:'720p',aspect_ratio:'16:9'},{inputSchema:engine.inputSchema}).ok,true);
  assert.equal(validateRequest(engine.id,'t2v',{prompt:'Scene',duration:3.5,resolution:'720p'},{inputSchema:engine.inputSchema}).ok,false);
});

test('image model picker retains 2.6 complexity, and discloses removal on another model',async()=>{
  const {prepareImagePickerOption}=await import('../frontend/app/(core)/(workspace)/app/image/_lib/image-model-picker');
  const input={mode:'t2i' as const,numImages:1,resolution:'1024x1024',aspectRatio:null,quality:'high',complexity:'low',enableWebSearch:false,customImageWidth:'',customImageHeight:'',referenceImageCount:0,selectedReferenceCount:0,readyReferenceSizes:[]};
  const same=prepareImagePickerOption(candidate('gpt-image-2-6-flare').engine,input,'fr');
  assert.equal(same.settings.complexity,'low'); assert.equal(same.request.complexity,'low');
  const switched=prepareImagePickerOption(getFalEngineById('gpt-image-2-5-flare')!.engine,input,'fr');
  assert.equal(switched.settings.complexity,null); assert.ok(switched.changes.some(change=>change.before==='low'));
});
