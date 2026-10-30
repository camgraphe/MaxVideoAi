import assert from 'node:assert/strict';
import test from 'node:test';

test('new task levels use high/high/xhigh without reinterpreting frozen v1/v2 requests',async()=>{
 const tasks=await import('../frontend/src/lib/studio/task-budget-contract');
 for(const [model,reasoning] of [['gpt-6-luna','high'],['gpt-6.1-terra','high'],['gpt-6.1-sol','xhigh']] as const){
  const selection=tasks.studioTaskSelectionSchema.parse({profile:'standard',maxCredits:250,policyVersion:tasks.STUDIO_TASK_POLICY_VERSION,model});
  const profile=tasks.studioTaskProfileForModel(selection,model as never);
  assert.equal(profile.reasoning,reasoning);assert.equal(profile.maxOutputTokens,6000);
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
  const params=promptResponseParams(row as never,{} as never,[]);assert.equal(params.reasoning?.effort,effort);assert.equal(params.max_output_tokens,6000);
  const director=createStudioConversationDirector({model,runtimePolicy:row.runtime_policy,createResponse:async request=>{assert.equal(request.reasoning?.effort,effort);assert.equal(request.max_output_tokens,6000);return {id:'reply',model,status:'completed',service_tier:'default',usage:undefined,output:[],output_text:JSON.stringify({reply:'A slow camera movement.'})};}});
  await director({message:'Help refine the scene',history:[],references:[],project:{name:'Scene',revision:0,memory:{revision:0,brief:'',decisions:[]},generations:[]},checkpoint:async(_index,create)=>create(),execute:async()=>{throw new Error('Unexpected tool');}});
 }
 const old=promptResponseParams({model:'gpt-6.1-sol',input_json:{draft:{},message:'Old request'}} as never,{} as never,[]);assert.equal(old.reasoning?.effort,'medium');assert.equal(old.max_output_tokens,2200);
});
