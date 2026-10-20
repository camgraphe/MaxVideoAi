import assert from 'node:assert/strict';
import test from 'node:test';
import {createStudioConversationDirector,type StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import type {StudioActionRequest,StudioActionResult} from '../frontend/src/lib/studio/conversation-action-contract';
import type {StudioTaskExecution} from '../frontend/src/server/studio/tasks/execution';

const project={name:'Brand film',revision:0,memory:{revision:0,brief:'',decisions:[]}};
const failure:StudioActionResult={ok:false,action:'pricing.compare',error:{code:'PARAMETER_INVALID',message:'No current model could be verified. Keep the requirements; use the returned mode facts.',retryable:false,nextAction:{type:'generation_comparison',reason:'no_matching_scenario',durationMismatch:false,models:[]}}};
const scenario={surface:'video',mode:'i2v',prompt:'A product film',settings:[{name:'resolution',value:'720p'}],references:[],baselineModelId:null,baselineSettings:null,candidateModelIds:null,outputCount:1,filmDurationSec:20};
function response(index:number,args:unknown):StudioDirectorResponse {return {id:'response-'+index,model:'gpt-6-luna',status:'completed',service_tier:'default',usage:null,output_text:'',output:[{type:'function_call',name:'pricing_compare',call_id:'compare-'+index,arguments:JSON.stringify(Object.fromEntries(Object.entries(args as object).filter(([key])=>key!=='action')))}]};}
const execution:StudioTaskExecution={taskRequestId:'task',segmentRequestId:'segment',workerId:'worker',profile:{maxCredits:250,maxCalls:4,maxOutputTokens:2200,maxInputTokens:24000,deadlineSec:300,historyTurns:8,reasoning:'medium'},maxCalls:4,deadlineAt:new Date(Date.now()+300000),enabled:true,locale:'en'};
const context={message:'PERFECTO, ADELANTE',history:[{message:'Quiero un vídeo para mi tienda. No me hables en inglés, por favor.',reply:'Prepararé las opciones.'}],references:[],project,checkpoint:async(_:number,create:()=>Promise<StudioDirectorResponse>)=>create()};

test('film comparison receives one changed correction before a Spanish customer reply, without raw tool guidance',async()=>{
  let calls=0;const actions:StudioActionRequest[]=[];
  const draft=await createStudioConversationDirector({model:'gpt-6-luna',mediaEnabled:true,taskExecution:execution,createResponse:async()=>response(calls++,{...scenario,mode:calls===1?'i2v':'ref2v'})})({...context,execute:async(_,action)=>{actions.push(action);return failure;}});
  assert.equal(calls,2,'a failed film comparison needs a bounded opportunity to correct its selection');
  assert.deepEqual(actions.map(action=>'mode' in action?action.mode:undefined),['i2v','ref2v']);
  assert.match(draft.reply,/presupuesto|precios/);
  assert.doesNotMatch(draft.reply,/No current|Keep the requirements|returned mode facts|PARAMETER_INVALID|I cannot/);
  assert.equal(draft.image,null);assert.equal(draft.media,undefined);assert.equal(draft.continuation,undefined,'repeating a follow-up is not a recovery strategy');
});

test('an unchanged failed comparison is not executed twice in one turn',async()=>{
  let calls=0,actions=0;
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>response(calls++,scenario)})({...context,execute:async()=>{actions++;return failure;}});
  assert.equal(calls,2);assert.equal(actions,1);
  assert.match(draft.reply,/presupuesto|precios/);assert.equal(draft.continuation,undefined);
});

test('a one-call budget still returns a localized actionable failure without asking for another identical attempt',async()=>{
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,maxCalls:1},createResponse:async()=>response(0,scenario)})({...context,message:'Sí, adelante',execute:async()=>failure});
  assert.match(draft.reply,/presupuesto|precios/);assert.doesNotMatch(draft.reply,/No current|Keep the requirements|I cannot/);
  assert.equal(draft.image,null);assert.equal(draft.media,undefined);
});

test('a changed prompt is a real correction even when the pricing constraints stay unchanged',async()=>{
  let calls=0;const actions:StudioActionRequest[]=[];
  await createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>response(calls++,{...scenario,prompt:calls===1?'Long scene '.repeat(80):'Short scene'})})({...context,execute:async(_,action)=>{actions.push(action);return failure;}});
  assert.equal(actions.length,2);
});

