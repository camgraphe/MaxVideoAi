import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow, resolveWorkspaceComposerFacts } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { serializeWorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import { buildKlingLibraryAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { parseStoredMultiPromptScenes } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';
import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
import type { Mode } from '../frontend/types/engines';

const form = (mode: Mode = 'ref2v') => coerceFormState(KLING_V4_ENGINE, mode, null);
const asset = (id: string, kind: 'image' | 'video' = 'image') => buildKlingLibraryAsset({ id, kind, url: `https://owned.test/${id}`, width:1280,height:720,size:1234,durationSec:kind==='video'?4:null });
const subject = (id: string, video = false): KlingElementState => ({ id, frontal:video?null:asset(`${id}-front`),references: video?[null,null,null]:[asset(`${id}-angle`),null,null], video:video?asset(`${id}-video`,'video'):null });
const prepare = (patch: Record<string,unknown> = {}) => prepareGenerationInputs({ selectedEngineId:'kling-v4', activeMode:'ref2v', submissionMode:'ref2v', form:form(), inputSchema:KLING_V4_ENGINE.inputSchema, inputSchemaSummary:{assetFields:[]}, extraInputFields:[],inputAssets:{},primaryAssetFieldIds:new Set(),referenceAssetFieldIds:new Set(),genericImageFieldIds:new Set(),frameAssetFieldIds:new Set(),referenceAudioFieldIds:new Set(),supportsKlingV3Controls:false,klingElements:[],multiPromptActive:false,multiPromptScenes:[],...patch });

test('V4 explicit modes survive empty references and never enable V3 controls', () => {
  for (const mode of ['t2v','i2v','ref2v','v2v'] as const) {
    const workflow = resolveWorkspaceWorkflow({engine:KLING_V4_ENGINE,form:form(mode),inputAssets:{},klingElements:[]});
    assert.equal(workflow.submissionMode,mode);
    assert.equal(workflow.supportsKlingV3Controls,false);
    const facts=resolveWorkspaceComposerFacts({engine:KLING_V4_ENGINE,form:form(mode),workflow,prompt:'',multiPromptEnabled:true,multiPromptScenes:Array.from({length:10},(_,i)=>({id:String(i),prompt:`Shot ${i}`,duration:3})),voiceIdsInput:'unowned'});
    assert.equal(facts.multiPromptActive,mode!=='v2v');
    assert.equal(facts.multiPromptInvalid,false);
    assert.equal(facts.voiceControlEnabled,false);
    if(mode!=='v2v') assert.equal(facts.effectiveDurationSec,30);
  }
});

test('V4 shots reject fractions, empty prompts, overflow and never round or filter', () => {
  for(const scenes of [[{id:'1',prompt:'Shot',duration:3.5}],[{id:'1',prompt:' ',duration:3}],[{id:'1',prompt:'x'.repeat(513),duration:3}],[{id:'1',prompt:'Shot',duration:31}],[{id:'1',prompt:'Shot',duration:2}]]) {
    assert.equal(prepare({multiPromptActive:true,multiPromptScenes:scenes}).ok,false);
  }
  const scenes=Array.from({length:10},(_,i)=>({id:String(i),prompt:`Shot ${i}`,duration:3}));
  const result=prepare({multiPromptActive:true,multiPromptScenes:scenes,form:{...form(),durationSec:5,durationOption:'5'}});
  assert.ok(result.ok); if(result.ok) assert.deepEqual(result.multiPromptPayload,scenes.map(({prompt,duration})=>({prompt,duration})));
  assert.equal(prepare({submissionMode:'v2v',activeMode:'v2v',multiPromptActive:true,multiPromptScenes:scenes}).ok,false);
});

test('V4 seven owned subjects preserve order and identities; edit rejects video, mixed and voices', () => {
  const elements=Array.from({length:7},(_,i)=>subject(String(i),i<3));
  const result=prepare({klingElements:elements}); assert.ok(result.ok);
  if(result.ok) {
    assert.equal(result.klingElementsPayload?.length,7);
    assert.equal(result.klingElementsPayload?.[0].videoAssetId,'0-video');
    assert.equal(result.klingElementsPayload?.[3].frontalAssetId,'3-front');
    assert.deepEqual(result.klingElementsPayload?.[3].referenceAssetIds,['3-angle']);
  }
  for(const invalid of [[...elements,subject('8')],elements.map((e,i)=>i===3?subject('3',true):e),[{...subject('mixed'),video:asset('mixed-video','video')}],[{...subject('voice'),voiceId:'arbitrary'}],[{...subject('unowned'),frontal:{...asset('unowned-front'),assetId:undefined}}]]) assert.equal(prepare({klingElements:invalid}).ok,false);
  assert.equal(prepare({submissionMode:'v2v',activeMode:'v2v',klingElements:[subject('video',true)]}).ok,false);
  assert.equal(prepare({submissionMode:'v2v',activeMode:'v2v',klingElements:Array.from({length:7},(_,i)=>subject(String(i)))}).ok,true);
});

test('V4 same-model duration rejects invalid saved values without nearest rounding and ignores stale durationOption', () => {
  for(const durationSec of [3.5,31,2]) assert.equal(coerceFormState(KLING_V4_ENGINE,'t2v',{...form('t2v'),durationSec,durationOption:'5'}).durationSec,durationSec);
  const restored=coerceFormState(KLING_V4_ENGINE,'t2v',{...form('t2v'),durationSec:30,durationOption:'5'});
  assert.equal(restored.durationSec,30); assert.equal(restored.durationOption,30);
  assert.equal(prepare({form:{...form(),durationSec:3.5}}).ok,false);
});

test('draft persistence retains fractional invalid shots and owned subject media metadata for later validation', () => {
  const scenes=[{id:'scene',prompt:'Scene',duration:3.5}];
  assert.deepEqual(parseStoredMultiPromptScenes(JSON.stringify(scenes),()=>'',()=>scenes[0],true),scenes);
  const elements=[subject('subject',true)];
  const saved=serializeWorkspaceModelSetup({form:form(),inputAssets:{},klingElements:elements,prompt:'Scene',negativePrompt:'',multiPromptEnabled:true,multiPromptScenes:scenes,shotType:'customize',voiceIdsInput:'',cfgScale:null});
  assert.ok(saved.ok); if(saved.ok) assert.deepEqual(saved.setup.klingElements,elements);
});

test('V4 recreation preserves ordered asset IDs, exact invalid shots, voice provenance and reference timing', async () => {
  const {resolveVideoSettingsSnapshot}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings');
  const value={schemaVersion:1,surface:'video',engineId:'kling-v4',inputMode:'ref2v',prompt:'Scene',core:{durationSec:30,durationOption:'5'},advanced:{multiPrompt:[{prompt:' ',duration:1.5},{prompt:'Shot',duration:28.5}]},refs:{inputs:[{slotId:'video_urls',kind:'video',url:'https://owned.test/video',assetId:'reference-video',durationSec:4.25,size:1234,width:1280,height:720}],elements:[{id:'subject',frontalImageUrl:'https://owned.test/front',frontalAssetId:'front',referenceImageUrls:['https://owned.test/angle'],referenceAssetIds:['angle'],voiceId:'unverified-old-id'}]}};
  const restored=resolveVideoSettingsSnapshot(value,{engines:[KLING_V4_ENGINE],engineMap:new Map([['kling-v4',KLING_V4_ENGINE]]),createLocalId:(p)=>p,createFallbackScene:()=>({id:'fallback',prompt:'',duration:5}),createFallbackKlingElement:()=>subject('fallback')});
  assert.deepEqual(restored.multiPrompt.scenes.map(({prompt,duration})=>({prompt,duration})),value.advanced.multiPrompt);
  assert.equal(restored.klingElements?.[0].id,'subject');
  assert.equal(restored.klingElements?.[0].frontal?.assetId,'front');
  assert.equal(restored.klingElements?.[0].references[0]?.assetId,'angle');
  assert.equal(restored.klingElements?.[0].voiceId,'unverified-old-id');
  assert.equal(restored.inputAssets?.video_urls[0]?.durationSec,4.25);
  assert.equal(prepare({klingElements:restored.klingElements}).ok,false);
});

test('V4 generation and preflight both bind the exact shot total and owned subjects without V3 fields', async () => {
  const {buildWorkspaceGeneratePayload}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload');
  const {buildWorkspacePreflightRequest}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request');
  const elements=[subject('video',true),subject('image')];
  const prepared=prepare({klingElements:elements});assert.ok(prepared.ok);if(!prepared.ok)return;
  const result=buildWorkspaceGeneratePayload({selectedEngineId:'kling-v4',activeMode:'ref2v',submissionMode:'ref2v',form:{...form(),durationOption:'5'},trimmedPrompt:'Scene',trimmedNegativePrompt:'ignored',effectiveDurationSec:30,paymentMode:'wallet',cfgScale:0.5,capability:KLING_V4_ENGINE.modeCaps?.ref2v,inputSchema:KLING_V4_ENGINE.inputSchema,supportsNegativePrompt:false,supportsAudioToggle:false,isSeedance:false,supportsKlingV3Controls:false,supportsKlingV3VoiceControl:false,voiceIds:[],voiceControlEnabled:false,shotType:'intelligent',localKey:'offline',batchId:'offline',iterationIndex:0,iterationCount:1,friendlyMessage:'',lumaContext:{isLumaRay2GenerateWorkflow:false,lumaDuration:null,lumaResolution:null},referenceImageUrls:[],extraInputValues:{},klingElementsPayload:prepared.klingElementsPayload,multiPromptPayload:[{prompt:'Shot',duration:30}]}).payload;
  assert.equal(result.prompt,'');assert.equal(result.durationSec,30);assert.equal(result.durationOption,30);assert.deepEqual(result.elements,prepared.klingElementsPayload);assert.equal(result.shotType,undefined);assert.equal(result.cfgScale,undefined);assert.equal(result.voiceIds,undefined);assert.equal(result.fps,undefined);
  const request=buildWorkspacePreflightRequest({form:{...form(),durationOption:'5',loop:true,seedLocked:true},selectedEngine:KLING_V4_ENGINE,submissionMode:'ref2v',effectiveDurationSec:30,supportsAudioToggle:false,voiceControlEnabled:false,inputAssets:{},klingElements:elements,memberTier:'Member'});
  assert.equal(request.loop,undefined);assert.equal(request.seedLocked,undefined);assert.equal(request.durationOption,30);assert.deepEqual(request.elements,prepared.klingElementsPayload);
});

test('V4 saved mode remains selected when runtime availability is closed', async () => {
  const {getPreferredEngineMode}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers');
  const blocked={...KLING_V4_ENGINE,modeAvailability:{v2v:{available:false,reason:'provider_disabled' as const}}};
  assert.equal(getPreferredEngineMode(blocked,'v2v'),'v2v');
  assert.equal(resolveWorkspaceWorkflow({engine:blocked,form:form('v2v'),inputAssets:{},klingElements:[]}).submissionMode,'v2v');
});

test('V4 rejects wrong-kind subjects and aggregate reference overflow without clipping the request', () => {
  assert.equal(prepare({klingElements:[{...subject('wrong-kind'),frontal:asset('video-front','video')}]}).ok,false);
  const images=[asset('extra-1'),asset('extra-2')].map(value=>({...value,fieldId:'image_urls',type:'image/png',size:1234}));
  assert.equal(prepare({klingElements:Array.from({length:7},(_,i)=>subject(String(i))),inputAssets:{image_urls:images},inputSchemaSummary:{assetFields:[{field:{id:'image_urls',type:'image',label:'References'}}]}}).ok,false);
  const videos=Array.from({length:5},(_,i)=>({...asset(`ref-video-${i}`,'video'),fieldId:'video_urls',type:'video/mp4',size:1234,durationSec:5}));
  assert.equal(prepare({klingElements:Array.from({length:3},(_,i)=>subject(String(i),true)),inputAssets:{video_urls:videos},inputSchemaSummary:{assetFields:[{field:{id:'video_urls',type:'video',label:'References'}}]}}).ok,false);
});


test('V4 recreation rejects malformed subject arrays rather than filtering or re-pairing identities', async () => {
  const {resolveVideoSettingsSnapshot}=await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings');
  const options={engines:[KLING_V4_ENGINE],engineMap:new Map([['kling-v4',KLING_V4_ENGINE]]),createLocalId:(p:string)=>p,createFallbackScene:()=>({id:'fallback',prompt:'',duration:5}),createFallbackKlingElement:()=>subject('fallback')};
  for(const element of [null, {frontalImageUrl:'https://owned.test/front',referenceImageUrls:['', 'https://owned.test/angle'],referenceAssetIds:['bad','good']}, {videoUrl:'https://owned.test/video',voiceId:44}]) {
    assert.throws(()=>resolveVideoSettingsSnapshot({schemaVersion:1,surface:'video',engineId:'kling-v4',inputMode:'ref2v',refs:{elements:[element]}},options));
  }
});
