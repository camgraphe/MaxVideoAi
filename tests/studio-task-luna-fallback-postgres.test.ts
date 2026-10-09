import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
import {chooseStudioAssistance,readStudioAssistanceStatus,reserveStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';

const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
const response=(model:string,id:string)=>({id,model,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Continued from the saved project.'}),output:[]});

test('120 remaining Sol credits automatically continue a complex request with sponsored Luna',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('complex','Keep the approved vertical framing and continue.');await service.enqueue(input);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[actor.userId]);
  const counted:string[]=[],models:string[]=[];
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,
    countInputTokens:async params=>{counted.push(params.model!);return 100;},
    createActionResponse:async params=>{models.push(params.model!);assert.equal(params.max_output_tokens,2200);assert.equal(params.reasoning?.effort,'medium');assert.match(JSON.stringify(params.input),/approved vertical framing/);return response(params.model!,'luna-funded');}}};
  assert.equal(await runStudioTaskWorkerOnce(worker),true);
  const task=await service.read(input.requestId);
  assert.equal(task.state,'completed','Funding should continue with Luna instead of pausing');assert.equal(task.model,'gpt-6-luna');
  assert.equal(task.completedCalls,1);assert.equal(task.consumedCredits,0);assert.equal(task.reservedCredits,0);
  assert.deepEqual(counted,['gpt-6.1-sol','gpt-6-luna'],'Count the actual Luna request before reserving it');assert.deepEqual(models,['gpt-6-luna']);
  const call=(await f.pool.query('SELECT model,mode,charged_cents FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows;
  assert.deepEqual(call,[{model:'gpt-6-luna',mode:'sponsored_luna',charged_cents:0}]);
  assert.equal(Number((await f.pool.query('SELECT consumed_credits FROM studio_assistance_credit_lots WHERE user_id=$1',[actor.userId])).rows[0].consumed_credits),380);
  assert.equal((await f.pool.query('SELECT model FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].model,'gpt-6.1-sol','Keep the original authorization immutable');
  assert.equal((await f.pool.query('SELECT paid_enabled FROM studio_assistance_accounts WHERE user_id=$1',[actor.userId])).rows[0].paid_enabled,false);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(models.length,1,'Polling/retries cannot redispatch');
});

test('a mid-request funding stop keeps the Sol tool result in the Luna context and saves the edit once',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('standard','Remember that the artwork must remain centered.');await service.enqueue(input);
  let counts=0;const models:string[]=[];
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,
    countInputTokens:async()=>{if(++counts===2)await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=480 WHERE user_id=$1',[actor.userId]);return 100;},
    createActionResponse:async params=>{
      models.push(params.model!);
      if(models.length===1)return {...response(params.model!,'sol-memory'),output_text:'',output:[{type:'reasoning' as const,id:'private-sol-reasoning',summary:[],encrypted_content:'opaque-sol-reasoning'},{type:'function_call' as const,id:'fc-sol-memory',status:'completed' as const,name:'project_remember',call_id:'saved-framing',arguments:JSON.stringify({revision:0,brief:'Centered artwork',decisions:['Approved padding; preserve the artwork.'],projectTitle:null})}]};
      assert.equal(params.model,'gpt-6-luna');assert.match(JSON.stringify(params.input),/function_call_output/);assert.match(JSON.stringify(params.input),/Approved padding/);
      assert.doesNotMatch(JSON.stringify(params.input),/opaque-sol-reasoning/);
      assert.doesNotMatch(JSON.stringify(params.input),/fc-sol-memory/);assert.match(JSON.stringify(params.input),/saved-framing/);
      return response(params.model!,'luna-after-memory');
    }}});
  assert.equal((await service.read(input.requestId)).state,'completed');assert.deepEqual(models,['gpt-6.1-sol','gpt-6-luna']);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM studio_conversation_steps WHERE action_json->>'action'='project.remember' AND state='completed'")).rows[0].n,1);
  assert.equal(Number((await f.pool.query('SELECT revision FROM studio_conversation_memory WHERE project_id=$1',[actor.projectId])).rows[0].revision),1);
});

test('resuming a previously paused Sol task with go falls back without changing its frozen model',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('complex');await service.enqueue(input);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[actor.userId]);
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='funding' WHERE request_id=$1",[input.requestId]);
  const approvalId=randomUUID();await service.resume({requestId:input.requestId,approvalId,expectedRevision:0,action:'continue',maxCredits:500,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true});
  const models:string[]=[];
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{models.push(params.model!);return response(params.model!,'resumed-luna');}}});
  assert.equal((await service.read(input.requestId)).state,'completed');assert.deepEqual(models,['gpt-6-luna']);
  assert.equal((await f.pool.query('SELECT request_id FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows[0].request_id,approvalId);
});

test('unknown Sol usage and campaign exhaustion cannot dispatch a Luna replacement',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input();await service.enqueue(input);let calls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;throw new Error('Lost supplier response');}}};
  await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'unknown');assert.equal(calls,1);
  assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(calls,1);
  const other=await f.actor(),second=createStudioTaskService(other,{enabled:true,assistancePolicy:f.policy}),next=f.input('complex');await second.enqueue(next);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[other.userId]);
  await f.pool.query('UPDATE studio_assistance_campaigns SET limit_nano_usd=1');
  await runStudioTaskWorkerOnce({...worker,scope:{...other,requestId:next.requestId}});
  assert.equal((await second.read(next.requestId)).state,'paused');assert.equal(calls,1,'Unavailable sponsored funding stops before the Luna call');
});

