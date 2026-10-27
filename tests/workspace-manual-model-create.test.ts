import assert from 'node:assert/strict';
import test from 'node:test';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { preparePickerScenario } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-picker-scenario';
import { buildWorkspacePickerOptions } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-picker';
import { getVideoWorkflowSourceField } from '../frontend/lib/video-source-workflow';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
const engines = getBaseEnginesByCategory('video');
const engine = (id: string) => engines.find(e => e.id === id)!;
function setup(mode: 't2v'|'v2v'|'extend'): WorkspaceModelSetup {
  return {form:coerceFormState(engine('wan-3-prime'),mode,null),prompt:'Keep authored prompt',negativePrompt:'Keep negative',inputAssets:{},klingElements:[],multiPromptEnabled:false,
    multiPromptScenes:[{id:'scene',prompt:'Keep scene',duration:5}],shotType:'customize',voiceIdsInput:'',cfgScale:null};
}
for (const mode of ['v2v','extend'] as const) test(`${mode}: manual switching prepares real Create and never converts source video to references`,()=>{
 const current=setup(mode);
 const sourceField=getVideoWorkflowSourceField(engine(current.form.engineId).inputSchema,mode)!;
 current.inputAssets[sourceField.id]=[{id:'source',assetId:'source',fieldId:sourceField.id,kind:'video',name:'Source',type:'video/mp4',size:1024,status:'ready',durationSec:8,url:'https://owned.test/source.mp4',previewUrl:'https://owned.test/source.mp4'}];
 const before=structuredClone(current);
 for(const id of ['wan-3','flux-3-max','kling-o3-4k','kling-v4','luma-ray-3-2']) {
  const candidate=preparePickerScenario({current,engine:engine(id),currentEngine:engine(current.form.engineId),locale:'en'});
  assert.equal(candidate.applicable,true,`${id}: ${JSON.stringify(candidate.blockingReasons)}`);
  assert.equal(candidate.workflow.activeManualMode,null,id);
  assert.equal(candidate.workflow.submissionMode,'t2v',id);
  assert.equal(candidate.setup.form.operation,undefined,id);
  assert.ok(!Object.values(candidate.setup.inputAssets).flat().some(a=>a?.assetId==='source'),id);
  assert.ok(candidate.removedReferences.some(ref=>ref.asset.assetId==='source'),id);
  assert.equal(candidate.setup.prompt,current.prompt);assert.deepEqual(candidate.setup.multiPromptScenes,current.multiPromptScenes);
 }
 assert.deepEqual(current,before);
});
test('compatible opening image stays active and is quoted in inferred Create',()=>{
 const current=setup('v2v');
 current.inputAssets.start_image_url=[{id:'frame',assetId:'frame',fieldId:'start_image_url',kind:'image',name:'Frame',type:'image/png',size:100,status:'ready',url:'https://owned.test/frame.png',previewUrl:'https://owned.test/frame.png'}];
 for(const overrides of [{},{durationSec:10}]){
  const candidate=preparePickerScenario({current,engine:engine('wan-3'),currentEngine:engine(current.form.engineId),locale:'en',overrides});
  assert.equal(candidate.workflow.submissionMode,'i2v');
  assert.equal(candidate.setup.inputAssets.start_image_url?.[0]?.assetId,'frame');
  assert.ok(!candidate.removedReferences.some(ref=>ref.asset.assetId==='frame'),'a kept inactive compatible frame is not reported as retired');
 }
});
test('runtime admission is checked on the prepared Create mode, without inventing absent Create',()=>{
 const current=setup('v2v');
 const target={...engine('wan-3'),modeAvailability:{v2v:{available:false}}};
 const rows=buildWorkspacePickerOptions({current,engines:[engine(current.form.engineId),target],locale:'en',memberTier:'Member'});
 assert.equal(rows[target.id].disabledReason,undefined);assert.equal(rows[target.id].request?.mode,'t2v');
 for(const closed of [
  {...target,modes:['v2v'] as typeof target.modes},
  {...target,modeAvailability:Object.fromEntries(target.modes.map(mode=>[mode,{available:false}]))},
 ]){
  for(const overrides of [{},{iterations:2}]){
   const prepared=preparePickerScenario({current,engine:closed,currentEngine:engine(current.form.engineId),locale:'en',overrides});
   assert.equal(prepared.applicable,false,'edited options cannot bypass Create admission');
   const option=buildWorkspacePickerOptions({current,engines:[engine(current.form.engineId),closed],locale:'en',memberTier:'Member',overrides})[closed.id];
   assert.ok(option.disabledReason);assert.equal(option.request,null);
  }
 }
});

test('Retake is another explicit source workflow, and its clip never becomes a new model Create reference',()=>{
 const current=setup('t2v');const sourceEngine=engine('ltx-2-3');
 current.form=coerceFormState(sourceEngine,'retake',null);
 current.inputAssets.video_url=[{id:'retake',assetId:'retake',fieldId:'video_url',kind:'video',name:'Retake clip',type:'video/mp4',size:1234,status:'ready',url:'https://owned.test/retake.mp4',previewUrl:'https://owned.test/retake.mp4',durationSec:8}];
 const prepared=preparePickerScenario({current,engine:engine('wan-3'),currentEngine:sourceEngine,locale:'en'});
 assert.equal(prepared.workflow.submissionMode,'t2v');
 assert.ok(!Object.values(prepared.setup.inputAssets).flat().some(a=>a?.assetId==='retake'));
});
