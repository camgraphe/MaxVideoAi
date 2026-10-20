import assert from 'node:assert/strict';
import test from 'node:test';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {compareGenerationPrices,generationComparisonCatalogFingerprint} from '../frontend/src/server/agent-api/generation-price-comparison';
import {AgentApiError,toAgentApiFailure} from '../frontend/src/server/agent-api/errors';
import {createStudioConversationDirector} from '../frontend/src/server/studio/conversation-director';
import {STUDIO_TASK_PROFILES} from '../frontend/src/lib/studio/task-budget-contract';
import type {StudioActionResult} from '../frontend/lib/studio/conversation-action-contract';

const actor={authMethod:'studio-session' as const,userId:'owner',projectId:'project',clientId:null};
const args={surface:'video',mode:'t2v',prompt:'An educational one-minute film with narration',settings:[{name:'durationSec',value:60},{name:'audio',value:true}],references:[],baselineModelId:null,candidateModelIds:null,outputCount:1};
const response=(index:number,toolArgs:unknown|null)=>({id:'response-'+index,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:null,
  output_text:toolArgs===null?JSON.stringify({reply:'Keep the full minute: plan six supported clips and a separate scripted voiceover. No video or quote has been created.'}):'',
  output:toolArgs===null?[]:[{type:'function_call' as const,name:'pricing_compare',call_id:'compare-'+index,arguments:JSON.stringify(Object.fromEntries(Object.entries(toolArgs as object).filter(([key])=>key!=='action')))}]});
const execution={taskRequestId:'task',segmentRequestId:'segment',workerId:'worker',profile:STUDIO_TASK_PROFILES.standard,maxCalls:4,deadlineAt:new Date(Date.now()+300000),enabled:true};
const catalog=(modelId='ltx-2-5-pro')=>{
  const entry=getFalEngineById(modelId)!;
  return {engine:entry.engine,surface:'video' as const,publicModes:['t2v' as const],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))};
};
const context={message:'Create a one-minute video with voiceover',references:[],history:[],project:{name:'Film',revision:0,memory:{revision:0,brief:'',decisions:[]}},checkpoint:async(_:number,create:()=>Promise<any>)=>create(),
  comparisonCatalogFingerprint:async(action:any)=>generationComparisonCatalogFingerprint(action,[catalog()])};

async function executeComparison(_:string,action:any,options:{modelId?:string;unavailable?:boolean}={}):Promise<StudioActionResult> {
  const entry=getFalEngineById(options.modelId??'ltx-2-5-pro')!;
  try {
    const data=await compareGenerationPrices({...action,settings:Object.fromEntries(action.settings.map(({name,value}:any)=>[name,value]))},actor,{
      listPublicEngines:async()=>[{engine:entry.engine,surface:'video',publicModes:['t2v'],modeCaps:Object.fromEntries(entry.modes.map(mode=>[mode.mode,mode.ui]))}],
      resolveMembershipPricing:async()=>({tier:'member',source:'app_receipts_rolling_30d',spent30Cents:0,thresholdCents:0,discountPercent:0}),
      resolveRequestExecutability:()=>({executable:true,reason:'available'}),
      priceGeneration:async()=>{if(options.unavailable)throw new AgentApiError('ENGINE_UNAVAILABLE','Temporary pricing outage.');return {priceCents:250,currency:'USD',membershipTier:'member',pricingSnapshot:{totalCents:250,currency:'USD',membershipTier:'member'}};},
    });
    return {ok:true,action:'pricing.compare',data};
  } catch(error) {
    if(!(error instanceof AgentApiError))throw error;
    return {...toAgentApiFailure(error),action:'pricing.compare'};
  }
}