test('Luna stays selected for later steps and continuation even if Sol credits become available again',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('quick');await service.enqueue(input);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=480 WHERE user_id=$1',[actor.userId]);
  const models:string[]=[];
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{
    models.push(params.model!);return {...response(params.model!,'luna-read-'+models.length),output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'luna-read-'+models.length,arguments:'{}'}]};
  }}};
  await runStudioTaskWorkerOnce(worker);const paused=await service.read(input.requestId);assert.equal(paused.state,'paused');assert.equal(paused.error,'steps');assert.equal(paused.model,'gpt-6-luna');
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=0 WHERE user_id=$1',[actor.userId]);
  await service.resume({requestId:input.requestId,approvalId:randomUUID(),expectedRevision:paused.revision,action:'continue',maxCredits:100,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true});
  await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{models.push(params.model!);assert.match(JSON.stringify(params.input),/previousWork/);return response(params.model!,'luna-finished');}}});
  assert.equal((await service.read(input.requestId)).state,'completed');assert.deepEqual(models,['gpt-6-luna','gpt-6-luna','gpt-6-luna']);
  assert.equal((await service.read(input.requestId)).consumedCredits,0);
});

test('suspended purchased usage continues with Luna without consuming or resuming a Sol pack',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor();
  await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
  let status=await readStudioAssistanceStatus(actor.userId,f.policy);
  status=await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('complex');await service.enqueue(input);
  await chooseStudioAssistance(actor.userId,{action:'disable_paid',expectedRevision:status.revision},f.policy);
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{assert.equal(params.model,'gpt-6-luna');return response(params.model!,'luna-no-pack');}}});
  assert.equal((await service.read(input.requestId)).state,'completed');status=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.equal(status.paid.enabled,false);assert.equal(status.credits?.purchased.remaining,2000);assert.equal(status.credits?.included.remaining,500);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,1,'Only the explicitly purchased setup pack was debited');
});

test('the ledger refuses a fabricated Luna fallback when the original Sol reservation is fundable',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('complex');await service.enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await assert.rejects(reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:100,outputTokens:2200,lunaFallback:{solBounds:{inputTokens:100,outputTokens:6000}}},f.policy),/still be funded/);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
});

test('a saved Luna response is settled and replayed without a second call after a lost settlement',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('complex');await service.enqueue(input);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[actor.userId]);let calls=0;
  await f.pool.query(`CREATE FUNCTION lose_luna_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled Luna settlement failure'; END; $$;
    CREATE TRIGGER lose_luna_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW WHEN (NEW.model='gpt-6-luna' AND NEW.state='settled') EXECUTE FUNCTION lose_luna_settlement();`);
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{calls++;return response(params.model!,'saved-luna');}}};
  await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'unknown');assert.equal(calls,1);
  await f.pool.query('DROP TRIGGER lose_luna_settlement ON studio_assistance_calls; DROP FUNCTION lose_luna_settlement()');
  await runStudioTaskWorkerOnce({...worker,enabled:false,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{throw new Error('Saved Luna output must not be repurchased');}}});
  assert.equal((await service.read(input.requestId)).state,'completed');assert.equal((await service.read(input.requestId)).model,'gpt-6-luna');assert.equal(calls,1);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE state<>'settled'")).rows[0].n,0);
});

test('Luna tool round trips retain their own reasoning and native function-call identities',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('complex');await service.enqueue(input);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=380 WHERE user_id=$1',[actor.userId]);let calls=0;
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{
    assert.equal(params.model,'gpt-6-luna');
    if(++calls===1)return {...response(params.model!,'luna-with-tool'),output_text:'',output:[{type:'reasoning' as const,id:'luna-thinking',summary:[],encrypted_content:'luna-opaque'},{type:'function_call' as const,id:'fc-luna-read',status:'completed' as const,name:'project_read',call_id:'luna-project-read',arguments:'{}'}]};
    assert.match(JSON.stringify(params.input),/luna-opaque/);assert.match(JSON.stringify(params.input),/fc-luna-read/);assert.match(JSON.stringify(params.input),/function_call_output/);
    return response(params.model!,'luna-roundtrip-done');
  }}});
  assert.equal((await service.read(input.requestId)).state,'completed');assert.equal(calls,2);
});

test('zero Sol credits allow sending a task when the enabled worker can continue with sponsored Luna',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('complex');await service.enqueue(input);
  const flags=['STUDIO_CONVERSATION_TASKS_ENABLED','STUDIO_CONVERSATION_ACTIONS_ENABLED','STUDIO_ASSISTANCE_ENABLED'] as const;
  const previous=flags.map(flag=>process.env[flag]);for(const flag of flags)process.env[flag]='true';
  t.after(async()=>{for(const [index,flag] of flags.entries()){if(previous[index]===undefined)delete process.env[flag];else process.env[flag]=previous[index];}});
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1',[actor.userId]);
  const status=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.equal(status.selectedModel,'gpt-6.1-sol');assert.equal(status.credits?.included.remaining,0);assert.equal(status.canContinue,true,'Do not block the composer before it reaches the fallback worker');assert.equal(status.blockedReason,null);
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{assert.equal(params.model,'gpt-6-luna');return response(params.model!,'zero-credit-luna');}}});
  assert.equal((await service.read(input.requestId)).state,'completed');
  process.env.STUDIO_CONVERSATION_TASKS_ENABLED='false';
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).canContinue,false,'Disabled task execution cannot advertise automatic Luna assistance');
});
