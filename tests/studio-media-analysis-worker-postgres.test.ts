import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {getDb} from '../frontend/src/lib/db';
import {createPaidGenerationTestSchema,startDisposablePostgres} from './helpers/disposable-postgres';
import {createStudioAnalysisService} from '../frontend/src/server/studio/media-analysis/service';
import {runStudioAnalysisWorkerOnce} from '../frontend/src/server/studio/media-analysis/worker';
import {studioAssistancePolicy} from '../frontend/src/server/studio/assistance-policy';
import {readStudioAnalysisExposure} from '../frontend/src/server/studio/media-analysis/exposure';

const policy={version:'worker-test-v1',processingNanoUsdPerSecond:100_000,marginPercent:1,video:{maxInputTokens:20_000,maxOutputTokens:2200},audio:null};
const snapshot={id:'response',model:'gpt-6.1-sol',serviceTier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20},outputText:'{"summary":"Requested observation","observations":[]}',inputTokens:100,outputTokenBound:2200,providerNanoUsd:450_000};
function deferred<T>() {let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
async function until(check:()=>Promise<boolean>) {const deadline=Date.now()+5000;while(!await check()){if(Date.now()>deadline)throw new Error('PostgreSQL barrier did not arrive');await delay(10);}}

test('analysis workers fence leases and lock exact sources through the dispatch checkpoint',async t=>{
  const pg=await startDisposablePostgres('studio-analysis-worker'),previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
  t.after(async()=>{await getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
  await createPaidGenerationTestSchema(pg.pool);
  await pg.pool.query(`CREATE TABLE studio_projects(id text PRIMARY KEY,user_id text NOT NULL,deleted_at timestamptz);
    CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,mime_type text,status text,metadata jsonb);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text,user_id text,kind text,url text,mime_type text,status text,deleted_at timestamptz,metadata jsonb,source_job_id text,source_output_id text,size_bytes bigint);`);
  for(const name of ['53_studio_media_generation_scope.sql','54_studio_assistance_ledger.sql','62_studio_assistance_resolutions.sql','63_studio_assistance_credits.sql','64_studio_media_analysis.sql'])await pg.pool.query(readFileSync('neon/migrations/'+name,'utf8'));
  const assistancePolicy=studioAssistancePolicy({STUDIO_ASSISTANCE_ENABLED:'true'});
  const extract=async()=>({frames:[{atSec:0,imageUrl:'data:image/jpeg;base64,AAAA'}],sourceHash:'hash'});
  async function fixture(jobOutput=false) {
    const id=randomUUID(),actor={userId:id,projectId:id,authMethod:'studio-session' as const,clientId:null};
    const assetId='ma_'+id.replaceAll('-',''),jobId='job-'+id,outputId='output-'+id;
    const metadata=JSON.stringify({mediaFacts:{source:'probe',durationSec:30,hasAudio:true}});
    await pg.pool.query('INSERT INTO studio_projects VALUES($1,$1,null)',[id]);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,hidden) VALUES($1,$2,'completed',false)",[jobId,id]);
    await pg.pool.query("INSERT INTO job_outputs VALUES($1,$2,$3,'video','https://cdn.maxvideoai.com/owned.mp4','video/mp4','ready',$4::jsonb)",[outputId,jobId,id,metadata]);
    await pg.pool.query("INSERT INTO media_assets VALUES($1,$2,$1,'video','https://cdn.maxvideoai.com/owned.mp4','video/mp4','ready',null,$3::jsonb,$4,$5,1000)",[id,assetId,metadata,jobId,outputId]);
    if(jobOutput){
      const quoteId=randomUUID();
      await pg.pool.query(`INSERT INTO mcp_generation_quotes(quote_id,user_id,auth_origin,studio_project_id,request_json,request_hash,catalog_revision,pricing_snapshot,price_cents,currency,funding_mode,state,expires_at)
        VALUES($1,$2,'studio-session',$2,'{"schemaVersion":1,"surface":"video"}',$3,'fixture','{}',0,'USD','wallet','prepared',now()+interval '45 minutes')`,[quoteId,id,'a'.repeat(64)]);
      await pg.pool.query("UPDATE mcp_generation_quotes SET state='claimed',job_id=$2,claimed_at=now(),updated_at=now() WHERE quote_id=$1",[quoteId,jobId]);
      await pg.pool.query("UPDATE mcp_generation_quotes SET state='accepted',updated_at=now() WHERE quote_id=$1",[quoteId]);
    }
    const ref=jobOutput?{type:'job-output' as const,jobId,outputId,kind:'video' as const}:{type:'asset' as const,assetId,kind:'video' as const};
    const service=createStudioAnalysisService(actor,{policy,assistancePolicy});
    const quote=await service.prepare({ref,goal:'Requested observation',reason:'requested',startSec:0,endSec:30},randomUUID());
    await service.confirm({analysisId:quote.analysisId,maxCredits:quote.maxCredits,policyVersion:quote.policyVersion,confirmed:true});
    return {id,actor,jobId,outputId,service,quote};
  }
  for(const phase of ['prepare','dispatch','late'] as const)await t.test(`a second worker preserves ${phase} work and its sole supplier response`,async()=>{
    const f=await fixture(),entered=deferred<void>(),finish=deferred<void>();let calls=0;
    const worker={policy,assistancePolicy,extract,provider:async()=>{
      if(phase==='prepare'){entered.resolve();await finish.promise;}
      return {inputTokens:100,dispatch:async()=>{calls++;if(phase!=='prepare'){entered.resolve();await finish.promise;}return snapshot;}};
    }};
    const first=runStudioAnalysisWorkerOnce(worker);await entered.promise;
    try{
      await pg.pool.query("UPDATE studio_media_analysis_runs SET started_at=clock_timestamp()-interval '3 minutes 30 seconds' WHERE id=$1",[f.quote.analysisId]);
      if(phase==='late')await pg.pool.query("UPDATE studio_media_analysis_runs SET dispatched_at=clock_timestamp()-interval '3 minutes' WHERE id=$1",[f.quote.analysisId]);
      const exposure=await readStudioAnalysisExposure({query:async(sql,values)=>(await pg.pool.query(sql,values)).rows},f.id);
      assert.equal(exposure.unresolved,phase==='late'?1:0,'Only an expired phase blocks further requests');
      assert.equal(await runStudioAnalysisWorkerOnce(worker),false,'No second supplier dispatch');
      assert.equal((await f.service.read(f.quote.analysisId)).state,phase==='late'?'unknown':'running');
    }finally{finish.resolve();await first;}
    assert.equal((await f.service.read(f.quote.analysisId)).state,'completed','A known late reply settles its original hold');
    assert.equal(calls,1);assert.equal(await runStudioAnalysisWorkerOnce(worker),false);
    assert.equal((await pg.pool.query('SELECT charged_cents IS NOT NULL settled FROM studio_analysis_credit_funding WHERE call_id=$1',[f.quote.analysisId])).rows[0].settled,true);
  });
  await t.test('project closed during extraction stops before paid dispatch',async()=>{
    const f=await fixture();let calls=0;
    await runStudioAnalysisWorkerOnce({policy,assistancePolicy,extract:async()=>{await pg.pool.query('UPDATE studio_projects SET deleted_at=now() WHERE id=$1',[f.id]);return extract();},provider:async()=>({inputTokens:100,dispatch:async()=>{calls++;return snapshot;}})});
    const saved=(await pg.pool.query('SELECT state,charged_credits,dispatched_at FROM studio_media_analysis_runs WHERE id=$1',[f.quote.analysisId])).rows[0];
    assert.deepEqual(saved,{state:'failed',charged_credits:0,dispatched_at:null});assert.equal(calls,0);
  });
  for(const change of ['asset replace','asset parent hide','output replace','output parent hide','project close'] as const)await t.test(`${change} waits for the durable dispatch checkpoint`,async()=>{
    const f=await fixture(change.startsWith('output')),barrier=await pg.pool.connect(),mutator=await pg.pool.connect();
    const key=187391;
    await pg.pool.query(`CREATE OR REPLACE FUNCTION wait_analysis_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.id='${f.quote.analysisId}' AND OLD.dispatched_at IS NULL AND NEW.dispatched_at IS NOT NULL THEN PERFORM pg_advisory_xact_lock(${key}); END IF; RETURN NEW; END; $$;
      CREATE TRIGGER wait_analysis_dispatch BEFORE UPDATE ON studio_media_analysis_runs FOR EACH ROW EXECUTE FUNCTION wait_analysis_dispatch();`);
    await barrier.query('SELECT pg_advisory_lock($1)',[key]);
    const worker=runStudioAnalysisWorkerOnce({policy,assistancePolicy,extract,provider:async()=>({inputTokens:100,dispatch:async()=>snapshot})});
    let mutation:Promise<unknown>|undefined;
    try{
      await until(async()=>(await pg.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'UPDATE studio_media_analysis_runs SET dispatched_at=%') waiting")).rows[0].waiting);
      const pid=(await mutator.query('SELECT pg_backend_pid() pid')).rows[0].pid;let changed=false;
      const sql=change==='asset replace'?"UPDATE media_assets SET url='https://cdn.maxvideoai.com/replaced.mp4' WHERE id=$1":change==='output replace'?"UPDATE job_outputs SET url='https://cdn.maxvideoai.com/replaced.mp4' WHERE id=$1":change==='project close'?'UPDATE studio_projects SET deleted_at=now() WHERE id=$1':'UPDATE app_jobs SET hidden=true WHERE job_id=$1';
      const target=change==='output replace'?f.outputId:change.endsWith('hide')?f.jobId:f.id;
      mutation=mutator.query(sql,[target]).then(()=>{changed=true;});
      await until(async()=>changed||(await pg.pool.query('SELECT cardinality(pg_blocking_pids($1))>0 blocked',[pid])).rows[0].blocked);
      assert.equal(changed,false,'Source/project mutation must remain blocked until dispatched_at commits');
    }finally{
      await barrier.query('SELECT pg_advisory_unlock($1)',[key]);await worker;await mutation;
      await pg.pool.query('DROP TRIGGER wait_analysis_dispatch ON studio_media_analysis_runs; DROP FUNCTION wait_analysis_dispatch()');barrier.release();mutator.release();
    }
  });
});
