import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import {createStudioConversationDirector,type StudioDirectorResponse,type StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';
import {validateStudioMediaRequest,type StudioMediaFactories} from '../frontend/src/server/studio/conversation-media-generation';
import type {StudioActionResult,StudioActionRequest} from '../frontend/lib/studio/conversation-action-contract';
import {StudioPreparationInputError} from '../frontend/src/server/studio/conversation-preparation-validation';

const project={name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}};
const actor={userId:'owner',projectId:'project',authMethod:'studio-session' as const,clientId:null};
const input={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Create a 20-second vertical film with sound.',references:[]};
const entry=getFalEngineById('seedance-2-5')!;
const candidate={engine:entry.engine,surface:'video' as const,publicModes:['t2v'] as const,modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
const factories={video:()=>({catalog:async()=>[candidate]})} as unknown as StudioMediaFactories;
function videoArgs(valid:boolean){return {reply:'Review the video quote.',prompt:'A cinematic vertical film.',aspectRatio:'9:16',source:null,modelId:'seedance-2-5',mode:'t2v',references:[],outputCount:1,
  settings:[{name:'durationSec',value:20},{name:'resolution',value:'1080p'},{name:valid?'audio':'generateAudio',value:true},{name:'aspectRatio',value:'9:16'}]};}
function response(index:number,name:string,args:unknown):StudioDirectorResponse{return {id:'response-'+index,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name,call_id:'action-'+index,arguments:JSON.stringify(args)}]};}
const correction=(action:StudioActionRequest)=>({...toAgentApiFailure(new StudioPreparationInputError('PARAMETER_INVALID','settings contains an unknown or unsupported field.')),action:action.action}) as StudioActionResult;

test('catalog and model discovery leave a preparation correction within the existing four response checkpoints',async()=>{
  const steps=[['catalog_read',{}],['model_details',{modelId:'seedance-2-5'}],['video_prepare',videoArgs(false)],['video_prepare',videoArgs(true)]] as const;
  const indices:number[]=[],actions:string[]=[];
  let calls=0;
  const createResponse:StudioResponseCreator=async params=>{
    const index=calls++;
    const names=params.tools?.filter(tool=>tool.type==='function').map(tool=>tool.name)??[];
    if(index===2){assert.equal(names.includes('project_remember'),false,'Late optional memory must not consume the correction slot');assert.ok(names.includes('media_read'),'Necessary source discovery remains available');}
    if(index===3){assert.deepEqual(names,['video_prepare']);assert.match(JSON.stringify(params.input),/studio_preparation_input/);}
    return response(index,...steps[index]);
  };
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse})({...input,references:[],history:[],project,
    checkpoint:async(index,create)=>{indices.push(index);return create();},execute:async(_,action)=>{
      actions.push(action.action);
      if(action.action!=='video.prepare')return {ok:true,action:action.action,data:[]} as StudioActionResult;
      try{await validateStudioMediaRequest(actor,action,input,factories,true);return {ok:true,action:action.action,data:{}} as StudioActionResult;}
      catch(error){assert.ok(error instanceof AgentApiError);return {...toAgentApiFailure(error),action:action.action};}
    }});
  assert.deepEqual(indices,[0,1,2,3]);assert.deepEqual(actions,['catalog.read','model.details','video.prepare','video.prepare']);
  assert.equal(calls,4);assert.equal(draft.continuation,undefined);assert.equal(draft.media?.action,'video.prepare');
  assert.ok(draft.media?.action==='video.prepare'&&draft.media.settings?.some(setting=>setting.name==='audio'&&setting.value===true));
});

test('a rejected correction stops after one correction attempt rather than spending all remaining responses',async()=>{
  let calls=0,executed=0;
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>response(calls++,'video_prepare',videoArgs(false))})({...input,references:[],history:[],project,checkpoint:async(_,create)=>create(),execute:async(_,action)=>{executed++;return correction(action);}});
  assert.equal(calls,2);assert.equal(executed,2);assert.equal(draft.media,undefined);
  assert.equal(draft.continuation?.lastError?.code,'PARAMETER_INVALID');assert.match(draft.reply,/failed|continue/i);
  assert.match(draft.reply,/single preparation correction.*rejected/i);
  assert.doesNotMatch(draft.reply,/message reached its action limit/i);
});

test('a correction cannot execute an unrelated timeline mutation',async()=>{
  let calls=0,executed=0;
  const director=createStudioConversationDirector({mediaEnabled:true,editingEnabled:true,createResponse:async()=>++calls===1?response(0,'video_prepare',videoArgs(false)):response(1,'timeline_edit',{sequenceId:'sequence',expectedRevision:0,edit:{kind:'gain',clipId:'music',volume:20}})});
  await assert.rejects(director({...input,references:[],history:[],project,checkpoint:async(_,create)=>create(),execute:async(_,action)=>{executed++;return correction(action);}}),{code:'PARAMETER_INVALID'});
  assert.equal(calls,2);assert.equal(executed,1,'The unrelated mutation must never run');
});