test('an unsupported whole-film comparison can advance to supported component prices and a clip quote',async()=>{
  let calls=0,reads=0;
  const clipArgs={...args,settings:[{name:'durationSec',value:10},{name:'audio',value:true}]};
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async params=>{
    calls++;
    if(calls===2){
      assert.equal(params.tool_choice,'auto','Useful montage/component actions must remain available.');
      assert.match(JSON.stringify(params.input),/requestedDurationSec.*60/);
    }
    if(calls===3)return {...response(calls,null),output_text:'',output:[{type:'function_call',name:'video_prepare',call_id:'first-clip',arguments:JSON.stringify({reply:'First 10-second clip of the requested 60-second montage; the remaining clips and voiceover follow after confirmation.',prompt:'First scene of the educational film',aspectRatio:'16:9',source:null,modelId:'ltx-2-5-pro',mode:'t2v',settings:clipArgs.settings,references:[],outputCount:1})}]};
    return response(calls,calls===1?args:clipArgs);
  }});
  const draft=await director({...context,execute:async(id,action)=>{
    if(action.action==='video.prepare')return {ok:true,action:action.action,data:{quoteId:'first-clip',confirmationRequired:true}} as never;
    reads++;return executeComparison(id,action);
  }});
  assert.equal(reads,2);
  assert.equal(calls,3);
  assert.equal(draft.continuation,undefined);
  assert.equal(draft.media?.action,'video.prepare');
  assert.match(draft.reply,/60-second montage/);
});

for(const variant of [{modelId:'ltx-2-5-fast',durationSec:20,parts:3},{modelId:'seedance-2-5',durationSec:30,parts:2}])
test(`a sixty-second brief can advance to ${variant.parts} supported ${variant.durationSec}-second parts without imposing ten-second clips`,async()=>{
  let calls=0,reads=0;
  const clipArgs={...args,candidateModelIds:[variant.modelId],settings:[{name:'durationSec',value:variant.durationSec},{name:'audio',value:true}]};
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>{
    if(++calls===3)return {...response(calls,null),output_text:'',output:[{type:'function_call',name:'video_prepare',call_id:'longer-clip',arguments:JSON.stringify({reply:`First ${variant.durationSec}-second clip of ${variant.parts} parts for the full minute; narration and the remaining parts follow after confirmation.`,prompt:'First cohesive sequence in the same visual world',aspectRatio:'16:9',source:null,modelId:variant.modelId,mode:'t2v',settings:clipArgs.settings,references:[],outputCount:1})}]};
    return response(calls,calls===1?{...args,candidateModelIds:[variant.modelId]}:clipArgs);
  }});
  const draft=await director({...context,execute:async(id,action)=>{
    if(action.action==='video.prepare')return {ok:true,action:action.action,data:{quoteId:'component',confirmationRequired:true}} as never;
    reads++;return executeComparison(id,action,{modelId:variant.modelId});
  }});
  assert.equal(reads,2);assert.equal(calls,3);assert.equal(draft.continuation,undefined);
  assert.equal(draft.media?.action,'video.prepare');assert.match(draft.reply,new RegExp(`${variant.durationSec}-second clip of ${variant.parts} parts`));
});

test('continuation after a saved no-match result does not repeat the failed pricing read',async()=>{
  const failure=await executeComparison('old',{...args,action:'pricing.compare'});
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:{...args,action:'pricing.compare'}}]},createResponse:async params=>{
    calls++;
    assert.equal(params.tool_choice,'auto');
    assert.match(JSON.stringify(params.input),/no_matching_scenario/);
    return response(calls,null);
  }});
  const draft=await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action);}});
  assert.equal(reads,0);
  assert.equal(calls,1);
  assert.equal(draft.continuation,undefined);
});

test('a repeated unchanged comparison cannot execute or cause another paid continuation loop',async()=>{
  const failure=await executeComparison('old',{...args,action:'pricing.compare'});
  let reads=0,calls=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:{...args,action:'pricing.compare'}}]},createResponse:async()=>response(++calls,{...args,prompt:'A rephrased description of the same requested film'})});
  const draft=await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action);}});
  assert.equal(reads,0);
  assert.equal(calls,1);
  assert.equal(draft.continuation,undefined);
  assert.match(draft.reply,/60/);
});

test('a repeated failed comparison within a fresh segment is bounded before a second pricing read',async()=>{
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async()=>response(++calls,args)});
  const draft=await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action);}});
  assert.equal(reads,1);
  assert.equal(calls,2);
  assert.equal(draft.continuation,undefined);
});

test('malformed comparison settings still allow one corrected current pricing read',async()=>{
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,createResponse:async params=>{
    calls++;
    if(calls===2)assert.equal(params.tool_choice,'auto');
    return response(calls,calls===1?{...args,settings:[{name:'duration',value:8}]}:calls===2?{...args,settings:[{name:'durationSec',value:8}]}:null);
  }});
  const draft=await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action);}});
  assert.equal(reads,2);
  assert.equal(calls,3);
  assert.equal(draft.continuation,undefined);
});

