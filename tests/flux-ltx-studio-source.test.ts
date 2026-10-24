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
 if(operation==='ltx23-reframe'){const inferred=await validateStudioMediaRequest(actor,{...action,operation:undefined},input,factories,true,dependencies);assert.equal((await inferred.materialize()).settings.durationSec,undefined);}
 for(const corruption of ['all',original,durable]){changed='none';const pending=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);changed=corruption;await assert.rejects(pending.materialize(),{code:'REFERENCE_INVALID'},corruption);}
});