test('recovery of checkpointed responses never executes a comparison previously skipped as a duplicate',async()=>{
  let calls=0;const saved:StudioDirectorResponse[]=[];const actions:string[]=[];
  const director=createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>response(calls++,scenario)});
  const checkpoint=async(index:number,create:()=>Promise<StudioDirectorResponse>)=>saved[index]??(saved[index]=await create());
  const execute=async(id:string)=>{actions.push(id);return failure;};
  await director({...context,checkpoint,execute});
  actions.length=0;
  await director({...context,checkpoint,execute});
  assert.deepEqual(actions,['compare-0']);assert.equal(calls,2);
});

test('recovery of a terminal historical film failure cannot purchase a new response',async()=>{
  const {AgentApiError}=await import('../frontend/src/server/agent-api/errors');
  let creates=0;const replayOnly:boolean[]=[];
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>{creates++;return response(1,scenario);}})({...context,
    checkpoint:async(index,create,_params,options)=>{if(index===0)return response(0,scenario);replayOnly.push(options?.replayOnly??false);if(options?.replayOnly)throw new AgentApiError('RATE_LIMITED','No paid response');return create();},execute:async()=>failure});
  assert.deepEqual(replayOnly,[true]);assert.equal(creates,0);assert.equal(draft.continuation,undefined);
});

test('a corrective response cannot discard the approved film total or escape its single attempt',async()=>{
  let calls=0;const actions:StudioActionRequest[]=[];
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:execution,createResponse:async()=>response(calls++,{...scenario,filmDurationSec:calls===1?20:null,settings:[{name:'durationSec',value:calls+4}]})})({...context,execute:async(_,action)=>{actions.push(action);return failure;}});
  assert.equal(calls,2);assert.equal(actions.length,2);
  assert.ok(actions.every(action=>action.action==='pricing.compare'&&action.filmDurationSec===20));
  assert.equal(draft.continuation,undefined);
});

test('reply language does not follow the requested voice-over language',async()=>{
  const {studioConversationLanguage}=await import('../frontend/src/server/studio/conversation-language');
  assert.equal(studioConversationLanguage('Je veux une vidéo pour ma boutique avec une voix off en anglais.',[],'fr'),'fr');
  assert.equal(studioConversationLanguage('Quiero un vídeo para mi tienda con una voz en inglés.',[],'en'),'es');
  assert.equal(studioConversationLanguage('Please reply in French.',[]),'fr');
  assert.equal(studioConversationLanguage('Réponds-moi en espagnol.',[]),'es');
  assert.equal(studioConversationLanguage('En español, por favor.',[]),'es');
  assert.equal(studioConversationLanguage('Oui', [{message:'Je veux une vidéo pour ma boutique.'}],'en'),'fr');
});

test('multiple valid references do not turn a resolution failure into an invented image diagnosis',async()=>{
  const {studioComparisonFailureGuidance}=await import('../frontend/src/server/studio/conversation-comparison-failure');
  const result=studioComparisonFailureGuidance({...scenario,action:'pricing.compare',mode:'ref2v',references:[{source:'asset',assetId:'one',role:'reference'},{source:'asset',assetId:'two',role:'reference'}]} as Extract<StudioActionRequest,{action:'pricing.compare'}>,failure as Extract<StudioActionResult,{ok:false}>,'fr');
  assert.doesNotMatch(result,/images ne peuvent pas|premier plan/);assert.match(result,/réglages/);
});