test('a corrected prompt length can be priced after a generic no-match failure',async()=>{
  const scenario={...args,action:'pricing.compare',candidateModelIds:['wan-2-6'],settings:[{name:'durationSec',value:5}]};
  const failure=await executeComparison('old',{...scenario,prompt:'x'.repeat(900)},{modelId:'wan-2-6'});
  assert.equal(failure.ok,false);
  assert.equal((await executeComparison('direct',{...scenario,prompt:'Short scene'},{modelId:'wan-2-6'})).ok,true);
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>response(++calls,calls===1?{...scenario,prompt:'Short scene'}:null)});
  await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action,{modelId:'wan-2-6'});}});
  assert.equal(reads,1,'An unrelated prompt correction must not be suppressed.');
  assert.equal(calls,2);
});

test('pricing availability can recover after an earlier no-match result',async()=>{
  const scenario={...args,action:'pricing.compare',settings:[{name:'durationSec',value:8},{name:'audio',value:true}]};
  const failure=await executeComparison('old',scenario,{unavailable:true});
  assert.equal(failure.ok,false);
  assert.equal((await executeComparison('direct',scenario)).ok,true);
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>response(++calls,calls===1?scenario:null)});
  await director({...context,execute:async(id,action)=>{reads++;return executeComparison(id,action);}});
  assert.equal(reads,1,'An unavailable price is not a proven impossible duration.');
  assert.equal(calls,2);
});

test('a newly available compatible model invalidates a historical duration failure',async()=>{
  const scenario={...args,action:'pricing.compare',candidateModelIds:['ltx-2-5-pro','minimax-h3'],settings:[{name:'durationSec',value:12},{name:'audio',value:true}]};
  const failure=await executeComparison('old',scenario);
  assert.equal(failure.ok,false);
  assert.equal((failure as any).error.nextAction.durationMismatch,true);
  assert.equal((await executeComparison('direct',scenario,{modelId:'minimax-h3'})).ok,true);
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>response(++calls,calls===1?scenario:null)});
  await director({...context,comparisonCatalogFingerprint:async action=>generationComparisonCatalogFingerprint(action,[catalog(),catalog('minimax-h3')]),execute:async(id,action)=>{reads++;return executeComparison(id,action,{modelId:'minimax-h3'});}});
  assert.equal(reads,1);
  assert.equal(calls,2);
});

test('a lost duplicate-stop reply replays without executing the skipped comparison or buying another response',async()=>{
  const failure=await executeComparison('old',{...args,action:'pricing.compare'});
  const previousWork=[{action:'pricing.compare',callId:'old',completed:true as const,result:failure,comparison:{...args,action:'pricing.compare'}}];
  const paid=new Map<number,ReturnType<typeof response>>();
  let calls=0,reads=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork},createResponse:async()=>response(++calls,calls===1?args:null)});
  const replayContext={...context,checkpoint:async(index:number,create:()=>Promise<any>)=>{
    if(paid.has(index))return paid.get(index)!;
    const value=await create();paid.set(index,value);return value;
  },execute:async(id:string,action:any)=>{reads++;return executeComparison(id,action);}};
  const first=await director(replayContext);
  const recovered=await director(replayContext);
  assert.deepEqual(recovered,first);
  assert.equal(reads,0);
  assert.equal(calls,1);
  assert.equal(recovered.continuation,undefined);
});

test('an interrupted catalog check recovers an unprocessed paid comparison against the new catalog without another model call',async()=>{
  const scenario={...args,action:'pricing.compare',candidateModelIds:['ltx-2-5-pro','minimax-h3'],settings:[{name:'durationSec',value:12},{name:'audio',value:true}]};
  const failure=await executeComparison('old',scenario);
  let calls=0,reads=0,checks=0;
  let saved:ReturnType<typeof response>|undefined;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>response(++calls,scenario)});
  const recoveringContext={...context,comparisonCatalogFingerprint:async(action:any)=>{
    if(++checks===1)throw Error('Controlled catalog interruption');
    return generationComparisonCatalogFingerprint(action,[catalog(),catalog('minimax-h3')]);
  },checkpoint:async(index:number,create:()=>Promise<any>,_params:unknown,options:any)=>{
    if(index===0){saved??=await create();return saved;}
    assert.equal(options.replayOnly,true,'A cached unprocessed comparison cannot purchase its follow-up response.');
    throw new AgentApiError('RATE_LIMITED','Saved responses exhausted.');
  },execute:async(id:string,action:any)=>{reads++;return executeComparison(id,action,{modelId:'minimax-h3'});}};
  await assert.rejects(director(recoveringContext),/Controlled catalog interruption/);
  const recovered=await director(recoveringContext);
  assert.equal(reads,1);assert.equal(calls,1);assert.equal(checks,2);assert.equal(recovered.continuation,undefined);
  assert.match(recovered.reply,/2.50/,'Recovered compatible prices are retained instead of the stale duration failure.');
});

