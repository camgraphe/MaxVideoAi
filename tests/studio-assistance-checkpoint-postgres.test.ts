import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {runStudioImageActions} from '../frontend/src/server/studio/conversation-image-run';
import {createStudioImageGenerationService} from '../frontend/src/server/studio/image-generation-service';
import {checkpointStudioResponse} from '../frontend/src/server/studio/conversation-run-repository';
import {claimImageTurn} from '../frontend/src/server/studio/image-conversation-repository';
import {chooseStudioAssistance,openStudioAssistanceTurn,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';

test('mandatory response checkpoint reserves before dispatch and replay settles a saved response without another provider call',async t=>{
 const pg=await startDisposablePostgres('studio-meter'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 await pg.pool.query("CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY);INSERT INTO studio_projects(id,user_id,name) VALUES('film','owner','Test')");
 for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
 const actor={userId:'owner',projectId:'film',authMethod:'studio-session' as const,clientId:null};
 const policy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
 const claim=await claimImageTurn(actor,{requestId:randomUUID(),message:'Hello',references:[]});await openStudioAssistanceTurn(actor,claim.turn.request_id,policy);
 const response={id:'saved-response',model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default' as const,usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output_text:JSON.stringify({reply:'A saved direction'}),output:[]};
 let dispatch=0,count=0;
 const meter={prepare:async()=>{count++;return {inputTokens:1000,outputTokens:2200,policy};}};
 const create=async()=>{dispatch++;assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE state='reserved'")).rows[0].n,1,'Allowance must be durably reserved before model dispatch');return response;};
 await checkpointStudioResponse(actor,claim.turn,0,create,meter);
 assert.equal(dispatch,1);assert.equal(count,1);
 await checkpointStudioResponse(actor,claim.turn,0,create,meter);
 assert.equal(dispatch,1);assert.equal(count,1,'Replay must not repeat even token counting');
 assert.equal((await readStudioAssistanceStatus('owner',policy)).unresolvedCalls,0);
 // A settlement storage outage after response checkpoint must replay the stored response and settle once.
 const claim2={...claim.turn,lease_id:randomUUID()};
 await pg.pool.query('UPDATE studio_image_turns SET lease_id=$1 WHERE request_id=$2',[claim2.lease_id,claim2.request_id]);
 await pg.pool.query("CREATE FUNCTION reject_assistance_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='settled' THEN RAISE EXCEPTION 'settlement unavailable'; END IF; RETURN NEW; END; $$;CREATE TRIGGER reject_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION reject_assistance_settlement()");
 await assert.rejects(checkpointStudioResponse(actor,claim2,1,async()=>({...response,id:'recover-response'}),meter),/settlement unavailable/);
 await pg.pool.query('DROP TRIGGER reject_settlement ON studio_assistance_calls');
 await checkpointStudioResponse(actor,claim2,1,async()=>{throw new Error('Duplicate provider dispatch');},meter);
 assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE state='settled'")).rows[0].n,2);
 // A billed but malformed response still settles from its saved usage before an explicit retry.
 await pg.pool.query('CREATE TRIGGER reject_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION reject_assistance_settlement()');
 await assert.rejects(checkpointStudioResponse(actor,claim2,2,async()=>({...response,id:'invalid-reply',output_text:'invalid JSON'}),meter),/settlement unavailable/);
 await pg.pool.query('DROP TRIGGER reject_settlement ON studio_assistance_calls');
 claim2.lease_id=randomUUID();await pg.pool.query('UPDATE studio_image_turns SET lease_id=$1 WHERE request_id=$2',[claim2.lease_id,claim2.request_id]);
 await checkpointStudioResponse(actor,claim2,2,async()=>({...response,id:'valid-explicit-retry'}),meter);
 assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE state='settled'")).rows[0].n,4);
 await assert.rejects(checkpointStudioResponse(actor,claim2,3,async()=>{throw new Error('Must not dispatch a fifth call');},meter),/model-call limit/);
 await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE user_id='owner'");
 const timeoutTurn=(await claimImageTurn(actor,{requestId:randomUUID(),message:'Timeout test',references:[]})).turn;
 await openStudioAssistanceTurn(actor,timeoutTurn.request_id,policy);


 await assert.rejects(checkpointStudioResponse(actor,timeoutTurn,0,async()=>{throw new Error('Transport timeout');},meter),/timeout/);
 const nextLease={...timeoutTurn,lease_id:randomUUID()};await pg.pool.query('UPDATE studio_image_turns SET lease_id=$1 WHERE request_id=$2',[nextLease.lease_id,nextLease.request_id]);
 await assert.rejects(checkpointStudioResponse(actor,nextLease,0,async()=>{throw new Error('Duplicate transport attempt');},meter),/unresolved/i);
 assert.equal((await readStudioAssistanceStatus('owner',policy)).unresolvedCalls,1);
 // Real orchestration uses the explicitly chosen Luna model, exact preflight and the mandatory money checkpoint.
 await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE user_id='owner'");
 await chooseStudioAssistance('owner',{action:'select_luna',expectedRevision:0},policy);
 const lunaInput={requestId:randomUUID(),message:'Continue planning',references:[]};
 const lunaTurn=(await claimImageTurn(actor,lunaInput)).turn;
 let countedPayload:unknown,calls=0;
 const draft=await runStudioImageActions({actor,turn:lunaTurn,input:lunaInput,references:[],referenceFingerprint:'0'.repeat(64),history:[],enabled:true,factory:createStudioImageGenerationService,assistancePolicy:policy,
   countInputTokens:async params=>{countedPayload=params;assert.equal(params.model,'gpt-6-luna');return 1000;},
   createResponse:async params=>{calls++;assert.equal(params,countedPayload);assert.equal((await pg.pool.query("SELECT model FROM studio_assistance_calls WHERE request_id=$1",[lunaInput.requestId])).rows[0].model,'gpt-6-luna');return {...response,id:'actual-luna',model:'gpt-6-luna'};},
 });
 assert.equal(draft.reply,'A saved direction');assert.equal(calls,1);
 assert.equal((await pg.pool.query("SELECT state FROM studio_assistance_calls WHERE request_id=$1",[lunaInput.requestId])).rows[0].state,'settled');
 const counterInput={requestId:randomUUID(),message:'Count failure',references:[]},counterTurn=(await claimImageTurn(actor,counterInput)).turn;
 await assert.rejects(runStudioImageActions({actor,turn:counterTurn,input:counterInput,references:[],referenceFingerprint:'0'.repeat(64),history:[],enabled:true,factory:createStudioImageGenerationService,assistancePolicy:policy,
   countInputTokens:async()=>{throw new Error('Token preflight unavailable');},createResponse:async()=>{throw new Error('Unexpected paid call');},
 }),/Token preflight unavailable/);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1',[counterInput.requestId])).rows[0].n,0);
 // Mid-message exhaustion closes a known settled attempt with visible context for the next assistant.
 await pg.pool.query("UPDATE studio_image_turns SET state='failed' WHERE user_id='owner'");
 await chooseStudioAssistance('owner',{action:'select_sol',expectedRevision:1},policy);
 await pg.pool.query("UPDATE studio_assistance_accounts SET sol_limit_nano_usd=(SELECT COALESCE(sum(CASE WHEN state='settled' THEN provider_max_nano_usd ELSE reserved_nano_usd END),0)+24500000 FROM studio_assistance_calls WHERE user_id='owner' AND mode='included_sol') WHERE user_id='owner'");
 const partialInput={requestId:randomUUID(),message:'Remember warm light and then help with the next step',references:[]},partialTurn=(await claimImageTurn(actor,partialInput)).turn;
 await assert.rejects(runStudioImageActions({actor,turn:partialTurn,input:partialInput,references:[],referenceFingerprint:'0'.repeat(64),history:[],enabled:true,factory:createStudioImageGenerationService,assistancePolicy:policy,countInputTokens:async()=>1000,
   createResponse:async()=>({...response,id:'partial-memory',output_text:'',output:[{type:'function_call',call_id:'remember-before-cap',name:'project_remember',arguments:JSON.stringify({revision:0,brief:'Warm light',decisions:[]})}]}),
 }),error=>(error as any).nextAction?.canStartFollowup===true&&(error as any).nextAction?.safeToStartNewRequest===false);
 const partial=(await pg.pool.query('SELECT state,draft_json FROM studio_image_turns WHERE request_id=$1',[partialInput.requestId])).rows[0];
 assert.equal(partial.state,'ready');assert.match(partial.draft_json.reply,/follow-up/);assert.match(partial.draft_json.reply,/not finished/);


});
