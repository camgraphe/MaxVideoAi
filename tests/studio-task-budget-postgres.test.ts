import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {reserveStudioAssistanceCall,settleStudioAssistanceCall,readStudioAssistanceStatus,chooseStudioAssistance,openStudioAssistanceTurn} from '../frontend/src/server/studio/assistance-ledger';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
import {stableJson} from '../frontend/src/server/agent-api/generation-normalization';

test('task enqueue freezes authorization; exact budgets constrain the existing credit ledger',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor();
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input(),task=await service.enqueue(input);
  assert.equal(task.state,'queued');assert.equal(task.maxCredits,250);assert.equal(task.model,'gpt-6.1-sol');
  assert.equal((await service.enqueue(input)).requestId,task.requestId);
  await assert.rejects(service.enqueue({...input,message:'Changed intent'}),/identity|request/i);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0,'Enqueue cannot dispatch or reserve');
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
  await assert.rejects(service.enqueue(f.input()),/previous|active|finish/i);
  await assert.rejects(createStudioTaskService({...actor,userId:'foreign'},{enabled:true,assistancePolicy:f.policy}).read(task.requestId),/available|project/i);
  const selection=await readStudioAssistanceStatus(actor.userId,f.policy);
  await chooseStudioAssistance(actor.userId,{action:'select_luna',expectedRevision:selection.revision},f.policy);
  assert.equal((await service.read(task.requestId)).model,'gpt-6.1-sol','Changing UI model cannot change a queued task');
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='steps' WHERE request_id=$1",[task.requestId]);
  const approval={requestId:task.requestId,approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true};
  const resumed=await Promise.all([service.resume(approval),service.resume(approval)]);
  assert.ok(resumed.every(r=>r.state==='queued'&&r.allowedCalls===8&&r.maxCredits===250));
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_task_approvals')).rows[0].n,1);
  await assert.rejects(service.resume({...approval,maxCredits:350}),/identity|ceiling|approval/i);
  await f.pool.query("UPDATE studio_tasks SET state='completed',phase='done' WHERE request_id=$1",[task.requestId]);
  await assert.rejects(service.resume({...approval,approvalId:randomUUID(),expectedRevision:1}),/completed|paused|resume/i);
  const a=await f.actor(),quick=createStudioTaskService(a,{enabled:true,assistancePolicy:f.policy}),q=await quick.enqueue(f.input('quick'));
  const lease=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '3 minutes' WHERE request_id=$1",[q.requestId,lease]);
  await assert.rejects(reserveStudioAssistanceCall({...a,requestId:q.requestId,leaseId:lease,index:0,inputTokens:12000,outputTokens:2200},f.policy),/ceiling|budget/i);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1',[a.userId])).rows[0].n,0,'Conservative quote over ceiling stops before dispatch');
  const call=await reserveStudioAssistanceCall({...a,requestId:q.requestId,leaseId:lease,index:0,inputTokens:1000,outputTokens:2200},f.policy);
  await settleStudioAssistanceCall(call.id,a.userId,{id:'quick-reply',model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:100}});
  const read=await quick.read(q.requestId);assert.equal(read.consumedCredits,10);assert.equal(read.reservedCredits,0);
  await assert.rejects(reserveStudioAssistanceCall({...a,requestId:q.requestId,leaseId:lease,index:2,inputTokens:10,outputTokens:100},f.policy),/call|step|limit/i);
  await assert.rejects(reserveStudioAssistanceCall({...a,requestId:q.requestId,leaseId:randomUUID(),index:1,inputTokens:10,outputTokens:100},f.policy),/worker|lease|superseded/i);
  const b=await f.actor(),complex=createStudioTaskService(b,{enabled:true,assistancePolicy:f.policy}),c=await complex.enqueue(f.input('complex'));
  const complexLease=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '10 minutes' WHERE request_id=$1",[c.requestId,complexLease]);
  const expanded=await reserveStudioAssistanceCall({...b,requestId:c.requestId,leaseId:complexLease,index:4,inputTokens:10,outputTokens:6000},f.policy);
  assert.equal(expanded.output_token_bound,6000);assert.equal(expanded.response_index,4);
  const legacy=await f.actor(),legacyId=randomUUID();await openStudioAssistanceTurn(legacy,legacyId,f.policy);
  await assert.rejects(reserveStudioAssistanceCall({...legacy,requestId:legacyId,leaseId:randomUUID(),index:4,inputTokens:10,outputTokens:6000},f.policy),/bound|limit/i);
  await assert.rejects(f.pool.query(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents)
    VALUES($1,$2,$3,$4,$5,4,'gpt-6.1-sol','included_sol','studio-credits-2026-10-05-v2','openai-standard-global-2026-10-03','studio-sol-usd-2026-10-05-v2',10,6000,1,0)`,[randomUUID(),legacy.userId,legacy.projectId,legacyId,randomUUID()]),/owned task policy/,'SQL capacity expansion cannot relax legacy authorization');
  await assert.rejects(f.pool.query("UPDATE studio_tasks SET profile_json=profile_json||'{\"maxOutputTokens\":128000}' WHERE request_id=$1",[c.requestId]),/immutable/);
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='steps' WHERE request_id=$1",[q.requestId]);
  const next={requestId:q.requestId,approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:100,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true};
  await quick.resume(next);
  const nextLease=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '3 minutes' WHERE request_id=$1",[q.requestId,nextLease]);
  await assert.rejects(reserveStudioAssistanceCall({...a,requestId:next.approvalId,leaseId:nextLease,index:0,inputTokens:10000,outputTokens:2200},f.policy),/ceiling|budget/,'Continuation includes the previous segment consumption');
  await assert.rejects(reserveStudioAssistanceCall({...a,requestId:q.requestId,leaseId:nextLease,index:1,inputTokens:10,outputTokens:100},f.policy),/segment|superseded|lease/,'An old closed segment cannot acquire new calls');
});

test('paid Sol has a raised hourly allowance but purchased-credit suspension remains effective',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  for(let i=0;i<20;i++)await f.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,state,lease_id,lease_expires_at)
    VALUES($1,$2,$3,$4,'{"message":"Prior request","references":[]}','{"reply":"Saved reply","image":null}',$4,'ready',$5,now())`,[actor.userId,actor.projectId,randomUUID(),'a'.repeat(64),randomUUID()]);
  await assert.rejects(service.enqueue(f.input()),/hourly/);
  await f.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',200,'USD')",[actor.userId]);
  let status=await readStudioAssistanceStatus(actor.userId,f.policy);
  status=await chooseStudioAssistance(actor.userId,{action:'purchase_pack',amountCents:200,tariffVersion:status.tariff.version,expectedRevision:status.revision,purchaseKey:randomUUID()},f.policy);
  const task=await service.enqueue(f.input());assert.equal(task.state,'queued','Paid Sol can pass the old twenty-message ceiling');
  await f.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=total_credits WHERE user_id=$1 AND kind='included'",[actor.userId]);
  status=await chooseStudioAssistance(actor.userId,{action:'disable_paid',expectedRevision:status.revision},f.policy);
  const lease=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[task.requestId,lease]);
  await assert.rejects(reserveStudioAssistanceCall({...actor,requestId:task.requestId,leaseId:lease,index:0,inputTokens:100,outputTokens:100},f.policy),/Resume purchased Milo credits/);
  assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).paid.enabled,false);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows[0].n,0);
  await f.pool.query("INSERT INTO user_account_restrictions(user_id,reason,active) VALUES($1,'controlled',true)",[actor.userId]);
  await assert.rejects(service.enqueue(f.input()),/restricted/);
});

