import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {NANO21_ENGINE_ID} from '../frontend/src/lib/nano-banana-2-1';
import type {ImageDraft} from '../frontend/src/lib/studio/image-conversation-contract';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';
import {studioReferenceFingerprint} from '../frontend/src/server/agent-api/generation-actor';
import {validateStudioImageRequest} from '../frontend/src/server/studio/conversation-image-preparation';
import type {StudioMotionSourceDependencies} from '../frontend/src/server/studio/conversation-media-generation';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor = {authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
const output = {type:'job-output' as const,kind:'image' as const,jobId:'generated-job',outputId:'generated-job:image:0'};
const savedId = 'ma_'+'a'.repeat(32), attachedId = 'ma_'+'b'.repeat(32);
const originalUrl='https://cdn.maxvideoai.com/generated-original.png';
const savedUrl='https://cdn.maxvideoai.com/library-copy.png';
const entry=getFalEngineById('gpt-image-2')!;
const catalog=[{engine:entry.engine,surface:'image' as const,publicModes:['t2i' as const,'i2i' as const],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}];
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Retouch the generated image.',references:[] as string[]};
const draft:ImageDraft={reply:'Review the retouch quote.',image:{prompt:'Keep the scene and shorten the object.',aspectRatio:'1:1',modelId:'gpt-image-2',mode:'i2i',
  settings:[{name:'resolution',value:'1024x1024'},{name:'quality',value:'medium'},{name:'outputFormat',value:'png'}],
  references:[{ref:output,role:'reference',slot:null}],outputCount:1}};
function facts(assetId:string,url:string):ResolvedReference {
  return {assetId,role:'reference',mediaKind:'image',storageUrl:url,mimeType:'image/png',width:1024,height:1024,durationSec:null,sizeBytes:4096,originalName:null};
}
function fixture() {
  let original=originalUrl, ready=true, writes=0;
  const media=(ref:StudioResolvedMedia['ref']):StudioResolvedMedia=>({id:ref.type==='asset'?ref.assetId:ref.outputId,ref,kind:'image',
    url:ref.type==='job-output'?original:ref.assetId===savedId?savedUrl:'https://cdn.maxvideoai.com/attached.png',
    mime:'image/png',width:1024,height:1024,durationSec:null,sizeBytes:4096,mediaFacts:undefined,thumbUrl:null,previewUrl:null,originalAccess:{type:'external'}});
  const dependencies:StudioMotionSourceDependencies={
    readProjectMedia:async current=>ready&&current.userId==='owner'&&current.projectId==='film'?[{ref:output,name:'Generated image',durationSec:null}]:[],
    resolveMedia:async(_userId,ref)=>media(ref),
    saveOutput:async identity=>{writes++;return {publicId:savedId,userId:identity.userId,kind:'image',url:savedUrl,
      sourceJobId:identity.jobId,sourceOutputId:identity.outputId,status:'ready',metadata:{originUrl:originalUrl}} as never;},
  };
  const resolveReferences=async(request:Parameters<Parameters<typeof validateStudioImageRequest>[0]['resolveReferences']>[0])=>
    request.references.map(ref=>({...facts(ref.kind==='asset'?ref.assetId:'invalid',ref.kind==='asset'&&ref.assetId===savedId?savedUrl:'https://cdn.maxvideoai.com/attached.png'),role:ref.role,...(ref.slot===undefined?{}:{slot:ref.slot})}));
  return {dependencies,resolveReferences,writes:()=>writes,changeOriginal:()=>{original='https://cdn.maxvideoai.com/replaced.png';},hide:()=>{ready=false;}};
}
function options(f:ReturnType<typeof fixture>) {
  return {actor,draft,input,catalog,reviewedReferences:[] as ResolvedReference[],resolveReferences:f.resolveReferences,sourceDependencies:f.dependencies};
}

test('native image preflight is read-only and materialization binds the exact original copy to a canonical retouch',async()=>{
  const f=fixture(), original=structuredClone(draft);
  const selected=await validateStudioImageRequest(options(f));
  assert.equal(f.writes(),0);
  const result=await selected.materialize();
  assert.equal(f.writes(),1);
  assert.equal(result.request.engineId,'gpt-image-2');
  assert.equal(result.request.mode,'i2i');
  assert.deepEqual(result.request.settings,{aspectRatio:'1:1',resolution:'1024x1024',quality:'medium',outputFormat:'png'});
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:savedId,role:'reference'}]);
  assert.equal(result.expectedReferenceFingerprint,studioReferenceFingerprint([facts(savedId,savedUrl)]));
  assert.deepEqual(draft,original,'The immutable native draft survives materialization.');
});