test('needed source discovery can still use three reads followed by preparation',async()=>{
  const steps=[['catalog_read',{}],['model_details',{modelId:'seedance-2-5'}],['media_read',{}],['video_prepare',videoArgs(true)]] as const;
  let calls=0;
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>response(calls,...steps[calls++])})({...input,references:[],history:[],project,checkpoint:async(_,create)=>create(),execute:async(_,action)=>({ok:true,action:action.action,data:[]} as StudioActionResult)});
  assert.equal(calls,4);assert.equal(draft.media?.action,'video.prepare');assert.equal(draft.continuation,undefined);
});

test('unmarked wallet, lease, ownership and provider failures never request a corrective model response',async()=>{
  for(const [code,message]of [['PARAMETER_INVALID','Wallet currency mismatch'],['PARAMETER_INVALID','Request lease superseded'],['REFERENCE_INVALID','Owned media missing'],['ENGINE_UNAVAILABLE','Provider unavailable']] as const){
    let calls=0;
    const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>response(calls++,'video_prepare',videoArgs(true))});
    await assert.rejects(director({...input,references:[],history:[],project,checkpoint:async(_,create)=>create(),execute:async(_,action)=>({...toAgentApiFailure(new AgentApiError(code,message)),action:action.action})}),{code,message});
    assert.equal(calls,1);
  }
});

test('older saved discovery after a preparation rejection replays without purchasing those responses again',async()=>{
  const saved=[response(0,'video_prepare',videoArgs(false)),response(1,'model_details',{modelId:'seedance-2-5'}),response(2,'video_prepare',videoArgs(true))];
  const actions:string[]=[];
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>{throw new Error('Recorded responses must not be repurchased');}})({...input,references:[],history:[],project,
    checkpoint:async index=>saved[index],execute:async(_,action)=>{actions.push(action.action);return actions.length===1?correction(action):{ok:true,action:action.action,data:[]} as StudioActionResult;}});
  assert.deepEqual(actions,['video.prepare','model.details','video.prepare']);assert.equal(draft.media?.action,'video.prepare');
});

test('two saved preparation rejections permit only recorded follow-up responses and never a new dispatch',async()=>{
  const saved=[response(0,'video_prepare',videoArgs(false)),response(1,'video_prepare',videoArgs(false)),response(2,'model_details',{modelId:'seedance-2-5'}),response(3,'video_prepare',videoArgs(true))];
  const indices:number[]=[],replayOnly:boolean[]=[];
  const draft=await createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>{throw new Error('No new response is authorized');}})({...input,references:[],history:[],project,
    checkpoint:async(index,_create,_params,options)=>{indices.push(index);replayOnly.push(options?.replayOnly===true);return saved[index];},
    execute:async(_,action)=>indices.length<3?correction(action):{ok:true,action:action.action,data:[]} as StudioActionResult});
  assert.deepEqual(indices,[0,1,2,3]);assert.deepEqual(replayOnly,[false,false,true,true]);assert.equal(draft.media?.action,'video.prepare');
});

test('exhausted legacy corrections stop before a new checkpoint reservation while unresolved usage remains terminal',async()=>{
  for(const unresolved of [false,true]){
    let read=0;
    const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>{throw new Error('No dispatch after exhausted corrections');}});
    const context={...input,references:[],history:[],project,checkpoint:async(index:number,_create:unknown,_params:unknown,options?:{replayOnly?:boolean})=>{
      read++;
      if(index<2)return response(index,'video_prepare',videoArgs(false));
      assert.equal(options?.replayOnly,true,'Replay-only must be set before the reservation checkpoint');
      throw new AgentApiError('SPENDING_LIMIT_EXCEEDED','Saved usage state.',false,{type:'studio_assistance',reason:unresolved?'usage_unresolved':'call_limit'});
    },execute:async(_call:string,action:StudioActionRequest)=>correction(action)};
    if(unresolved)await assert.rejects(director(context),error=>error instanceof AgentApiError&&error.nextAction?.reason==='usage_unresolved');
    else {const draft=await director(context);assert.equal(draft.continuation?.lastError?.code,'PARAMETER_INVALID');assert.match(draft.reply,/single preparation correction.*rejected/i);}
    assert.equal(read,3);
  }
});

test('an unknown saved action after exhausted corrections cannot execute or trigger another dispatch',async()=>{
  let executed=0;
  const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>{throw new Error('Unknown saved action must not cause dispatch');}});
  await assert.rejects(director({...input,references:[],history:[],project,
    checkpoint:async(index,_create,_params,options)=>{
      if(index<2)return response(index,'video_prepare',videoArgs(false));
      assert.equal(options?.replayOnly,true);
      return response(index,'generation_confirm',{quoteId:'invented'});
    },execute:async(_,action)=>{executed++;return correction(action);}}),{code:'PARAMETER_INVALID'});
  assert.equal(executed,2);
});
