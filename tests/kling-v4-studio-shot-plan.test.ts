import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {studioVideoActionSchema,STUDIO_MEDIA_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-media-contract';
import {studioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import {conversationQuotePresentation} from '../frontend/src/lib/studio/conversation-quote-presentation';
import {KLING_V4_ENGINE} from '../frontend/src/config/fal-engines/kling-v4';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
const candidate={engine:KLING_V4_ENGINE,surface:'video' as const,publicModes:KLING_V4_ENGINE.modes,modeCaps:KLING_V4_ENGINE.modeCaps!};
const shotPlan=Array.from({length:10},(_,i)=>({prompt:`Subject in shot ${i+1}`,durationSec:3}));
const action={action:'video.prepare',reply:'Review this quote.',prompt:'',modelId:'kling-v4',mode:'t2v',aspectRatio:'16:9',source:null,shotPlan};
const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'film',clientId:null};
const input={requestId:'00000000-0000-4000-8000-000000000001',message:'Prepare ten shots',references:[]};
const factories={video:()=>({catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
test('Studio explicit shot plan reaches canonical request and exact paid body without stale default duration',async()=>{
 assert.equal(studioVideoActionSchema.safeParse(action).success,true);
 const saved=structuredClone(action);
 const request=await studioMediaRequest(actor,action as never,input,factories,true) as CanonicalGenerationRequest;
 assert.deepEqual(request.settings.multiPrompt,shotPlan);assert.equal(request.settings.durationSec,30);assert.deepEqual(action,saved);
 const body=buildPaidVideoRequestBody({request,engine:KLING_V4_ENGINE,quoteId:'local',canonicalPricing:{membershipTier:'member'}});
 assert.deepEqual(body.multiPrompt,shotPlan.map(({prompt,durationSec})=>({prompt,duration:durationSec})));
 const view=conversationQuotePresentation(request,'en');assert.match(view.direction,/Subject in shot 10/);assert.match(view.direction,/3 s/);
 assert.ok(studioVisualCapabilityDetails(candidate).modes.find(mode=>mode.mode==='t2v')!.settings.some(setting=>setting.type==='multi_prompt'));
 assert.ok(Object.hasOwn(STUDIO_MEDIA_DIRECTOR_TOOLS.find(tool=>tool.name==='video_prepare')!.properties,'shotPlan'));
});
test('Studio rejects ambiguous prompts, fractional shots, mismatching totals and edit shots before any paid call',async()=>{
 for(const patch of [{prompt:'Conflicting direction'},{mode:'v2v'},{shotPlan:[{prompt:'Scene',durationSec:3.5}]},{settings:[{name:'durationSec',value:5}]},{shotPlan:[{prompt:'',durationSec:3}]},{shotPlan:[{prompt:'long',durationSec:31}]}]){
  await assert.rejects(studioMediaRequest(actor,{...action,...patch} as never,input,factories,true));
 }
});

test('Studio preserves seven image subjects using fourteen owned ready outputs without enlarging the chat attachment pool',async()=>{
 const {imageTurnInputSchema}=await import('../frontend/src/lib/studio/image-conversation-contract');
 const {STUDIO_CONVERSATION_MAX_ATTACHMENTS}=await import('../frontend/lib/studio/conversation-creation-contract');
 const outputs=Array.from({length:14},(_,index)=>({type:'job-output' as const,kind:'image' as const,jobId:'job',outputId:String(index)}));
 const assetId=(index:number)=>'ma_'+index.toString(16).padStart(32,'0');
 const url=(index:number)=>`https://media.example/subject-${index}.png`;
 const sourceIndex=(ref:typeof outputs[number]|{type:'asset';assetId:string})=>ref.type==='asset'?parseInt(ref.assetId.slice(3),16):Number(ref.outputId);
 const selected={...action,prompt:'Seven actors meet',shotPlan:null,mode:'ref2v',references:outputs.map(ref=>({ref,role:'reference',slot:null})),subjects:Array.from({length:7},(_,i)=>({kind:'image',frontalReferenceSlot:i*2,referenceSlots:[i*2+1]}))};
 assert.equal(studioVideoActionSchema.safeParse(selected).success,true);
 assert.equal(imageTurnInputSchema.safeParse({...input,references:Array.from({length:STUDIO_CONVERSATION_MAX_ATTACHMENTS+1},(_,i)=>assetId(i))}).success,false);
 const details=studioVisualCapabilityDetails(candidate);assert.ok(details.surface!=='audio');
 assert.equal(details.maxReferences,43);assert.deepEqual(details.subjectReferenceAllowance,{attachedPoolLimit:STUDIO_CONVERSATION_MAX_ATTACHMENTS,maxSelectedReferences:43,additionalSource:'ready_project_outputs'});
 const request=await studioMediaRequest(actor,selected as never,input,factories,true,{
  readProjectMedia:async()=>outputs.map(ref=>({ref,name:'Subject view',durationSec:null})),
  resolveMedia:async(_owner,ref)=>({id:String(sourceIndex(ref as never)),ref,kind:'image',url:url(sourceIndex(ref as never)),thumbUrl:null,previewUrl:null,mime:'image/png',sizeBytes:1024,width:1280,height:720,durationSec:null,originalName:'view.png',originalAccess:{type:'external'}} as never),
  saveOutput:async identity=>({publicId:assetId(Number(identity.outputId)),userId:identity.userId,kind:'image',sourceJobId:identity.jobId,sourceOutputId:identity.outputId,status:'ready',metadata:{originUrl:url(Number(identity.outputId))}} as never),
 }) as CanonicalGenerationRequest;
 assert.equal(request.subjects?.length,7);assert.equal(request.references.length,14);assert.equal(request.references[13].kind==='asset'&&request.references[13].assetId,assetId(13));
});

test('saved Studio shot directions remain visible to historical conversation recovery',async()=>{
 const {projectStudioQuoteDirections}=await import('../frontend/src/server/studio/conversation-history-facts');
 const directions=projectStudioQuoteDirections([{state:'ready',quote_id:'00000000-0000-4000-8000-000000000001',request_id:'request',draft_json:{reply:'Review',image:null,media:action}}] as never);
 assert.match(directions[0].text,/Shot 10 · 3 s/);assert.equal(directions[0].truncated,false);
});

test('a bounded structured revision preserves thirty full shots across retry without raising the chat text limit',async()=>{
 const {imageTurnInputSchema,imageTurnRetryInput}=await import('../frontend/src/lib/studio/image-conversation-contract');
 const shots=Array.from({length:30},()=>({prompt:'é'.repeat(512),durationSec:1}));
 const revision={modelId:'kling-v4',mode:'t2v',durationSec:30,shots};
 const parsed=imageTurnInputSchema.parse({...input,message:'Prepare this revised plan.',shotPlanRevision:revision});
 assert.deepEqual(imageTurnRetryInput(parsed as never).shotPlanRevision,revision);
 assert.equal(imageTurnInputSchema.safeParse({...input,message:'x'.repeat(4001),shotPlanRevision:revision}).success,false);
 for(const patch of [{modelId:'kling-3-pro'},{mode:'v2v'},{durationSec:29},{shots:[{prompt:'bad',durationSec:1.5}]}])
  assert.equal(imageTurnInputSchema.safeParse({...input,shotPlanRevision:{...revision,...patch}}).success,false);
 const revised=await studioMediaRequest(actor,{...action,shotPlan:shots} as never,parsed,factories,true) as CanonicalGenerationRequest;
 assert.deepEqual(revised.settings.multiPrompt,shots);
 await assert.rejects(studioMediaRequest(actor,action as never,parsed,factories,true));
});

test('structured full-length Unicode revision survives bounded HTTP ingestion and reaches director context',async()=>{
 const {readStudioConversationBody}=await import('../frontend/app/api/studio/_lib/studio-image-conversation-handler');
 const {createStudioConversationDirector}=await import('../frontend/src/server/studio/conversation-director');
 const revision={modelId:'kling-v4' as const,mode:'t2v' as const,durationSec:30,shots:Array.from({length:30},()=>({prompt:'界'.repeat(512),durationSec:1}))};
 const body=JSON.stringify({...input,shotPlanRevision:revision});assert.ok(Buffer.byteLength(body)>24000);
 assert.deepEqual(await readStudioConversationBody(new NextRequest('https://maxvideoai.com/api/studio/test',{method:'POST',body})),JSON.parse(body));
 await assert.rejects(readStudioConversationBody(new NextRequest('https://maxvideoai.com/api/studio/test',{method:'POST',body:'x'.repeat(96001)})),/BODY_TOO_LARGE/);
 let received='';
 const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async params=>{
  received=JSON.stringify(params.input);
  return {id:'local-response',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'{"reply":"Review the plan."}',output:[]};
 }});
 await director({message:'Prepare the revised plan.',shotPlanRevision:revision,references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},
  checkpoint:async(_,create)=>create(),execute:async()=>{throw new Error('No paid tool expected');}});
 assert.ok(received.includes('界'.repeat(512)));assert.ok(received.includes('Exact client-authored shot plan revision'));
});

test('Studio adapter verifies exact owned video facts and binds them across reviewed preparation',async()=>{
 const {createStudioVideoGenerationService}=await import('../frontend/src/server/studio/image-generation-service');
 const {normalizeGenerationRequest}=await import('../frontend/src/server/agent-api/generation-normalization');
 const {studioReferenceFingerprint}=await import('../frontend/src/server/agent-api/generation-actor');
 const assetId='ma_'+'a'.repeat(32);const url='https://media.maxvideoai.com/user-assets/original.mp4';
 const owned={assetId,mediaKind:'video' as const,storageUrl:url,mimeType:'video/mp4',sizeBytes:1024,originalName:'original.mp4',width:1280,height:720,durationSec:5};
 let fps=24;let reads=0;
 const options={enabled:true,referenceDependencies:{resolveOwnedReferenceAsset:async()=>{reads++;return owned;},resolveMedia:async()=>({}) as never,
   klingV4Media:{detectVideoMetadataFn:async()=>({width:1280,height:720,durationSec:5,fps})}}};
 const request=normalizeGenerationRequest({surface:'video',engineId:'kling-v4',mode:'ref2v',prompt:'An actor walks',settings:{durationSec:5,resolution:'1080p'},references:[{kind:'asset',assetId,role:'reference'}]});
 const service=createStudioVideoGenerationService(actor,options);
 const verified=await service.resolveReferences(request);assert.equal(verified[0].fps,24);assert.ok(reads>0);
 const bound=createStudioVideoGenerationService(actor,{...options,expectedReferenceFingerprint:studioReferenceFingerprint(verified)});
 assert.deepEqual(await bound.resolveReferences(request),verified);
 fps=25;await assert.rejects(bound.resolveReferences(request),{code:'REFERENCE_INVALID'});
 fps=23;await assert.rejects(service.resolveReferences(request),{code:'REFERENCE_INVALID'});
 fps=24;
 const actualFactories={video:()=>({...service,catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
 const selected={...action,prompt:'An actor walks',shotPlan:null,mode:'ref2v',references:[{ref:{type:'asset',kind:'video',assetId},role:'reference',slot:0}]};
 const reviewed={...owned,role:'reference' as const,slot:0};
 const media={id:assetId,ref:{type:'asset',assetId,kind:'video'},kind:'video',url,mime:'video/mp4',sizeBytes:1024,originalName:'original.mp4',width:1280,height:720,durationSec:5};
 const selectedInput={...input,attachments:[{type:'asset',assetId,kind:'video'}]};
 await assert.doesNotReject(studioMediaRequest(actor,selected as never,selectedInput as never,actualFactories,true,{resolveMedia:async()=>media as never,reviewedReferences:[reviewed]}));
 await assert.rejects(studioMediaRequest(actor,selected as never,selectedInput as never,actualFactories,true,{resolveMedia:async()=>({...media,width:1400}) as never,reviewedReferences:[reviewed]}),{code:'REFERENCE_INVALID'});
});
