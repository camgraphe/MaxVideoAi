import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createLegacyTaskService as createStudioTaskService} from './helpers/legacy-task-service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import type {StudioResponseCreator} from '../frontend/src/server/studio/conversation-director';
import {chooseStudioAssistance,readStudioAssistanceStatus,reserveStudioAssistanceCall,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';

const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
const response=(model:string,outputTokens:number)=>({id:randomUUID(),model,status:'completed' as const,service_tier:'default',usage:{input_tokens:8000,input_tokens_details:{cached_tokens:0},output_tokens:outputTokens},output_text:JSON.stringify({reply:'Here is your finished direction.'}),output:[]});

for(const remaining of [40,10])for(const purchased of [false,true]){
  test(`${remaining} ${purchased?'purchased':'included'} credits fund a full Max answer down to zero`,async t=>{
    const f=await studioTaskFixture(t),actor=await f.actor();
    if(purchased){
      await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
      const status=await readStudioAssistanceStatus(actor.userId,f.policy);
      await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
    }
    const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard','Describe a clean opening shot.');
    await service.enqueue(input);
    await f.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=total_credits-CASE WHEN kind=$2 THEN $3 ELSE 0 END WHERE user_id=$1",[actor.userId,purchased?'purchased':'included',remaining]);
    let calls=0;
    const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>8000,createActionResponse:async(params:Parameters<StudioResponseCreator>[0])=>{
      calls++;assert.equal(params.model,'gpt-6.1-sol','A small positive balance should still buy Max assistance');
      assert.equal(params.max_output_tokens,6000);
      const stored=(await f.pool.query('SELECT output_token_bound FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows[0];
      assert.equal(stored.output_token_bound,params.max_output_tokens,'Dispatch and durable reservation must use the same limit');
      return response(params.model!,params.max_output_tokens!);
    }}};
    await runStudioTaskWorkerOnce(worker);
    const task=await service.read(input.requestId),balance=await readStudioAssistanceStatus(actor.userId,f.policy);
    assert.equal(task.state,'completed');assert.equal(task.consumedCredits,remaining);
    assert.equal(balance.credits?.included.remaining,0);assert.equal(balance.credits?.purchased.remaining,0);assert.equal(balance.unresolvedCalls,0);
    const funding=(await f.pool.query('SELECT f.*,c.pricing_snapshot,c.campaign_id,c.reserved_nano_usd FROM studio_assistance_credit_funding f JOIN studio_assistance_calls c ON c.id=f.call_id WHERE c.user_id=$1',[actor.userId])).rows[0];
    assert.equal(funding.quoted_cents,remaining/10);assert.equal(funding.charged_cents,remaining/10);
    assert.equal(funding.pricing_snapshot.creditCompletion.giftCents,16-remaining/10);
    assert.equal(funding.reserved_sponsored_nano_usd,funding.reserved_nano_usd);assert.ok(funding.campaign_id);
    assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,purchased?1:0,'Completion never purchases or debits the wallet');
    assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(calls,1);
  });
}

test('a full last Max output can finish with Lite without executing its incomplete tool call',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard','Help develop the opening shot.');
  await service.enqueue(input);await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=460 WHERE user_id=$1',[actor.userId]);
  const models:string[]=[];
  await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>8000,createActionResponse:async params=>{
    models.push(params.model!);
    if(models.length===1){
      assert.equal(params.model,'gpt-6.1-sol');assert.equal(params.max_output_tokens,6000);
      return {...response(params.model!,6000),status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'',output:[{type:'function_call',name:'project_remember',call_id:'incomplete-memory',arguments:'{"revision":0'}]};
    }
    assert.equal(params.model,'gpt-6-luna');assert.equal(params.max_output_tokens,2200);
    assert.doesNotMatch(JSON.stringify(params.input),/incomplete-memory/);
    return response(params.model!,50);
  }}});
  assert.deepEqual(models,['gpt-6.1-sol','gpt-6-luna']);
  const task=await service.read(input.requestId);assert.equal(task.state,'completed');assert.equal(task.consumedCredits,40);assert.equal(task.reservedCredits,0);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_conversation_steps')).rows[0].n,0);
});

