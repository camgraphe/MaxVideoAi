import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {summarizeWorkspaceInputSchema} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import {prepareGenerationInputs} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import {buildWorkspaceGeneratePayload} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-payload';
import type {FormState} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type {ReferenceAsset} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import {resolveLumaAgentsSubmissionMediaInputs} from '../frontend/app/api/generate/_lib/luma-agents-submission';
import {buildLumaAgentsVideoPayload} from '../frontend/src/server/video-providers/luma-agents/payload';
import type {GeneratePayload} from '../frontend/src/lib/fal-types';

const entry=getFalEngineById('luma-ray-3-2')!;
for(const names of [['a'],['b','a','b']]) test(`Site creation keyframes reach the direct builder in selected order: ${names.join(',')}`,()=>{
  const indexes=names.map((_,index)=>index*12);
  const form:FormState={engineId:entry.id,mode:'t2v',durationSec:5,resolution:'720p',aspectRatio:'16:9',fps:24,
    iterations:1,seedLocked:false,loop:false,audio:false,extraInputValues:{keyframe_indexes:indexes.join(',')}};
  const summary=summarizeWorkspaceInputSchema({selectedEngine:entry.engine,activeMode:'t2v',allowsUnifiedVeoFirstLast:false,
    isUnifiedHappyHorse:false,isUnifiedSeedance:false,isUnifiedGeminiOmni:false,uiLocale:'en'});
  const slots=(role:string)=>new Set(summary.assetFields.filter(field=>field.role===role).map(field=>field.field.id));
  const assets:ReferenceAsset[]=names.map(name=>({id:name,assetId:name,fieldId:'keyframe_urls',kind:'image',name:`${name}.png`,
    type:'image/png',size:1024,width:1024,height:1024,durationSec:null,status:'ready',url:`https://example.com/${name}.png`,previewUrl:`https://example.com/${name}.png`}));
  const prepared=prepareGenerationInputs({selectedEngineId:entry.id,activeMode:'t2v',submissionMode:'t2v',form,
    inputSchema:entry.engine.inputSchema,inputSchemaSummary:summary,extraInputFields:[...summary.promotedFields,...summary.secondaryFields],
    inputAssets:{keyframe_urls:assets},primaryAssetFieldIds:slots('primary'),referenceAssetFieldIds:slots('reference'),
    genericImageFieldIds:new Set(summary.assetFields.filter(field=>field.field.type==='image').map(field=>field.field.id)),
    frameAssetFieldIds:slots('frame'),referenceAudioFieldIds:new Set(),supportsKlingV3Controls:false,klingElements:[],multiPromptActive:false,multiPromptScenes:[]});
  assert.equal(prepared.ok,true);if(!prepared.ok)throw new Error(prepared.message);
  const {payload}=buildWorkspaceGeneratePayload({selectedEngineId:entry.id,activeMode:'t2v',submissionMode:'t2v',form,
    trimmedPrompt:'Create this motion',trimmedNegativePrompt:'',effectiveDurationSec:5,paymentMode:'wallet',
    capability:entry.modes.find(mode=>mode.mode==='t2v')!.ui,inputSchema:entry.engine.inputSchema,
    supportsNegativePrompt:false,supportsAudioToggle:false,isSeedance:false,supportsKlingV3Controls:false,supportsKlingV3VoiceControl:false,
    voiceIds:[],voiceControlEnabled:false,shotType:'customize',localKey:'local',batchId:'batch',iterationIndex:0,iterationCount:1,friendlyMessage:'Creating',
    lumaContext:{isLumaRay2GenerateWorkflow:false,lumaDuration:null,lumaResolution:null},...prepared});
  const media=resolveLumaAgentsSubmissionMediaInputs({imageUrl:payload.imageUrl,falPayload:payload as GeneratePayload});
  // Exercise the real failure before checking projection details: generic references must never reach this builder.
  const built=buildLumaAgentsVideoPayload({engineId:entry.id,mode:'t2v',prompt:payload.prompt,durationSec:5,resolution:'720p',
    keyframeUrls:media.keyframeUrls,referenceImageUrls:media.referenceImageUrls,extraInputValues:payload.extraInputValues});
  assert.deepEqual(prepared.referenceImageUrls,[]);
  assert.equal(payload.referenceImages,undefined);
  assert.deepEqual(payload.inputs?.map(input=>[input.slotId,input.url]),assets.map(asset=>['keyframe_urls',asset.url]));
  assert.deepEqual(built.video.keyframes,assets.map(asset=>({url:asset.url})));
  assert.deepEqual(built.video.keyframe_indexes,indexes);
});
