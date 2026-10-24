import assert from 'node:assert/strict';
import test from 'node:test';
import {MINIMAX_H3_MAX_ENGINE as engine} from '../frontend/src/config/fal-engines/minimax-h3-max';
import {studioMediaIntentSchema} from '../frontend/lib/studio/conversation-media-contract';
import {validateStudioMediaRequest, type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {resolveGenerationReferencesForActor} from '../frontend/src/server/agent-api/resolve-generation-references';
import {hashH3PromotionImage} from '../frontend/src/server/studio/h3-promotion-identity';
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

for(const operation of ['h3-recast','h3-relight'] as const) test(`Studio ${operation} binds ready video/image promotion to original provenance and bytes`,async()=>{
 const outputs=refs.map((ref,index)=>({type:'job-output' as const,jobId:'job',outputId:`output-${index}`,kind:ref.kind}));
 const durable=media.map((item,index)=>({...item,url:`https://media.maxvideoai.com/durable-${index}`}));
 let corruption='none';let writes=0;
 const inspect=async(url:string)=>({kind:'video' as const,width:512,height:512,durationSec:124/24,sizeBytes:1000,mimeType:'video/mp4',fps:24,decodedFrameCount:124,constantFrameRate:true,sourceSha256:((corruption==='video-bytes'&&url===durable[0].url)||(corruption==='original-video'&&url===media[0].url))?'changed-video':'video-bytes',hasAudio:true,videoCodec:'h264',audioCodec:'aac'});
 const hashImage=(url:string,userId:string)=>hashH3PromotionImage(url,userId,{
  readUrl:async()=>url,download:async()=>({bytes:Buffer.from(((corruption==='image-bytes'&&url===durable[1].url)||(corruption==='original-image'&&url===media[1].url))?'changed-image':'image-bytes'),fileName:'sphere.png',mimeType:'image/png'}),
 });
 const factories={video:()=>({catalog:async()=>[{engine,surface:'video',publicModes:['v2v'],modeCaps:engine.modeCaps}],resolveReferences:(request:Parameters<typeof resolveGenerationReferencesForActor>[0])=>resolveGenerationReferencesForActor(request,actor,{resolveOwnedReferenceAsset:async(_actor,id)=>{const index=ids.indexOf(id);return {...owned(index),storageUrl:corruption==='url-substitution'?`${durable[index].url}/substitute`:durable[index].url};},inspectH3Source:inspect})})} as unknown as StudioMediaFactories;
 const action=studioMediaIntentSchema.parse({action:'video.prepare',reply:'Review',operation,modelId:engine.id,mode:'v2v',aspectRatio:'auto',source:null,references:outputs.map((ref,index)=>({ref,role:index===0?'source':'reference'})),settings:[{name:'resolution',value:'768P'}]});
 const dependencies={
  readProjectMedia:async()=>outputs.map(ref=>({ref,name:'Ready output',durationSec:ref.kind==='video'?5:null})),
  resolveMedia:async(_user:string,ref:unknown)=>{const selected=ref as typeof outputs[number] | typeof refs[number];const index=selected.type==='asset'?ids.indexOf(selected.assetId):outputs.findIndex(output=>output.outputId===selected.outputId);return {...(selected.type==='asset'?durable[index]:media[index]),...(selected.type==='asset'&&corruption==='resolved-url'?{url:'https://media.maxvideoai.com/substitute'}:{}),ref:selected};},
  inspectH3Source:inspect,hashH3Image:hashImage,
  saveOutput:async({outputId}:{outputId:string})=>{writes++;if(corruption==='during-original-video')corruption='original-video';const index=outputs.findIndex(output=>output.outputId===outputId);return {publicId:ids[index],userId:corruption==='owner'?'foreign':actor.userId,kind:outputs[index].kind,url:durable[index].url,sourceJobId:'job',sourceOutputId:corruption==='source-substitution'?'other-output':outputId,status:'ready',metadata:{originUrl:corruption==='origin-substitution'?'https://media.maxvideoai.com/other':media[index].url}} as never;},
 };
 const selection=await validateStudioMediaRequest(actor,action,{...input,references:[],attachments:[]},factories,true,dependencies);
 const request=await selection.materialize();
 assert.equal(writes,2);assert.deepEqual(request.references.map(r=>r.kind==='asset'?r.assetId:''),ids);assert.ok(selection.referenceFingerprint?.());
 for(const scenario of ['video-bytes','image-bytes','original-video','original-image','during-original-video','resolved-url','owner','source-substitution','origin-substitution','url-substitution']) {
  corruption='none';
  const pending=await validateStudioMediaRequest(actor,action,{...input,references:[],attachments:[]},factories,true,dependencies);
  corruption=scenario;
  await assert.rejects(pending.materialize(),{code:'REFERENCE_INVALID'},scenario);
 }
});

import {withVideoExcerptSlot} from '../frontend/server/video-excerpts/media';
test('promotion image byte identity is admission bounded before reading',async()=>{
 let reads=0;
 await withVideoExcerptSlot('owner',async()=>{
  await assert.rejects(hashH3PromotionImage('owned-image','owner',{readUrl:async()=>{reads++;return 'unused';},download:async()=>({bytes:Buffer.from('image'),fileName:'image.png',mimeType:'image/png'})}),error=>Boolean(error&&typeof error==='object'&&'code' in error&&error.code==='RATE_LIMITED'&&'retryable' in error&&error.retryable));
 });
 assert.equal(reads,0);
});
