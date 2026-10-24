import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {listOwnedGenerationSources} from '../frontend/server/generations/owned-operation-sources';
import {resolveOwnedLumaGenerationSource} from '../frontend/src/server/agent-api/generation-luma-lineage';
import {resolveFluxDraftOrigin} from '../frontend/server/flux-draft-cache-store';

test('picker SQL includes owned ready originals without media_assets, isolates accounts, and excludes invalid lineage',async t=>{
 const db=await startDisposablePostgres('owned-generation-picker');t.after(()=>db.cleanup());
 await db.pool.query(`CREATE TABLE app_jobs(id bigint,job_id text,user_id text,engine_id text,surface text,status text,provider text,provider_job_id text,video_url text,hidden boolean DEFAULT false,prompt text,created_at timestamptz DEFAULT now());
 CREATE TABLE provider_attempts(id bigint,job_id bigint,provider text,provider_model text,status text,provider_job_id text,request_snapshot jsonb);
 CREATE TABLE job_outputs(id text,job_id text,user_id text,kind text,position integer,status text,url text,storage_url text,metadata jsonb,duration_sec numeric);
 CREATE TABLE media_assets(public_id text,source_output_id text,source_job_id text,user_id text,status text,deleted_at timestamptz);`);
 await db.pool.query(readFileSync('neon/migrations/79_flux_draft_cache_sources.sql','utf8'));
 await db.pool.query(readFileSync('neon/migrations/80_flux_draft_origin_provenance.sql','utf8'));
 await db.pool.query(`INSERT INTO app_jobs(id,job_id,user_id,engine_id,surface,status,provider,provider_job_id,video_url,prompt) VALUES
 (1,'luma','alice','luma-ray-3-2','video','completed','luma_agents_direct','private-luma','https://owned/luma.mp4','A landscape'),
 (2,'draft','alice','flux-3-draft','video','completed','fal','private-draft','https://owned/draft.mp4','A portrait'),
 (3,'extended','alice','flux-3-draft','video','completed','fal','private-extended','https://owned/extend.mp4','A continuation');
 INSERT INTO provider_attempts VALUES (11,1,'luma_agents_direct','ray-3.2','completed','private-luma','{}'),
 (12,2,'fal','blackforestlabs/flux-3/image-to-video/draft','completed','private-draft','{}'),
 (13,3,'fal','blackforestlabs/flux-3/extend/draft','completed','private-extended','{}');`);
 for(const job of ['luma','draft','extended']){
  const url=`https://owned/${job==='extended'?'extend':job}.mp4`;
  await db.pool.query(`INSERT INTO job_outputs VALUES($1,$2,'alice','video',0,'ready',$3,NULL,$4,5.56)`,[job+'-output',job,url,JSON.stringify({mediaFacts:{original:{url,sha256:'a'.repeat(64)}}})]);
 }
 const executor={query:async<T,>(sql:string,params?:unknown[]):Promise<T[]> =>(await db.pool.query(sql,params)).rows};
 const deps={executor,luma:resolveOwnedLumaGenerationSource,flux:resolveFluxDraftOrigin};
 for(const operation of ['luma-extend','flux-draft-enhance'] as const){
  const page=await listOwnedGenerationSources('alice',{operation},deps);assert.equal(page.sources.length,1);
  assert.equal(page.sources[0].sourceJobId,operation==='luma-extend'?'luma':'draft');assert.equal(page.sources[0].durationSec,5.56);
  assert.equal(page.sources[0].preparation,operation==='luma-extend'?'ready':'prepare');assert.doesNotMatch(JSON.stringify(page),/private-|provider|cacheUrl/);
  assert.deepEqual((await listOwnedGenerationSources('bob',{operation},deps)).sources,[]);
  assert.deepEqual((await listOwnedGenerationSources('admin',{operation},deps)).sources,[]);
  assert.deepEqual((await listOwnedGenerationSources('alice',{operation,sourceJobId:'foreign'},deps)).sources,[]);
 }
 await db.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='luma'; UPDATE job_outputs SET storage_url='https://changed/output' WHERE job_id='draft'");
 assert.deepEqual((await listOwnedGenerationSources('alice',{operation:'luma-extend'},deps)).sources,[]);
 assert.deepEqual((await listOwnedGenerationSources('alice',{operation:'flux-draft-enhance'},deps)).sources,[]);
 assert.equal((await db.pool.query('SELECT count(*) FROM media_assets')).rows[0].count,'0');
});