test('older purchased responses after a failed duplicate replay their terminal preparation without buying new responses',async()=>{
  const failure=await executeComparison('old',{...args,action:'pricing.compare'});
  let recovered=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:{...args,action:'pricing.compare'}}]},createResponse:async()=>{throw Error('No new response may be purchased.');}});
  const draft=await director({...context,readCompletedAction:async()=>failure,checkpoint:async(index:number,_:unknown,_params:unknown,options:any)=>{
    if(index===0)return response(1,args);
    assert.equal(options.replayOnly,true);
    return {...response(2,null),output_text:'',output:[{type:'function_call',name:'video_prepare',call_id:'paid-clip',arguments:JSON.stringify({reply:'First clip of the requested montage.',prompt:'First scene',aspectRatio:'16:9',source:null,modelId:'ltx-2-5-pro',mode:'t2v',settings:[{name:'durationSec',value:10}],references:[],outputCount:1})}]};
  },execute:async(_id,action)=>{
    recovered++;
    return action.action==='pricing.compare'?failure:{ok:true,action:'video.prepare',data:{quoteId:'existing',confirmationRequired:true}} as never;
  }});
  assert.equal(recovered,2);
  assert.equal(draft.media?.action,'video.prepare');
  assert.equal(draft.continuation,undefined);
});

test('replaying a saved refreshed price receipt keeps its compatible prices when no paid follow-up remains',async()=>{
  const scenario={...args,action:'pricing.compare',candidateModelIds:['ltx-2-5-pro','minimax-h3'],settings:[{name:'durationSec',value:12},{name:'audio',value:true}]};
  const failure=await executeComparison('old',scenario),saved=await executeComparison('current',scenario,{modelId:'minimax-h3'});
  assert.equal(saved.ok,true);
  let executions=0;
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>{throw Error('No new response is allowed.');}});
  const draft=await director({...context,readCompletedAction:async()=>saved,comparisonCatalogFingerprint:async()=>{throw Error('Completed actions replay their exact receipt.');},checkpoint:async(index,_create,_params,options)=>{
    if(index===0)return response(1,scenario);
    assert.equal(options?.replayOnly,true);throw new AgentApiError('RATE_LIMITED','Saved responses exhausted.');
  },execute:async()=>{executions++;return saved;}});
  assert.equal(executions,1);assert.equal(draft.continuation,undefined);assert.match(draft.reply,/2.50/);
});

test('replaying a saved refreshed pricing error keeps that error instead of an obsolete duration diagnosis',async()=>{
  const scenario={...args,action:'pricing.compare',candidateModelIds:['ltx-2-5-pro','minimax-h3'],settings:[{name:'durationSec',value:12},{name:'audio',value:true}]};
  const failure=await executeComparison('old',scenario),saved=await executeComparison('current',scenario,{modelId:'minimax-h3',unavailable:true});
  assert.equal(saved.ok,false);assert.equal((saved as any).error.nextAction.durationMismatch,false);
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:failure,comparison:scenario}]},createResponse:async()=>{throw Error('No new response is allowed.');}});
  const draft=await director({...context,readCompletedAction:async()=>saved,checkpoint:async(index,_create,_params,options)=>{
    if(index===0)return response(1,scenario);
    assert.equal(options?.replayOnly,true);throw new AgentApiError('RATE_LIMITED','Saved responses exhausted.');
  },execute:async()=>saved});
  assert.equal(draft.continuation,undefined);assert.match(draft.reply,/unavailable pricing/);
  assert.doesNotMatch(draft.reply,/supports 12 seconds as a single clip/);
});
