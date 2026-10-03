import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getDb} from '../frontend/src/lib/db';
import {STUDIO_ASSISTANCE_TARIFF} from '../frontend/src/lib/studio/assistance-contract';
import {chooseStudioAssistance,readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import {createImageConversationService} from '../frontend/src/server/studio/image-conversation-service';
import type {StudioDirectorResponse} from '../frontend/src/server/studio/conversation-director';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {AgentApiError} from '../frontend/src/server/agent-api/errors';

test('the real conversation service recovers recorded responses after the retry limit without reopening provider dispatch',async t=>{
  const pg=await startDisposablePostgres('studio-rec'),previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query("CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,name text NOT NULL,deleted_at timestamptz);CREATE TABLE studio_sequences(id text PRIMARY KEY);INSERT INTO studio_projects(id,user_id,name) VALUES('film','owner','Test'),('private','foreign','Private')");
  for(const file of ['50_studio_image_conversation.sql','51_studio_image_model_usage.sql','42_studio_connected_montages.sql','52_studio_conversation_runs.sql','54_studio_assistance_ledger.sql'])await pg.pool.query(readFileSync('neon/migrations/'+file,'utf8'));
  const actor={userId:'owner',projectId:'film',authMethod:'studio-session' as const,clientId:null};
  const policy={enabled:true,solAllowanceNanoUsd:1_000_000_000,lunaAllowanceNanoUsd:250_000_000,campaignNanoUsd:100_000_000_000,maxAdditionalBudgetCents:2000};
  await pg.pool.query("INSERT INTO app_receipts(user_id,type,amount_cents,currency) VALUES ('owner','topup',1000,'USD')");
  await chooseStudioAssistance('owner',{action:'authorize_paid',budgetCents:100,tariffVersion:STUDIO_ASSISTANCE_TARIFF.version,expectedRevision:0},policy);
  await pg.pool.query("CREATE FUNCTION reject_assistance_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='settled' THEN RAISE EXCEPTION 'settlement unavailable'; END IF; RETURN NEW; END; $$");
  const stopSettlement=()=>pg.pool.query('CREATE TRIGGER reject_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION reject_assistance_settlement()');
  const resumeSettlement=()=>pg.pool.query('DROP TRIGGER reject_settlement ON studio_assistance_calls');
  const response:StudioDirectorResponse={id:'saved-reply',model:'gpt-6.1-sol',status:'completed',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50,output_tokens_details:{reasoning_tokens:0},total_tokens:150},output_text:JSON.stringify({reply:'A saved direction'}),output:[]};
  let dispatches=0,counts=0;
  const service=(create=async()=>response)=>createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:policy,
    countInputTokens:async()=>{counts++;return 1000;},createActionResponse:async()=>{dispatches++;return create();},
  });
  const callLimit=(completed:number)=>(error:unknown)=>error instanceof AgentApiError
    && error.nextAction?.type==='studio_assistance' && error.nextAction.reason==='call_limit'
    && error.nextAction.canStartFollowup===true && error.nextAction.safeToStartNewRequest===false
    && error.nextAction.completedModelCalls===completed;
  const input={requestId:randomUUID(),message:'Help plan the film',references:[]};
  await stopSettlement();
  await assert.rejects(service().submit(input),/settlement unavailable/);
  await assert.rejects(service().submit(input),/settlement unavailable/);
  assert.equal((await pg.pool.query('SELECT model_attempts FROM studio_image_turns WHERE request_id=$1',[input.requestId])).rows[0].model_attempts,2);
  await resumeSettlement();
  const recovered=await service().submit(input);
  assert.equal(recovered.state,'ready');
  assert.equal(recovered.reply,'A saved direction');
  await service().submit(input);
  assert.equal(dispatches,1);assert.equal(counts,1,'Recorded-only recovery must not repeat token counting');
  const status=await readStudioAssistanceStatus('owner',policy);
  assert.equal(status.unresolvedCalls,0);assert.equal(status.paid.spentCents,1);assert.equal(status.paid.reservedCents,0);
  assert.equal((await pg.pool.query("SELECT sum(CASE WHEN type='charge' THEN -amount_cents ELSE amount_cents END)::int balance FROM app_receipts WHERE user_id='owner'")).rows[0].balance,999);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0].n,1);

  // A saved tool can settle and replay its durable action, but cannot buy its missing next response.
  const partial={requestId:randomUUID(),message:'Remember warm light, then continue planning',references:[]};
  const toolResponse:StudioDirectorResponse={...response,id:'saved-tool',output_text:'',output:[{type:'function_call',call_id:'remember-once',name:'project_remember',arguments:JSON.stringify({revision:0,brief:'Warm light',decisions:[]})}]};
  await stopSettlement();
  await assert.rejects(service(async()=>toolResponse).submit(partial),/settlement unavailable/);
  await assert.rejects(service(async()=>toolResponse).submit(partial),/settlement unavailable/);
  // Further storage failures also remain recoverable without spending another model attempt.
  await assert.rejects(service(async()=>toolResponse).submit(partial),/settlement unavailable/);
  await resumeSettlement();
  await assert.rejects(service(async()=>toolResponse).submit(partial),callLimit(1));
  const closed=await service(async()=>toolResponse).submit(partial);
  assert.equal(closed.state,'ready');assert.match(closed.reply!,/not finished/);assert.match(closed.reply!,/follow-up/);
  assert.equal(dispatches,2);assert.equal(counts,2,'No preflight or dispatch is allowed after the recorded tool');
  assert.equal((await pg.pool.query("SELECT revision FROM studio_conversation_memory WHERE user_id='owner' AND project_id='film'")).rows[0].revision,'1');
  assert.equal((await pg.pool.query('SELECT model_attempts FROM studio_image_turns WHERE request_id=$1',[partial.requestId])).rows[0].model_attempts,2);
  assert.equal((await readStudioAssistanceStatus('owner',policy)).unresolvedCalls,0);

  // An invalid but settled reply can consume one retry, so the cumulative four-call cap
  // can precede the director's normal four-step closeout. Save an honest partial turn.
  const capped={requestId:randomUUID(),message:'Develop the film direction',references:[]};
  let capDispatches=0;
  const capService=()=>service(async()=>{
    capDispatches++;
    if(capDispatches===2)return {...response,id:'malformed-cap-reply',output_text:'invalid JSON'};
    const revision=capDispatches===1?1:capDispatches-1;
    return {...response,id:'cap-'+capDispatches,output_text:'',output:[{type:'function_call' as const,call_id:'cap-memory-'+capDispatches,name:'project_remember',arguments:JSON.stringify({revision,brief:'Direction '+capDispatches,decisions:[]})}]};
  });
  await assert.rejects(capService().submit(capped),{code:'INTERNAL_ERROR'});
  await assert.rejects(capService().submit(capped),callLimit(4));
  const cappedReady=await capService().submit(capped);
  assert.equal(cappedReady.state,'ready');assert.match(cappedReady.reply!,/not finished/);
  assert.equal(capDispatches,4,'The technical cap must not permit a fifth supplier call');
  assert.equal((await pg.pool.query("SELECT revision FROM studio_conversation_memory WHERE user_id='owner' AND project_id='film'")).rows[0].revision,'4');
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1 AND state='settled'",[capped.requestId])).rows[0].n,4);

  // Replayable earlier tools do not authorize follow-up when a later call is unknown.
  const mixed={requestId:randomUUID(),message:'Keep the direction, then refine it',references:[]};
  let mixedDispatches=0;
  const mixedService=()=>service(async()=>{
    if(++mixedDispatches>1)throw new Error('Later provider timeout');
    return {...toolResponse,id:'mixed-known-tool',output:[{type:'function_call' as const,call_id:'mixed-memory',name:'project_remember',arguments:JSON.stringify({revision:4,brief:'Known partial direction',decisions:[]})}]};
  });
  const usageLocked=(error:unknown)=>error instanceof AgentApiError && error.nextAction?.reason==='usage_unresolved'
    && error.nextAction.canStartFollowup===false && error.nextAction.safeToStartNewRequest===false;
  await assert.rejects(mixedService().submit(mixed),/Later provider timeout/);
  await assert.rejects(mixedService().submit(mixed),usageLocked);
  await assert.rejects(mixedService().submit(mixed),usageLocked);
  assert.equal(mixedDispatches,2);
  assert.equal((await pg.pool.query('SELECT state,draft_json FROM studio_image_turns WHERE request_id=$1',[mixed.requestId])).rows[0].state,'failed');
  assert.equal((await pg.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[mixed.requestId])).rows[0].draft_json,null);

  // Unknown calls have no durable response to replay and retain the original retry ceiling.
  const unknown={requestId:randomUUID(),message:'Unknown response',references:[]};
  const timedOut=()=>service(async()=>{throw new Error('Provider timeout');});
  await assert.rejects(timedOut().submit(unknown),/Provider timeout/);
  await assert.rejects(timedOut().submit(unknown),/unresolved/);
  await assert.rejects(timedOut().submit(unknown),{code:'RATE_LIMITED'});
  assert.equal(dispatches,9);
  const foreign=createImageConversationService({...actor,userId:'foreign',projectId:'private'},{enabled:true,actionsEnabled:true,assistancePolicy:policy,countInputTokens:async()=>1000,createActionResponse:async()=>{throw new Error('Own provider path');}});
  await assert.rejects(foreign.submit(input),/Own provider path/,'An identical request ID cannot replay another account\'s response');
});
