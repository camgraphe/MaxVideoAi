import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {STUDIO_ASSISTANCE_TARIFF,STUDIO_ASSISTANCE_CREDIT_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {readStudioAssistanceStatus,chooseStudioAssistance,openStudioAssistanceTurn,reserveStudioAssistanceCall,settleStudioAssistanceCall,markStudioAssistanceUnknown} from '../frontend/src/server/studio/assistance-ledger';
import {inspectStudioAssistanceResolution,applyStudioAssistanceResolution} from '../frontend/src/server/studio/assistance-resolution';
import {checkpointStudioResponse} from '../frontend/src/server/studio/conversation-run-repository';
import {claimImageTurn,failImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import type {StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import type {StudioGenerationActor} from '../frontend/src/server/agent-api/generation-actor';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

const legacyVersion='studio-beta-2026-10-03-v1',creditVersion='studio-credits-2026-10-05-v2';
const env={NODE_ENV:'production',STUDIO_ASSISTANCE_ENABLED:'true'};
const response=(id:string):StudioDirectorResponse=>({id,model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output:[],output_text:JSON.stringify({reply:'Review the current assistance terms.'})});

test('real v1 calls, paid checkpoints and support survive delivery before migration 63; v2 stays separately consented',async t=>{
  assert.equal(process.env.DATABASE_URL,undefined,'Only disposable PostgreSQL is allowed.');
  const pg=await startDisposablePostgres('studio-policy-compat');
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();delete process.env.DATABASE_URL;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY)');
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const legacy=studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:legacyVersion});
  // Explicit old persisted rows reproduce the production version; creating them through
  // the new open-turn owner would hide a global-version regression.
  async function seedOldCall(userId:string,saved?:StudioDirectorResponse){
    const actor:StudioGenerationActor={userId,projectId:userId+'-film',authMethod:'studio-session',clientId:null};
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,'Legacy film')",[actor.projectId,userId]);
    await pg.pool.query("INSERT INTO studio_assistance_accounts(user_id,paid_enabled,paid_authorized_cents,tariff_version,sol_limit_nano_usd,luna_limit_nano_usd) VALUES($1,true,100,$2,1000000000,250000000)",[userId,STUDIO_ASSISTANCE_TARIFF.version]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')",[userId]);
    const input={requestId:randomUUID(),message:'Continue my existing paid message.',references:[]};
    const {turn}=await claimImageTurn(actor,input);
    await pg.pool.query("INSERT INTO studio_assistance_turns(user_id,project_id,request_id,model,mode,policy_version,tariff_version,tariff_snapshot) VALUES($1,$2,$3,'gpt-6.1-sol','paid_sol',$4,$5,$6::jsonb)",[userId,actor.projectId,input.requestId,legacyVersion,STUDIO_ASSISTANCE_TARIFF.version,JSON.stringify(STUDIO_ASSISTANCE_TARIFF)]);
    if(saved)await checkpointStudioResponse(actor,turn,0,async()=>saved);
    const callId=randomUUID();
    const receipt=(await pg.pool.query<{id:string}>("INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id,surface,billing_product_key) VALUES($1,'charge',8,'USD',$2,'tool','studio_assistance') RETURNING id::text",[userId,'studio-assistance:'+callId])).rows[0];
    await pg.pool.query(`INSERT INTO studio_assistance_calls(id,user_id,project_id,request_id,lease_id,response_index,model,mode,policy_version,rate_version,tariff_version,input_token_bound,output_token_bound,reserved_nano_usd,reserved_cents,charge_receipt_id,state)
      VALUES($1,$2,$3,$4,$5,0,'gpt-6.1-sol','paid_sol',$6,'openai-standard-global-2026-10-03',$7,1000,2200,24500000,8,$8,'unknown')`,[callId,userId,actor.projectId,input.requestId,turn.lease_id,legacyVersion,STUDIO_ASSISTANCE_TARIFF.version,receipt.id]);
    await failImageTurn(actor,turn);
    return {actor,input,callId};
  }
  const tool={...response('old-paid-read'),output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'old-read-once',arguments:'{}'}]};
  const old=await seedOldCall('old-client',tool);
  let newResponses=0,tokenCounts=0;
  const service=createImageConversationService(old.actor,{enabled:true,actionsEnabled:true,assistancePolicy:legacy,
    countInputTokens:async()=>{tokenCounts++;return 1000;},createActionResponse:async params=>{
      newResponses++;assert.match(String(params.instructions),/one-time.*allowance|allowance.*one-time/);
      assert.doesNotMatch(String(params.instructions),/monthly free credits|no monthly quota/);
      return response('new-v1-followup');
    }});

  await t.test('v1 status and controls execute on 54/62 only and cannot buy a v2 pack',async()=>{
    const status=await readStudioAssistanceStatus(old.actor.userId,legacy);
    assert.equal(status.enabled,true);assert.equal(status.policyVersion,legacyVersion);assert.equal(status.paid.enabled,true);assert.equal(status.credits,undefined);
    assert.equal(status.tariff.version,STUDIO_ASSISTANCE_TARIFF.version);
    await assert.rejects(chooseStudioAssistance(old.actor.userId,{action:'purchase_pack',amountCents:200,purchaseKey:randomUUID(),expectedRevision:0,tariffVersion:STUDIO_ASSISTANCE_CREDIT_TARIFF.version},legacy),/Credit packs are unavailable/);
    assert.equal((await pg.pool.query<{table:string|null}>("SELECT to_regclass('studio_assistance_credit_lots')::text AS table")).rows[0].table,null);
  });
  await t.test('a persisted v1 turn reserves its next call with the v1 identity and frozen tariff',async()=>{
    const prior=await seedOldCall('direct-client');
    await settleStudioAssistanceCall(prior.callId,prior.actor.userId,response('direct-old-settlement'));
    const policy={...legacy,enabled:true,credits:false};
    const call=await reserveStudioAssistanceCall({...prior.actor,requestId:prior.input.requestId,leaseId:randomUUID(),index:1,inputTokens:1000,outputTokens:2200},policy);
    assert.equal(call.policy_version,legacyVersion);assert.equal(call.tariff_version,STUDIO_ASSISTANCE_TARIFF.version);
    await settleStudioAssistanceCall(call.id,prior.actor.userId,response('direct-next-settlement'));
  });
  await t.test('the real service replays the paid checkpoint once and purchases only the missing v1 Response',async()=>{
    const ready=await service.submit(old.input);assert.equal(ready.state,'ready');
    await service.submit(old.input);
    assert.equal(newResponses,1);assert.equal(tokenCounts,1);
    const calls=(await pg.pool.query<{policy_version:string;tariff_version:string;state:string;charged_cents:number}>('SELECT policy_version,tariff_version,state,charged_cents FROM studio_assistance_calls WHERE user_id=$1 ORDER BY response_index',[old.actor.userId])).rows;
    assert.equal(calls.length,2);assert.ok(calls.every(call=>call.policy_version===legacyVersion&&call.tariff_version===STUDIO_ASSISTANCE_TARIFF.version&&call.state==='settled'));
    assert.equal(calls.reduce((sum,call)=>sum+call.charged_cents,0),1,'The v1 cumulative message price is settled once.');
    const saved=(await pg.pool.query<{response_json:StudioDirectorResponse}>('SELECT response_json FROM studio_conversation_responses WHERE user_id=$1 AND response_index=0',[old.actor.userId])).rows;
    assert.equal(saved.length,1);assert.deepEqual(saved[0].response_json.output,tool.output);
  });
  await t.test('old recorded settlements and unknown waivers need no credit tables or refund_credits column',async()=>{
    const recorded=await seedOldCall('support-recorded',response('old-support-response'));
    const unknown=await seedOldCall('support-unknown');
    for(const [item,action] of [[recorded,'settle_recorded'],[unknown,'waive_unknown']] as const){
      const preview=await inspectStudioAssistanceResolution(item.callId,action);
      const input={callId:item.callId,action,expectedFingerprint:preview.fingerprint,operator:'offline-support',reason:'Historical v1 delivery qualification'};
      assert.equal((await applyStudioAssistanceResolution(input)).applied,true);
      assert.equal((await applyStudioAssistanceResolution(input)).applied,false);
    }
    await settleStudioAssistanceCall(unknown.callId,unknown.actor.userId,response('late-old-response'));
    assert.equal((await pg.pool.query<{charged_cents:number}>('SELECT charged_cents FROM studio_assistance_calls WHERE id=$1',[unknown.callId])).rows[0].charged_cents,0);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='refund'",[unknown.actor.userId])).rows[0].n,1);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM information_schema.columns WHERE table_name='studio_assistance_resolutions' AND column_name='refund_credits'")).rows[0].n,0);
  });

  const beforeMigration=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[old.callId])).rows;
  await pg.pool.query(readFileSync('neon/migrations/63_studio_assistance_credits.sql','utf8'));
  const creditPolicy=studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:creditVersion});
  await t.test('a policy change before dispatch permits a reviewed new request without supplier or wallet work',async()=>{
    const actor:StudioGenerationActor={userId:'transition-empty',projectId:'transition-empty-film',authMethod:'studio-session',clientId:null};
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,'Empty transition')",[actor.projectId,actor.userId]);
    const input={requestId:randomUUID(),message:'Help with my scene.',references:[]};
    await openStudioAssistanceTurn(actor,input.requestId,legacy);
    let dispatches=0;
    const transitioned=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:creditPolicy,countInputTokens:async()=>1000,createActionResponse:async()=>{dispatches++;return response('never-empty-transition');}});
    await assert.rejects(transitioned.submit(input),error=>{
      assert.deepEqual((error as {nextAction:unknown}).nextAction,{type:'studio_assistance',reason:'policy_changed',safeToStartNewRequest:true,canStartFollowup:false,completedModelCalls:0});return true;
    });
    assert.equal(dispatches,0);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1',[actor.userId])).rows[0].n,0);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_receipts WHERE user_id=$1',[actor.userId])).rows[0].n,0);
  });
  await t.test('a changed policy closes settled tool work once and requires an explicit follow-up',async()=>{
    const remember={...response('transition-memory-response'),output_text:'',output:[{type:'function_call' as const,name:'project_remember',call_id:'transition-memory-once',arguments:JSON.stringify({revision:0,brief:'Preserve this settled creative decision.',decisions:[]})}]};
    const item=await seedOldCall('transition-settled',remember);
    let dispatches=0,counts=0;
    const transitioned=createImageConversationService(item.actor,{enabled:true,actionsEnabled:true,assistancePolicy:creditPolicy,countInputTokens:async()=>{counts++;return 1000;},createActionResponse:async()=>{dispatches++;return response('never-settled-transition');}});
    await assert.rejects(transitioned.submit(item.input),error=>{
      assert.deepEqual((error as {nextAction:unknown}).nextAction,{type:'studio_assistance',reason:'policy_changed',safeToStartNewRequest:false,canStartFollowup:true,completedModelCalls:1});return true;
    });
    const saved=(await pg.pool.query<{state:string;draft_json:{reply:string}}>('SELECT state,draft_json FROM studio_image_turns WHERE user_id=$1',[item.actor.userId])).rows[0];
    assert.equal(saved.state,'ready');assert.match(saved.draft_json.reply,/follow-up/);
    const receipts=(await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[item.actor.userId])).rows;
    assert.equal((await transitioned.submit(item.input)).state,'ready');
    assert.equal(dispatches,0);assert.equal(counts,1);
    assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[item.actor.userId])).rows,receipts);
    assert.equal((await pg.pool.query<{revision:string}>('SELECT revision::text FROM studio_conversation_memory WHERE user_id=$1',[item.actor.userId])).rows[0].revision,'1','Replaying the closed request cannot repeat its completed mutation');
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM studio_assistance_calls WHERE user_id=$1',[item.actor.userId])).rows[0].n,1);
  });
  await t.test('a policy change with mixed settled and unknown calls preserves holds and cannot close or redispatch',async()=>{
    const item=await seedOldCall('transition-unknown');
    await settleStudioAssistanceCall(item.callId,item.actor.userId,response('transition-first-settled'));
    const held=await reserveStudioAssistanceCall({...item.actor,requestId:item.input.requestId,leaseId:randomUUID(),index:1,inputTokens:1000,outputTokens:2200},legacy);
    const checkLocked=async()=>assert.rejects(reserveStudioAssistanceCall({...item.actor,requestId:item.input.requestId,leaseId:randomUUID(),index:2,inputTokens:1000,outputTokens:2200},creditPolicy),error=>{
      assert.deepEqual((error as {nextAction:unknown}).nextAction,{type:'studio_assistance',reason:'policy_changed',safeToStartNewRequest:false,canStartFollowup:false,completedModelCalls:1});return true;
    });
    await checkLocked();
    await markStudioAssistanceUnknown(held.id,item.actor.userId);
    const calls=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1 ORDER BY response_index',[item.actor.userId])).rows;
    const receipts=(await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[item.actor.userId])).rows;
    await checkLocked();
    assert.deepEqual((await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1 ORDER BY response_index',[item.actor.userId])).rows,calls);
    assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[item.actor.userId])).rows,receipts);
    const turn=(await pg.pool.query<{state:string;draft_json:unknown}>('SELECT state,draft_json FROM studio_image_turns WHERE user_id=$1',[item.actor.userId])).rows[0];
    assert.equal(turn.state,'failed');assert.equal(turn.draft_json,null);
    const preview=await inspectStudioAssistanceResolution(held.id,'waive_unknown');
    await applyStudioAssistanceResolution({callId:held.id,action:'waive_unknown',expectedFingerprint:preview.fingerprint,operator:'offline-transition-support',reason:'Explicit release permits a new policy request without replaying unknown work'});
    assert.equal((await pg.pool.query<{state:string}>('SELECT state FROM studio_image_turns WHERE user_id=$1',[item.actor.userId])).rows[0].state,'ready');
    const followupId=randomUUID();await openStudioAssistanceTurn(item.actor,followupId,creditPolicy);
    const followup=await reserveStudioAssistanceCall({...item.actor,requestId:followupId,leaseId:randomUUID(),index:0,inputTokens:1000,outputTokens:0},creditPolicy);
    assert.equal(followup.policy_version,creditVersion);
    assert.equal((await pg.pool.query<{state:string}>('SELECT state FROM studio_assistance_calls WHERE id=$1',[held.id])).rows[0].state,'unknown','A support release cannot invent supplier settlement or replay its response');
  });
  await t.test('migration 63 preserves old calls and replay without another debit or Response',async()=>{
    assert.deepEqual((await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[old.callId])).rows,beforeMigration);
    const beforeReceipts=(await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows;
    assert.equal((await service.submit(old.input)).state,'ready');
    assert.equal(newResponses,1);assert.equal(tokenCounts,1);
    assert.deepEqual((await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows,beforeReceipts);
  });
  await t.test('v2 ignores legacy wallet authorization and grants paid credits only after current explicit consent',async()=>{
    const policy=studioAssistancePolicy({...env,STUDIO_ASSISTANCE_APPROVED_POLICY:creditVersion});
    const status=await readStudioAssistanceStatus(old.actor.userId,policy);
    assert.equal(status.policyVersion,creditVersion);assert.equal(status.paid.enabled,false);assert.equal(status.mode,'included_sol');assert.equal(status.credits?.purchased.total,0);
    await assert.rejects(chooseStudioAssistance(old.actor.userId,{action:'authorize_paid',budgetCents:100,expectedRevision:status.revision,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version},policy),/Sol pack/);
    const purchase={action:'purchase_pack' as const,amountCents:200 as const,purchaseKey:randomUUID(),expectedRevision:status.revision,tariffVersion:STUDIO_ASSISTANCE_CREDIT_TARIFF.version};
    await assert.rejects(chooseStudioAssistance(old.actor.userId,{...purchase,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version},policy),/current Sol pack tariff/);
    const paid=await chooseStudioAssistance(old.actor.userId,purchase,policy);await chooseStudioAssistance(old.actor.userId,purchase,policy);
    assert.equal(paid.paid.enabled,true);assert.equal(paid.credits?.purchased.remaining,2000);
    assert.equal((await pg.pool.query<{n:number}>("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND billing_product_key='studio_assistance_pack'",[old.actor.userId])).rows[0].n,1);
    const requestId=randomUUID();const turn=await openStudioAssistanceTurn(old.actor,requestId,policy);
    assert.equal(turn.policy_version,creditVersion);assert.equal(turn.tariff_version,STUDIO_ASSISTANCE_CREDIT_TARIFF.version);
    const receiptCount=(await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_receipts')).rows[0].n;
    const call=await reserveStudioAssistanceCall({...old.actor,requestId,leaseId:randomUUID(),index:0,inputTokens:0,outputTokens:2200},policy);
    await settleStudioAssistanceCall(call.id,old.actor.userId,{...response('v2-free-first'),usage:{input_tokens:0,input_tokens_details:{cached_tokens:0},output_tokens:1000,total_tokens:1000}});
    assert.equal((await pg.pool.query<{charged_cents:number}>('SELECT charged_cents FROM studio_assistance_credit_funding WHERE call_id=$1',[call.id])).rows[0].charged_cents,2,'Only v2 uses the supplier basis times two.');
    assert.equal((await readStudioAssistanceStatus(old.actor.userId,policy)).credits?.included.remaining,480);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_receipts')).rows[0].n,receiptCount,'Usage consumes credits without another wallet debit.');
    let dispatches=0;
    const creditService=createImageConversationService(old.actor,{enabled:true,actionsEnabled:true,assistancePolicy:policy,countInputTokens:async()=>1000,createActionResponse:async params=>{
      dispatches++;assert.match(String(params.instructions),/monthly free credits.*before purchased/);assert.match(String(params.instructions),/Luna.*no monthly quota/);
      assert.doesNotMatch(String(params.instructions),/one-time preview allowance|authorize an assistance spending limit/);
      return response('v2-service-help');
    }});
    const input={requestId:randomUUID(),message:'Explain my current assistance terms.',references:[]};
    assert.equal((await creditService.submit(input)).state,'ready');await creditService.submit(input);
    assert.equal(dispatches,1);
    assert.equal((await readStudioAssistanceStatus(old.actor.userId,policy)).credits?.included.remaining,470);
    assert.equal((await pg.pool.query<{n:number}>('SELECT count(*)::int n FROM app_receipts')).rows[0].n,receiptCount);
  });
  await t.test('v1 does not reinterpret an active v2 pack authorization as a legacy wallet ceiling',async()=>{
    const policy={...legacy,enabled:true,credits:false};
    const status=await readStudioAssistanceStatus(old.actor.userId,policy);
    assert.equal(status.paid.enabled,false);assert.equal(status.mode,'included_sol');assert.equal(status.tariff.version,STUDIO_ASSISTANCE_TARIFF.version);
    const turn=await openStudioAssistanceTurn(old.actor,randomUUID(),policy);
    assert.equal(turn.mode,'included_sol');assert.equal(turn.policy_version,legacyVersion);
    const account=(await pg.pool.query<{paid_enabled:boolean;tariff_version:string}>('SELECT paid_enabled,tariff_version FROM studio_assistance_accounts WHERE user_id=$1',[old.actor.userId])).rows[0];
    assert.equal(account.paid_enabled,true);assert.equal(account.tariff_version,STUDIO_ASSISTANCE_CREDIT_TARIFF.version,'Reading/selecting a regime cannot rewrite customer consent.');
  });
  await t.test('v2 credit consumption and unknown holds do not reduce a restored v1 wallet ceiling',async()=>{
    const item=await seedOldCall('rollback-spend');
    await settleStudioAssistanceCall(item.callId,item.actor.userId,response('rollback-original-paid'));
    await chooseStudioAssistance(item.actor.userId,{action:'purchase_pack',amountCents:200,purchaseKey:randomUUID(),expectedRevision:0,tariffVersion:STUDIO_ASSISTANCE_CREDIT_TARIFF.version},creditPolicy);
    async function consume(inputTokens:number){
      const requestId=randomUUID();await openStudioAssistanceTurn(item.actor,requestId,creditPolicy);
      const call=await reserveStudioAssistanceCall({...item.actor,requestId,leaseId:randomUUID(),index:0,inputTokens,outputTokens:0},creditPolicy);
      await settleStudioAssistanceCall(call.id,item.actor.userId,{...response('rollback-'+requestId),usage:{input_tokens:inputTokens,input_tokens_details:{cached_tokens:0},output_tokens:0}});
      return call;
    }
    await consume(100000);await consume(10000);
    const requestId=randomUUID();await openStudioAssistanceTurn(item.actor,requestId,creditPolicy);
    const unknown=await reserveStudioAssistanceCall({...item.actor,requestId,leaseId:randomUUID(),index:0,inputTokens:10000,outputTokens:0},creditPolicy);
    await markStudioAssistanceUnknown(unknown.id,item.actor.userId);
    const before=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1 ORDER BY created_at',[item.actor.userId])).rows;
    const status=await readStudioAssistanceStatus(item.actor.userId,legacy);
    assert.equal(status.paid.enabled,false);
    assert.equal(status.paid.spentCents,1,'The legacy wallet display must exclude usage already paid from a purchased credit lot');
    assert.equal(status.paid.remainingCents,99);
    assert.equal(status.paid.reservedCents,0);
    assert.equal(status.unresolvedCalls,1,'Regime isolation cannot hide unresolved v2 evidence');
    const resumed=await chooseStudioAssistance(item.actor.userId,{action:'authorize_paid',budgetCents:100,expectedRevision:status.revision,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version},legacy);
    assert.equal(resumed.paid.enabled,true);assert.equal(resumed.paid.remainingCents,99);
    assert.deepEqual((await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1 ORDER BY created_at',[item.actor.userId])).rows,before,'Restoring a wallet limit cannot rewrite prior credit calls or holds');
  });
  await t.test('pure purchased credit work does not consume legacy sponsored campaign availability on rollback',async()=>{
    const rows=(await pg.pool.query<{campaign_id:string|null;reserved_sponsored_nano_usd:string}>(`SELECT c.campaign_id,f.reserved_sponsored_nano_usd::text FROM studio_assistance_calls c JOIN studio_assistance_credit_funding f ON f.call_id=c.id WHERE c.user_id='rollback-spend' AND f.reserved_sponsored_nano_usd=0`)).rows;
    assert.equal(rows.length,2);
    for(const row of rows)assert.equal(row.campaign_id,null,'The shared campaign cannot acquire purchased-only supplier exposure when its reader changes to v1');
  });
});