test('last credits are locked once and unused output is returned at actual settlement',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),input=f.input();
  await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=460 WHERE user_id=$1',[actor.userId]);
  const attempts=await Promise.allSettled([0,1].map(index=>reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy)));
  const accepted=attempts.filter((r):r is PromiseFulfilledResult<Awaited<ReturnType<typeof reserveStudioAssistanceCall>>>=>r.status==='fulfilled');
  assert.equal(accepted.length,1,'Concurrent requests cannot spend the same final credits');
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.reserved,40);
  const saved={...response('gpt-6.1-sol',50),usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50}};
  await settleStudioAssistanceCall(accepted[0].value.id,actor.userId,saved);
  await settleStudioAssistanceCall(accepted[0].value.id,actor.userId,saved);
  const balance=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.equal(balance.credits?.included.remaining,30,'Reserve does not force consumption of unused credits');assert.equal(balance.credits?.included.reserved,0);
});

test('the final response fits the remaining task ceiling as well as the account balance',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),input=f.input(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  await service.enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  const scope={...actor,requestId:input.requestId,leaseId};
  for(let index=0;index<2;index++){
    const call=await reserveStudioAssistanceCall({...scope,index,inputTokens:24000,outputTokens:0},f.policy);
    await settleStudioAssistanceCall(call.id,actor.userId,{...response('gpt-6.1-sol',0),usage:{input_tokens:24000,input_tokens_details:{cached_tokens:0},output_tokens:0}});
  }
  assert.equal((await service.read(input.requestId)).consumedCredits,240);
  const final=await reserveStudioAssistanceCall({...scope,index:2,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy);
  assert.equal(final.output_token_bound,2200);
  await settleStudioAssistanceCall(final.id,actor.userId,response('gpt-6.1-sol',2200));
  assert.equal((await service.read(input.requestId)).consumedCredits,250,'The existing ceiling is respected exactly');
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.remaining,250);
  const finish=await reserveStudioAssistanceCall({...scope,index:3,inputTokens:8000,outputTokens:2200,lunaFallback:{solBounds:{inputTokens:8000,outputTokens:2200,allowCreditCompletion:true}}},f.policy);
  assert.equal(finish.model,'gpt-6-luna','Standard can finish at the customer task ceiling');
  await settleStudioAssistanceCall(finish.id,actor.userId,response('gpt-6-luna',50));
  assert.equal((await service.read(input.requestId)).consumedCredits,250);
});

test('recovery of a saved sponsored Max response settles once before Standard finishes',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input('standard','Develop the scene.');
  await service.enqueue(input);await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=460 WHERE user_id=$1',[actor.userId]);
  await f.pool.query(`CREATE FUNCTION lose_final_credit_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled settlement failure'; END; $$;
    CREATE TRIGGER lose_final_credit_settlement BEFORE UPDATE ON studio_assistance_credit_funding FOR EACH ROW EXECUTE FUNCTION lose_final_credit_settlement();`);
  let maxCalls=0,lunaCalls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>8000,createActionResponse:(async params=>{
    if(params.model==='gpt-6.1-sol'){
      maxCalls++;assert.equal(maxCalls,1,'The saved Max output must not be repurchased');
      return {...response(params.model!,params.max_output_tokens!),status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output_text:'',output:[]};
    }
    lunaCalls++;return response(params.model!,50);
  }) as StudioResponseCreator}};
  await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'unknown');assert.equal(maxCalls,1);assert.equal(lunaCalls,0);
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.reserved,40);
  await f.pool.query('DROP TRIGGER lose_final_credit_settlement ON studio_assistance_credit_funding; DROP FUNCTION lose_final_credit_settlement()');
  await runStudioTaskWorkerOnce(worker);
  const task=await service.read(input.requestId);assert.equal(task.state,'completed');assert.equal(task.consumedCredits,40);assert.equal(maxCalls,1);assert.equal(lunaCalls,1);
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.remaining,0);
});


