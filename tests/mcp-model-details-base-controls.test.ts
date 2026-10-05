import assert from 'node:assert/strict';
import test from 'node:test';
import {listFalEngines} from '../frontend/src/config/falEngines';
import {getAgentModelDetails} from '../frontend/src/server/agent-api/model-details';
import {studioVisualCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import {normalizeGenerationRequest} from '../frontend/src/server/agent-api/generation-normalization';
import {validateCanonicalGenerationCapabilities} from '../frontend/src/server/agent-api/generation-capability-validation';

const entries=listFalEngines();
const deps={listEngines:async()=>entries.map(entry=>entry.engine),surfaceByEngineId:(id:string)=>entries.find(entry=>entry.id===id)?.category==='image'?'image' as const:'video' as const,isEngineExecutable:()=>true,isModeExecutable:()=>true};
function videoCandidate(id:string){
  const entry=entries.find(entry=>entry.id===id)!;
  return {engine:entry.engine,surface:'video' as const,publicModes:entry.modes.map(mode=>mode.mode) as never,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
}

test('Seedance 2.5 discovery publishes executable canonical base controls for the rejected vertical audio request',async()=>{
  const candidate=videoCandidate('seedance-2-5');
  const mcp=(await getAgentModelDetails('seedance-2-5',deps)).modes.find(mode=>mode.mode==='t2v')!;
  const studio=studioVisualCapabilityDetails(candidate);
  assert.notEqual(studio.surface,'audio');
  if(studio.surface==='audio')throw new Error('Expected video details');
  assert.deepEqual(mcp.settings.find(setting=>setting.key==='audio'),{key:'audio',type:'boolean',required:false,values:null,min:null,max:null,default:null});
  assert.deepEqual(mcp.settings.find(setting=>setting.key==='durationSec'),{key:'durationSec',type:'number',required:false,values:[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30],min:null,max:null,step:1,default:null});
  assert.ok(mcp.settings.find(setting=>setting.key==='resolution')?.values?.includes('1080p'));
  assert.ok(mcp.settings.find(setting=>setting.key==='aspectRatio')?.values?.includes('9:16'));
  assert.deepEqual(studio.modes.find(mode=>mode.mode==='t2v')?.settings,mcp.settings);
  assert.equal(mcp.settings.some(setting=>setting.key==='generateAudio'||setting.key==='generate_audio'),false);
  const request={schemaVersion:1,surface:'video',engineId:'seedance-2-5',mode:'t2v',prompt:'A cinematic vertical film.',references:[],outputCount:1};
  const settings={durationSec:20,resolution:'1080p',audio:true,aspectRatio:'9:16'};
  assert.doesNotThrow(()=>validateCanonicalGenerationCapabilities(normalizeGenerationRequest({...request,settings}),candidate));
  assert.throws(()=>normalizeGenerationRequest({...request,settings:{durationSec:20,resolution:'1080p',generateAudio:true,aspectRatio:'9:16'}}),{field:'settings'});
});

test('base-control discovery does not grant an audio toggle to always-generated or silent models',async()=>{
  for(const [id,audio]of [['minimax-h3','always_generated'],['pika-text-to-video','unavailable']] as const){
    const mode=(await getAgentModelDetails(id,deps)).modes.find(mode=>mode.mode==='t2v')!;
    assert.equal(mode.audio,audio);
    assert.equal(mode.settings.some(setting=>setting.key==='audio'),false,id);
  }
});
