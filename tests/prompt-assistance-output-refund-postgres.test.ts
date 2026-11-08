import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb,withDbTransaction} from '../frontend/src/lib/db';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';
import {buildPromptAssistanceContext} from '../frontend/src/server/prompt-assistance/context';
import {createAgentModelCatalogDeps} from '../frontend/src/server/agent-api/model-catalog';
import {getBaseEngines} from '../frontend/src/lib/engines';
import {readStudioAssistanceStatus,openStudioAssistanceTurn,reserveStudioAssistanceCall,settleStudioAssistanceCall,chooseStudioAssistance} from '../frontend/src/server/studio/assistance-ledger';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {inspectStudioAssistanceOutputRefund,applyStudioAssistanceOutputRefund} from '../frontend/src/server/studio/assistance-output-refund';
import {sendPromptAssistance,recoverPromptAssistance} from './helpers/prompt-assistance-service';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';

const catalog={...createAgentModelCatalogDeps(),listEngines:async()=>getBaseEngines(),isModeExecutable:()=>true,isEngineExecutable:()=>true};
const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
const request=()=>promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',message:'Help with this scene.',draft:{surface:'video',workflow:'create',engineId:'wan-3-prime',mode:'t2v',target:'prompt',text:'Keep my draft.',settings:{durationSec:6,aspectRatio:'16:9',audio:false},references:[]}});
const response=(output:unknown,extra:Record<string,unknown>={})=>({id:'resp_'+randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',output_text:JSON.stringify(output),usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:1000},...extra} as never);

test('completed application-invalid Milo output restores customer credits and preserves supplier facts',async t=>{
 const pg=await startDisposablePostgres('milo-output-refund'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const file of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql','96_milo_lite_output_allowance.sql','92_milo_reply_workers.sql','93_milo_output_credit_refunds.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const userId=randomUUID(),input=request();
 const result=await sendPromptAssistance(userId,input,{policy,buildContext:async(user,input)=>buildPromptAssistanceContext(user,input,{catalog}),count:async()=>1000,create:async()=>response({kind:'conversation',reply:'Invalid tagged advice.',text:'Must not become a replacement.',analysisRequest:null})});
 assert.equal(result.state,'failed');
 assert.equal(result.error,'OUTPUT_INVALID_CREDITS_RESTORED');
 assert.equal(result.assistance.credits?.included.remaining,500,'Undeliverable completed output cannot consume credits');
 assert.equal(result.assistance.revision,1,'A credit restoration invalidates stale funding decisions');
 const call=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE user_id=$1',[userId])).rows[0];
 assert.equal(call.state,'settled');assert.equal(call.usage_facts.inputTokens,1000);assert.equal(Number(call.provider_max_nano_usd),12500000);
 assert.equal((await pg.pool.query('SELECT charged_cents FROM studio_assistance_credit_funding WHERE call_id=$1',[call.id])).rows[0].charged_cents,3);
 assert.equal((await pg.pool.query('SELECT charged_credits FROM studio_assistance_credit_allocations WHERE call_id=$1',[call.id])).rows[0].charged_credits,'30');
 assert.equal((await readStudioAssistanceStatus(userId,policy)).canContinue,true);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM app_receipts')).rows[0].n,0);
 const replay=await recoverPromptAssistance(userId,input.sessionId,input.requestId,policy);
 assert.equal(replay.error,'OUTPUT_INVALID_CREDITS_RESTORED');assert.equal(replay.assistance.credits?.included.remaining,500);assert.equal(replay.assistance.revision,1);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_output_refunds WHERE call_id=$1',[call.id])).rows[0].n,1);

 for(const [name,patch,want] of [
  ['incomplete',{status:'incomplete'},'OUTPUT_INCOMPLETE'],
  ['refusal',{output:[{type:'message',content:[{type:'refusal',refusal:'Provider refusal.'}]}]},'OUTPUT_REFUSED'],
  ['other provider status',{status:'failed'},'OUTPUT_INVALID'],
  ['actual target length',{output_text:JSON.stringify({kind:'replacement',reply:'Ready.',text:'x'.repeat(20001),analysisRequest:null})},'OUTPUT_TOO_LONG'],
 ] as const)await t.test(name+' retains the existing known-usage charge policy',async()=>{
  const user=randomUUID(),input=request();
  const result=await sendPromptAssistance(user,input,{policy,buildContext:async(user,input)=>buildPromptAssistanceContext(user,input,{catalog}),count:async()=>1000,create:async()=>response({kind:'conversation',reply:'Invalid advice.',text:'Bad',analysisRequest:null},patch)});
  assert.equal(result.state,'failed');assert.equal(result.error,want);assert.equal(result.assistance.credits?.included.remaining,470);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_output_refunds WHERE user_id=$1',[user])).rows[0].n,0);
 });
 const legacy=async(options:{userId?:string;state?:string;error?:string;status?:string;refusal?:boolean;unsupported?:boolean;purchased?:boolean;priorMonth?:boolean;unsettled?:boolean;zeroCharge?:boolean;charge90?:boolean}={})=>{
  const userId=options.userId??randomUUID(),input=request(),leaseId=randomUUID(),actor={userId,projectId:`composer:${input.sessionId}`};
  if(options.purchased){
   await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES($1,'topup',1000,'USD')",[userId]);
   const current=await readStudioAssistanceStatus(userId,policy);
   await chooseStudioAssistance(userId,{action:'purchase_pack',amountCents:200,expectedRevision:current.revision,tariffVersion:current.tariff.version,purchaseKey:randomUUID()},policy);
   await pg.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1 AND kind='included'",[userId]);
  }
  const call=await withDbTransaction(async tx=>{
   const actualQuery=tx.query;
   // Historical-month fixture uses the real reservation owner and an earlier database period.
   if(options.priorMonth)tx.query=(sql,params)=>actualQuery(sql.replaceAll("transaction_timestamp() AT TIME ZONE 'UTC'","(date_trunc('month',transaction_timestamp() AT TIME ZONE 'UTC')-interval '1 month')"),params);
   try{await openStudioAssistanceTurn(actor,input.requestId,policy,tx);return await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:options.charge90?12500:1000,outputTokens:1000},policy,tx);}
   finally{tx.query=actualQuery;}
  });
  const savedResponse:any=response({kind:'conversation',reply:'A'.repeat(6081),text:null},options.zeroCharge?{usage:{input_tokens:0,input_tokens_details:{cached_tokens:0},output_tokens:0}}:{});
  if(options.charge90)savedResponse.usage.input_tokens=12500;
  if(!options.unsettled)await settleStudioAssistanceCall(call.id,userId,savedResponse);
  savedResponse.status=options.status??'completed';
  if(options.refusal)savedResponse.output=[{type:'message',content:[{type:'refusal',refusal:'Provider refused.'}]}];
  if(options.unsupported)savedResponse.service_tier='unsupported';
  await pg.pool.query("INSERT INTO prompt_assistance_sessions(user_id,id,scope) VALUES($1,$2,'video:create')",[userId,input.sessionId]);
  await pg.pool.query(`INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,input_hash,input_json,lease_id,state,model,call_id,context_json,response_json,reply_json,error)
   VALUES($1,$2,$3,'fixture',$4::jsonb,$5,$6,'gpt-6.1-sol',$7,'{"replyFormat":"destination-v1","maxChars":20000}'::jsonb,$8::jsonb,$9::jsonb,$10)`,
   [userId,input.sessionId,input.requestId,JSON.stringify(input),leaseId,options.state??'failed',call.id,JSON.stringify(savedResponse),options.state==='complete'?JSON.stringify({reply:'Delivered',text:null}):null,options.error??'OUTPUT_INVALID']);
  return {callId:call.id,userId,sessionId:input.sessionId,requestId:input.requestId};
 };
 const financialSnapshot=async(callId:string)=>{
  const saved=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[callId])).rows[0];
  const funding=(await pg.pool.query('SELECT * FROM studio_assistance_credit_funding WHERE call_id=$1',[callId])).rows;
  const allocations=(await pg.pool.query('SELECT * FROM studio_assistance_credit_allocations WHERE call_id=$1 ORDER BY lot_id',[callId])).rows;
  const request=(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE call_id=$1',[callId])).rows;
  const receipts=(await pg.pool.query('SELECT * FROM app_receipts WHERE user_id=$1 ORDER BY id',[saved.user_id])).rows;
  return {saved,funding,allocations,request,receipts};
 };
 const apply=(scope:{callId:string;userId:string},fingerprint:string)=>applyStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId,expectedFingerprint:fingerprint,operator:'support:fixture',reason:'Case fixture: undelivered completed application-invalid reply'});
 await t.test('legacy failed long replies remain eligible; concurrent/double apply restores exactly once and bumps revision only',async()=>{
  const scope=await legacy(),before=await financialSnapshot(scope.callId),status=await readStudioAssistanceStatus(scope.userId,policy);
  assert.equal(status.credits?.included.remaining,470);
  const preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId});
  assert.equal(preview.refundCredits,30);assert.equal(preview.alreadyApplied,false);
  assert.doesNotMatch(JSON.stringify(preview),/Keep my draft|Help with|AAAAAA/);
  const results=await Promise.all([apply(scope,preview.fingerprint),apply(scope,preview.fingerprint)]);
  assert.equal(results.filter(result=>result.applied).length,1);
  assert.equal((await apply(scope,preview.fingerprint)).applied,false);
  await assert.rejects(apply(scope,'a'.repeat(64)),/different approved/);
  assert.deepEqual(await financialSnapshot(scope.callId),before,'Original provider, gross charges, history and receipts never change');
  const after=await readStudioAssistanceStatus(scope.userId,policy);
  assert.equal(after.credits?.included.remaining,500);assert.equal(after.revision,status.revision+1);assert.equal(after.canContinue,true);assert.equal(after.unresolvedCalls,0);assert.equal(after.selectedModel,status.selectedModel);assert.deepEqual(after.paid,status.paid);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_output_refunds WHERE call_id=$1',[scope.callId])).rows[0].n,1);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_choices WHERE user_id=$1',[scope.userId])).rows[0].n,0,'A refund is not a model or budget choice');
  for(const table of ['studio_assistance_output_refunds','studio_assistance_output_refund_allocations']){
   await assert.rejects(pg.pool.query(`UPDATE ${table} SET refund_credits=refund_credits WHERE call_id=$1`,[scope.callId]),/immutable/);
   await assert.rejects(pg.pool.query(`DELETE FROM ${table} WHERE call_id=$1`,[scope.callId]),/immutable/);
  }
 });
 await t.test('two exact historical 90-credit calls restore 180 from a 470-consumed account without reopening history',async()=>{
  const userId=randomUUID(),first=await legacy({userId,charge90:true}),second=await legacy({userId,charge90:true});
  await pg.pool.query("UPDATE studio_assistance_credit_lots SET consumed_credits=consumed_credits+290 WHERE user_id=$1 AND kind='included'",[userId]);
  const beforeFirst=await financialSnapshot(first.callId),beforeSecond=await financialSnapshot(second.callId);
  assert.equal((await readStudioAssistanceStatus(userId,policy)).credits?.included.remaining,30);
  for(const scope of [first,second]){
   const preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId});assert.equal(preview.refundCredits,90);await apply(scope,preview.fingerprint);
  }
  const status=await readStudioAssistanceStatus(userId,policy);
  assert.equal(status.credits?.included.remaining,210);assert.equal(status.credits?.included.reserved,0);assert.equal(status.revision,2);assert.equal(status.canContinue,true);assert.equal(status.unresolvedCalls,0);
  assert.deepEqual(await financialSnapshot(first.callId),beforeFirst);assert.deepEqual(await financialSnapshot(second.callId),beforeSecond);
 });
 await t.test('failure to persist refund evidence rolls back the lot balance and account revision',async()=>{
  const scope=await legacy(),before=await readStudioAssistanceStatus(scope.userId,policy),preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId});
  await pg.pool.query(`CREATE FUNCTION fail_fixture_refund_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture evidence unavailable'; END; $$;
    CREATE TRIGGER fail_fixture_refund_evidence BEFORE INSERT ON studio_assistance_output_refund_allocations FOR EACH ROW EXECUTE FUNCTION fail_fixture_refund_evidence()`);
  try{await assert.rejects(apply(scope,preview.fingerprint),/fixture evidence unavailable/);}
  finally{await pg.pool.query('DROP TRIGGER fail_fixture_refund_evidence ON studio_assistance_output_refund_allocations;DROP FUNCTION fail_fixture_refund_evidence()');}
  assert.deepEqual(await readStudioAssistanceStatus(scope.userId,policy),before);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_output_refunds WHERE call_id=$1',[scope.callId])).rows[0].n,0);
 });
 await t.test('admin review separates gross charged credits, exact refunds and net consumption by account/request',async()=>{
  const scope=await legacy(),other=await legacy({userId:scope.userId}),foreign=await legacy();
  for(const item of [scope,other,foreign]){const preview=await inspectStudioAssistanceOutputRefund({callId:item.callId,userId:item.userId});await apply(item,preview.fingerprint);}
  const {readNativeEvidence}=await import('../frontend/server/admin-assistant-review/sources');
  const detail=await withDbTransaction(tx=>readNativeEvidence(tx,{source:'composer',userId:scope.userId,scopeId:scope.sessionId,requestId:scope.requestId}));
  const refund=detail.evidence.find(row=>row.title==='Application-invalid credit refunds and net consumption (supplier costs unchanged)');
  assert.ok(refund);assert.equal(refund.status,'available');
  const rows=refund.data.value as Array<Record<string,unknown>>;
  assert.equal(rows.length,1);assert.equal(rows[0].call_id,scope.callId);assert.equal(rows[0].gross_charged_credits,30);assert.equal(rows[0].refund_credits,30);assert.equal(rows[0].net_consumed_credits,0);
  assert.doesNotMatch(JSON.stringify(refund),new RegExp(other.callId+'|'+foreign.callId));
 });
 await t.test('purchased credits return to the original pack without a wallet refund',async()=>{
  const scope=await legacy({purchased:true}),before=await financialSnapshot(scope.callId);
  assert.equal((await readStudioAssistanceStatus(scope.userId,policy)).credits?.purchased.remaining,1970);assert.equal((await readStudioAssistanceStatus(scope.userId,policy)).paid.spentCents,3);
  const preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId});
  assert.equal(preview.allocations[0].kind,'purchased');await apply(scope,preview.fingerprint);
  const status=await readStudioAssistanceStatus(scope.userId,policy);
  assert.equal(status.credits?.purchased.remaining,2000);assert.equal(status.paid.spentCents,0,'Customer status reports net purchased credits consumed');assert.equal(status.credits?.included.remaining,0);assert.equal(status.credits?.purchased.packs.length,1);
  assert.deepEqual(await financialSnapshot(scope.callId),before);
 });
 await t.test('prior-month included credits retain their original expiry and never enlarge this month',async()=>{
  const scope=await legacy({priorMonth:true});
  const preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId});
  assert.equal(preview.allocations[0].kind,'included');
  const before=await readStudioAssistanceStatus(scope.userId,policy);assert.notEqual(preview.allocations[0].period,before.credits?.included.period);
  await apply(scope,preview.fingerprint);
  assert.equal((await readStudioAssistanceStatus(scope.userId,policy)).credits?.included.remaining,500);
  assert.equal((await pg.pool.query('SELECT consumed_credits FROM studio_assistance_credit_lots WHERE id=$1',[preview.allocations[0].lotId])).rows[0].consumed_credits,'0');
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_credit_lots WHERE user_id=$1',[scope.userId])).rows[0].n,1,'Support cannot issue a new monthly lot');
 });
 await t.test('exact ownership and changed previews fail closed without financial mutation',async()=>{
  const scope=await legacy(),before=await financialSnapshot(scope.callId);
  await assert.rejects(inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:'different-owner'}),/owned/);
  await assert.rejects(apply({...scope,userId:'different-owner'},'a'.repeat(64)),/owned/);
  const preview=await inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId});
  await chooseStudioAssistance(scope.userId,{action:'select_luna',expectedRevision:0},policy);
  await assert.rejects(apply(scope,preview.fingerprint),/preview changed/);
  assert.deepEqual(await financialSnapshot(scope.callId),before);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_output_refunds WHERE call_id=$1',[scope.callId])).rows[0].n,0);
 });
 for(const [name,options] of [
  ['successful delivered reply',{state:'complete'}],['active call',{state:'calling'}],['unsettled call',{unsettled:true}],
  ['incomplete provider response',{status:'incomplete'}],['provider refusal',{refusal:true}],['refusal outcome',{error:'OUTPUT_REFUSED'}],
  ['real target limit',{error:'OUTPUT_TOO_LONG'}],['unsupported recorded usage',{unsupported:true}],['zero credit charge',{zeroCharge:true}],
 ] as const)await t.test(name+' is ineligible for compensation',async()=>{
  const scope=await legacy(options),before=await financialSnapshot(scope.callId);
  await assert.rejects(inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId}));
  await assert.rejects(apply(scope,'a'.repeat(64)));
  assert.deepEqual(await financialSnapshot(scope.callId),before);
 });
 await t.test('reapplying migration93 preserves balances and immutable refund evidence',async()=>{
  const before=(await pg.pool.query('SELECT * FROM studio_assistance_output_refunds ORDER BY call_id')).rows;
  const balances=(await pg.pool.query('SELECT * FROM studio_assistance_credit_lots ORDER BY id')).rows;
  await pg.pool.query(readFileSync('neon/migrations/93_milo_output_credit_refunds.sql','utf8'));
  assert.deepEqual((await pg.pool.query('SELECT * FROM studio_assistance_output_refunds ORDER BY call_id')).rows,before);
  assert.deepEqual((await pg.pool.query('SELECT * FROM studio_assistance_credit_lots ORDER BY id')).rows,balances);
 });
 await t.test('a waived call cannot be refunded as a completed-output failure',async()=>{
  const scope=await legacy();
  await pg.pool.query("INSERT INTO studio_assistance_resolutions(call_id,action,operator_id,reason,expected_fingerprint,refund_cents,refund_credits) VALUES($1,'waive_unknown','support:fixture','Previously waived fixture',$2,0,30)",[scope.callId,'b'.repeat(64)]);
  await assert.rejects(inspectStudioAssistanceOutputRefund({callId:scope.callId,userId:scope.userId}),/eligible/);
 });

});
