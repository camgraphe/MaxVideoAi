import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
import { promoteMarketingVideo } from '../frontend/server/marketing-media/copy';
import type { QueryExecutor } from '../frontend/src/lib/db';

test('marketing promotion survives source deletion and rejects incomplete, stale and concurrent preparations',async t=>{
 const db=await startDisposablePostgres('marketing-media');
 const query:QueryExecutor['query']=async(sql,params)=>(await db.pool.query(sql,params as any[])).rows;
 const transaction=async<T,>(run:(executor:QueryExecutor)=>Promise<T>):Promise<T>=>{
  const client=await db.pool.connect();try{await client.query('BEGIN');const result=await run({query:async(sql,params)=>(await client.query(sql,params as any[])).rows});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 };
 const snapshot={schemaVersion:1,surface:'video',engineId:'luma-ray-3-2',inputMode:'v2v',prompt:'Exact prompt',negativePrompt:'no blur',core:{durationSec:5,aspectRatio:'9:16',resolution:'1080p'},advanced:{seed:42},refs:{videoUrls:['https://media.example/reference.mp4']}};
 const insert=async(id:string)=>{
  await query(`INSERT INTO app_jobs(job_id,user_id,status,surface,engine_id,engine_label,prompt,video_url,thumb_url,settings_snapshot,visibility,indexable,created_at)
    VALUES($1,'owner','completed','video','luma-ray-3-2','Luma','Exact prompt','https://media.example/'||$1||'.mp4','https://media.example/poster.jpg',$2,'public',true,'2026-10-22')`,[id,JSON.stringify(snapshot)]);
  await query(`INSERT INTO job_outputs(id,job_id,kind,status,url,width,height) VALUES($1,$1,'video','ready','https://media.example/'||$1||'.mp4',1080,1920)`,[id]);
 };
 let copies=0;
 const copyFile=async(file:any,context:any)=>{copies++;return{sourceUrl:file.sourceUrl,url:`https://media.example/marketing-media/${context.copyId}/${copies}`,key:`marketing-media/${context.copyId}/${copies}`,mime:'video/mp4',sizeBytes:100,sha256:'a'.repeat(64)};};
 const deps={db:{query},transaction,copyFile};
 try {
  await query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text,surface text,engine_id text,engine_label text,prompt text,video_url text,thumb_url text,settings_snapshot jsonb,visibility text,indexable boolean,created_at timestamptz);
   CREATE TABLE job_outputs(id text PRIMARY KEY,job_id text,kind text,status text,url text,storage_url text,thumb_url text,width int,height int,position int,created_at timestamptz DEFAULT now());
   CREATE TABLE media_assets(id text,user_id text,url text,deleted_at timestamptz,status text);`);
  await query(readFileSync('neon/migrations/78_marketing_media.sql','utf8'));
  await t.test('foreign source requires permission and completed copy preserves existing identity',async()=>{
   await insert('stable-id');
   await assert.rejects(promoteMarketingVideo({videoId:'stable-id',actorId:'admin',permissionConfirmed:false},deps),/permission/i);
   assert.equal(copies,0);
   const ready=await promoteMarketingVideo({videoId:'stable-id',actorId:'admin',permissionConfirmed:true},deps);
   assert.equal(ready.state,'ready');assert.equal(ready.videoId,'stable-id');assert.equal(copies,3);
   assert.equal((await query<any>('SELECT video_url FROM app_jobs WHERE job_id=$1',['stable-id']))[0].video_url,'https://media.example/stable-id.mp4');
   await query(`DELETE FROM job_outputs WHERE job_id='stable-id'; DELETE FROM app_jobs WHERE job_id='stable-id'`);
   const again=await promoteMarketingVideo({videoId:'stable-id',actorId:'admin',permissionConfirmed:true},deps);
   assert.equal(again.state,'ready');assert.equal(copies,3,'ready copies survive source deletion and are idempotent');
   const [stored]=await query<any>(`SELECT * FROM marketing_media WHERE video_id='stable-id'`);
   assert.equal(stored.publication.job_id,'stable-id');assert.equal(stored.publication.indexable,true);
   assert.equal(stored.recreation_snapshot.advanced.seed,42);assert.match(stored.recreation_snapshot.refs.videoUrls[0],/marketing-media/);
   assert.equal(stored.source_user_id,'owner');assert.equal(stored.publication.user_id,null);
  });
  await t.test('failed reference copy never exposes a partial publication and can be retried',async()=>{
   await insert('failure');let calls=0;
   await assert.rejects(promoteMarketingVideo({videoId:'failure',actorId:'owner',permissionConfirmed:false},{...deps,copyFile:async(file:any,context:any)=>{if(++calls===2)throw Error('failed fixture');return copyFile(file,context);}}),/copy/i);
   const [failed]=await query<any>(`SELECT state,publication FROM marketing_media WHERE video_id='failure'`);assert.equal(failed.state,'failed');assert.deepEqual(failed.publication,{});
   const result=await promoteMarketingVideo({videoId:'failure',actorId:'owner',permissionConfirmed:false},deps);assert.equal(result.state,'ready');
  });
  await t.test('source edits and deletion during copying reject activation',async()=>{
   for(const deleted of[false,true]){
    const id=deleted?'deleted-during-copy':'changed-during-copy';await insert(id);let first=true;
    await assert.rejects(promoteMarketingVideo({videoId:id,actorId:'owner',permissionConfirmed:false},{...deps,copyFile:async(file:any,context:any)=>{
     if(first){first=false;await query(deleted?`INSERT INTO media_assets(id,user_id,url,status,deleted_at) VALUES('removed','owner',$1,'deleted',now())`:`UPDATE app_jobs SET prompt='changed' WHERE video_url=$1`,[file.sourceUrl]);}return copyFile(file,context);
    }}),/changed|unavailable/i);
    assert.equal((await query<any>('SELECT state FROM marketing_media WHERE video_id=$1',[id]))[0].state,'failed');
   }
  });
  await t.test('a second request cannot compete with the current preparation',async()=>{
   await insert('concurrent');let release!:()=>void;let started!:()=>void;const signal=new Promise<void>(r=>started=r);const wait=new Promise<void>(r=>release=r);
   const first=promoteMarketingVideo({videoId:'concurrent',actorId:'owner',permissionConfirmed:false},{...deps,copyFile:async(file:any,context:any)=>{started();await wait;return copyFile(file,context);}});
   await signal;
   await assert.rejects(promoteMarketingVideo({videoId:'concurrent',actorId:'owner',permissionConfirmed:false},deps),/progress/i);
   release();assert.equal((await first).state,'ready');
  });
 }finally{await db.cleanup();}
});