test('a credit gift is never charged back after a pack purchase and same-ceiling continuation',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),input=f.input(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  await service.enqueue(input);
  let leaseId=randomUUID();
  const ownLease=()=>f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await ownLease();await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=460 WHERE user_id=$1',[actor.userId]);
  const first=await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy);
  await settleStudioAssistanceCall(first.id,actor.userId,response('gpt-6.1-sol',2200));
  assert.equal((await service.read(input.requestId)).consumedCredits,40);
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='deadline' WHERE request_id=$1",[input.requestId]);
  await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
  const status=await readStudioAssistanceStatus(actor.userId,f.policy);
  await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
  const approvalId=randomUUID();
  await service.resume({requestId:input.requestId,approvalId,expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true});
  leaseId=randomUUID();await ownLease();
  const second=await reserveStudioAssistanceCall({...actor,requestId:approvalId,leaseId,index:0,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy);
  await settleStudioAssistanceCall(second.id,actor.userId,response('gpt-6.1-sol',2200));
  const balance=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.equal(balance.credits?.purchased.remaining,1920,'Only the new cumulative increment is charged; the 50-credit gift stays gifted');
  assert.equal((await service.read(input.requestId)).consumedCredits,120);
});

test('purchased-only completion cannot bypass sponsored campaign availability',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor();
  await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
  const status=await readStudioAssistanceStatus(actor.userId,f.policy);
  await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
  const input=f.input();await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await f.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=total_credits-CASE WHEN kind='purchased' THEN 40 ELSE 0 END WHERE user_id=$1",[actor.userId]);
  await f.pool.query('UPDATE studio_assistance_campaigns SET limit_nano_usd=1');
  await assert.rejects(reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy),/temporarily unavailable/);
  const balance=await readStudioAssistanceStatus(actor.userId,f.policy);
  assert.equal(balance.credits?.purchased.remaining,40);assert.equal(balance.credits?.purchased.reserved,0);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
});

test('invalid completion evidence cannot consume credits or silently change the saved funding cap',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),input=f.input();
  await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=460 WHERE user_id=$1',[actor.userId]);
  const call=await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy);
  const valid={version:1,customerCapCents:4,maximumIncrementCents:9};
  for(const invalid of [{...valid,version:2},{...valid,customerCapCents:5},{...valid,accountedIncrementCents:9,giftCents:0},{...valid,maximumIncrementCents:5}]){
    await f.pool.query('UPDATE studio_assistance_calls SET pricing_snapshot=$2::jsonb WHERE id=$1',[call.id,JSON.stringify({creditCompletion:invalid})]);
    await assert.rejects(settleStudioAssistanceCall(call.id,actor.userId,response('gpt-6.1-sol',2200)),/authorization|sponsorship/);
    const funding=(await f.pool.query('SELECT quoted_cents,charged_cents FROM studio_assistance_credit_funding WHERE call_id=$1',[call.id])).rows[0];
    assert.equal(funding.quoted_cents,4);assert.equal(funding.charged_cents,null);
    assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.reserved,40);
  }
  await f.pool.query('UPDATE studio_assistance_calls SET pricing_snapshot=$2::jsonb WHERE id=$1',[call.id,JSON.stringify({creditCompletion:valid})]);
  await settleStudioAssistanceCall(call.id,actor.userId,response('gpt-6.1-sol',2200));
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.included.remaining,0);
});

test('completion evidence cannot invent campaign funding for an ordinary purchased call',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor();
  await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
  const status=await readStudioAssistanceStatus(actor.userId,f.policy);
  await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
  const input=f.input();await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  await f.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=total_credits WHERE user_id=$1 AND kind='included'",[actor.userId]);
  const call=await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:8000,outputTokens:2200,allowCreditCompletion:true},f.policy);
  await f.pool.query('UPDATE studio_assistance_calls SET pricing_snapshot=$2::jsonb WHERE id=$1',[call.id,JSON.stringify({creditCompletion:{version:1,customerCapCents:9,maximumIncrementCents:10}})]);
  await assert.rejects(settleStudioAssistanceCall(call.id,actor.userId,response('gpt-6.1-sol',2200)),/sponsorship/);
  assert.equal((await f.pool.query('SELECT charged_cents FROM studio_assistance_credit_funding WHERE call_id=$1',[call.id])).rows[0].charged_cents,null);
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).credits?.purchased.reserved,90);
});
