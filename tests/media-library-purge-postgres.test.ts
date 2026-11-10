import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('empty Trash freezes owned media, protects work and retries physical deletion', { timeout: 120000 }, async t => {
  const pg = await startDisposablePostgres('library-purge');
  const oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = pg.databaseUrl;
  const db = await import('../frontend/src/lib/db');
  t.after(async () => { await db.getDb().end(); process.env.DATABASE_URL = oldUrl; await pg.cleanup(); });
  const schema = await import('../frontend/src/lib/schema');
  await schema.ensureAssetSchema(); await schema.ensureMediaLibrarySchema(); await schema.ensureMediaLibraryOrganizationSchema();
  const fenceMigration=readFileSync('neon/migrations/37_mcp_reference_upload_recovery_state.sql','utf8');
  await pg.pool.query(fenceMigration.match(/CREATE TABLE IF NOT EXISTS mcp_reference_upload_object_fences[\s\S]*?\n\);/)![0]);
  await pg.pool.query(readFileSync('neon/migrations/44_mcp_reference_staging_storage_namespace.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0]);
  await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,status text DEFAULT 'completed',hidden boolean DEFAULT false,prompt text,surface text,settings_snapshot jsonb,duration_sec integer,aspect_ratio text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),video_url text,audio_url text,thumb_url text,preview_video_url text,preview_frame text,keyframe_urls jsonb,render_ids jsonb,hero_render_id text);
    CREATE TABLE app_timeline_exports(id text PRIMARY KEY,user_id text,status text,render_manifest jsonb);
    CREATE TABLE creator_operations(id uuid PRIMARY KEY,user_id text,status text,snapshot jsonb);
    CREATE TABLE mcp_generation_quotes(quote_id uuid PRIMARY KEY,user_id text,job_id text);
    CREATE TABLE subtitle_operations(id text PRIMARY KEY,user_id text,state text,request_snapshot jsonb);
    CREATE TABLE studio_media_analysis_runs(id text PRIMARY KEY,user_id text,state text,request_json jsonb);
    CREATE TABLE studio_image_turns(id text PRIMARY KEY,user_id text,state text,lease_expires_at timestamptz,input_json jsonb);
    CREATE TABLE studio_tasks(id text PRIMARY KEY,user_id text,state text,input_json jsonb);`);
  const { installLibraryPurgeSchema } = await import('../frontend/server/media-library/purge-schema');
  await installLibraryPurgeSchema();
  const { requestLibraryTrashPurge } = await import('../frontend/server/media-library/purge');
  const { processLibraryPurgeBatch } = await import('../frontend/server/media-library/purge-worker');
  const { mutateLibraryOrganization: mutate } = await import('../frontend/server/media-library/organization');
  const { createLibrarySelectionSnapshot: freeze } = await import('../frontend/server/media-library/selection');
  const { browseLibrary } = await import('../frontend/server/media-library/browse');
  const scope = { view: 'all', kind: 'all', sort: 'recent', trash: true } as const;
  let index = 0;
  const add = async (owner: string, url?: string) => {
    const id = `purge-${++index}`, assetId = `ma_${String(index).padStart(32, '0')}`;
    await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,mime_type,size_bytes,source) VALUES($1,$2,$3,'image',$4,$5,'image/png',100,'upload')`, [id, assetId, owner, url ?? `https://cdn.maxvideoai.com/user-assets/${owner}/${id}.png`, `https://cdn.maxvideoai.com/user-asset-thumbs/${owner}/${id}.webp`]);
    const ref = { type: 'asset', assetId, kind: 'image' } as const;
    await mutate({ userId: owner, operation: 'trash', references: [ref] });
    return { id, ref };
  };
  const request = (owner: string, snapshotId: string) => requestLibraryTrashPurge({userId:owner,snapshotId,confirmation:'empty-trash'});
  const deleted: string[] = [];
  let workerTick=0;
  const worker = (owner: string, remove = async (key: string) => { deleted.push(key); }) => processLibraryPurgeBatch({userId:owner,limit:20,now:new Date(Date.now()+(11+(workerTick++*3))*60_000)}, {
    deleteStorageObjectKey:remove,
    ownedKey:(url:string,userId:string) => { const key=new URL(url).pathname.slice(1); return /^(user-assets|user-asset-thumbs)\//.test(key) && key.split('/')[1]===userId ? key : null; },
  });

  await t.test('confirmation rejects foreign snapshots, active scopes and a restored source atomically', async () => {
    const owner='purge-scope', first=await add(owner), second=await add(owner);
    const frozen=await freeze({userId:owner,scope});
    await assert.rejects(request('foreign',frozen.id), /SNAPSHOT_NOT_FOUND/);
    await assert.rejects(requestLibraryTrashPurge({userId:owner,snapshotId:frozen.id,confirmation:'yes'}), /CONFIRMATION_REQUIRED/);
    const active=await freeze({userId:owner,scope:{...scope,trash:false}});
    await assert.rejects(request(owner,active.id), /TRASH_SCOPE_REQUIRED/);
    await mutate({userId:owner,operation:'restore',references:[second.ref]});
    await assert.rejects(request(owner,frozen.id), /TRASH_CHANGED/);
    assert.equal((await pg.pool.query('SELECT count(*) FROM library_purge_requests WHERE user_id=$1',[owner])).rows[0].count,'0');
    assert.equal((await pg.pool.query('SELECT deleted_at FROM media_assets WHERE id=$1',[first.id])).rows[0].deleted_at,null);
  });

  await t.test('accepted deletion is idempotent, leaves exact input usable during work, then removes bytes', async () => {
    const owner='purge-running', item=await add(owner), frozen=await freeze({userId:owner,scope});
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('active',$1,'running',$2)",[owner,{ref:item.ref}]);
    assert.deepEqual(await request(owner,frozen.id),{requestedCount:1,queuedCount:1,alreadyQueuedCount:0});
    assert.deepEqual(await request(owner,frozen.id),{requestedCount:1,queuedCount:0,alreadyQueuedCount:1});
    assert.equal((await browseLibrary({userId:owner,scope})).totalCount,0);
    assert.equal((await mutate({userId:owner,operation:'restore',references:[item.ref]})).failedCount,1);
    await worker(owner);
    assert.equal(deleted.length,0);
    assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1',[item.id])).rows[0].status,'ready');
    await assert.rejects(pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('new-use',$1,'queued',$2)",[owner,{ref:item.ref}]), /MEDIA_DELETED/);
    await pg.pool.query("UPDATE app_jobs SET status='completed' WHERE job_id='active'");
    await worker(owner);
    assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1',[item.id])).rows[0].status,'deleted');
    assert.equal(deleted.length,2);
    const {resolveStudioMedia}=await import('../frontend/src/server/studio/media-resolver');
    await assert.rejects(resolveStudioMedia(owner,item.ref),/MEDIA_DELETED/);
    await assert.rejects(resolveStudioMedia('foreign',item.ref),/MEDIA_NOT_AVAILABLE/);
    await worker(owner);
    assert.equal(deleted.length,2,'completed work is not repeated');
  });

  await t.test('a storage failure is retried, while an independent live original remains shared', async () => {
    const owner='purge-retry', first=await add(owner), sharedUrl=`https://cdn.maxvideoai.com/user-assets/${owner}/shared.png`;
    const shared=await add(owner,sharedUrl), survivor=await add('purge-survivor',sharedUrl);
    await mutate({userId:'purge-survivor',operation:'restore',references:[survivor.ref]});
    await request(owner,(await freeze({userId:owner,scope})).id);
    await worker(owner,async()=>{throw new Error('storage unavailable');});
    assert.ok((await pg.pool.query('SELECT count(*)::int n FROM library_purge_objects WHERE user_id=$1 AND state=\'pending\'',[owner])).rows[0].n>0);
    const calls: string[]=[];
    await worker(owner,async key=>{calls.push(key);});
    assert.ok(calls.some(key=>key.includes(first.id)));
    assert.ok(!calls.some(key=>key.endsWith('/shared.png')));
    assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1',[survivor.id])).rows[0].status,'ready');
    assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1',[shared.id])).rows[0].status,'deleted');
  });

  await t.test('a concurrent persistence cannot attach bytes while physical deletion owns the fence', async()=>{
    const owner='purge-fenced', item=await add(owner);
    const url=(await pg.pool.query('SELECT url FROM media_assets WHERE id=$1',[item.id])).rows[0].url;
    await request(owner,(await freeze({userId:owner,scope})).id);
    let rejected=false;
    await worker(owner,async key=>{
      if(!key.endsWith('.png'))return;
      try{await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type) VALUES('racing-persist',$1,$2,'image/png')",[owner,url]);}
      catch(error){rejected=/being deleted/.test((error as Error).message);}
    });
    assert.equal(rejected,true,'source persistence must fail before storage deletion is performed');
  });

  await t.test('unconfirmed Creator preparation does not retain files and cannot later start', async()=>{
    const owner='purge-prepared',item=await add(owner);
    await pg.pool.query("INSERT INTO creator_operations VALUES('40000000-0000-4000-8000-000000000001',$1,'prepared',$2)",[owner,{ref:item.ref}]);
    await request(owner,(await freeze({userId:owner,scope})).id);
    const calls:string[]=[];
    await worker(owner,async key=>{calls.push(key);});
    assert.equal(calls.length,2);
    await assert.rejects(pg.pool.query("UPDATE creator_operations SET status='running' WHERE id='40000000-0000-4000-8000-000000000001'"),/MEDIA_DELETED/);
  });

  await t.test('independent live identity using the same URL remains admissible', async()=>{
    const owner='purge-independent',url=`https://cdn.maxvideoai.com/user-assets/${owner}/same.png`;
    const removed=await add(owner,url),live=await add(owner,`${url}?copy=2`);
    await mutate({userId:owner,operation:'restore',references:[live.ref]});
    await request(owner,(await freeze({userId:owner,scope})).id);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('valid-live',$1,'queued',$2)",[owner,{ref:live.ref,url}]);
    await assert.rejects(pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('invalid-old',$1,'queued',$2)",[owner,{ref:removed.ref,url}]),/MEDIA_DELETED/);
    await pg.pool.query("UPDATE app_jobs SET status='completed' WHERE job_id='valid-live'");
  });

  await t.test('physical identity protects aliases and eventually collects the last shared reference', async()=>{
    const owner='purge-alias',url=`https://cdn.maxvideoai.com/user-assets/${owner}/aliased.png`;
    await add(owner,url);
    const survivor=await add('purge-alias-survivor',url.replace('cdn.maxvideoai.com','media.maxvideoai.com'));
    await mutate({userId:'purge-alias-survivor',operation:'restore',references:[survivor.ref]});
    await request(owner,(await freeze({userId:owner,scope})).id);
    const calls:string[]=[];
    await worker(owner,async key=>{calls.push(key);});
    assert.ok(!calls.some(key=>key.endsWith('/aliased.png')),'live alias must protect the same bytes');
    await mutate({userId:'purge-alias-survivor',operation:'trash',references:[survivor.ref]});
    await request('purge-alias-survivor',(await freeze({userId:'purge-alias-survivor',scope})).id);
    await worker('purge-alias-survivor');
    await pg.pool.query('UPDATE library_purge_requests SET not_before=now() WHERE user_id=$1',[owner]);
    await worker(owner,async key=>{calls.push(key);});
    assert.equal(calls.filter(key=>key.endsWith('/aliased.png')).length,1,'original owner retains authority until final reference removal');
  });

  await t.test('concurrent alias persistence is fenced and unknown authorities never grant deletion',async()=>{
    const owner='purge-alias-race',item=await add(owner);
    const url=(await pg.pool.query('SELECT url FROM media_assets WHERE id=$1',[item.id])).rows[0].url;
    await request(owner,(await freeze({userId:owner,scope})).id);
    let rejected=false;
    await worker(owner,async key=>{
      if(!key.endsWith('.png'))return;
      try{await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type) VALUES('racing-alias',$1,$2,'image/png')",[owner,url.replace('cdn.maxvideoai.com','media.maxvideoai.com')]);}
      catch(error){rejected=/being deleted/.test((error as Error).message);}
    });
    assert.equal(rejected,true);
  });

  await t.test('blocked oldest account yields eligibility to a later account',async()=>{
    await pg.pool.query("UPDATE library_purge_requests SET not_before=now()+interval '1 day' WHERE state IN ('pending','deleting')");
    const blocked='purge-fair-blocked',ready='purge-fair-ready';
    await add(blocked); await add(ready);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status) VALUES('fair-active',$1,'running')",[blocked]);
    await request(blocked,(await freeze({userId:blocked,scope})).id);
    await request(ready,(await freeze({userId:ready,scope})).id);
    const now=new Date(Date.now()+11*60_000);
    const deps={deleteStorageObjectKey:async()=>{},ownedKey:(url:string)=>new URL(url).pathname.slice(1)};
    assert.equal((await processLibraryPurgeBatch({limit:1,now},deps)).pendingCount,1);
    assert.equal((await processLibraryPurgeBatch({limit:1,now},deps)).completedCount,1);
    assert.equal((await pg.pool.query('SELECT state FROM library_purge_requests WHERE user_id=$1',[ready])).rows[0].state,'completed');
  });

  await t.test('accepted Creator finalization is protected even before prepared status advances',async()=>{
    const owner='purge-creator-accepted',item=await add(owner);
    await pg.pool.query("INSERT INTO creator_operations VALUES('40000000-0000-4000-8000-000000000002',$1,'prepared',$2)",[owner,{ref:item.ref}]);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('accepted-creator-job',$1,'completed',$2)",[owner,{ref:item.ref}]);
    await pg.pool.query("INSERT INTO mcp_generation_quotes VALUES('40000000-0000-4000-8000-000000000002',$1,'accepted-creator-job')",[owner]);
    await request(owner,(await freeze({userId:owner,scope})).id);
    const calls:string[]=[];await worker(owner,async key=>{calls.push(key);});
    assert.equal(calls.length,0);
    await pg.pool.query("UPDATE creator_operations SET status='finalizing' WHERE id='40000000-0000-4000-8000-000000000002'");
    await pg.pool.query("UPDATE creator_operations SET status='completed' WHERE id='40000000-0000-4000-8000-000000000002'");
    await worker(owner,async key=>{calls.push(key);});assert.equal(calls.length,2);
  });
  await t.test('specialist job admission includes its prepared source snapshot',async()=>{
    const owner='purge-specialist',item=await add(owner);
    await pg.pool.query("INSERT INTO creator_operations VALUES('40000000-0000-4000-8000-000000000003',$1,'prepared',$2)",[owner,{ref:item.ref}]);
    await request(owner,(await freeze({userId:owner,scope})).id);
    await assert.rejects(pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('specialist-job',$1,'queued',$2)",[owner,{creatorOperationId:'40000000-0000-4000-8000-000000000003'}]),/MEDIA_DELETED/);
  });
  await t.test('subtitle execution is protected and a prepared quote cannot later consume deleted input',async()=>{
    const owner='purge-subtitle',item=await add(owner);
    await pg.pool.query("INSERT INTO subtitle_operations VALUES('subtitle-running',$1,'provider-pending',$2),('subtitle-prepared',$1,'prepared',$2)",[owner,{ref:item.ref}]);
    await request(owner,(await freeze({userId:owner,scope})).id);
    const calls:string[]=[];await worker(owner,async key=>{calls.push(key);});assert.equal(calls.length,0);
    await assert.rejects(pg.pool.query("UPDATE subtitle_operations SET state='queued' WHERE id='subtitle-prepared'"),/MEDIA_DELETED/);
    await pg.pool.query("UPDATE subtitle_operations SET state='completed' WHERE id='subtitle-running'");
    await worker(owner,async key=>{calls.push(key);});assert.equal(calls.length,2);
  });

  await t.test('replayed canonical and job projections cannot resurrect a purged source',async()=>{
    const owner='purge-replay',item=await add(owner);
    const url=(await pg.pool.query('SELECT url FROM media_assets WHERE id=$1',[item.id])).rows[0].url;
    await request(owner,(await freeze({userId:owner,scope})).id);await worker(owner);
    await pg.pool.query("UPDATE media_assets SET status='ready',deleted_at=NULL WHERE id=$1",[item.id]);
    assert.equal((await pg.pool.query('SELECT status FROM media_assets WHERE id=$1',[item.id])).rows[0].status,'deleted');
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,render_ids,hero_render_id,thumb_url) VALUES('old-replay-job',$1,'completed',$2,$3,$3)",[owner,JSON.stringify([url,'https://provider.invalid/independent.png']),url]);
    const job=(await pg.pool.query("SELECT render_ids,hero_render_id,thumb_url FROM app_jobs WHERE job_id='old-replay-job'")).rows[0];
    assert.deepEqual(job.render_ids,['https://provider.invalid/independent.png']);assert.equal(job.hero_render_id,null);assert.equal(job.thumb_url,'/assets/frames/thumb-1x1.svg');
  });
  await t.test('post-confirmation preparation and raw alias admission are rejected',async()=>{
    const owner='purge-prep-after',item=await add(owner),url=(await pg.pool.query('SELECT url FROM media_assets WHERE id=$1',[item.id])).rows[0].url;
    await request(owner,(await freeze({userId:owner,scope})).id);
    await assert.rejects(pg.pool.query("INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata) VALUES('late-child','ma_ffffffffffffffffffffffffffffffff',$1,'image','https://provider.invalid/late-child.png','upload',$2)",[owner,{creator:{version:1,source:item.ref,sourceFingerprint:'old'}}]),/MEDIA_DELETED/);
    for(const alias of [url.replace('cdn.maxvideoai.com','media.maxvideoai.com'),`${url}#fragment`]){
      await assert.rejects(pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('raw-alias-use',$1,'queued',$2)",[owner,{url:alias}]),/MEDIA_DELETED/);
    }
  });

  await t.test('a proven technical child cannot bypass pending deletion through its raw URL',async()=>{
    const owner='purge-prepared-url',item=await add(owner);
    const {resolveStudioMedia}=await import('../frontend/src/server/studio/media-resolver');
    const {creatorSourceFingerprint}=await import('../frontend/src/server/tools/creator-sources');
    const fingerprint=creatorSourceFingerprint(await resolveStudioMedia(owner,item.ref));
    const url='https://provider.invalid/technical-child.png';
    await pg.pool.query("INSERT INTO media_assets(id,public_id,user_id,kind,url,source,metadata) VALUES('prepared-url-child','ma_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',$1,'image',$2,'upload',$3)",[owner,url,{creator:{version:1,source:item.ref,sourceFingerprint:fingerprint}}]);
    await pg.pool.query("INSERT INTO user_assets(asset_id,user_id,url,mime_type,metadata) VALUES('prepared-url-child',$1,$2,'image/png',$3)",[owner,url,{canonicalAssetId:'prepared-url-child'}]);
    await request(owner,(await freeze({userId:owner,scope})).id);
    await assert.rejects(pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('child-raw-job',$1,'queued',$2)",[owner,{url}]),/MEDIA_DELETED/);
    await pg.pool.query("INSERT INTO media_assets(id,public_id,user_id,kind,url,source) VALUES('independent-url-child','ma_dddddddddddddddddddddddddddddddd',$1,'image',$2,'upload')",[owner,`${url}?independent=1`]);
    await pg.pool.query("INSERT INTO app_jobs(job_id,user_id,status,settings_snapshot) VALUES('independent-child-job',$1,'queued',$2)",[owner,{url}]);
  });

});
