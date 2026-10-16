import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {readStudioTaskBudget} from '../frontend/src/server/studio/tasks/budget';
import {studioTaskSourceFingerprint} from '../frontend/src/server/studio/tasks/source';
import {StudioTaskStop} from '../frontend/src/server/studio/tasks/policy';
import {chooseStudioAssistance,readStudioAssistanceStatus,reserveStudioAssistanceCall,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';
import {hydrateOwnedVideoMediaFacts} from '../frontend/server/media-library/owned-video-facts';
import {STUDIO_TASK_LEGACY_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
import type {QueryExecutor} from '../frontend/src/lib/db';

const assetId='ma_'+'1'.repeat(32);
const original='https://cdn.maxvideoai.com/'+assetId+'.mp4';
const originalBytes=70*1024*1024;
const measured={source:'probe' as const,durationSec:20,width:320,height:180,hasAudio:true};
const permission=(error:unknown)=>error instanceof StudioTaskStop&&error.reason==='permission';

async function sourceFixture(t:Parameters<typeof studioTaskFixture>[0]) {
  const f=await studioTaskFixture(t);
  await f.pool.query(`CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,url text,status text,metadata jsonb,
      mime_type text,storage_url text,size_bytes bigint,width integer,height integer,updated_at timestamptz);
    CREATE TABLE media_assets(id text PRIMARY KEY,public_id text UNIQUE,user_id text,kind text,url text,mime_type text,status text,
      deleted_at timestamptz,source_job_id text,source_output_id text,metadata jsonb,size_bytes bigint,width integer,height integer,updated_at timestamptz);`);
  const db:QueryExecutor={query:async<T>(sql,values=[]) => (await f.pool.query(sql,[...values])).rows as T[]};
  async function actor(){
    const actor=await f.actor(),status=await readStudioAssistanceStatus(actor.userId,f.policy);
    await chooseStudioAssistance(actor.userId,{action:'select_luna',expectedRevision:status.revision},f.policy);
    return actor;
  }
  async function video(owner:string,id=assetId,metadata:unknown={durationSec:25,legacy:true}) {
    await f.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,metadata,size_bytes)
      VALUES($1,$2,$3,'video',$4,'video/mp4','ready',$5::jsonb,$6)`,[randomUUID(),id,owner,'https://cdn.maxvideoai.com/'+id+'.mp4',JSON.stringify(metadata),originalBytes]);
    return {type:'asset' as const,assetId:id,kind:'video' as const};
  }
  async function running(requestId:string){
    const leaseId=randomUUID();
    await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[requestId,leaseId]);
    return leaseId;
  }
  return {...f,db,actor,video,running};
}

test('a v2 task can reserve its final reply after canonical video qualification without changing its frozen approval',async t=>{
  const f=await sourceFixture(t),actor=await f.actor(),ref=await f.video(actor.userId);
  const input={...f.input('standard','Assemble my minute-long garden film from the selected clips.'),attachments:[ref]};
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  await service.enqueue(input);
  const frozenSql='SELECT source_fingerprint,input_hash,input_json,profile_json,policy_version,revision,segment_request_id FROM studio_tasks WHERE request_id=$1';
  const before=(await f.pool.query(frozenSql,[input.requestId])).rows[0];
  const leaseId=await f.running(input.requestId),scope={...actor,requestId:input.requestId,leaseId};
  assert.ok(await readStudioTaskBudget(f.db,scope));
  const first=await reserveStudioAssistanceCall({...scope,index:0,inputTokens:100,outputTokens:6000},f.policy);
  await settleStudioAssistanceCall(first.id,actor.userId,{id:'before-qualification',model:'gpt-6-luna',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50}});
  let probes=0;
  await hydrateOwnedVideoMediaFacts({userId:actor.userId,ref,expectedUrl:original},{query:f.db.query,
    createReadUrl:async({url})=>url,inspectVideo:async url=>{assert.equal(url,original);probes++;return measured;}});
  const hydrated=(await f.pool.query('SELECT metadata,width,height,size_bytes,url FROM media_assets WHERE public_id=$1',[assetId])).rows[0];
  assert.deepEqual(hydrated.metadata.mediaFacts,measured);
  assert.deepEqual([hydrated.width,hydrated.height,Number(hydrated.size_bytes),hydrated.url],[320,180,originalBytes,original]);
  assert.ok(await readStudioTaskBudget(f.db,scope),'Measuring the same original must not invalidate the next assistant checkpoint.');
  const final=await reserveStudioAssistanceCall({...scope,index:1,inputTokens:100,outputTokens:6000},f.policy);
  await settleStudioAssistanceCall(final.id,actor.userId,{id:'final-reply',model:'gpt-6-luna',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50}});
  assert.equal(probes,1);
  assert.deepEqual((await f.pool.query(frozenSql,[input.requestId])).rows[0],before);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_task_segments WHERE task_request_id=$1',[input.requestId])).rows[0].n,1);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0].n,2);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge' AND user_id=$1",[actor.userId])).rows[0].n,0);
});

test('v2 source checks still reject changes to the original URL ownership readiness MIME or bytes',async t=>{
  const f=await sourceFixture(t);
  for(const change of [
    {name:'URL',sql:"url='https://cdn.maxvideoai.com/replaced.mp4'"},
    {name:'ownership',sql:"user_id='another-owner'"},
    {name:'status',sql:"status='processing'"},
    {name:'MIME',sql:"mime_type='video/webm'"},
    {name:'bytes',sql:'size_bytes=size_bytes+1'},
  ]){
    await t.test(change.name,async()=>{
      const actor=await f.actor(),id='ma_'+randomUUID().replaceAll('-',''),ref=await f.video(actor.userId,id);
      const input={...f.input(),attachments:[ref]};
      await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
      const leaseId=await f.running(input.requestId),scope={...actor,requestId:input.requestId,leaseId};
      assert.ok(await readStudioTaskBudget(f.db,scope));
      const fingerprint=(await f.pool.query('SELECT source_fingerprint FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].source_fingerprint;
      await f.pool.query(`UPDATE media_assets SET ${change.sql} WHERE public_id=$1`,[id]);
      await assert.rejects(readStudioTaskBudget(f.db,scope),permission);
      await assert.rejects(reserveStudioAssistanceCall({...scope,index:0,inputTokens:100,outputTokens:6000},f.policy),permission);
      assert.equal((await f.pool.query('SELECT source_fingerprint FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].source_fingerprint,fingerprint);
      assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0].n,0);
    });
  }
});

test('v1 retains its exact fingerprint recipe and dimension binding, including inputs without a task policy',async t=>{
  const f=await sourceFixture(t),actor=await f.actor(),ref=await f.video(actor.userId,assetId,{mediaFacts:measured});
  const base=f.input();
  const input={...base,attachments:[ref],taskBudget:{...base.taskBudget,policyVersion:STUDIO_TASK_LEGACY_POLICY_VERSION}};
  const expected=createHash('sha256').update(JSON.stringify([{durationSec:20,height:180,mime:'video/mp4',ref:{assetId,kind:'video',type:'asset'},sizeBytes:originalBytes,url:original,width:320}])).digest('hex');
  assert.equal(await studioTaskSourceFingerprint(actor,input,f.db),expected);
  assert.equal(await studioTaskSourceFingerprint(actor,{...input,taskBudget:undefined},f.db),expected);
  await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=await f.running(input.requestId),scope={...actor,requestId:input.requestId,leaseId};
  const before=(await f.pool.query('SELECT source_fingerprint,profile_json,policy_version FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0];
  assert.equal(before.source_fingerprint,expected);
  assert.equal(before.profile_json.reasoning,'medium');
  assert.equal(before.profile_json.maxOutputTokens,2200);
  await f.pool.query('UPDATE media_assets SET width=640,height=360 WHERE public_id=$1',[assetId]);
  assert.notEqual(await studioTaskSourceFingerprint(actor,input,f.db),expected);
  await assert.rejects(readStudioTaskBudget(f.db,scope),permission);
  assert.deepEqual((await f.pool.query('SELECT source_fingerprint,profile_json,policy_version FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0],before);
});

test('v2 image dimensions remain part of the selected source fingerprint',async t=>{
  const f=await sourceFixture(t),actor=await f.actor();
  await f.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,size_bytes,width,height)
    VALUES($1,$2,$3,'image','https://cdn.maxvideoai.com/image.png','image/png','ready',1024,640,360)`,[randomUUID(),assetId,actor.userId]);
  const input={...f.input(),references:[assetId]};
  const before=await studioTaskSourceFingerprint(actor,input,f.db);
  await f.pool.query('UPDATE media_assets SET width=1280 WHERE public_id=$1',[assetId]);
  assert.notEqual(await studioTaskSourceFingerprint(actor,input,f.db),before);
});

