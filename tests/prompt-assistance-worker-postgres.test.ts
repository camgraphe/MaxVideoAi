import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {getDb} from '../frontend/src/lib/db';
import {startDisposablePostgres,createPaidGenerationTestSchema} from './helpers/disposable-postgres';
import {sendPromptAssistance,readPromptAssistance} from '../frontend/src/server/prompt-assistance/service';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {promptAssistanceRequestSchema} from '../frontend/src/lib/prompt-assistance/contract';

const policy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
const context={model:{id:'seedance-2-5'},maxChars:20000,references:[],referencePerception:'metadata_only' as const};
const request=()=>promptAssistanceRequestSchema.parse({sessionId:randomUUID(),requestId:randomUUID(),draftRevision:0,locale:'en',
 message:'Prepare a welcoming astronomy-club film with reference photographs.',draft:{surface:'video',workflow:'create',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'An unrelated sample.',settings:{durationSec:5},references:[]}});
const evidence=()=>({id:'resp_'+randomUUID(),model:'gpt-6.1-sol',status:'completed',service_tier:'default',
 output_text:JSON.stringify({kind:'replacement',reply:'A direction is ready.',text:'A telescope turns slowly under a twilight sky.'}),
 usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:100}} as never);
function gate<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>resolve=done);return {promise,resolve};}
async function fixture(t:{after:(callback:()=>Promise<void>)=>void},migration=true){
 const pg=await startDisposablePostgres('milo-reply-worker'),old=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 t.after(async()=>{await getDb().end();if(old===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=old;await pg.cleanup();});
 await createPaidGenerationTestSchema(pg.pool);
 for(const f of ['54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','85_prompt_assistance.sql','86_milo_three_levels.sql','87_milo_runtime_bounds.sql',...(migration?['92_milo_reply_workers.sql']:[])]){
  if(f.startsWith('92_')&&!existsSync('neon/migrations/'+f))continue;
  await pg.pool.query(readFileSync('neon/migrations/'+f,'utf8'));
 }
 return pg;
}
const executeDefaults={buildContext:async()=>context as never,count:async()=>1000,create:async()=>evidence()};

test('admission returns saved pending before provider preparation and creates no hold',async t=>{
 const pg=await fixture(t),input=request(),release=gate<ReturnType<typeof evidence>>();let creates=0,preparations=0;
 const sending=sendPromptAssistance('admission-owner',input,{policy,workersEnabled:true,...executeDefaults,
  buildContext:async()=>{preparations++;return context as never;},create:async()=>{creates++;return release.promise;}} as never);
 const early=await Promise.race([sending.then(result=>({returned:true,result})),new Promise<{returned:false}>(resolve=>setTimeout(()=>resolve({returned:false}),1000))]);
 release.resolve(evidence());await sending;
 assert.equal(early.returned,true,'the admission response cannot wait for the provider');
 if(!early.returned)return;
 assert.equal(early.result.state,'pending');assert.equal(early.result.phase,'queued');
 assert.equal(creates,0);assert.equal(preparations,0);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
 const row=(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[input.requestId])).rows[0];
 assert.equal(row.execution_version,'durable-v1');assert.equal(row.worker_started_at,null);
 assert.equal(row.execution_deadline_at.getTime()-row.created_at.getTime(),600_000);
 assert.ok(row.lease_expires_at.getTime()>=row.execution_deadline_at.getTime());
 await assert.rejects(pg.pool.query("UPDATE prompt_assistance_requests SET execution_deadline_at=execution_deadline_at+interval '1 second' WHERE request_id=$1",[input.requestId]),/immutable/i);
});

