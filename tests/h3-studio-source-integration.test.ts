import assert from 'node:assert/strict';
import test from 'node:test';
import {MINIMAX_H3_MAX_ENGINE as engine} from '../frontend/src/config/fal-engines/minimax-h3-max';
import {studioMediaIntentSchema} from '../frontend/lib/studio/conversation-media-contract';
import {validateStudioMediaRequest, type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {resolveGenerationReferencesForActor} from '../frontend/src/server/agent-api/resolve-generation-references';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor={userId:'owner',projectId:'project',authMethod:'studio-session' as const,clientId:null};
const ids=[1,2].map(n=>`ma_${String(n).padStart(32,'0')}`);
const refs=ids.map((assetId,index)=>({type:'asset' as const,assetId,kind:index===0?'video' as const:'image' as const}));
const media=refs.map((ref,index)=>({id:ref.assetId,ref,kind:ref.kind,url:`https://media.maxvideoai.com/${index}`,mime:index===0?'video/mp4':'image/png',width:512,height:512,durationSec:index===0?5:null,sizeBytes:1000,originalName:null,thumbUrl:null,previewUrl:null,originalAccess:{type:'external'}} as StudioResolvedMedia));
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Use these references',references:[ids[1]],attachments:[refs[0]]};
const owned=(index:number)=>({assetId:ids[index],storageUrl:media[index].url,mediaKind:media[index].kind,mimeType:media[index].mime,width:512,height:512,durationSec:media[index].durationSec,sizeBytes:1000,originalName:null});

for(const operation of ['h3-recast','h3-relight'] as const) test(`Studio ${operation} permits unchanged measured source and rejects changed bytes`,async()=>{
 let hash='same-bytes';
 const inspect=async()=>({kind:'video' as const,width:512,height:512,durationSec:124/24,sizeBytes:1000,mimeType:'video/mp4',fps:24,decodedFrameCount:124,constantFrameRate:true,sourceSha256:hash,hasAudio:true,videoCodec:'h264',audioCodec:'aac'});
 const factories={video:()=>({catalog:async()=>[{engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps}],resolveReferences:(request:Parameters<typeof resolveGenerationReferencesForActor>[0])=>resolveGenerationReferencesForActor(request,actor,{resolveOwnedReferenceAsset:async(_actor,id)=>owned(ids.indexOf(id)),inspectH3Source:inspect})})} as unknown as StudioMediaFactories;
 const action=studioMediaIntentSchema.parse({action:'video.prepare',reply:'Review',operation,modelId:engine.id,mode:'v2v',aspectRatio:'auto',source:null,references:refs.map((ref,index)=>({ref,role:index===0?'source':'reference'})),settings:[{name:'resolution',value:'768P'}]});
 const dependencies={resolveMedia:async(_user:string,ref:unknown)=>media[ids.indexOf((ref as {assetId:string}).assetId)],inspectH3Source:inspect,reviewedReferences:ids.map((_,index)=>({...owned(index),role:index===0?'source' as const:'reference' as const}))};
 const selection=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);
 const request=await selection.materialize();
 assert.equal(request.prompt,'');assert.ok(selection.referenceFingerprint?.());
 const pending=await validateStudioMediaRequest(actor,action,input,factories,true,dependencies);
 hash='replaced-bytes-same-length';
 await assert.rejects(pending.materialize(),/changed before quote preparation/);
});

test('Studio mixed ordered references traverse initial validation, owned kinds and materialization without reordering',async()=>{
 const kinds=['image','image','video','audio'] as const;
 const selection=[2,1,3,4].map((n,index)=>({ref:{type:'asset' as const,assetId:`ma_${String(n).padStart(32,'0')}`,kind:kinds[index]},role:'reference' as const,slot:index}));
 const selectedMedia=selection.map(({ref},index)=>({...media[0],id:ref.assetId,ref,kind:ref.kind,url:`https://media.maxvideoai.com/${index}`,mime:index<2?'image/png':index===2?'video/mp4':'audio/mpeg',durationSec:index<2?null:5,originalName:index<2?'image.png':index===2?'video.mp4':'audio.mp3'}));
 const action=studioMediaIntentSchema.parse({action:'video.prepare',reply:'Review',modelId:engine.id,mode:'ref2v',prompt:'Follow the reference sequence',aspectRatio:'auto',source:null,references:selection,settings:[{name:'resolution',value:'768P'},{name:'durationSec',value:5},{name:'referenceOrder',value:'video1,image1,audio1,image2'}]});
 const attached={...input,references:selection.slice(0,2).map(s=>s.ref.assetId),attachments:selection.slice(2).map(s=>s.ref)};
 const factories={video:()=>({catalog:async()=>[{engine,surface:'video',publicModes:['ref2v'],modeCaps:engine.modeCaps}]})} as unknown as StudioMediaFactories;
 const validated=await validateStudioMediaRequest(actor,action,attached,factories,true,{resolveMedia:async(_user,ref)=>selectedMedia.find(m=>m.ref.assetId===(ref as {assetId:string}).assetId)!});
 const request=await validated.materialize();
 assert.deepEqual(request.references.map(r=>r.kind==='asset'?r.assetId:''),selection.map(s=>s.ref.assetId));
});
