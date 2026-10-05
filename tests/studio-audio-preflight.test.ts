import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createStudioAudioGenerationService} from '../frontend/src/server/studio/audio-generation-service';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import type {StudioMediaIntent} from '../frontend/lib/studio/conversation-media-contract';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor={authMethod:'studio-session' as const,userId:'audio-owner',projectId:'audio-project',clientId:null};
const video={type:'asset' as const,kind:'video' as const,assetId:'ma_'+'a'.repeat(32)};
const voice={type:'asset' as const,kind:'audio' as const,assetId:'ma_'+'b'.repeat(32)};
const env={FAL_KEY:'test-only',GOOGLE_VERTEX_PROJECT_ID:'test-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'test-only'};
const factory:typeof createStudioAudioGenerationService=(principal,options)=>({...createStudioAudioGenerationService(principal,options),catalog:async()=>listAudioCapabilities(env)});
const input={requestId:randomUUID(),message:'Prepare the exact attached sources.',references:[],attachments:[video,voice]};
const source={role:'source_video' as const,asset:video};
const sample={role:'voice_sample' as const,asset:voice};

test('audio preflight preserves canonical packs, exact source roles and native output references',async()=>{
  const module=await import('../frontend/src/server/studio/conversation-audio-generation').catch(()=>null);
  assert.ok(module?.validateStudioAudioRequest,'An Audio preflight must validate all references before quote preparation.');
  const resolved:string[]=[];
  const dependencies={readProjectMedia:async()=>[],resolveMedia:async(owner:string,ref:unknown):Promise<StudioResolvedMedia>=>{
    assert.equal(owner,actor.userId);assert.deepEqual(ref,ref && typeof ref==='object'&&'kind'in ref&&ref.kind==='video'?video:voice);
    const selected=ref as typeof video|typeof voice;resolved.push(selected.assetId);
    return {id:selected.assetId,ref:selected,kind:selected.kind,url:'https://cdn.maxvideoai.com/fixture/'+selected.assetId,thumbUrl:null,previewUrl:null,mime:selected.kind==='video'?'video/mp4':'audio/mpeg',mediaFacts:{source:'probe',durationSec:6},originalAccess:{type:'external'}};
  }};
  const cases=[
    {mode:'music_only',modelId:'audio-music-only',settings:[{name:'mood',value:'dreamy'},{name:'durationSec',value:30}],references:[]},
    {mode:'voice_only',modelId:'audio-voice-only',settings:[{name:'script',value:'Read this exact sentence.'},{name:'voiceModel',value:'seed'}],references:[sample]},
    {mode:'sfx_only',modelId:'audio-sfx-only',settings:[{name:'durationSec',value:8}],references:[]},
    {mode:'song',modelId:'audio-song',settings:[{name:'lyrics',value:'Carry the morning home.'}],references:[]},
    {mode:'ambience_only',modelId:'audio-ambience',settings:[{name:'durationSec',value:12}],references:[]},
    {mode:'cinematic',modelId:'audio-cinematic',settings:[{name:'mood',value:'dreamy'},{name:'musicEnabled',value:false}],references:[source]},
    {mode:'cinematic_voice',modelId:'audio-cinematic-voice',settings:[{name:'mood',value:'dreamy'},{name:'musicEnabled',value:false},{name:'script',value:'Read this exact sentence.'},{name:'voiceModel',value:'seed'}],references:[source,sample]},
  ] as const;
  for(const item of cases){
    const action={action:'audio.prepare',reply:'Review this quote.',prompt:'A warm original cinematic sound.',...item,settings:[...item.settings],references:[...item.references]} as Exclude<StudioMediaIntent,{action:'video.prepare'}>;
    const validated=await module.validateStudioAudioRequest(actor,action,input,factory,true,dependencies);
    const request=await validated.materialize();
    assert.equal(request.mode,item.mode);assert.equal(request.engineId,item.modelId);assert.equal(request.surface,'audio');assert.equal(request.outputCount,1);
    assert.deepEqual(request.references,[...item.references]);
  }
  assert.deepEqual(resolved,[voice.assetId,video.assetId,video.assetId,voice.assetId]);
  const output={type:'job-output' as const,kind:'audio' as const,jobId:'ready-job',outputId:'ready-output'};
  const action={action:'voice.prepare',reply:'Review this voice.',script:'Preserve these words.',language:'english',modelId:'audio-voice-only',settings:[{name:'voiceModel',value:'seed'}],references:[{role:'voice_sample',asset:output}]} as Exclude<StudioMediaIntent,{action:'video.prepare'}>;
  const prepared=await module.validateStudioAudioRequest(actor,action,input,factory,true,{readProjectMedia:async()=>[{ref:output,name:'Ready voice',durationSec:6}],resolveMedia:async()=>({id:output.outputId,ref:output,kind:'audio',url:'https://cdn.maxvideoai.com/ready.mp3',thumbUrl:null,previewUrl:null,mime:'audio/mpeg',mediaFacts:{source:'probe',durationSec:6},originalAccess:{type:'external'}})});
  assert.deepEqual((await prepared.materialize()).references,[{role:'voice_sample',asset:output}]);
});

test('audio preflight fails closed for ownership/read faults and rejects invalid selections before resolving sources',async()=>{
  const {validateStudioAudioRequest}=await import('../frontend/src/server/studio/conversation-audio-generation');
  let reads=0;
  const dependencies={readProjectMedia:async()=>[],resolveMedia:async():Promise<StudioResolvedMedia>=>{reads++;throw new Error('owner read failure');}};
  const base={action:'audio.prepare',reply:'Review the quote.',mode:'cinematic_voice',modelId:'audio-cinematic-voice',prompt:'A warm cinematic sound.',settings:[{name:'mood',value:'dreamy'},{name:'script',value:'Exact words.'},{name:'voiceModel',value:'seed'}],references:[source,sample]} as Exclude<StudioMediaIntent,{action:'video.prepare'}>;
  await assert.rejects(validateStudioAudioRequest(actor,base,{...input,attachments:[video]},factory,true,dependencies),error=>{
    assert.equal((error as {code:string}).code,'REFERENCE_INVALID');return true;
  });
  assert.equal(reads,0,'An unattached later reference must reject before any earlier resolution.');
  await assert.rejects(validateStudioAudioRequest(actor,{...base,settings:[{name:'mood',value:'dreamy'},{name:'script',value:'Exact words.'},{name:'voiceModel',value:'minimax'}]},input,factory,true,dependencies),{code:'PARAMETER_INVALID'});
  assert.equal(reads,0,'Invalid provider/reference combinations are pure validation failures.');
  await assert.rejects(validateStudioAudioRequest(actor,base,input,factory,true,dependencies),error=>{
    assert.equal((error as {nextAction?:unknown}).nextAction,undefined);return true;
  });
  assert.equal(reads,1);
});

test('legacy audio defaults remain compatible while explicit providers and operational failures stay closed',async()=>{
  const {validateStudioAudioRequest}=await import('../frontend/src/server/studio/conversation-audio-generation');
  const partial:typeof createStudioAudioGenerationService=(principal,options)=>({...factory(principal,options),catalog:async()=>{
    const catalog=listAudioCapabilities(env);
    return {...catalog,modes:catalog.modes.map(mode=>({...mode,variants:mode.variants.map(variant=>({...variant,available:variant.settings.musicModel!=='clip'&&variant.settings.voiceModel!=='seed'}))}))};
  }});
  const dependencies={readProjectMedia:async()=>[]};
  const music={action:'music.prepare' as const,reply:'Review music.',prompt:'A warm cinematic instrumental.',mood:'dreamy' as const};
  const request=await(await validateStudioAudioRequest(actor,music,input,partial,true,dependencies)).materialize();
  assert.equal(request.settings.musicModel,'pro');assert.equal(request.settings.durationSec,45);
  await assert.rejects(validateStudioAudioRequest(actor,{...music,settings:[{name:'musicModel',value:'clip'}]},input,partial,true,dependencies),error=>{
    assert.equal((error as {code:string}).code,'ENGINE_UNAVAILABLE');assert.equal((error as {nextAction?:unknown}).nextAction,null);return true;
  });
  const fault:typeof createStudioAudioGenerationService=(principal,options)=>({...factory(principal,options),catalog:async()=>{throw new Error('catalog read failure');}});
  await assert.rejects(validateStudioAudioRequest(actor,music,input,fault,true,dependencies),/catalog read failure/);
  const native={type:'job-output' as const,kind:'audio' as const,jobId:'other-job',outputId:'other-output'};
  await assert.rejects(validateStudioAudioRequest(actor,{action:'voice.prepare',reply:'Review voice.',script:'Exact script.',language:'english',references:[{role:'voice_sample',asset:native}]},input,factory,true,dependencies),error=>{
    assert.equal((error as {code:string}).code,'REFERENCE_INVALID');assert.equal((error as {nextAction?:unknown}).nextAction,null);return true;
  });
});
