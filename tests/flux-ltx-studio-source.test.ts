import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { studioMediaIntentSchema } from '../frontend/lib/studio/conversation-media-contract';
import { validateStudioMediaRequest,studioPricingSourceSelection,type StudioMediaFactories } from '../frontend/src/server/studio/conversation-media-generation';
import { resolveGenerationReferencesForActor } from '../frontend/src/server/agent-api/resolve-generation-references';
const actor={userId:'owner',projectId:'project',authMethod:'studio-session' as const,clientId:null};
const assetId='ma_'+ '1'.repeat(32),original='https://media.maxvideoai.com/original.mp4',durable='https://media.maxvideoai.com/durable.mp4';
for(const [engineId,mode,operation,resolution]of [['flux-3','v2v','flux-fast-edit','720p'],['ltx-2-3','reframe','ltx23-reframe','1080p']]as const)test(`Studio ${operation} quotes exact measured source and binds owned promotion`,async()=>{
 const entry=getFalEngineById(engineId)!;const candidate={engine:entry.engine,surface:'video',publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};
 let changed='none',writes=0;
 const inspect=async(url:string)=>({kind:'video' as const,width:720,height:1280,durationSec:5.558333,sizeBytes:123456,mimeType:'video/mp4',fps:25,sourceSha256:changed==='all'||changed===url?'changed':'same',hasAudio:true,videoCodec:'h264',audioCodec:'aac'});
 const output={type:'job-output' as const,jobId:'job',outputId:'out',kind:'video' as const};
 const asset={type:'asset' as const,assetId,kind:'video' as const};
 const media=(ref:typeof output|typeof asset)=>({id:ref.type==='asset'?assetId:'out',ref,kind:'video',url:ref.type==='asset'?durable:original,mime:'video/mp4',width:720,height:1280,durationSec:5.558,sizeBytes:123456,originalName:null,thumbUrl:null,previewUrl:null,originalAccess:{type:'external'}});
 const owned=()=>({assetId,storageUrl:durable,mediaKind:'video' as const,mimeType:'video/mp4',width:720,height:1280,durationSec:5.558,sizeBytes:123456,originalName:null});
 const factories={video:()=>({catalog:async()=>[candidate],resolveReferences:(request:any)=>resolveGenerationReferencesForActor(request,actor,{resolveOwnedReferenceAsset:async()=>owned(),inspectFluxLtxSource:inspect})})}as unknown as StudioMediaFactories;
 const dependencies={inspectFluxLtxSource:inspect,readProjectMedia:async()=>[{ref:output,name:'ready',durationSec:5.558}],resolveMedia:async(_user:string,ref:any)=>media(ref)as any,
 saveOutput:async()=>{writes++;return{publicId:assetId,userId:'owner',kind:'video',url:durable,sourceJobId:'job',sourceOutputId:'out',status:'ready',metadata:{originUrl:original}}as never;}};
 const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Use this clip',references:[],attachments:[]};
 const action=studioMediaIntentSchema.parse({action:'video.prepare',reply:'Review',modelId:engineId,mode,operation,prompt:operation==='flux-fast-edit'?'Make it winter':'',aspectRatio:'16:9',source:null,references:[{ref:output,role:'source'}],settings:[{name:'resolution',value:resolution}]});
 const selected=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);
 const request=await selected.materialize();assert.equal(request.settings.durationSec,undefined);assert.ok(selected.referenceFingerprint?.());assert.equal(writes,1);
 const pricing=studioPricingSourceSelection(actor,[{ref:output,role:'source',slot:null}],input,dependencies);
 const priced=await pricing.resolveReferences({...request,references:pricing.references}as any);
 assert.equal(priced[0].durationSec,5.558333);assert.equal(priced[0].sourceSha256,'same');assert.equal(writes,1,'Read-only pricing never promotes');
 if(operation==='ltx23-reframe'){const inferred=await validateStudioMediaRequest(actor,studioMediaIntentSchema.parse({...action,operation:undefined}),input,factories,true,dependencies);assert.equal((await inferred.materialize()).settings.durationSec,undefined);}
 for(const corruption of ['all',original,durable]){changed='none';const pending=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);changed=corruption;await assert.rejects(pending.materialize(),{code:'REFERENCE_INVALID'},corruption);}
});

