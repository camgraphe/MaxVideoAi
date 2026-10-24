import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {withDbTransaction} from '../frontend/src/lib/db';
import {qualifyFluxDraftPair} from '../frontend/server/flux-draft-cache';
import {nativeFluxDraftSubmission} from '../frontend/server/flux-draft-provenance';
import {persistQualifiedFluxDraftSource,resolveOwnedFluxDraftSource,resolveFluxDraftOrigin} from '../frontend/server/flux-draft-cache-store';
import {listOwnedGenerationSources} from '../frontend/server/generations/owned-operation-sources';

test('a completed native canonical Draft without provider_attempts is eligible only with exact authoritative queue proof',async t=>{
 const db=await startDisposablePostgres('flux-origin');t.after(()=>db.cleanup());
 await db.pool.query(`CREATE TABLE app_jobs(id bigserial PRIMARY KEY,job_id text,user_id text,engine_id text,provider text,provider_job_id text,surface text,status text,hidden boolean,video_url text,settings_snapshot jsonb,prompt text,created_at timestamptz DEFAULT now());
 CREATE TABLE provider_attempts(id bigserial PRIMARY KEY,job_id bigint,provider text,provider_model text,provider_job_id text,status text);
 CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,user_id text,kind text,position int,status text,url text,storage_url text,metadata jsonb,duration_sec numeric);
 CREATE TABLE media_assets(public_id text,source_output_id text,source_job_id text,user_id text,status text,deleted_at timestamptz);
 CREATE TABLE fal_queue_log(id bigserial PRIMARY KEY,job_id text,provider text,provider_job_id text,engine_id text,status text,payload jsonb);`);
 await db.pool.query(readFileSync('neon/migrations/79_flux_draft_cache_sources.sql','utf8'));
 await db.pool.query(`INSERT INTO flux_draft_cache_sources(source_job_id,source_output_id,owner_id,provider_request_id,attempt_id,fingerprint,qualified_source) VALUES('legacy','old-output','alice','old-request',42,'old-fingerprint','{"ownerId":"alice","providerRequestId":"old-request","fingerprint":"old-fingerprint"}')`);
 const beforeUpgrade=(await db.pool.query("SELECT * FROM flux_draft_cache_sources WHERE source_job_id='legacy'")).rows[0];
 for(let i=0;i<2;i++)await db.pool.query(readFileSync('neon/migrations/80_flux_draft_origin_provenance.sql','utf8'));
 const upgraded=(await db.pool.query("SELECT * FROM flux_draft_cache_sources WHERE source_job_id='legacy'")).rows[0];
 assert.deepEqual(upgraded,{...beforeUpgrade,origin_kind:'provider_attempt',origin_proof:null});
 await db.pool.query("DELETE FROM flux_draft_cache_sources WHERE source_job_id='legacy'");
 const snapshot={schemaVersion:1,surface:'video',engineId:'flux-3-draft',mode:'i2v',prompt:'Animate the image',settings:{durationSec:5,resolution:'480p',aspectRatio:'16:9'},references:[{kind:'asset',assetId:'ma_11111111111111111111111111111111',role:'first_frame'}],outputCount:1};
 const payload={engineId:'flux-3-draft',provider:'fal',promptLength:17,inputSummary:{primaryImageUrl:'https://owned/image.png',primaryAudioUrl:null,referenceImageCount:1,referenceVideoCount:0,referenceAudioCount:0,hasFirstFrame:true,hasLastFrame:false,inputSlots:[{slotId:'image_url',kind:'image',hasUrl:true}]}};
 await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,provider,provider_job_id,surface,status,hidden,video_url,settings_snapshot,prompt) VALUES('draft','alice','flux-3-draft','fal','request','video','completed',false,'owned',$1,'Animate the image')`,[snapshot]);
 await db.pool.query(`INSERT INTO job_outputs VALUES('out','draft','alice','video',0,'ready','owned',NULL,$1,5)`,[{mediaFacts:{original:{url:'owned',sha256:'a'.repeat(64)}}}]);
 await db.pool.query(`INSERT INTO fal_queue_log(job_id,provider,provider_job_id,engine_id,status,payload) VALUES('draft','fal','request','flux-3-draft','enqueue',$1),('draft','fal','request','flux-3-draft','completed','{}')`,[payload]);
 const executor={query:async<T,>(sql:string,params?:unknown[]):Promise<T[]> =>(await db.pool.query(sql,params)).rows};
 const input={userId:'alice',sourceJobId:'draft',executor};
 const origin=await resolveFluxDraftOrigin(input);
 assert.equal(origin.endpoint,'blackforestlabs/flux-3/image-to-video/draft');
 assert.equal(origin.attemptId,null);
 assert.equal((origin as any).provenance.kind,'canonical_queue');
 const pair=qualifyFluxDraftPair(origin,{providerRequestId:'request',providerVideoUrl:'https://v3.fal.media/video.mp4',cacheUrl:'https://v3.fal.media/cache.bin',ownedSha256:origin.outputSha256,videoIdentity:'same',ownedVideoIdentity:'same',audioIdentity:'same',ownedAudioIdentity:'same',durationSec:5,fps:24,decodedFrameCount:120});
 await withDbTransaction(tx=>persistQualifiedFluxDraftSource(pair,tx),{pool:db.pool});
 assert.equal((await db.pool.query('SELECT attempt_id,origin_kind,origin_proof FROM flux_draft_cache_sources')).rows[0].attempt_id,null);
 assert.equal((await resolveOwnedFluxDraftSource(input,async()=>{})).fingerprint,pair.fingerprint);
 // Same owned job/output with changed authoritative request is not the previously qualified source.
 await db.pool.query('UPDATE app_jobs SET settings_snapshot=$1',[{...snapshot,prompt:'A changed prompt'}]);
 await assert.rejects(()=>resolveOwnedFluxDraftSource(input,async()=>{}),{code:'REFERENCE_INVALID'});
 await assert.rejects(()=>withDbTransaction(tx=>persistQualifiedFluxDraftSource(pair,tx),{pool:db.pool}),{code:'REFERENCE_INVALID'});
 await db.pool.query('UPDATE app_jobs SET settings_snapshot=$1',[snapshot]);
 await db.pool.query('DELETE FROM flux_draft_cache_sources');
 const page=await listOwnedGenerationSources('alice',{operation:'flux-draft-enhance'},{executor,flux:resolveFluxDraftOrigin,luma:async()=>{throw new Error('not Luma');}});
 assert.deepEqual(page.sources.map(s=>({job:s.sourceJobId,state:s.preparation})),[{job:'draft',state:'prepare'}]);
 assert.doesNotMatch(JSON.stringify(page),/providerRequestId|cacheUrl|requestSha256|snapshotSha256/);
 for(const who of ['bob','admin'])await assert.rejects(()=>resolveFluxDraftOrigin({...input,userId:who}),{code:'REFERENCE_INVALID'});
 for(const changed of [{...snapshot,mode:'extend'},{...snapshot,mode:'v2v',operation:'flux-draft-enhance'}, {...snapshot,engineId:'flux-3'},{...snapshot,surface:'image'}, {...snapshot,schemaVersion:2},{...snapshot,origin:'external_fal_import'}, {inputMode:'i2v',core:{},refs:[]}, {...snapshot,mode:undefined}, {...snapshot,references:[]}]){
  await db.pool.query('UPDATE app_jobs SET settings_snapshot=$1',[changed]);
  await assert.rejects(()=>resolveFluxDraftOrigin(input),{code:'REFERENCE_INVALID'});
 }
 await db.pool.query('UPDATE app_jobs SET settings_snapshot=$1',[snapshot]);
 await db.pool.query("UPDATE fal_queue_log SET provider_job_id='other' WHERE status='completed'");
 await assert.rejects(()=>resolveFluxDraftOrigin(input),{code:'REFERENCE_INVALID'});
 await db.pool.query("UPDATE fal_queue_log SET provider_job_id='request' WHERE status='completed'");
 await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[{...payload,inputSummary:{...payload.inputSummary,inputSlots:[]}}]);
 await assert.rejects(()=>resolveFluxDraftOrigin(input),{code:'REFERENCE_INVALID'});
 await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[payload]);
 await db.pool.query("INSERT INTO provider_attempts(job_id,provider,provider_model,provider_job_id,status) VALUES(1,'fal','blackforestlabs/flux-3/extend-video/draft','request','completed')");
 await assert.rejects(()=>resolveFluxDraftOrigin(input),{code:'REFERENCE_INVALID'});
 assert.equal((await db.pool.query('SELECT count(*) FROM provider_attempts')).rows[0].count,'1','only the test inserted the explicit conflicting row');
 await db.pool.query('DELETE FROM provider_attempts');
 const nativeDraftSubmission=nativeFluxDraftSubmission('flux-3-draft','i2v','blackforestlabs/flux-3/image-to-video/draft',{prompt:snapshot.prompt,image_url:'https://owned/image.png'})!;
 await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[{...payload,nativeDraftSubmission}]);
 // Future proof comes from the final shared Fal writer, so both web and canonical snapshots work.
 for(const shape of [{inputMode:'i2v',core:{prompt:snapshot.prompt},refs:[]},snapshot]){
  await db.pool.query('UPDATE app_jobs SET settings_snapshot=$1',[shape]);
  const future=await resolveFluxDraftOrigin(input);
  assert.equal(future.provenance.kind,'fal_submission');assert.equal(future.attemptId,null);
  const futurePair={...pair,...future,fingerprint:'future-proof'};
  await withDbTransaction(tx=>persistQualifiedFluxDraftSource(futurePair,tx),{pool:db.pool});
  assert.equal((await resolveOwnedFluxDraftSource(input,async()=>{})).fingerprint,'future-proof');
  await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[{...payload,nativeDraftSubmission:{...nativeDraftSubmission,requestSha256:'b'.repeat(64)}}]);
  await assert.rejects(()=>resolveOwnedFluxDraftSource(input,async()=>{}),{code:'REFERENCE_INVALID'});
  await assert.rejects(()=>withDbTransaction(tx=>persistQualifiedFluxDraftSource(futurePair,tx),{pool:db.pool}),{code:'REFERENCE_INVALID'});
  await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[{...payload,nativeDraftSubmission}]);
  await db.pool.query('DELETE FROM flux_draft_cache_sources');
 }
 for(const bad of [{...nativeDraftSubmission,endpoint:'blackforestlabs/flux-3/extend-video/draft'},{...nativeDraftSubmission,mode:'v2v'},{...nativeDraftSubmission,requestSha256:'client-claim'}]){
  await db.pool.query("UPDATE fal_queue_log SET payload=$1 WHERE status='enqueue'",[{...payload,nativeDraftSubmission:bad}]);
  await assert.rejects(()=>resolveFluxDraftOrigin(input),{code:'REFERENCE_INVALID'});
 }
 assert.equal((await db.pool.query('SELECT count(*) FROM provider_attempts')).rows[0].count,'0');
});