test('saved workers fence dispatch, leases, expiry and financial recovery',async t=>{
 const pg=await fixture(t);
 const worker=await import('../frontend/src/server/prompt-assistance/worker').catch(()=>null);
 const repo=await import('../frontend/src/server/prompt-assistance/worker-repository').catch(()=>null);
 assert.ok(worker&&repo,'saved admitted replies need their fenced worker and lease owner');
 const row=async(id:string)=>(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[id])).rows[0];
 const scope=(userId:string,input:ReturnType<typeof request>)=>({userId,sessionId:input.sessionId,requestId:input.requestId});
 const admit=(owner:string,input:ReturnType<typeof request>,extra={})=>sendPromptAssistance(owner,input,{policy,workersEnabled:true,executionOwner:'local',...executeDefaults,...extra} as never);
 const run=(owner:string,input:ReturnType<typeof request>,deps={},extra={})=>worker.runPromptAssistanceWorkerOnce({scope:scope(owner,input),policy,enabled:true,executionOwner:'local',executionDependencies:{...executeDefaults,...deps},...extra});
 // A fixture may initialize an unstarted historical admission without weakening
 // the immutable production trigger. No provider call/hold exists at this point.
 async function seedTiming(input:ReturnType<typeof request>,createdAgo:number,deadlineFromNow:number){
  assert.equal((await row(input.requestId)).call_id,null);
  await pg.pool.query(`WITH original AS (DELETE FROM prompt_assistance_requests WHERE request_id=$1 RETURNING *)
   INSERT INTO prompt_assistance_requests SELECT (jsonb_populate_record(NULL::prompt_assistance_requests,
    to_jsonb(original)||jsonb_build_object('created_at',stamp.at-($2*interval '1 second'),'execution_deadline_at',stamp.at+($3*interval '1 second'),'lease_expires_at',stamp.at+($3*interval '1 second')+interval '30 seconds'))).* FROM original CROSS JOIN (SELECT clock_timestamp() at) stamp`,[input.requestId,createdAgo,deadlineFromNow]);
 }
 async function assertNoExternalLock(owner:string){
  const c=await pg.pool.connect();try{await c.query('BEGIN');
   assert.equal((await c.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) ok',['prompt-assistance:'+owner])).rows[0].ok,true);
   await c.query('SELECT user_id FROM studio_assistance_accounts WHERE user_id=$1 FOR UPDATE NOWAIT',[owner]);
  }finally{await c.query('ROLLBACK');c.release();}
 }
 await t.test('one paid create survives the old90s boundary and racing wakeups',async inner=>{
  const owner='race-owner',input=request(),started=gate<void>(),response=gate<ReturnType<typeof evidence>>();let creates=0,timeout=0,countParams:unknown;
  input.message=('Prepare a welcoming astronomy-club film with a carefully paced night-sky sequence. ').repeat(85).trim();
  input.draft.references=Array.from({length:7},(_,slot)=>({fieldId:'references',slot,label:`Photo${slot+1}`,ref:{type:'asset' as const,assetId:`synthetic-photo-${slot}`,kind:'image' as const}}));
  const images=Array.from({length:7},()=>({type:'input_image',image_url:'data:image/png;base64,iVBORw0KGgo=',detail:'low'}));
  await admit(owner,input);const originalNow=Date.now;inner.mock.method(Date,'now',()=>originalNow()+95_000);
  const running=run(owner,input,{perception:async()=>({context:{...context,references:input.draft.references},content:images} as never),count:async(params:any,countTimeout:number)=>{
   await assertNoExternalLock(owner);countParams=params;assert.equal(countTimeout,15_000);
   const content=params.input.at(-1).content;assert.equal(content.filter((part:any)=>part.type==='input_image').length,7);
   assert.ok(JSON.parse(content[0].text).message.length>6000);return 1000;
  },create:async(params:any,remaining:number)=>{
   await assertNoExternalLock(owner);creates++;timeout=remaining;
   assert.equal(params,countParams,'count and create use the same frozen request including seven synthetic images');
   assert.equal(params.model,'gpt-6.1-sol');assert.equal(params.reasoning.effort,'xhigh');assert.equal(params.max_output_tokens,6000);assert.equal(params.store,false);
   started.resolve();return response.promise;
  }});
  await started.promise;assert.equal(await run(owner,input),false);assert.equal(creates,1);
  assert.ok(timeout>450_000&&timeout<600_000,'create receives the unspent admission deadline');
  const {closeExpiredPromptRequests}=await import('../frontend/src/server/prompt-assistance/unanswered');
  await closeExpiredPromptRequests(owner);assert.equal((await row(input.requestId)).state,'calling','legacy expiry closeout does not end a live lease');
  await assert.rejects(readPromptAssistance('another-owner',input.sessionId,input.requestId,policy),/REQUEST_NOT_FOUND/);
  response.resolve(evidence());await running;
  assert.equal((await readPromptAssistance(owner,input.sessionId,input.requestId,policy)).state,'complete');
  assert.equal(await run(owner,input),false);assert.equal(creates,1);
 });
 await t.test('expired preparation lease is reclaimed once and fences its former worker',async()=>{
  const owner='prepare-owner',input=request(),a=gate<void>(),b=gate<void>(),releaseA=gate<void>(),releaseB=gate<void>();let prepares=0,creates=0;
  await admit(owner,input);
  const deps={buildContext:async()=>{prepares++;if(prepares===1){a.resolve();await releaseA.promise;}else{b.resolve();await releaseB.promise;}return context as never;},create:async()=>{creates++;return evidence();}};
  const first=run(owner,input,deps);await a.promise;const firstLease=(await row(input.requestId)).lease_id;
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  const second=run(owner,input,deps);await b.promise;const secondLease=(await row(input.requestId)).lease_id;
  assert.notEqual(firstLease,secondLease);releaseA.resolve();await first;
  assert.equal((await row(input.requestId)).state,'preparing');assert.equal((await row(input.requestId)).call_id,null);
  releaseB.resolve();await second;assert.equal(creates,1);assert.equal((await row(input.requestId)).worker_attempts,2);
 });
 await t.test('heartbeat is identity-fenced and capped at the original deadline grace',async()=>{
  const owner='heartbeat-owner',input=request(),started=gate<void>(),release=gate<void>();await admit(owner,input);await seedTiming(input,590,10);
  const running=run(owner,input,{buildContext:async()=>{started.resolve();await release.promise;return context as never;}});
  await started.promise;const current=await row(input.requestId);
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()+interval '1 second' WHERE request_id=$1",[input.requestId]);
  assert.equal(await repo.renewPromptWorkLease(scope(owner,input),current.lease_id),true);
  const renewed=await row(input.requestId);assert.equal(renewed.lease_expires_at.getTime(),renewed.execution_deadline_at.getTime()+30_000);
  assert.equal(await repo.renewPromptWorkLease(scope(owner,input),randomUUID()),false);
  release.resolve();await running;assert.equal(await repo.renewPromptWorkLease(scope(owner,input),current.lease_id),false);
 });
 await t.test('expired queued work never reserves or dispatches',async()=>{
  const owner='expired-owner',input=request();let creates=0;await admit(owner,input);await seedTiming(input,601,-1);
  await run(owner,input,{create:async()=>{creates++;return evidence();}});
  const saved=await readPromptAssistance(owner,input.sessionId,input.requestId,policy);
  assert.equal(saved.state,'failed');assert.equal(saved.error,'REQUEST_DEADLINE');assert.equal(saved.safeToRetry,true);assert.equal(creates,0);
  assert.equal((await row(input.requestId)).call_id,null);
 });
 await t.test('a dispatched expired call is waived once, never redispatched, and late evidence cannot recharge',async()=>{
  const owner='late-owner',input=request(),started=gate<void>(),response=gate<ReturnType<typeof evidence>>();let creates=0;await admit(owner,input);
  const running=run(owner,input,{create:async()=>{creates++;started.resolve();return response.promise;}});await started.promise;
  const dispatched=await row(input.requestId);await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  await run(owner,input,{create:async()=>{creates++;return evidence();}});
  assert.equal((await row(input.requestId)).error,'REQUEST_UNANSWERED');assert.equal(creates,1);
  const unknown=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[dispatched.call_id])).rows[0];
  assert.equal(unknown.state,'unknown');assert.equal(unknown.usage_facts,null);assert.ok(Number(unknown.reserved_nano_usd)>0);
  response.resolve(evidence());await running;
  const closed=await readPromptAssistance(owner,input.sessionId,input.requestId,policy);assert.equal(closed.state,'failed');assert.equal(closed.reply,undefined);
  assert.equal(closed.assistance.credits?.included.remaining,500);
  assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_resolutions WHERE call_id=$1',[dispatched.call_id])).rows[0].n,1);
  assert.equal((await pg.pool.query('SELECT charged_cents FROM studio_assistance_calls WHERE id=$1',[dispatched.call_id])).rows[0].charged_cents,0);
 });
 await t.test('saved provider evidence settles after process loss without a second paid create',async()=>{
  const owner='checkpoint-owner',input=request();let creates=0;await admit(owner,input);
  await run(owner,input,{create:async()=>{creates++;await pg.pool.query("UPDATE prompt_assistance_requests SET response_json=$2::jsonb,state='reported' WHERE request_id=$1",[input.requestId,JSON.stringify(evidence())]);throw Error('Synthetic lost persistence acknowledgement');}});
  assert.equal((await row(input.requestId)).state,'unknown');
  await run(owner,input,{create:async()=>{creates++;return evidence();}});
  assert.equal((await row(input.requestId)).state,'complete');assert.equal(creates,1);assert.equal(await run(owner,input),false);
 });
 await t.test('late evidence checkpoint after waiver survives process loss and settles once',async()=>{
  const owner='waived-checkpoint-owner',input=request(),started=gate<void>(),release=gate<void>();let creates=0;await admit(owner,input);
  const running=run(owner,input,{create:async()=>{creates++;started.resolve();await release.promise;
   await pg.pool.query("UPDATE prompt_assistance_requests SET response_json=$2::jsonb,state=CASE WHEN state='failed' THEN state ELSE 'reported' END WHERE request_id=$1",[input.requestId,JSON.stringify(evidence())]);
   throw Error('Synthetic process loss after late evidence checkpoint');
  }});await started.promise;
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  await run(owner,input);assert.equal((await row(input.requestId)).error,'REQUEST_UNANSWERED');release.resolve();await running;
  const saved=await row(input.requestId);assert.ok(saved.response_json);
  assert.equal((await pg.pool.query('SELECT state FROM studio_assistance_calls WHERE id=$1',[saved.call_id])).rows[0].state,'unknown');
  await pg.pool.query(`CREATE FUNCTION reject_late_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='settled' THEN RAISE EXCEPTION 'Synthetic settlement database failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_late_settlement BEFORE UPDATE ON studio_assistance_calls FOR EACH ROW EXECUTE FUNCTION reject_late_settlement()`);
  try{
   await assert.rejects(run(owner,input),/Synthetic settlement database failure/);
   assert.equal((await row(input.requestId)).context_json.lateSettlementError,undefined,'a transient database error must remain retryable by cron');
  }finally{await pg.pool.query('DROP TRIGGER reject_late_settlement ON studio_assistance_calls');}
  assert.equal(await run(owner,input),true,'cron must settle saved late evidence even while the customer request stays failed');
  const call=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[saved.call_id])).rows[0];
  assert.equal(call.state,'settled');assert.ok(call.usage_facts);assert.equal(call.charged_cents,0);assert.equal(creates,1);
  const result=await readPromptAssistance(owner,input.sessionId,input.requestId,policy);
  assert.equal(result.state,'failed');assert.equal(result.error,'REQUEST_UNANSWERED');assert.equal(result.reply,undefined);assert.equal(result.assistance.credits?.included.remaining,500);
  assert.equal(await run(owner,input),false,'settled late evidence is no longer a cron candidate');
 });
 await t.test('old recover and claim cannot close reclaimable durable preparation before its deadline',async()=>{
  const owner='coexistence-owner',input=request();await admit(owner,input);
  const claimed=await repo.claimPromptWork(scope(owner,input),'local');assert.equal(claimed?.kind,'execute');
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  const legacyRecovered=(await pg.pool.query("UPDATE prompt_assistance_requests SET state='failed',error='REQUEST_INTERRUPTED',updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *",[owner,input.sessionId,input.requestId])).rows[0];
  assert.equal(legacyRecovered.state,'preparing','legacy RETURNING must report the still-recoverable admission');
  await pg.pool.query("UPDATE prompt_assistance_requests SET state=CASE WHEN call_id IS NULL THEN 'failed' ELSE 'unknown' END,error='REQUEST_INTERRUPTED',updated_at=clock_timestamp() WHERE user_id=$1 AND state IN ('preparing','calling') AND lease_expires_at<clock_timestamp()",[owner]);
  assert.equal((await row(input.requestId)).state,'preparing');
  const resumed=await repo.claimPromptWork(scope(owner,input),'local');assert.equal(resumed?.kind,'execute');assert.equal(resumed?.row.worker_attempts,2);
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  assert.equal((await pg.pool.query("UPDATE prompt_assistance_requests SET state='failed',error='REQUEST_INTERRUPTED',updated_at=clock_timestamp() WHERE request_id=$1 RETURNING state",[input.requestId])).rows[0].state,'failed','an exhausted attempt budget is a true closure');
  for(const kind of ['actual-error','changed-context','changed-owner'] as const){
   const next=request(),nextOwner='coexistence-'+kind;await admit(nextOwner,next);await repo.claimPromptWork(scope(nextOwner,next),'local');
   await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[next.requestId]);
   if(kind==='changed-owner')await assert.rejects(pg.pool.query("UPDATE prompt_assistance_requests SET state='failed',error='REQUEST_INTERRUPTED',execution_owner='another' WHERE request_id=$1",[next.requestId]),/immutable/);
   else{
    const sql=kind==='actual-error'?"UPDATE prompt_assistance_requests SET state='failed',error='CONTEXT_TOO_LARGE',updated_at=clock_timestamp() WHERE request_id=$1 RETURNING state"
     :"UPDATE prompt_assistance_requests SET state='failed',error='REQUEST_INTERRUPTED',context_json='{}'::jsonb,updated_at=clock_timestamp() WHERE request_id=$1 RETURNING state";
    assert.equal((await pg.pool.query(sql,[next.requestId])).rows[0].state,'failed','the guard cannot swallow a different error/update shape');
   }
  }
 });
 await t.test('Preview and production workers cannot take each other’s queued request',async()=>{
  const owner='environment-owner',input=request();await admit(owner,input,{executionOwner:'preview:dpl_fixture'});let creates=0;
  assert.equal(await run(owner,input,{create:async()=>{creates++;return evidence();}},{executionOwner:'production'}),false);
  assert.equal((await row(input.requestId)).call_id,null);
  assert.equal(await run(owner,input,{create:async()=>{creates++;return evidence();}},{executionOwner:'preview:dpl_fixture'}),true);assert.equal(creates,1);
 });
 await t.test('policy disable before dispatch fails without a hold or create',async()=>{
  const owner='disabled-owner',input=request();await admit(owner,input);let creates=0;
  await run(owner,input,{create:async()=>{creates++;return evidence();}},{policy:{...policy,enabled:false}});
  assert.equal((await row(input.requestId)).state,'failed');assert.equal((await row(input.requestId)).call_id,null);assert.equal(creates,0);
 });
 await t.test('activation off refuses new work but an admitted reply remains readable',async()=>{
  const owner='flag-owner',input=request();await admit(owner,input);
  assert.equal((await sendPromptAssistance(owner,input,{policy,workersEnabled:false})).state,'pending');
  await assert.rejects(sendPromptAssistance('flag-off-owner',request(),{policy,workersEnabled:false}),/WORKER_UNAVAILABLE/);
  assert.equal((await pg.pool.query("SELECT count(*)::int n FROM studio_assistance_accounts WHERE user_id='flag-off-owner'")).rows[0].n,0);
  assert.equal(await run(owner,input,{}, {enabled:false}),false);assert.equal((await row(input.requestId)).worker_started_at,null);
 });
 await t.test('two lost preparation attempts close without a provider identity',async()=>{
  const owner='attempt-owner',input=request(),a=gate<void>(),b=gate<void>(),release=gate<void>();let prepares=0,creates=0;await admit(owner,input);
  const deps={buildContext:async()=>{if(++prepares===1)a.resolve();else b.resolve();await release.promise;return context as never;},create:async()=>{creates++;return evidence();}};
  const first=run(owner,input,deps);await a.promise;
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  const second=run(owner,input,deps);await b.promise;
  await pg.pool.query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
  assert.equal(await run(owner,input,deps),true);assert.equal((await row(input.requestId)).error,'REQUEST_INTERRUPTED');
  release.resolve();await Promise.all([first,second]);assert.equal(creates,0);assert.equal((await row(input.requestId)).call_id,null);
 });
 await t.test('legacy admissions are excluded and legacy explicit recovery still closes them',async()=>{
  const owner='legacy-owner',input=request();await admit(owner,input);
  await pg.pool.query(`WITH original AS (DELETE FROM prompt_assistance_requests WHERE request_id=$1 RETURNING *)
   INSERT INTO prompt_assistance_requests SELECT (jsonb_populate_record(NULL::prompt_assistance_requests,
    to_jsonb(original)||jsonb_build_object('execution_version','legacy-sync-v1','execution_deadline_at',NULL,'execution_owner',NULL,
    'lease_expires_at',clock_timestamp()-interval '1 second'))).* FROM original`,[input.requestId]);
  assert.equal(await run(owner,input),false);
  const {recoverPromptAssistance}=await import('../frontend/src/server/prompt-assistance/service');
  assert.equal((await recoverPromptAssistance(owner,input.sessionId,input.requestId,policy)).error,'REQUEST_INTERRUPTED');
 });
 await t.test('reapplying the additive migration preserves every request and financial record',async()=>{
  const snapshot=async()=>Promise.all(['prompt_assistance_requests','studio_assistance_calls','studio_assistance_credit_lots','studio_assistance_resolutions'].map(async table=>(await pg.pool.query(`SELECT to_jsonb(t) data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
  const before=await snapshot();await pg.pool.query(readFileSync('neon/migrations/92_milo_reply_workers.sql','utf8'));assert.deepEqual(await snapshot(),before);
 });
});

test('missing migration refuses a new admission without financial initialization',async t=>{
 const pg=await fixture(t,false);
 await assert.rejects(sendPromptAssistance('missing-schema-owner',request(),{policy,workersEnabled:true,...executeDefaults} as never),/WORKER_UNAVAILABLE/);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM studio_assistance_turns')).rows[0].n,0);
 assert.equal((await pg.pool.query('SELECT count(*)::int n FROM prompt_assistance_requests')).rows[0].n,0);
});

test('missed wakeup is recovered by the real global cron worker; duplicates cannot dispatch again',async t=>{
 await fixture(t);const input=request(),owner='cron-owner',started=gate<void>(),response=gate<ReturnType<typeof evidence>>();let creates=0;
 await sendPromptAssistance(owner,input,{policy,workersEnabled:true,executionOwner:'local'});
 const {runPromptAssistanceWorkerOnce}=await import('../frontend/src/server/prompt-assistance/worker');
 const {handlePromptAssistanceWorkerCron}=await import('../frontend/app/api/cron/_lib/prompt-assistance-worker-handler');
 const run=()=>runPromptAssistanceWorkerOnce({policy,enabled:true,executionOwner:'local',executionDependencies:{...executeDefaults,create:async()=>{creates++;started.resolve();return response.promise;}}});
 const invoke=()=>handlePromptAssistanceWorkerCron(new NextRequest('https://example.test/api/cron/prompt-assistance',{headers:{authorization:'Bearer fixture-secret'}}),
  {env:{CRON_SECRET:'fixture-secret',PROMPT_ASSISTANCE_WORKERS_ENABLED:'true',VERCEL_ENV:'production'},run});
 const first=invoke();await started.promise;
 assert.equal((await(await invoke()).json()).handled,false);
 assert.equal(await runPromptAssistanceWorkerOnce({scope:{userId:owner,sessionId:input.sessionId,requestId:input.requestId},policy,enabled:true,executionOwner:'local',executionDependencies:executeDefaults}),false);
 response.resolve(evidence());assert.equal((await(await first).json()).handled,true);
 assert.equal((await readPromptAssistance(owner,input.sessionId,input.requestId,policy)).state,'complete');assert.equal(creates,1);
});

test('invalid late evidence is inspected once and cannot starve a later global candidate',async t=>{
 const pg=await fixture(t),bad=request(),fresh=request();let creates=0;
 const {runPromptAssistanceWorkerOnce}=await import('../frontend/src/server/prompt-assistance/worker');
 const admission=(owner:string,input:ReturnType<typeof request>)=>sendPromptAssistance(owner,input,{policy,workersEnabled:true,executionOwner:'local'});
 const run=(scope?:{userId:string;sessionId:string;requestId:string},fail=false)=>runPromptAssistanceWorkerOnce({scope,policy,enabled:true,executionOwner:'local',executionDependencies:{...executeDefaults,
  create:async()=>{creates++;if(fail)throw Error('Synthetic disconnected transport');return evidence();}}});
 await admission('bad-late-owner',bad);await run({userId:'bad-late-owner',sessionId:bad.sessionId,requestId:bad.requestId},true);
 const invalid={...evidence() as any,usage:undefined};await pg.pool.query('UPDATE prompt_assistance_requests SET response_json=$2::jsonb WHERE request_id=$1',[bad.requestId,JSON.stringify(invalid)]);
 await admission('fresh-after-bad-owner',fresh);assert.equal(await run(),true);
 const badRow=(await pg.pool.query('SELECT * FROM prompt_assistance_requests WHERE request_id=$1',[bad.requestId])).rows[0];
 assert.equal(badRow.context_json.lateSettlementError,'USAGE_UNRESOLVED');assert.equal(badRow.state,'failed');assert.equal(badRow.error,'REQUEST_UNANSWERED');
 const unknown=(await pg.pool.query('SELECT * FROM studio_assistance_calls WHERE id=$1',[badRow.call_id])).rows[0];assert.equal(unknown.state,'unknown');assert.equal(unknown.usage_facts,null);assert.ok(Number(unknown.reserved_nano_usd)>0);
 assert.equal(await run(),true);assert.equal((await readPromptAssistance('fresh-after-bad-owner',fresh.sessionId,fresh.requestId,policy)).state,'complete');
 assert.equal(await run(),false);assert.equal(creates,2);
});