import { studioActionRequestSchema } from '../frontend/lib/studio/conversation-action-contract';
import { createStudioActionExecutor } from '../frontend/src/server/studio/conversation-actions';
import { createStudioVideoGenerationService } from '../frontend/src/server/studio/image-generation-service';
for (const operation of [undefined, null, 'ltx23-reframe'] as const) test(`Studio real schemas and pricing executor infer LTX Reframe for ${String(operation)}`, async () => {
  const action = {action:'video.prepare',reply:'Review',modelId:'ltx-2-3',mode:'reframe',operation,prompt:'',aspectRatio:'4:5',source:null,references:[],settings:[{name:'resolution',value:'720p'}]};
  for (const schema of [studioMediaIntentSchema,studioActionRequestSchema]) {
    assert.equal(schema.safeParse(action).success,true);
    assert.equal(schema.safeParse({...action,prompt:'Not supported'}).success,false);
  }
  const entry=getFalEngineById('ltx-2-3')!;
  const candidate={engine:entry.engine,surface:'video' as const,publicModes:entry.engine.modes,modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};
  let priced=0;
  const service=createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{
    listPublicEngines:async()=>[candidate],resolveRequestExecutability:()=>({executable:true,reason:'available'}),
    resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
    priceGeneration:async(request)=>{assert.equal(request.operation,'ltx23-reframe');assert.equal(request.prompt,'');priced++;return{priceCents:48,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:48,currency:'USD',membershipTier:'member'}};},
  }});
  const execute=createStudioActionExecutor(actor,{enabled:true,mediaEnabled:true,generation:{} as never,readProject:async()=>({}) as never,prepareImage:async()=>{throw new Error('unused');},attachedMedia:[{assetId,mediaKind:'video'}],factories:{video:()=>({...service,
    // Only replace the authorized-media DB boundary; execute the real Studio estimator.
    estimate:input=>service.estimate(input,async()=>[{assetId,role:'source',mediaKind:'video',storageUrl:durable,durationSec:5.558333,width:720,height:1280,sizeBytes:1000,mimeType:'video/mp4'}]),
  })} as StudioMediaFactories});
  const result=await execute({action:'pricing.read',surface:'video',modelId:'ltx-2-3',mode:'reframe',operation,settings:[{name:'resolution',value:'720p'},{name:'aspectRatio',value:'4:5'}],references:[{ref:{type:'asset',assetId,kind:'video'},role:'source'}],outputCount:1});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(priced,1);
});

import { studioMediaRequest } from '../frontend/src/server/studio/conversation-media-generation';
for (const mode of [undefined,null] as const) test(`Studio preserves source-inferred Kling Edit mode for ${String(mode)} through both ingress schemas`,async()=>{
 const clip={type:'asset' as const,kind:'video' as const,assetId};
 const entry=getFalEngineById('kling-o3-standard')!;
 const candidate={engine:entry.engine,surface:'video' as const,publicModes:['v2v'],modeCaps:entry.engine.modeCaps!};
 const factories={video:()=>({catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
 const input={requestId:'00000000-0000-4000-8000-000000000001',message:'Edit this clip',references:[],attachments:[clip]};
 const dependencies={resolveMedia:async()=>({id:assetId,ref:clip,kind:'video',url:original,mime:'video/mp4',sizeBytes:1024,originalName:'clip.mp4',thumbUrl:null,previewUrl:null,mediaFacts:{source:'probe',width:1280,height:720,durationSec:5},originalAccess:{type:'external'}})};
 const base={action:'video.prepare',reply:'Review',modelId:'kling-o3-standard',operation:'kling-edit',mode,prompt:'Make it winter',aspectRatio:'16:9',settings:[{name:'resolution',value:'720p'}]};
 for(const selection of [{source:clip,references:null},{source:null,references:[{ref:clip,role:'source',slot:null}]}]) {
  for(const schema of [studioMediaIntentSchema,studioActionRequestSchema]) {
   const action=schema.parse({...base,...selection});
   assert.equal(action.action,'video.prepare');
   const request=await studioMediaRequest(actor,action as never,input,factories,true,dependencies as never);
   assert.equal(request.mode,'v2v');assert.equal(request.operation,'kling-edit');
   assert.equal(schema.safeParse({...base,...selection,mode:'t2v'}).success,false,'An explicit incompatible mode remains invalid');
  }
 }
});

test('omitted/null Studio modes retain existing explicit-operation prompt rules until source inference',()=>{
 for(const mode of [undefined,null]) for(const [modelId,operation,prompt]of [
  ['kling-o3-standard','kling-edit','Edit'],['kling-o3-standard','kling-reference','Reference'],
  ['minimax-h3-max','h3-recast',''],['minimax-h3-max','h3-relight',''],['flux-3','flux-fast-edit','Edit'],['flux-3-draft','flux-draft-enhance',''],
 ]) for(const schema of [studioMediaIntentSchema,studioActionRequestSchema]) {
  const action={action:'video.prepare',reply:'Review',modelId,operation,mode,prompt,aspectRatio:'16:9',source:{type:'asset',kind:'video',assetId}};
  assert.equal(schema.safeParse(action).success,true,`${modelId}/${operation}/${String(mode)}`);
  if(operation==='h3-relight'||operation==='flux-draft-enhance')assert.equal(schema.safeParse({...action,prompt:'Invalid nonempty prompt'}).success,false);
  if(operation==='flux-fast-edit')assert.equal(schema.safeParse({...action,prompt:'a'.repeat(4097)}).success,false);
 }
});
