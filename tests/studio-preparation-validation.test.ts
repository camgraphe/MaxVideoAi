import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import {validateStudioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import {isStudioPreparationCorrection} from '../frontend/src/server/studio/conversation-preparation-validation';
import type {StudioMediaIntent} from '../frontend/lib/studio/conversation-media-contract';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import type {StudioResolvedMedia} from '../frontend/src/server/studio/media-resolver';

const actor={userId:'owner',projectId:'project',authMethod:'studio-session' as const,clientId:null};
const source={type:'job-output' as const,kind:'image' as const,jobId:'job',outputId:'output'};
const entry=getFalEngineById('wan-3')!;
const candidate={engine:entry.engine,surface:'video',publicModes:['i2v'],modeCaps:Object.fromEntries(entry.modes.map(m=>[m.mode,m.ui]))};
const factories={video:()=>({catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Animate this image.',references:[]};
const action:StudioMediaIntent={action:'video.prepare',reply:'Review the quote.',prompt:'Slow cinematic motion',aspectRatio:'16:9',source,modelId:'wan-3',mode:'i2v',references:[],outputCount:1,settings:[{name:'resolution',value:'720p'},{name:'durationSec',value:5}]};
const corrective=(error:unknown)=>error instanceof AgentApiError&&isStudioPreparationCorrection({...toAgentApiFailure(error),action:'video.prepare'});
const imageUrl='https://cdn.maxvideoai.com/owned-ready-image.png';
const ownedImage:StudioResolvedMedia={id:source.outputId,ref:source,kind:'image',url:imageUrl,thumbUrl:null,previewUrl:null,mime:'image/png',mediaFacts:undefined,originalAccess:{type:'external'},width:1280,height:720,durationSec:null,sizeBytes:1024,originalName:'ready-image.png'};

test('invalid video selections are rejected before reading, resolving or promoting any source',async()=>{
  let touched=0;
  const fail=async()=>{touched++;throw new Error('Source access forbidden before validation');};
  await assert.rejects(validateStudioMediaRequest(actor,{...action,settings:[{name:'unknownField',value:true}]},input,factories,true,{readProjectMedia:fail,resolveMedia:fail,saveOutput:fail}),corrective);
  assert.equal(touched,0);
});

test('an unattached or truncated asset ID is rejected locally before resolution or promotion',async()=>{
  let touched=0;
  const fail=async()=>{touched++;throw new Error('Foreign asset must not be resolved');};
  const foreign={type:'asset' as const,kind:'image' as const,assetId:'ma_'+'b'.repeat(32)};
  await assert.rejects(validateStudioMediaRequest(actor,{...action,source:foreign},{...input,references:['ma_'+'a'.repeat(32)]},factories,true,{resolveMedia:fail,saveOutput:fail}),corrective);
  assert.equal(touched,0);
});

test('valid video preflight checks owned sources but defers library promotion to materialization',async()=>{
  let writes=0;
  const selected=await validateStudioMediaRequest(actor,action,input,factories,true,{
    readProjectMedia:async()=>[{ref:source,name:'Ready image',durationSec:null}],
    resolveMedia:async(_userId,ref)=>({...ownedImage,ref:ref as StudioResolvedMedia['ref']}),
    saveOutput:async()=>{writes++;return {publicId:'ma_'+'a'.repeat(32),userId:actor.userId,kind:'image',sourceJobId:source.jobId,sourceOutputId:source.outputId,status:'ready',metadata:{originUrl:imageUrl}} as never;},
  });
  assert.equal(writes,0);
  const request=await selected.materialize();
  assert.equal(writes,1);assert.equal(request.surface,'video');
});

test('catalog, ownership and post-promotion errors cannot acquire a correction marker from their public code',async()=>{
  const failure=new AgentApiError('REFERENCE_INVALID','Owned source no longer available.');
  const plain=(error:unknown)=>error instanceof AgentApiError&&!corrective(error);
  await assert.rejects(validateStudioMediaRequest(actor,action,input,{video:()=>({catalog:async()=>{throw new AgentApiError('ENGINE_UNAVAILABLE','Catalog unavailable');}})} as unknown as StudioMediaFactories,true),plain);
  await assert.rejects(validateStudioMediaRequest(actor,action,input,factories,true,{readProjectMedia:async()=>[]}),plain);
  const attached={type:'asset' as const,kind:'image' as const,assetId:'ma_'+'a'.repeat(32)};
  await assert.rejects(validateStudioMediaRequest(actor,{...action,source:attached},{...input,references:[attached.assetId]},factories,true,{
    resolveMedia:async()=>{throw new AgentApiError('REFERENCE_FORBIDDEN','Foreign owner');},
    saveOutput:async()=>{throw new Error('No promotion is allowed after ownership refusal');},
  }),plain);
  const selection=await validateStudioMediaRequest(actor,action,input,factories,true,{
    readProjectMedia:async()=>[{ref:source,name:'Ready image',durationSec:null}],resolveMedia:async()=>ownedImage,
    saveOutput:async()=>{throw failure;},
  });
  await assert.rejects(selection.materialize(),error=>error===failure&&!corrective(error));
});

test('unmarked wallet, lease and provider failures remain terminal regardless of public code',()=>{
  for(const code of ['PARAMETER_INVALID','ENGINE_UNAVAILABLE','REFERENCE_INVALID'] as const)
    assert.equal(isStudioPreparationCorrection({...toAgentApiFailure(new AgentApiError(code,'Terminal failure')),action:'image.prepare'}),false);
});

test('an unavailable real Audio variant remains terminal rather than becoming a model-ID correction',async()=>{
  const audio={audio:()=>({catalog:async()=>listAudioCapabilities({})})} as unknown as StudioMediaFactories;
  await assert.rejects(validateStudioMediaRequest(actor,{action:'voice.prepare',reply:'Review.',script:'Hello.',language:'english',modelId:'audio-voice-only',settings:[{name:'voiceModel',value:'seed'}]},input,audio,true),
    (error:unknown)=>error instanceof AgentApiError&&error.code==='ENGINE_UNAVAILABLE'&&error.nextAction===null);
});