test('v2 promoted output qualification preserves task identity while job provenance remains checked',async t=>{
  const f=await sourceFixture(t),actor=await f.actor(),jobId='job_'+randomUUID(),outputId=randomUUID();
  const url='https://cdn.maxvideoai.com/owned-output.mp4';
  await f.pool.query("INSERT INTO app_jobs(job_id,user_id,status,hidden) VALUES($1,$2,'completed',false)",[jobId,actor.userId]);
  await f.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,mime_type,status,metadata,size_bytes)
    VALUES($1,$2,$3,'video',$4,'video/mp4','ready','{"durationSec":25,"legacy":true}',$5)`,[outputId,jobId,actor.userId,url,originalBytes]);
  const ref=await f.video(actor.userId);
  await f.pool.query('UPDATE media_assets SET url=$2,source_job_id=$3,source_output_id=$4 WHERE public_id=$1',[assetId,url,jobId,outputId]);
  const outputRef={type:'job-output' as const,jobId,outputId,kind:'video' as const},input={...f.input(),attachments:[ref]};
  await createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}).enqueue(input);
  const leaseId=await f.running(input.requestId),scope={...actor,requestId:input.requestId,leaseId};
  const before=await studioTaskSourceFingerprint(actor,input,f.db);
  await hydrateOwnedVideoMediaFacts({userId:actor.userId,ref:outputRef,expectedUrl:url},{query:f.db.query,
    createReadUrl:async({url})=>url,inspectVideo:async()=>measured});
  assert.equal(await studioTaskSourceFingerprint(actor,input,f.db),before);
  assert.ok(await readStudioTaskBudget(f.db,scope));
  assert.deepEqual((await f.pool.query('SELECT metadata FROM job_outputs WHERE id=$1',[outputId])).rows[0].metadata.mediaFacts,measured);
  await f.pool.query('UPDATE app_jobs SET hidden=true WHERE job_id=$1',[jobId]);
  await assert.rejects(readStudioTaskBudget(f.db,scope),permission);
  await f.pool.query('UPDATE app_jobs SET hidden=false,user_id=$2 WHERE job_id=$1',[jobId,'another-owner']);
  await assert.rejects(readStudioTaskBudget(f.db,scope),permission);
  await f.pool.query('UPDATE app_jobs SET user_id=$2 WHERE job_id=$1',[jobId,actor.userId]);
  await f.pool.query("UPDATE job_outputs SET status='processing' WHERE id=$1",[outputId]);
  await assert.rejects(readStudioTaskBudget(f.db,scope),permission);
});
