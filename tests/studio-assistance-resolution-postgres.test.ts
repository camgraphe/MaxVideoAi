import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {chooseStudioAssistance,readStudioAssistanceStatus,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';
import {applyStudioAssistanceResolution,inspectStudioAssistanceResolution} from '../frontend/src/server/studio/assistance-resolution';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';

const policy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
const evidence=()=>({id:randomUUID(),model:'gpt-6.1-sol',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50}});
test('support resolution releases customer holds without inventing supplier usage or replaying work',{timeout:60_000},async t=>{
  const pg=await startDisposablePostgres('studio-support'),previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query('CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY)');
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  async function unknown(paid=true,withCompletedEdit=false){
    const userId=randomUUID(),actor={userId,projectId:randomUUID(),authMethod:'studio-session' as const,clientId:null};
    await pg.pool.query("INSERT INTO studio_projects(id,user_id,name) VALUES($1,$2,'Support fixture')",[actor.projectId,userId]);
    await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')",[userId]);
    if(paid)await chooseStudioAssistance(userId,{action:'authorize_paid',budgetCents:100,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision:0},policy);
    let dispatches=0;
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:policy,countInputTokens:async()=>1000,createActionResponse:async()=>{
      dispatches++;
      if(withCompletedEdit&&dispatches===1)return {...evidence(),status:'completed' as const,usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output_text:'',output:[{type:'function_call' as const,call_id:randomUUID(),name:'project_remember',arguments:JSON.stringify({revision:0,brief:'Warm light',decisions:[]})}]};
      throw new Error('transport outcome unknown');
    }});
    const input={requestId:randomUUID(),message:'Suggest a direction',references:[]};
    await assert.rejects(service.submit(input),/transport outcome unknown/);
    const call=(await pg.pool.query("SELECT * FROM studio_assistance_calls WHERE user_id=$1 AND state<>'settled'",[userId])).rows[0];
    const apply=async(action:'waive_unknown'|'settle_recorded'='waive_unknown')=>{
      const preview=await inspectStudioAssistanceResolution(call.id,action);
      return applyStudioAssistanceResolution({callId:call.id,action,expectedFingerprint:preview.fingerprint,operator:'support-operator',reason:'Support case 123: provider outcome could not be recovered'});
    };
    const balance=async()=>Number((await pg.pool.query("SELECT sum(CASE WHEN type='charge' THEN -amount_cents ELSE amount_cents END) n FROM app_receipts WHERE user_id=$1",[userId])).rows[0].n);
    return {actor,call,input,service,apply,balance,dispatches:()=>dispatches};
  }
  await t.test('dry run, concurrent waiver, wallet restoration, late usage and saved request replay',async()=>{
    const user=await unknown();
    const preview=await inspectStudioAssistanceResolution(user.call.id,'waive_unknown');
    assert.equal(preview.refundCents,8);assert.equal(await user.balance(),992);
    assert.equal((await readStudioAssistanceStatus(user.actor.userId,policy)).unresolvedCalls,1);
    const input={callId:user.call.id,action:'waive_unknown' as const,expectedFingerprint:preview.fingerprint,operator:'support',reason:'Case 123'};
    await Promise.all([applyStudioAssistanceResolution(input),applyStudioAssistanceResolution(input)]);
    assert.equal(await user.balance(),1000);
    let status=await readStudioAssistanceStatus(user.actor.userId,policy);
    assert.equal(status.paid.reservedCents,0);assert.equal(status.unresolvedCalls,0);assert.equal(status.paid.spentCents,0);
    const stillUnknown=(await pg.pool.query('SELECT state,usage_facts,provider_max_nano_usd,reserved_nano_usd FROM studio_assistance_calls WHERE id=$1',[user.call.id])).rows[0];
    assert.equal(stillUnknown.state,'unknown');assert.equal(stillUnknown.usage_facts,null);assert.equal(stillUnknown.provider_max_nano_usd,null);assert.equal(stillUnknown.reserved_nano_usd,user.call.reserved_nano_usd);
    const replay=await user.service.submit(user.input);assert.equal(replay.state,'ready');assert.match(replay.reply??'',/closed|refunded/i);assert.equal(user.dispatches(),1);
    const response=evidence();assert.equal(await settleStudioAssistanceCall(user.call.id,user.actor.userId,response),true);
    assert.equal(await settleStudioAssistanceCall(user.call.id,user.actor.userId,response),true);
    assert.equal(await user.balance(),1000);
    status=await readStudioAssistanceStatus(user.actor.userId,policy);assert.equal(status.paid.spentCents,0);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='refund'",[user.actor.userId])).rows[0].n,1);
    await assert.rejects(pg.pool.query('DELETE FROM studio_assistance_resolutions WHERE call_id=$1',[user.call.id]),/immutable/);
  });
  await t.test('an active thinking lease cannot be waived',async()=>{
    const user=await unknown();
    await pg.pool.query("UPDATE studio_image_turns SET state='thinking',lease_expires_at=clock_timestamp()+interval '1 hour' WHERE request_id=$1",[user.input.requestId]);
    await assert.rejects(user.apply(),/inactive|lease/i);assert.equal(await user.balance(),992);
  });
  await t.test('expired exhausted leases are explicitly revoked before a late worker can execute',async()=>{
    const user=await unknown();
    await pg.pool.query("UPDATE studio_image_turns SET state='thinking',model_attempts=2,lease_expires_at=clock_timestamp()-interval '1 hour' WHERE request_id=$1",[user.input.requestId]);
    await assert.rejects(user.service.submit(user.input),/retry limit/);
    const before=(await pg.pool.query('SELECT * FROM studio_image_turns WHERE request_id=$1',[user.input.requestId])).rows[0];
    await user.apply();
    const after=(await pg.pool.query('SELECT * FROM studio_image_turns WHERE request_id=$1',[user.input.requestId])).rows[0];
    assert.notEqual(after.lease_id,before.lease_id);assert.equal(after.state,'ready');
    const {beginStudioAction}=await import('../frontend/src/server/studio/conversation-run-repository');
    await assert.rejects(beginStudioAction(user.actor,before,'late-tool',{action:'project.remember',revision:0,brief:'Must not run',decisions:[]}),/superseded/);
    assert.equal((await user.service.submit(user.input)).state,'ready');assert.equal(user.dispatches(),1);
    await settleStudioAssistanceCall(user.call.id,user.actor.userId,evidence());assert.equal(await user.balance(),1000);
    assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_conversation_memory WHERE user_id=$1',[user.actor.userId])).rows[0].n,0);
    assert.equal((await pg.pool.query('SELECT revoked_lease_id FROM studio_assistance_resolutions WHERE call_id=$1',[user.call.id])).rows[0].revoked_lease_id,before.lease_id);
  });
  await t.test('an expired lease cannot discard a started action or a saved draft',async()=>{
    const user=await unknown();
    await pg.pool.query("UPDATE studio_image_turns SET state='thinking',lease_expires_at=clock_timestamp()-interval '1 hour' WHERE request_id=$1",[user.input.requestId]);
    await pg.pool.query("INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision) VALUES($1,$2,$3,'started-tool',$4,$5,$6::jsonb,0)",[user.actor.userId,user.actor.projectId,user.input.requestId,user.call.lease_id,'a'.repeat(64),JSON.stringify({action:'project.remember',revision:0,brief:'Pending',decisions:[]})]);
    await assert.rejects(user.apply(),/unfinished actions/);assert.equal(await user.balance(),992);
    await pg.pool.query('DELETE FROM studio_conversation_steps WHERE request_id=$1',[user.input.requestId]);
    await pg.pool.query("UPDATE studio_image_turns SET draft_json=$2::jsonb,draft_reference_fingerprint=$3 WHERE request_id=$1",[user.input.requestId,JSON.stringify({image:null,reply:'A saved reply'}),'b'.repeat(64)]);
    await assert.rejects(user.apply(),/Saved creation/);assert.equal(await user.balance(),992);
  });
  await t.test('settlement wins safely over a stale waiver preview',async()=>{
    const user=await unknown(),preview=await inspectStudioAssistanceResolution(user.call.id,'waive_unknown');
    await settleStudioAssistanceCall(user.call.id,user.actor.userId,evidence());
    await assert.rejects(applyStudioAssistanceResolution({callId:user.call.id,action:'waive_unknown',expectedFingerprint:preview.fingerprint,operator:'support',reason:'Case 123'}),/changed|settled/i);
    assert.equal(await user.balance(),999);
  });
  await t.test('concurrent supplier settlement and customer waiver have one financial winner',async()=>{
    const user=await unknown(),preview=await inspectStudioAssistanceResolution(user.call.id,'waive_unknown');
    const outcomes=await Promise.allSettled([
      applyStudioAssistanceResolution({callId:user.call.id,action:'waive_unknown',expectedFingerprint:preview.fingerprint,operator:'support',reason:'Case 123'}),
      settleStudioAssistanceCall(user.call.id,user.actor.userId,evidence()),
    ]);
    assert.equal(outcomes[1].status,'fulfilled');
    assert.equal(await user.balance(),outcomes[0].status==='fulfilled'?1000:999);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='refund'",[user.actor.userId])).rows[0].n,1);
  });
  await t.test('partial completed edits and earlier settled charges survive customer closeout',async()=>{
    const user=await unknown(true,true);assert.equal(user.dispatches(),2);
    await user.apply();assert.equal(await user.balance(),999);
    assert.equal((await user.service.submit(user.input)).state,'ready');assert.equal(user.dispatches(),2);
    assert.deepEqual((await pg.pool.query('SELECT revision::int,brief FROM studio_conversation_memory WHERE user_id=$1',[user.actor.userId])).rows,[{revision:1,brief:'Warm light'}]);
    assert.equal((await readStudioAssistanceStatus(user.actor.userId,policy)).paid.spentCents,1);
  });
  await t.test('refund failure rolls back both closeout and resolution',async()=>{
    const user=await unknown();
    await pg.pool.query(`CREATE FUNCTION reject_support_refund() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.type='refund' THEN RAISE EXCEPTION 'refund unavailable'; END IF; RETURN NEW; END $$;CREATE TRIGGER reject_support_refund BEFORE INSERT ON app_receipts FOR EACH ROW EXECUTE FUNCTION reject_support_refund()`);
    try{await assert.rejects(user.apply(),/refund unavailable/);}finally{await pg.pool.query('DROP TRIGGER reject_support_refund ON app_receipts');}
    assert.equal(await user.balance(),992);assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1',[user.call.id])).rows[0].n,0);
    assert.equal((await user.service.read()).turns[0].state,'failed');
    await user.apply();assert.equal(await user.balance(),1000);
  });
  await t.test('included exposure remains reserved and deleted projects retain financial support',async()=>{
    const included=await unknown(false),before=await readStudioAssistanceStatus(included.actor.userId,policy);
    await included.apply();const after=await readStudioAssistanceStatus(included.actor.userId,policy);
    assert.equal(after.includedSol.remainingPercent,before.includedSol.remainingPercent);assert.equal(after.unresolvedCalls,0);
    const deleted=await unknown();await pg.pool.query('DELETE FROM studio_projects WHERE id=$1',[deleted.actor.projectId]);
    await deleted.apply();assert.equal(await deleted.balance(),1000);
  });
  await t.test('recorded settlement only accepts scoped durable provider usage',async()=>{
    const user=await unknown();await assert.rejects(user.apply('settle_recorded'),/recorded|evidence/i);
    const response={...evidence(),status:'completed',output:[],output_text:'{"reply":"Saved response"}'};
    await pg.pool.query("UPDATE studio_conversation_responses SET state='reported',response_id=$2,response_json=$3::jsonb WHERE request_id=$1",[user.input.requestId,response.id,JSON.stringify(response)]);
    await assert.rejects(user.apply(),/recorded|settle/i);
    await user.apply('settle_recorded');await user.apply('settle_recorded');assert.equal(await user.balance(),999);
    assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1 AND action='settle_recorded'",[user.call.id])).rows[0].n,1);
  });
});