test('adaptive input reservations stop at 128k under all three funding policies', async t => {
  const f = await studioTaskFixture(t);
  for (const [action, model, outputTokens] of [
    ['select_luna', 'gpt-6-luna', 32_000],
    ['select_terra', 'gpt-6.1-terra', 6_000],
    ['select_sol', 'gpt-6.1-sol', 6_000],
  ] as const) {
    const actor = await f.actor();
    await chooseStudioAssistance(actor.userId, {action, expectedRevision:0}, f.policy);
    const service = createStudioTaskService(actor, {enabled:true, assistancePolicy:f.policy});
    const task = await service.enqueue(f.input());
    const leaseId = randomUUID();
    await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[task.requestId,leaseId]);
    const bounds = {...actor, requestId:task.requestId, leaseId, index:0, outputTokens, allowCreditCompletion:true};
    await assert.rejects(reserveStudioAssistanceCall({...bounds, inputTokens:128_001}, f.policy), /context/);
    const call = await reserveStudioAssistanceCall({...bounds, inputTokens:128_000}, f.policy);
    assert.equal(call.model, model);
    assert.equal(call.input_token_bound, 128_000);
    assert.equal(call.output_token_bound, outputTokens);
    await assert.rejects(f.pool.query(`INSERT INTO studio_assistance_calls
      SELECT (jsonb_populate_record(NULL::studio_assistance_calls, to_jsonb(c)
        || jsonb_build_object('id',$2::uuid,'response_index',1,'input_token_bound',128001))).*
      FROM studio_assistance_calls c WHERE c.id=$1`,[call.id,randomUUID()]), /Task resource bound/);
    const response = {id:randomUUID(),model,service_tier:'default',usage:{input_tokens:128_000,input_tokens_details:{cached_tokens:0},output_tokens:outputTokens}};
    await settleStudioAssistanceCall(call.id, actor.userId, response);
    await settleStudioAssistanceCall(call.id, actor.userId, response);
    const settled = await service.read(task.requestId);
    assert.equal(settled.completedCalls, 1);
    assert.equal(settled.consumedCredits, model === 'gpt-6-luna' ? 0 : 250);
    assert.equal(settled.reservedCredits, 0);
    const saved = (await f.pool.query('SELECT campaign_id, pricing_snapshot, charged_cents FROM studio_assistance_calls WHERE id=$1',[call.id])).rows[0];
    assert.ok(saved.campaign_id);
    if (model !== 'gpt-6-luna') {
      assert.equal(saved.pricing_snapshot.creditCompletion.customerCapCents, 25);
      assert.ok(saved.pricing_snapshot.creditCompletion.giftCents > 0);
    }
    assert.equal((await f.pool.query("SELECT count(*)::int AS n FROM app_receipts WHERE user_id=$1 AND type='charge'",[actor.userId])).rows[0].n, 0);
  }
});

