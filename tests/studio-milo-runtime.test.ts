import assert from 'node:assert/strict';
import test from 'node:test';
import {studioProviderReservation} from '../frontend/src/server/studio/assistance-provider-facts';

test('expanded Lite reservations retain per-model and frozen approval ceilings',()=>{
 assert.equal(studioProviderReservation('gpt-6-luna',22168,32000,32000),18771000);
 for(const [model,output,bound] of [['gpt-6-luna',32001,32000],['gpt-6-luna',32000,6000],['gpt-6.1-sol',32000,32000],['gpt-6.1-terra',32000,32000]] as const){
  assert.throws(()=>studioProviderReservation(model,1000,output,bound),/Invalid Studio token bounds/);
 }
});

test('new task levels use high/high/xhigh without reinterpreting frozen v1/v2 requests',async()=>{
 const tasks=await import('../frontend/src/lib/studio/task-budget-contract');
 for(const [model,reasoning] of [['gpt-6-luna','high'],['gpt-6.1-terra','high'],['gpt-6.1-sol','xhigh']] as const){
  const selection=tasks.studioTaskSelectionSchema.parse({profile:'standard',maxCredits:250,policyVersion:tasks.STUDIO_TASK_POLICY_VERSION,model});
  const profile=tasks.studioTaskProfileForModel(selection,model as never);
  assert.equal(profile.reasoning,reasoning);assert.equal(profile.maxOutputTokens,model==='gpt-6-luna'?32000:6000);
 }
 for(const model of ['gpt-6-luna','gpt-6.1-terra','gpt-6.1-sol'] as const){
  const old=tasks.studioTaskSelectionSchema.parse({profile:'standard',maxCredits:250,policyVersion:'studio-task-budget-2026-10-29-v3',model});
  assert.equal(tasks.studioTaskProfileForModel(old,model).maxOutputTokens,6000,'Previously approved v3 requests must retain their exact output allowance.');
 }
 for(const policyVersion of ['studio-task-budget-2026-10-06-v1','studio-task-budget-2026-10-11-v2']){
  const selection=tasks.studioTaskSelectionSchema.parse({profile:'standard',maxCredits:250,policyVersion});
  const profile=tasks.studioTaskProfileForModel(selection,'gpt-6.1-sol');assert.equal(profile.reasoning,'medium');assert.equal(profile.maxOutputTokens,2200);
 }
});

test('Studio and composer send the same three exact API reasoning efforts',async()=>{
 const {studioMiloRuntime}=await import('../frontend/src/lib/studio/assistance-contract');
 const {promptResponseParams}=await import('../frontend/src/server/prompt-assistance/provider');
 const {createStudioConversationDirector}=await import('../frontend/src/server/studio/conversation-director');
 for(const [model,effort] of [['gpt-6-luna','high'],['gpt-6.1-terra','high'],['gpt-6.1-sol','xhigh']] as const){
  const row={model,runtime_policy:studioMiloRuntime(model),input_json:{draft:{target:'prompt',text:'A dancer',settings:{}},message:'Slow motion',locale:'en'}};
  const bound=model==='gpt-6-luna'?32000:6000;
  const params=promptResponseParams(row as never,{} as never,[]);assert.equal(params.reasoning?.effort,effort);assert.equal(params.max_output_tokens,bound);
  const director=createStudioConversationDirector({model,runtimePolicy:row.runtime_policy,createResponse:async request=>{assert.equal(request.reasoning?.effort,effort);assert.equal(request.max_output_tokens,bound);return {id:'reply',model,status:'completed',service_tier:'default',usage:undefined,output:[],output_text:JSON.stringify({reply:'A slow camera movement.'})};}});
  await director({message:'Help refine the scene',history:[],references:[],project:{name:'Scene',revision:0,memory:{revision:0,brief:'',decisions:[]},generations:[]},checkpoint:async(_index,create)=>create(),execute:async()=>{throw new Error('Unexpected tool');}});
 }
 const old=promptResponseParams({model:'gpt-6.1-sol',input_json:{draft:{},message:'Old request'}} as never,{} as never,[]);assert.equal(old.reasoning?.effort,'medium');assert.equal(old.max_output_tokens,2200);
 const frozen=promptResponseParams({model:'gpt-6-luna',runtime_policy:{version:'milo-levels-2026-10-29-v1',reasoning:'high',maxOutputTokens:6000},input_json:{draft:{},message:'Frozen request'}} as never,{} as never,[]);
 assert.equal(frozen.max_output_tokens,6000);assert.equal(frozen.reasoning?.effort,'high');
});
