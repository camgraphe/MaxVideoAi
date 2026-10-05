import assert from 'node:assert/strict';
import test from 'node:test';
import {AjvJsonSchemaValidator} from '@modelcontextprotocol/sdk/validation/ajv';
import type {JsonSchemaType} from '@modelcontextprotocol/sdk/validation';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {listPublicAgentGenerationEngines} from '../frontend/src/server/agent-api/model-catalog';
import {createStudioVideoGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {studioMediaRequest,validateStudioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {studioVideoActionSchema,STUDIO_MEDIA_DIRECTOR_TOOLS} from '../frontend/lib/studio/conversation-media-contract';
import {studioToolReferenceProperties} from '../frontend/src/server/studio/conversation-tool-reference-schema';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';
import {buildPaidVideoRequestBody} from '../frontend/src/server/agent-api/paid-video-request-body';
import {requireStudioGenerationRequest} from '../frontend/src/server/agent-api/generation-actor';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import type {CanonicalGenerationRequest} from '../frontend/src/server/agent-api/generation-types';
import type {ResolvedReference} from '../frontend/src/server/agent-api/reference-types';
import {toolAssetRefSchema,type ToolAssetRef} from '../frontend/src/lib/toolbox/contract';
import {isWorkspaceModelCertifiedForBlock} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {projectAgentModelModeDetails} from '../frontend/src/server/agent-api/model-details';
import {workflowCatalog,workflowAction,workflowInput,workflowActor,workflowReference,workflowResolved} from './helpers/studio-video-workflow-fixtures';

const actor={authMethod:'studio-session' as const,userId:'workflow-owner',projectId:'workflow-project',clientId:null};
const entries=listFalEngines();
export const videoCatalog=()=>listPublicAgentGenerationEngines({listEngines:async()=>entries.map(e=>e.engine),surfaceByEngineId:id=>entries.find(e=>e.id===id)?.category==='image'?'image':'video',isEngineExecutable:()=>true,isModeExecutable:()=>true});
const ids={image:'ma_'+'1'.repeat(32),video:'ma_'+'2'.repeat(32),audio:'ma_'+'3'.repeat(32)};
const ref=(kind:keyof typeof ids):ToolAssetRef=>({type:'asset',kind,assetId:ids[kind]});
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Use these exact owned media.',references:[ids.image],attachments:[ref('video'),ref('audio')]};
function resolved(kind:keyof typeof ids,role:ResolvedReference['role']='source',slot?:number):ResolvedReference {
  return {assetId:ids[kind],mediaKind:kind,role,...(slot===undefined?{}:{slot}),storageUrl:`https://cdn.maxvideoai.com/owned.${kind==='image'?'png':kind==='video'?'mp4':'wav'}`,mimeType:kind==='image'?'image/png':kind==='video'?'video/mp4':'audio/wav',width:kind==='audio'?null:1920,height:kind==='audio'?null:1080,durationSec:kind==='image'?null:12,sizeBytes:4096,originalName:`owned.${kind==='image'?'png':kind==='video'?'mp4':'wav'}`};
}
function dependencies(events:string[]=[]) {return {resolveMedia:async(_userId:string,raw:unknown)=>{const r=toolAssetRefSchema.parse(raw);events.push('resolve:'+r.kind);const facts=resolved(r.kind);return {id:r.type==='asset'?r.assetId:r.outputId,ref:r,kind:r.kind,url:facts.storageUrl,mime:facts.mimeType,mediaFacts:{source:'probe' as const,width:facts.width??undefined,height:facts.height??undefined,durationSec:facts.durationSec??undefined},sizeBytes:facts.sizeBytes,originalName:facts.originalName??undefined,thumbUrl:null,previewUrl:null,originalAccess:{type:'external' as const}};},saveOutput:async(identity:{userId:string;jobId:string;outputId:string})=>{events.push('save');return {id:ids.video,publicId:ids.video,userId:identity.userId,kind:'video' as const,url:resolved('video').storageUrl,thumbUrl:null,previewUrl:null,mimeType:'video/mp4',width:1920,height:1080,sizeBytes:4096,durationSec:12,source:'saved_job_output' as const,sourceJobId:identity.jobId,sourceOutputId:identity.outputId,status:'ready',metadata:{originUrl:resolved('video').storageUrl}};},readProjectMedia:async()=>[]};}
const fixtures=[
  {engineId:'wan-3',mode:'extend',kind:'video',settings:{durationSec:5,resolution:'720p',aspectRatio:'16:9'}},
  {engineId:'wan-3',mode:'v2v',kind:'video',settings:{durationSec:5,resolution:'720p',aspectRatio:'16:9'}},
  {engineId:'wan-2-6',mode:'r2v',kind:'video',role:'reference',settings:{durationSec:5,resolution:'1080p',aspectRatio:'16:9'}},
  {engineId:'ltx-2-3',mode:'a2v',kind:'audio',settings:{durationSec:12,resolution:'1080p'}},
  {engineId:'ltx-2-3',mode:'retake',kind:'video',settings:{durationSec:5,resolution:'1080p',startTimeSec:3,retakeMode:'replace_audio_and_video'}},
  {engineId:'luma-ray-3-2',mode:'reframe',kind:'video',settings:{durationSec:12,resolution:'720p',aspectRatio:'9:16',sourcePositionX:0.1,sourcePositionY:-0.2,sourcePositionWidth:0.8,sourcePositionHeight:1}},
] as const;
test('Studio video discovery retains every executable public transport-neutral tuple',async()=>{
  const canonical=(await videoCatalog()).filter(e=>e.surface==='video');
  const studio=await createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:async()=>canonical}}).catalog();
  assert.deepEqual(studio.map(e=>[e.engine.id,e.publicModes]),canonical.map(e=>[e.engine.id,e.publicModes]));
  assert.equal(studio.reduce((count,entry)=>count+entry.publicModes.length,0),132,'Conversation qualification preserves every proven public tuple.');
  assert.equal(studio.find(e=>e.engine.id==='gemini-omni-flash')!.publicModes.includes('retake'),false,'Private interaction continuity remains excluded by the public catalog.');
  for(const candidate of studio){const details=studioVisualCapabilityDetails(candidate);assert.ok(details.surface==='video');for(const mode of details.modes){const canonical=projectAgentModelModeDetails(candidate,mode.mode);assert.deepEqual(mode.references.map(r=>[r.type,r.roles,r.required,r.min]),canonical.references.map(r=>[r.type,r.roles,r.required,r.min]));}}
});
for(const fixture of fixtures)test(`${fixture.engineId} ${fixture.mode} uses owned typed media through canonical validation and payload`,async()=>{
  const catalog=await videoCatalog();const factory=()=>({catalog:async()=>catalog});
  const action={action:'video.prepare',reply:'Review this quote.',prompt:input.message,aspectRatio:'16:9',source:null,modelId:fixture.engineId,mode:fixture.mode,settings:Object.entries(fixture.settings).map(([name,value])=>({name,value})),references:[{ref:ref(fixture.kind),role:'role' in fixture?fixture.role:'source',slot:null}],outputCount:1};
  assert.equal(studioVideoActionSchema.safeParse(action).success,true);
  const before=structuredClone(action);const request=await studioMediaRequest(actor,action as never,input,{video:factory} as never,true,dependencies()) as CanonicalGenerationRequest;
  assert.deepEqual(action,before);assert.equal(request.engineId,fixture.engineId);assert.equal(request.mode,fixture.mode);requireStudioGenerationRequest(request);
  const candidate=catalog.find(c=>c.engine.id===fixture.engineId)!;const refs=[resolved(fixture.kind,'role' in fixture?fixture.role:'source',request.references[0].slot)];
  validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:refs});
  const body=buildPaidVideoRequestBody({quoteId:input.requestId,request,engine:candidate.engine,resolvedReferences:refs,canonicalPricing:{membershipTier:'member'}});
  assert.equal(body[fixture.kind==='audio'?'audioUrl':fixture.mode==='r2v'?'referenceVideos':'videoUrl'] instanceof Array?(body.referenceVideos as string[])[0]:body[fixture.kind==='audio'?'audioUrl':'videoUrl'],refs[0].storageUrl);
});
test('invalid temporal range and unattached or wrong-kind video sources fail before promotion',async()=>{
  const catalog=await videoCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const events:string[]=[];const action={action:'video.prepare',reply:'Review.',prompt:input.message,aspectRatio:'16:9',source:null,modelId:'ltx-2-3',mode:'retake',settings:[{name:'durationSec',value:5},{name:'resolution',value:'1080p'},{name:'startTimeSec',value:9},{name:'retakeMode',value:'replace_audio_and_video'}],references:[{ref:ref('video'),role:'source',slot:null}]};
  await assert.rejects(validateStudioMediaRequest(actor,action as never,input,factories,true,dependencies(events)),{code:'PARAMETER_INVALID'});
  await assert.rejects(validateStudioMediaRequest(actor,{...action,settings:action.settings.map(s=>s.name==='startTimeSec'?{...s,value:0}:s)} as never,{...input,attachments:[]},factories,true,dependencies(events)),{code:'REFERENCE_INVALID'});
  await assert.rejects(validateStudioMediaRequest(actor,{...action,mode:'extend',modelId:'wan-3',settings:[{name:'durationSec',value:5},{name:'resolution',value:'720p'}],references:[{ref:ref('audio'),role:'source',slot:null}]} as never,input,factories,true,dependencies(events)),{code:'REFERENCE_INVALID'});
  assert.equal(events.includes('save'),false);
});
test('strict video schema scopes each asset identity to its exact reviewed media kind',()=>{
  const tool=STUDIO_MEDIA_DIRECTOR_TOOLS.find(t=>t.name==='video_prepare')!;const original=structuredClone(tool.properties);
  const properties=studioToolReferenceProperties(tool.name,tool.properties,Object.keys(ids).map(k=>resolved(k as keyof typeof ids)));
  const validate=new AjvJsonSchemaValidator().getValidator({type:'object',additionalProperties:false,properties,required:Object.keys(properties)} as unknown as JsonSchemaType);
  for(const kind of ['image','video','audio'] as const){const payload={reply:'Review.',prompt:'Continue the clip.',aspectRatio:'16:9',modelId:'wan-3',mode:'extend',settings:[],outputCount:1,source:ref(kind),references:[]};assert.equal(validate(payload).valid,true,kind);assert.equal(validate({...payload,source:{...ref(kind),assetId:ids[kind==='image'?'video':'image']}}).valid,false,'Wrong typed identity');assert.equal(validate({...payload,source:{...ref(kind),assetId:'ma_'+'f'.repeat(32)}}).valid,false,'Unattached');}
  assert.deepEqual(tool.properties,original);
});
test('every certified video tuple preserves its authored request and provider media fields',async t=>{
  const catalog=await workflowCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  for(const candidate of catalog)for(const mode of candidate.publicModes)await t.test(candidate.engine.id+' '+mode,async()=>{
    const action=workflowAction(candidate,mode);
    const request=await studioMediaRequest(workflowActor,action,workflowInput,factories,true,{resolveMedia:async(_userId,raw)=>{const ref=toolAssetRefSchema.parse(raw);const media=workflowReference(ref.kind,'source');return {kind:media.mediaKind,url:media.storageUrl,mime:media.mimeType,width:media.width,height:media.height,durationSec:media.durationSec,sizeBytes:media.sizeBytes,originalName:media.originalName} as never;}}) as CanonicalGenerationRequest;
    const refs=workflowResolved(request,action);requireStudioGenerationRequest(request);validateCanonicalGenerationCapabilities(request,candidate,{resolvedReferences:refs});
    assert.equal(request.engineId,candidate.engine.id);assert.equal(request.mode,mode);
    for(const setting of action.settings??[])assert.equal(request.settings[setting.name],setting.value,setting.name);
    const body=buildPaidVideoRequestBody({quoteId:workflowInput.requestId,request,engine:candidate.engine,resolvedReferences:refs,canonicalPricing:{membershipTier:'member'}});
    assert.equal(body.engineId,candidate.engine.id);assert.ok(body.mode);
    for(const ref of refs)assert.ok(JSON.stringify(body).includes(ref.storageUrl),'Every selected media survives provider projection');
  });
});
for(const output of [false,true])test(`ordered repeated ${output?'job output':'asset'} references preserve each canonical slot`,async()=>{
  const catalog=await videoCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const source=output?{type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'}:ref('video');
  const action={action:'video.prepare' as const,reply:'Review.',prompt:'Repeat this motion reference twice.',aspectRatio:'16:9' as const,source:null,modelId:'wan-2-6',mode:'r2v' as const,outputCount:1 as const,settings:[{name:'durationSec',value:5},{name:'resolution',value:'1080p'}],references:[{ref:source,role:'reference' as const,slot:null},{ref:source,role:'reference' as const,slot:null}]};
  const request=await studioMediaRequest(actor,action,input,factories,true,{...dependencies(),readProjectMedia:async()=>[{ref:source,name:'Ready video',durationSec:12}]}) as CanonicalGenerationRequest;
  assert.deepEqual(request.references.map(reference=>reference.slot),[0,1]);assert.ok(request.references.every(reference=>reference.kind==='asset'&&reference.assetId===ids.video));
  const body=buildPaidVideoRequestBody({quoteId:input.requestId,request,engine:catalog.find(c=>c.engine.id==='wan-2-6')!.engine,resolvedReferences:request.references.map(reference=>resolved('video',reference.role,reference.slot)),canonicalPricing:{membershipTier:'member'}});
  assert.deepEqual(body.referenceVideos,[resolved('video').storageUrl,resolved('video').storageUrl]);
});
test('attached source drift after model review is terminal before draft or library mutation',async()=>{
  const catalog=await videoCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const action={action:'video.prepare',reply:'Review.',prompt:'Continue this exact clip.',aspectRatio:'16:9',source:null,modelId:'wan-3',mode:'extend',settings:[{name:'durationSec',value:5},{name:'resolution',value:'720p'}],references:[{ref:ref('video'),role:'source',slot:null}]} as never;
  const events:string[]=[];const reviewed=[{...resolved('video'),storageUrl:'https://cdn.maxvideoai.com/earlier-reviewed.mp4'}];
  await assert.rejects(validateStudioMediaRequest(actor,action,input,factories,true,{...dependencies(events),reviewedReferences:reviewed} as never),(error:unknown)=>{
    assert.ok(error&&typeof error==='object'&&'code' in error&&error.code==='REFERENCE_INVALID');assert.equal('nextAction' in error&&!!error.nextAction,false,'Source drift is not a repairable parameter rejection');return true;
  });
  assert.equal(events.includes('save'),false);
});

test('all video reference fact completions share one bounded preflight signal',async()=>{
  const catalog=await videoCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const source=ref('video');const signals:AbortSignal[]=[];
  const action={action:'video.prepare' as const,reply:'Review.',prompt:'Use two references.',aspectRatio:'16:9' as const,source:null,modelId:'wan-2-6',mode:'r2v' as const,outputCount:1 as const,settings:[{name:'durationSec',value:5},{name:'resolution',value:'1080p'}],references:[{ref:source,role:'reference' as const,slot:0},{ref:source,role:'reference' as const,slot:1}]};
  const deps=dependencies();
  await validateStudioMediaRequest(actor,action,input,factories,true,{...deps,resolveMedia:async(user,raw,exec,options)=>{assert.equal(options?.completeReferenceFacts,true);assert.ok(options?.referenceFactsSignal instanceof AbortSignal,'Each completion is bounded');signals.push(options.referenceFactsSignal);return deps.resolveMedia(user,raw);}});
  assert.equal(signals.length,2);assert.equal(signals[0],signals[1],'Eight seconds applies to the whole selection, not once per reference');
});
for(const output of [false,true])test(`explicit ordered repeated ${output?'job output':'asset'} slots preserve canonical order and reject reversed slots before mutation`,async()=>{
  const catalog=await videoCatalog();const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const source=output?{type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'}:ref('video');
  const action={action:'video.prepare' as const,reply:'Review.',prompt:'Repeat the reference.',aspectRatio:'16:9' as const,source:null,modelId:'wan-2-6',mode:'r2v' as const,outputCount:1 as const,settings:[{name:'durationSec',value:5},{name:'resolution',value:'1080p'}],references:[{ref:source,role:'reference' as const,slot:0},{ref:source,role:'reference' as const,slot:1}]};
  const events:string[]=[];const deps={...dependencies(events),readProjectMedia:async()=>[{ref:source,name:'Ready clip',durationSec:12}]};
  const request=await studioMediaRequest(actor,action,input,factories,true,deps) as CanonicalGenerationRequest;
  assert.deepEqual(request.references.map(reference=>reference.slot),[0,1]);
  events.length=0;
  await assert.rejects(validateStudioMediaRequest(actor,{...action,references:[action.references[1],action.references[0]]},input,factories,true,deps),{code:'REFERENCE_INVALID'});
  assert.deepEqual(events,[],'Canonical slot ordering rejects before source reads and promotion');
});

test('an unchanged reviewed image with no ordered slot remains preparable',async()=>{
  const catalog=await videoCatalog();const candidate=catalog.find(c=>c.engine.id==='wan-3')!;
  const action=workflowAction(candidate,'i2v');action.references=[{ref:ref('image'),role:'first_frame',slot:null}];
  const factories={video:()=>({catalog:async()=>catalog,resolveReferences:async(request:CanonicalGenerationRequest)=>request.references.map(reference=>resolved('image',reference.role,reference.slot))})} as unknown as StudioMediaFactories;
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{...dependencies(),reviewedReferences:[resolved('image','reference')]});
  const request=await selection.materialize();assert.equal(request.surface,'video');assert.equal(request.references[0].role,'first_frame');assert.equal(request.references[0].slot,undefined);assert.ok(selection.referenceFingerprint?.());
});

for(const change of ['source','lineage','promotion'] as const)test(`native output ${change} drift cannot become a new quote direction`,async()=>{
  const catalog=await videoCatalog();const events:string[]=[];const deps=dependencies(events);
  const source={type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'};
  const action={...workflowAction(catalog.find(c=>c.engine.id==='wan-3')!,'extend'),references:[{ref:source,role:'source' as const,slot:null}]};
  let changed=false,promoted=false;
  const factories={video:()=>({catalog:async()=>catalog,resolveReferences:async(request:CanonicalGenerationRequest)=>request.references.map(reference=>resolved('video',reference.role,reference.slot))})} as unknown as StudioMediaFactories;
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{...deps,reviewedReferences:[],readProjectMedia:async()=>[{ref:source,name:'Ready original',durationSec:12}],resolveMedia:async(user,raw)=>{const media=await deps.resolveMedia(user,raw);return {...media,...(changed&&(change==='source'||change==='promotion'&&promoted)?{url:'https://cdn.maxvideoai.com/replaced-output.mp4'}:{})};},saveOutput:async identity=>{promoted=true;const asset=await deps.saveOutput(identity);return {...asset,...(change==='lineage'?{sourceOutputId:'other-output',metadata:{originUrl:'https://cdn.maxvideoai.com/other-original.mp4'}}:{})};}});
  changed=true;
  await assert.rejects(selection.materialize(),{code:'REFERENCE_INVALID'});
  if(change==='source')assert.equal(events.includes('save'),false,'A changed native source is refused before promotion');
  assert.equal(selection.referenceFingerprint?.(),undefined,'Rejected media never receives a quote fingerprint');
});

test('a native original may copy to a new owned URL while retaining exact source provenance',async()=>{
  const catalog=await videoCatalog();const deps=dependencies();const original=resolved('video');const copiedUrl='https://cdn.maxvideoai.com/library-copy.mp4';
  const source={type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'};
  const action={...workflowAction(catalog.find(c=>c.engine.id==='wan-3')!,'extend'),references:[{ref:source,role:'source' as const,slot:null}]};
  const factories={video:()=>({catalog:async()=>catalog,resolveReferences:async(request:CanonicalGenerationRequest)=>request.references.map(reference=>({...original,assetId:ids.video,role:reference.role,...(reference.slot===undefined?{}:{slot:reference.slot}),storageUrl:copiedUrl}))})} as unknown as StudioMediaFactories;
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{...deps,reviewedReferences:[],readProjectMedia:async()=>[{ref:source,name:'Ready original',durationSec:12}],resolveMedia:async(user,raw)=>{const media=await deps.resolveMedia(user,raw);return {...media,...(toolAssetRefSchema.parse(raw).type==='asset'?{url:copiedUrl}:{})};},saveOutput:async identity=>({...await deps.saveOutput(identity),url:copiedUrl})});
  const request=await selection.materialize();assert.ok(request.surface==='video');assert.equal(request.references[0].kind,'asset');assert.ok(selection.referenceFingerprint?.());
});

for(const drift of [false,true])test(`a copied native output ${drift?'still rejects original drift':'does not inherit the expired preflight HEAD budget'}`,async t=>{
  const controller=new AbortController();t.mock.method(AbortSignal,'timeout',()=>controller.signal);
  const catalog=await videoCatalog();const deps=dependencies();let promoted=false;
  const source={type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'};
  const action={...workflowAction(catalog.find(c=>c.engine.id==='wan-3')!,'extend'),references:[{ref:source,role:'source' as const,slot:null}]};
  const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{...deps,readProjectMedia:async()=>[{ref:source,name:'Ready original',durationSec:12}],resolveMedia:async(user,raw,_exec,options)=>{options?.referenceFactsSignal?.throwIfAborted();const media=await deps.resolveMedia(user,raw);return {...media,...(media.ref.type==='job-output'&&!options?.completeReferenceFacts?{sizeBytes:null,...(drift&&promoted?{url:'https://cdn.maxvideoai.com/drift-during-copy.mp4'}:{})}:{})};},saveOutput:async identity=>{const asset=await deps.saveOutput(identity);promoted=true;controller.abort();return asset;}});
  if(drift)await assert.rejects(selection.materialize(),{code:'REFERENCE_INVALID'});
  else {const request=await selection.materialize();assert.ok(request.surface==='video');assert.equal(request.references[0].kind,'asset');}
});

for(const kind of ['image','video'] as const)test(`unchanged native ${kind} accepts measured copy facts absent from the production output row`,async()=>{
  const catalog=await videoCatalog();const candidate=catalog.find(c=>c.engine.id===(kind==='image'?'minimax-h3':'wan-3'))!;
  const original=`https://cdn.maxvideoai.com/native.${kind==='image'?'png':'mp4'}`,copy=`https://cdn.maxvideoai.com/copy.${kind==='image'?'png':'mp4'}`;
  const source={type:'job-output' as const,kind,jobId:'ready-job',outputId:'ready-output'};
  const output={id:source.outputId,job_id:source.jobId,user_id:actor.userId,job_user_id:actor.userId,kind,status:'ready',url:original,mime_type:kind==='image'?'image/png':'video/mp4',width:null,height:null,metadata:{}};
  const saved={id:'saved',public_id:ids[kind],user_id:actor.userId,job_user_id:actor.userId,kind,status:'ready',url:copy,mime_type:output.mime_type,width:1920,height:1080,size_bytes:8192,source_job_id:source.jobId,source_output_id:source.outputId,metadata:{originUrl:original,mediaFacts:kind==='video'?{source:'probe',version:1,probe:'ffprobe',original:{url:copy,sha256:'f'.repeat(64),sizeBytes:8192},durationSec:6,videoDurationSec:6,audioDurationSec:null,containerDurationSec:6}:{source:'probe',width:1920,height:1080}}};
  const action={...workflowAction(candidate,kind==='image'?'i2v':'extend'),references:[{ref:source,role:kind==='image'?'first_frame' as const:'source' as const,slot:null}]};
  const factories={video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories;let promotions=0;
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{readProjectMedia:async()=>[{ref:source,name:'Ready original',durationSec:null}],resolveMedia:async(user,ref,_execute,options)=>resolveStudioMedia(user,ref,async sql=>sql.includes('FROM media_assets')?[saved]:[output],{...options,headReferenceMetadata:async()=>{throw new Error('A measured exact copy requires no HEAD');}}),saveOutput:async()=>{promotions++;return {userId:actor.userId,publicId:ids[kind],kind,status:'ready',sourceJobId:source.jobId,sourceOutputId:source.outputId,metadata:{originUrl:original},url:copy} as never;}});
  const request=await selection.materialize();assert.ok(request.surface==='video');assert.equal(request.references[0].kind,'asset');assert.equal(promotions,1);
});
for(const fact of ['bytes','width','duration'] as const)test(`removing a native ${fact} fact during copy is drift even when its earlier measured value is known`,async()=>{
  const catalog=await videoCatalog();const deps=dependencies();let removed=false;const source={type:'job-output' as const,kind:'video' as const,jobId:'ready-job',outputId:'ready-output'};
  const action={...workflowAction(catalog.find(c=>c.engine.id==='wan-3')!,'extend'),references:[{ref:source,role:'source' as const,slot:null}]};
  const selection=await validateStudioMediaRequest(actor,action,input,{video:()=>({catalog:async()=>catalog})} as unknown as StudioMediaFactories,true,{...deps,readProjectMedia:async()=>[{ref:source,name:'Ready original',durationSec:12}],resolveMedia:async(user,raw)=>{const media=await deps.resolveMedia(user,raw);return {...media,...(removed&&media.ref.type==='job-output'?fact==='bytes'?{sizeBytes:null}:fact==='width'?{width:null,mediaFacts:{...media.mediaFacts,width:undefined}}:{durationSec:null,mediaFacts:{...media.mediaFacts,durationSec:undefined}}:{})};},saveOutput:async identity=>{removed=true;return deps.saveOutput(identity);}});
  await assert.rejects(selection.materialize(),{code:'REFERENCE_INVALID'});
});

test('conversation source-media qualification cannot widen legacy Canvas certification',async()=>{
  for(const modelId of ['gemini-omni-flash','lumaRay2','kling-o3-pro','ltx-2-3','seedance-2-0-mini'])assert.equal(isWorkspaceModelCertifiedForBlock({modelId,presetId:'modify-video',workflowType:'video_to_video'}),false,modelId);
  for(const modelId of ['veo-3-1','gemini-omni-flash','ltx-2-3','flux-3'])assert.equal(isWorkspaceModelCertifiedForBlock({modelId,presetId:'extend-video',workflowType:'video_to_video'}),false,modelId);
  for(const modelId of ['kling-3-turbo-pro','minimax-h3-max','grok-imagine-video-1-5','flux-3'])assert.equal(isWorkspaceModelCertifiedForBlock({modelId,presetId:'generate-video',workflowType:'image_to_video'}),false,modelId);
  const catalog=await createStudioVideoGenerationService(actor,{enabled:true,prepareDependencies:{listPublicEngines:videoCatalog}}).catalog();
  assert.ok(catalog.find(entry=>entry.engine.id==='gemini-omni-flash')?.publicModes.includes('v2v'));
  assert.ok(catalog.find(entry=>entry.engine.id==='flux-3')?.publicModes.includes('extend'));
  assert.ok(catalog.find(entry=>entry.engine.id==='ltx-2-3')?.publicModes.includes('a2v'));
});
