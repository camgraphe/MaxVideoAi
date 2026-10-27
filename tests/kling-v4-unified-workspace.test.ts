import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_ENGINE as engine } from '../frontend/src/config/fal-engines/kling-v4';
import { buildComposerModeToggles, coerceFormState, getEngineModeOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { buildWorkspacePreflightRequest } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-preflight-request';
import { buildAssetFieldIdSet, buildKlingLibraryAsset, type ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { prepareGenerationInputs } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-inputs';
import { buildWorkspacePickerOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-picker';
import type { KlingElementState } from '../frontend/components/KlingElementsBuilder';
const copy={generateVideo:'Create video',removeAudioToUnlock:'Remove audio',audioUnsupported:'Unsupported',audioLocked:'Locked',audioLockedFallback:'Locked'};
const asset=(fieldId:string,kind:'image'|'video'='image'):ReferenceAsset=>({...buildKlingLibraryAsset({id:fieldId,kind,url:`https://owned.test/${fieldId}`,width:1280,height:720,size:1234,durationSec:kind==='video'?4:null}),fieldId,type:kind==='video'?'video/mp4':'image/png'});
function workflow(inputAssets:Record<string,(ReferenceAsset|null)[]>={},klingElements:KlingElementState[]=[],mode:'t2v'|'v2v'='t2v'){
 return resolveWorkspaceWorkflow({engine,form:coerceFormState(engine,mode,null),inputAssets,klingElements});
}
test('Kling4 exposes the shared Create/Modify workflow and no technical tabs or Extend',()=>{
 assert.equal(getEngineModeOptions(engine),undefined);
 assert.deepEqual(buildComposerModeToggles({selectedEngine:engine,audioWorkflowLocked:false,uiLocale:'en',workflowCopy:copy})?.map(x=>x.mode),[null,'v2v']);
 for(const [assets,expected] of [ [{},'t2v'],[{image_url:[asset('image_url')]},'i2v'],[{end_image_url:[asset('end_image_url')]},'i2v'],[{image_urls:[asset('image_urls')]},'ref2v'],[{video_urls:[asset('video_urls','video')]},'ref2v'],[{video_url:[asset('video_url','video')]},'t2v'] ] as const){
  const state=workflow(assets);assert.equal(state.submissionMode,expected);assert.equal(state.activeManualMode,null);
 }
 const subject:KlingElementState={id:'subject',frontal:buildKlingLibraryAsset({id:'front',kind:'image',url:'https://owned.test/front'}),references:[],video:null};
 assert.equal(workflow({},[subject]).submissionMode,'ref2v');
 assert.equal(workflow({},[],'v2v').activeManualMode,'v2v','empty explicit Modify waits for its source');
});

test('picker reference quotes carry the same owned subject identity and invalid media remains editable without an invented quote',()=>{
 const front=buildKlingLibraryAsset({id:'owned-front',kind:'image',url:'https://owned.test/front',width:1280,height:720,size:1234});
 const current={form:coerceFormState(engine,'t2v',null),inputAssets:{},klingElements:[{id:'subject',frontal:front,references:[{...front,id:'owned-angle',assetId:'owned-angle',url:'https://owned.test/angle'}],video:null}],prompt:'A scene',negativePrompt:'',multiPromptEnabled:false,multiPromptScenes:[],shotType:'customize' as const,voiceIdsInput:'',cfgScale:null};
 const row=buildWorkspacePickerOptions({current,engines:[engine],locale:'en',memberTier:'Member'})[engine.id];
 assert.equal(row.request?.mode,'ref2v');
 assert.equal(row.request?.elements?.[0]?.frontalAssetId,'owned-front');
 current.klingElements[0].frontal={...front,assetId:undefined};
 const invalid=buildWorkspacePickerOptions({current,engines:[engine],locale:'en',memberTier:'Member'})[engine.id];
 assert.equal(invalid.request,null);assert.ok(invalid.priceUnavailableReason);
});
test('Kling4 Create exposes its inputs before inference, keeps Modify source separate, and quotes only active refs',()=>{
 const inputAssets={image_url:[asset('image_url')],video_url:[asset('video_url','video')]};
 const state=workflow(inputAssets);
 const fields=summarizeWorkspaceInputSchema({selectedEngine:engine,...state,uiLocale:'en'}).assetFields.map(x=>x.field.id);
 for(const id of ['image_url','end_image_url','image_urls','video_urls']) assert.ok(fields.includes(id),id);
 assert.ok(!fields.includes('video_url'));
 const request=buildWorkspacePreflightRequest({form:coerceFormState(engine,'t2v',null),selectedEngine:engine,...state,effectiveDurationSec:5,voiceControlEnabled:false,inputAssets,memberTier:'Member'});
 assert.equal(request.mode,'i2v');assert.deepEqual(request.inputs?.map(x=>x.assetId),['image_url']);
 const modify=workflow(inputAssets,[],'v2v');
 const modifyFields=summarizeWorkspaceInputSchema({selectedEngine:engine,...modify,uiLocale:'en'}).assetFields.map(x=>x.field.id);
 assert.ok(modifyFields.includes('video_url'));assert.ok(!modifyFields.includes('video_urls'));assert.ok(!modifyFields.includes('image_url'));
});

test('unified Create input presentation never sends an inactive ending image or Modify source to reference generation',()=>{
 const inputAssets={image_url:[asset('image_url')],image_urls:[asset('image_urls')],end_image_url:[asset('end_image_url')],video_url:[asset('video_url','video')]};
 const state=workflow(inputAssets);
 const summary=summarizeWorkspaceInputSchema({selectedEngine:engine,...state,uiLocale:'en'});
 assert.equal(state.submissionMode,'ref2v');
 const prepared=prepareGenerationInputs({selectedEngineId:engine.id,...state,form:coerceFormState(engine,'t2v',null),inputSchema:engine.inputSchema,inputSchemaSummary:summary,
  extraInputFields:[...summary.promotedFields,...summary.secondaryFields],inputAssets,
  primaryAssetFieldIds:buildAssetFieldIdSet(summary.assetFields,x=>x.role==='primary'),referenceAssetFieldIds:buildAssetFieldIdSet(summary.assetFields,x=>x.role==='reference'),
  genericImageFieldIds:new Set(),frameAssetFieldIds:buildAssetFieldIdSet(summary.assetFields,x=>x.role==='frame'),referenceAudioFieldIds:new Set(),
  klingElements:[],multiPromptActive:false,multiPromptScenes:[]});
 assert.ok(prepared.ok,prepared.ok?undefined:prepared.message);
 if(prepared.ok)assert.deepEqual(prepared.inputsPayload?.map(x=>x.assetId),['image_url','image_urls']);
 assert.ok(inputAssets.end_image_url.length&&inputAssets.video_url.length,'inactive originals remain in the draft');
});