test('replayed v4 tasks keep their 24k input ceiling across continuation segments', async t => {
  const f = await studioTaskFixture(t);
  for (const explicitLiteChoice of [true, undefined]) {
    const actor = await f.actor();
    const input = f.input();
    const profile = {maxCredits:250, maxCalls:4, maxOutputTokens:6000, maxInputTokens:24_000, deadlineSec:300, historyTurns:8, reasoning:'xhigh', explicitLiteChoice};
    const hash = (value:unknown) => createHash('sha256').update(stableJson(value)).digest('hex');
    await openStudioAssistanceTurn(actor, input.requestId, f.policy);
    await f.pool.query(`INSERT INTO studio_tasks(user_id,project_id,request_id,segment_request_id,input_hash,input_json,source_fingerprint,policy_version,profile,profile_json,model,max_credits,allowed_calls,state,phase,error)
      VALUES($1,$2,$3,$3,$4,$5,$6,$7,'standard',$8,'gpt-6.1-sol',250,4,'paused','paused','steps')`,[actor.userId,actor.projectId,input.requestId,hash(input),input,hash([]),STUDIO_TASK_POLICY_VERSION,profile]);
    await f.pool.query('INSERT INTO studio_task_segments(user_id,project_id,task_request_id,request_id,max_calls) VALUES($1,$2,$3,$3,4)',[actor.userId,actor.projectId,input.requestId]);
    const service = createStudioTaskService(actor, {enabled:true, assistancePolicy:f.policy});
    assert.equal((await service.enqueue(input)).state, 'paused');
    const approvalId = randomUUID();
    await service.resume({requestId:input.requestId,approvalId,expectedRevision:0,action:'continue',confirmed:true,maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION});
    const leaseId = randomUUID();
    await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
    const bounds = {...actor,requestId:approvalId,leaseId,index:0,outputTokens:100};
    await assert.rejects(reserveStudioAssistanceCall({...bounds,inputTokens:24_001},f.policy), /context/);
    assert.equal((await reserveStudioAssistanceCall({...bounds,inputTokens:24_000},f.policy)).input_token_bound, 24_000);
  }
});