for(const changed of ['none','catalog','source','prompt','outage','legacy'] as const)
test(`only a proven unchanged owned-input failure is stopped across messages (${changed})`,async()=>{
  const {studioComparisonAttemptFingerprint}=await import('../frontend/src/server/studio/conversation-comparison-recovery');
  const old={...scenario,action:'pricing.compare' as const,filmDurationSec:null};
  const prior={...failure,error:{...(failure as Extract<StudioActionResult,{ok:false}>).error,nextAction:{type:'generation_comparison',reason:'no_matching_scenario',durationMismatch:false,constraintMismatch:changed!=='outage',catalogFingerprint:'catalog',...(changed==='legacy'?{}:{referenceFingerprint:'source'})}}};
  let calls=0,reads=0;
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'earlier',completed:true,result:prior,comparisonAttemptFingerprint:studioComparisonAttemptFingerprint(old)!}]},createResponse:async()=>{
    calls++;return calls===1?response(1,{...scenario,prompt:changed==='prompt'?'A revised scene':scenario.prompt,filmDurationSec:null}):{...response(2,scenario),output:[],output_text:JSON.stringify({reply:'Una propuesta revisada.'})};
  }})({...context,referenceFingerprint:changed==='source'?'updated-source':'source',comparisonCatalogFingerprint:async()=>changed==='catalog'?'updated-catalog':'catalog',execute:async()=>{reads++;return failure;}});
  assert.equal(reads,changed==='none'?0:1);assert.equal(calls,changed==='none'?1:2);assert.equal(draft.continuation,undefined);
});

test('a language spoken inside a requested scene does not change Studio replies',async()=>{
  const {studioConversationLanguage}=await import('../frontend/src/server/studio/conversation-language');
  assert.equal(studioConversationLanguage('Please generate a video where two cats speak in French.',[]),'en');
  assert.equal(studioConversationLanguage('No me hables en inglés.',[]),'es');
});

test('an unverified price does not ask the client to relax an unproven incompatibility',async()=>{
  const {studioComparisonFailureGuidance}=await import('../frontend/src/server/studio/conversation-comparison-failure');
  const result=studioComparisonFailureGuidance({...scenario,action:'pricing.compare'} as Extract<StudioActionRequest,{action:'pricing.compare'}>,{...failure,error:{...(failure as Extract<StudioActionResult,{ok:false}>).error,nextAction:{type:'generation_comparison',constraintMismatch:false,durationMismatch:false}}} as Extract<StudioActionResult,{ok:false}>,'en');
  assert.doesNotMatch(result,/do not fit|Choose which matters most/);assert.match(result,/could not|not yet/);
});

test('paid follow-up output is recovered after a cached comparison receipt',async()=>{
  const {studioComparisonAttemptFingerprint}=await import('../frontend/src/server/studio/conversation-comparison-recovery');
  const {AgentApiError}=await import('../frontend/src/server/agent-api/errors');
  const old={...scenario,action:'pricing.compare' as const,filmDurationSec:null};
  const rejected={...failure,error:{...(failure as Extract<StudioActionResult,{ok:false}>).error,nextAction:{type:'generation_comparison',reason:'no_matching_scenario',constraintMismatch:true,referenceFingerprint:'source',catalogFingerprint:'old'}}};
  const indices:number[]=[];
  const draft=await createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:rejected,comparisonAttemptFingerprint:studioComparisonAttemptFingerprint(old)!}]},createResponse:async()=>{throw Error('No new response may be bought');}})({...context,referenceFingerprint:'source',
    checkpoint:async(index,_create,_params,options)=>{indices.push(index);if(index===0)return response(0,old);assert.equal(options?.replayOnly,true);if(index===1)return {...response(1,old),output:[],output_text:JSON.stringify({reply:'La respuesta pagada sigue disponible.'})};throw new AgentApiError('RATE_LIMITED','No further saved response');},
    readCompletedAction:async()=>failure,execute:async()=>failure});
  assert.deepEqual(indices,[0,1]);assert.equal(draft.reply,'La respuesta pagada sigue disponible.');
});

test('a single-clip duration failure cannot suppress a full-film plan',async()=>{
  const previous={...scenario,action:'pricing.compare',settings:[{name:'durationSec',value:60}],filmDurationSec:null};
  const rejected={...failure,error:{...(failure as Extract<StudioActionResult,{ok:false}>).error,nextAction:{type:'generation_comparison',reason:'no_matching_scenario',durationMismatch:true,requestedDurationSec:60,catalogFingerprint:'catalog'}}};
  let reads=0;
  await createStudioConversationDirector({mediaEnabled:true,taskExecution:{...execution,maxCalls:1,previousWork:[{action:'pricing.compare',callId:'old',completed:true,result:rejected,comparison:previous}]},createResponse:async()=>response(0,{...previous,filmDurationSec:60})})({...context,message:'Yes, use the complete-film plan.',comparisonCatalogFingerprint:async()=> 'catalog',execute:async()=>{reads++;return failure;}});
  assert.equal(reads,1);
});