test('invalid model/settings and an unattached later image fail before promoting any native output',async()=>{
  for(const image of [
    {...draft.image!,modelId:'unavailable'},
    {...draft.image!,settings:[{name:'inventedSetting',value:true}]},
    {...draft.image!,references:[...draft.image!.references!,{ref:{type:'asset' as const,kind:'image' as const,assetId:attachedId},role:'reference' as const,slot:null}]},
  ]) {
    const f=fixture();
    await assert.rejects(validateStudioImageRequest({...options(f),draft:{...draft,image}}));
    assert.equal(f.writes(),0);
  }
});

test('another project/account and an unready output are rejected before any library write',async()=>{
  for(const current of [{...actor,projectId:'other'},{...actor,userId:'foreign'},actor]) {
    const f=fixture();if(current===actor)f.hide();
    await assert.rejects(validateStudioImageRequest({...options(f),actor:current}),{code:'REFERENCE_INVALID'});
    assert.equal(f.writes(),0);
  }
});

test('native source drift between validation and materialization fails before promotion',async()=>{
  const f=fixture(), selected=await validateStudioImageRequest(options(f));
  f.changeOriginal();
  await assert.rejects(selected.materialize(),{code:'REFERENCE_INVALID'});
  assert.equal(f.writes(),0);
});

test('saving a native original may add its previously unknown byte measurement without invalidating the source',async()=>{
  const f=fixture(),resolve=f.dependencies.resolveMedia!;
  f.dependencies.resolveMedia=async(...args)=>{
    const media=await resolve(...args);
    return args[1].type==='job-output'&&f.writes()===0?{...media,sizeBytes:null}:media;
  };
  const selected=await validateStudioImageRequest(options(f));
  const result=await selected.materialize();
  assert.deepEqual(result.request.references,[{kind:'asset',assetId:savedId,role:'reference'}]);
  assert.equal(result.expectedReferenceFingerprint,studioReferenceFingerprint([facts(savedId,savedUrl)]));
});

test('source drift during promotion and mismatched saved-copy provenance cannot become quote inputs',async()=>{
  for(const mode of ['original','provenance','copy'] as const) {
    const f=fixture(), save=f.dependencies.saveOutput!;
    f.dependencies.saveOutput=async identity=>{
      const saved=await save(identity);
      if(mode==='original')f.changeOriginal();
      if(mode==='provenance')return {...saved,sourceOutputId:'another-output'};
      if(mode==='copy')return {...saved,url:'https://cdn.maxvideoai.com/other-copy.png'};
      return saved;
    };
    const selected=await validateStudioImageRequest(options(f));
    await assert.rejects(selected.materialize(),{code:'REFERENCE_INVALID'});
  }
});

test('mixed native and attached images retain the selected facts and reject changes to an attached review',async()=>{
  const mixed={...draft,image:{...draft.image!,references:[...draft.image!.references!,{ref:{type:'asset' as const,kind:'image' as const,assetId:attachedId},role:'reference' as const,slot:null}]}};
  const reviewed=facts(attachedId,'https://cdn.maxvideoai.com/attached.png');
  const f=fixture();
  const selected=await validateStudioImageRequest({...options(f),draft:mixed,input:{...input,references:[attachedId]},reviewedReferences:[reviewed]});
  assert.deepEqual((await selected.materialize()).request.references,[
    {kind:'asset',assetId:savedId,role:'reference'},{kind:'asset',assetId:attachedId,role:'reference'},
  ]);
  const changed=fixture();
  await assert.rejects(validateStudioImageRequest({...options(changed),draft:mixed,input:{...input,references:[attachedId]},
    reviewedReferences:[{...reviewed,storageUrl:'https://cdn.maxvideoai.com/previous.png'}]}),{code:'REFERENCE_INVALID'});
  assert.equal(changed.writes(),0);
});

test('a native output and its already attached library copy preserve distinct ordered reference slots',async()=>{
  const nano=getFalEngineById(NANO21_ENGINE_ID)!;
  const nanoCatalog=[{engine:nano.engine,surface:'image' as const,publicModes:['i2i' as const],modeCaps:Object.fromEntries(nano.modes.map(mode=>[mode.mode,mode.ui]))}];
  const saved={type:'asset' as const,kind:'image' as const,assetId:savedId};
  for(const references of [[output,saved],[saved,output]]) {
    const f=fixture();
    const selection={...draft,image:{...draft.image!,modelId:NANO21_ENGINE_ID,
      settings:[{name:'resolution',value:'1k'}],
      references:references.map((ref,slot)=>({ref,role:'reference' as const,slot}))}};
    const selected=await validateStudioImageRequest({...options(f),draft:selection,catalog:nanoCatalog,
      input:{...input,references:[savedId]},reviewedReferences:[facts(savedId,savedUrl)]});
    const result=await selected.materialize();
    assert.deepEqual(result.request.references,[
      {kind:'asset',assetId:savedId,role:'reference',slot:0},
      {kind:'asset',assetId:savedId,role:'reference',slot:1},
    ]);
  }
});
