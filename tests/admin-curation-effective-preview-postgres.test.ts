import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('effective preview and atomic save', async t => {
  const db = await startDisposablePostgres('effective-preview');
  process.env.DATABASE_URL = db.databaseUrl;
  process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
  const { getDb } = await import('../frontend/src/lib/db');
  try {
    await db.pool.query(`CREATE TABLE playlists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text UNIQUE,is_public boolean DEFAULT true,updated_at timestamptz DEFAULT now());
      CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,PRIMARY KEY(playlist_id,video_id));
      CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,engine_id text DEFAULT 'wan-3',engine_label text,prompt text DEFAULT 'Fixture',thumb_url text,video_url text DEFAULT '/video.mp4',status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',indexable boolean DEFAULT true,created_at timestamptz DEFAULT now(),duration_sec int,aspect_ratio text DEFAULT '16:9',has_audio boolean,can_upscale boolean,featured boolean,featured_order int,final_price_cents int,currency text,pricing_snapshot jsonb);
      CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
      CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
      CREATE TABLE video_seo_pages(video_id text,seo_title text);
      INSERT INTO playlists(slug) VALUES ('examples'),('family-wan'),('examples-wan-3');
      INSERT INTO app_jobs(job_id) SELECT 'v'||n FROM generate_series(1,220) n;
      UPDATE app_jobs SET aspect_ratio='9:16' WHERE job_id='v2';
      INSERT INTO playlist_items SELECT p.id,j.job_id,substring(j.job_id from 2)::int,false FROM playlists p CROSS JOIN app_jobs j;
      INSERT INTO video_seo_pages VALUES ('v1','Original SEO');`);
    for (const file of ['52_playlist_curations.sql','53_playlist_opening.sql']) await db.pool.query(readFileSync(`neon/migrations/${file}`,'utf8'));
    const service = await import('../frontend/server/playlists/curation-service');
    const { listCatalogPage } = await import('../frontend/server/videos-catalog-page');
    const { listPlaylistVideosWithOptions } = await import('../frontend/server/videos-playlists');
    const rows = await db.pool.query<{id:string;slug:string}>('SELECT id,slug FROM playlists');
    const ids = new Map(rows.rows.map(row => [row.slug,row.id]));
    const openingIds = ['v1','v2','v3','v4'];
    await t.test('preview_matches_published_catalog', async () => {
      for (const slug of ['family-wan','examples','examples-wan-3']) {
        const id = ids.get(slug)!;
        const snapshot = await service.getCurationSnapshot(id);
        if (slug==='family-wan') await assert.rejects(service.previewCuration(id,{mode:'manual',orderedIds:['v1'],excludedIds:[]},snapshot.revision), /four opening/i);
        const draft = {mode:'manual',orderedIds:['v4','v7','v8'],excludedIds:[],openingIds};
        const preview = await service.previewCuration(id,draft,snapshot.revision);
        assert.equal(preview.effective.total,6);
        assert.equal(preview.effective.currentTotal,slug==='examples-wan-3'?200:220);
        assert.equal(preview.effective.removedCount,slug==='examples-wan-3'?200:214);
        assert.deepEqual(preview.effective.openingFormats,['16:9','9:16','16:9','16:9']);
        assert.ok(preview.effective.warnings.some(w => /remov/i.test(w)));
        if(slug==='family-wan') assert.deepEqual(preview.effective.suppressedSourceSlugs,['examples','examples-wan-3']);
        await service.saveCuration(id,draft,snapshot.revision,preview.token,null);
        const published = slug==='examples-wan-3'
          ? await listPlaylistVideosWithOptions({slug,limit:200})
          : (await listCatalogPage({familyId:slug==='family-wan'?'wan':undefined,sort:'playlist',limit:24,offset:0})).items;
        assert.deepEqual(preview.effective.firstPageIds,published.slice(0,24).map(item=>item.id));
        assert.equal(new Set(preview.effective.firstPageIds).size,6);
        await db.pool.query('DELETE FROM playlist_curations');
      }
      const id=ids.get('examples-wan-3')!;
      const snapshot=await service.getCurationSnapshot(id);
      const hybrid=await service.previewCuration(id,{mode:'hybrid',orderedIds:[],excludedIds:[]},snapshot.revision);
      assert.equal(hybrid.effective.total,200);
      assert.ok(hybrid.effective.warnings.some(w=>/200/.test(w)));
      const empty=await service.previewCuration(id,{mode:'manual',orderedIds:[],excludedIds:[]},snapshot.revision);
      assert.equal(empty.effective.total,0);
      assert.ok(empty.effective.warnings.some(w=>/empty|zero/i.test(w)));
    });
    await t.test('effective projection and save traverse more than 2000 IDs', async () => {
      await db.pool.query("INSERT INTO app_jobs(job_id) SELECT 'v'||n FROM generate_series(221,2201) n");
      const id=ids.get('family-wan')!;
      const snapshot=await service.getCurationSnapshot(id);
      const draft={mode:'hybrid',orderedIds:[],excludedIds:[],openingIds};
      const preview=await service.previewCuration(id,draft,snapshot.revision);
      assert.equal(preview.effective.total,2201);
      assert.equal(preview.effective.addedCount,1981);
      const started=performance.now();
      await service.saveCuration(id,draft,snapshot.revision,preview.token,null);
      t.diagnostic(`2201-item family save transaction: ${Math.round(performance.now()-started)} ms`);
      const actual=await listCatalogPage({familyId:'wan',sort:'playlist',limit:24,offset:0});
      assert.equal(actual.total,2201);
      assert.deepEqual(actual.items.map(item=>item.id),preview.effective.firstPageIds);
      await db.pool.query('DELETE FROM playlist_curations');
      await db.pool.query("DELETE FROM app_jobs WHERE substring(job_id from 2)::int>220");
    });
    await t.test('parent curation suppresses an already curated child and deduplicates the hub', async () => {
      const model=ids.get('examples-wan-3')!;
      const modelSnapshot=await service.getCurationSnapshot(model);
      const modelDraft={mode:'manual',orderedIds:['v5','v6'],excludedIds:[]};
      const modelPreview=await service.previewCuration(model,modelDraft,modelSnapshot.revision);
      await service.saveCuration(model,modelDraft,modelSnapshot.revision,modelPreview.token,null);
      const family=ids.get('family-wan')!;
      const snapshot=await service.getCurationSnapshot(family);
      const draft={mode:'manual',openingIds,orderedIds:['v1'],excludedIds:['v5']};
      const preview=await service.previewCuration(family,draft,snapshot.revision);
      assert.equal(preview.effective.currentTotal,220);
      assert.deepEqual(preview.effective.suppressedSourceSlugs,['examples','examples-wan-3']);
      await service.saveCuration(family,draft,snapshot.revision,preview.token,null);
      const actual=await listCatalogPage({familyId:'wan',sort:'playlist',limit:24,offset:0});
      assert.equal(actual.total,preview.effective.total);
      assert.deepEqual(actual.items.map(item=>item.id),preview.effective.firstPageIds);
      const hub=await listCatalogPage({sort:'playlist',limit:24,offset:0});
      assert.equal(hub.total,220,'legacy hub overlap is deduplicated against curated family');
      await db.pool.query('DELETE FROM playlist_curations');
    });
    await t.test('busy media writer rejects promptly while preview remains read-only', async () => {
      const id=ids.get('examples')!;
      const draft={mode:'manual',orderedIds:['v1'],excludedIds:[]};
      const snapshot=await service.getCurationSnapshot(id);
      const writer=await db.pool.connect();
      let pending: Promise<unknown> | undefined;
      let outcome: unknown;
      try {
        await writer.query('BEGIN');
        await writer.query("UPDATE app_jobs SET prompt=prompt WHERE job_id='v220'");
        const preview=await service.previewCuration(id,draft,snapshot.revision);
        pending=service.saveCuration(id,draft,snapshot.revision,preview.token,null).then(()=> 'saved', error=>error.status);
        outcome=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve('blocked'),500))]);
      } finally { await writer.query('ROLLBACK'); writer.release(); await pending; }
      assert.equal(outcome,409,'save must not queue broad locks behind ongoing generation writes');
      assert.equal((await db.pool.query('SELECT * FROM playlist_curations')).rowCount,0);
    });
    await t.test('historical catalog aliases also bind media changes into the token', async () => {
      const id=ids.get('family-wan')!;
      await db.pool.query("INSERT INTO app_jobs(job_id,engine_id) VALUES ('historical','wan26')");
      await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES ($1,'hybrid','{}','{}')",[id]);
      const snapshot=await service.getCurationSnapshot(id);
      const draft={mode:'hybrid',orderedIds:[],excludedIds:[]};
      const preview=await service.previewCuration(id,draft,snapshot.revision);
      assert.equal(preview.effective.total,221);
      await db.pool.query("UPDATE app_jobs SET video_url='/changed.mp4' WHERE job_id='historical'");
      await assert.rejects(service.saveCuration(id,draft,snapshot.revision,preview.token,null), (error:unknown)=>(error as {status:number}).status===409);
      await db.pool.query('DELETE FROM playlist_curations');
      await db.pool.query("DELETE FROM app_jobs WHERE job_id='historical'");
    });
    await t.test('stale_media_rejects_save',async()=>{
      const id=ids.get('examples')!;
      const draft={mode:'manual',orderedIds:['v1'],excludedIds:[]};
      const initial=await service.getCurationSnapshot(id);
      const initialPreview=await service.previewCuration(id,draft,initial.revision);
      await service.saveCuration(id,draft,initial.revision,initialPreview.token,null);
      for(const [change,restore] of [
        ["UPDATE app_jobs SET visibility='private' WHERE job_id='v1'","UPDATE app_jobs SET visibility='public' WHERE job_id='v1'"],
        ["UPDATE app_jobs SET aspect_ratio='1:1' WHERE job_id='v1'","UPDATE app_jobs SET aspect_ratio='16:9' WHERE job_id='v1'"],
        ["UPDATE app_jobs SET video_url='/replacement.mp4' WHERE job_id='v1'","UPDATE app_jobs SET video_url='/video.mp4' WHERE job_id='v1'"],
        ["UPDATE app_jobs SET video_url='/offpage.mp4' WHERE job_id='v219'","UPDATE app_jobs SET video_url='/video.mp4' WHERE job_id='v219'"],
        ["UPDATE playlist_items SET order_index=3 WHERE video_id='v10' AND playlist_id=(SELECT id FROM playlists WHERE slug='examples-wan-3')","UPDATE playlist_items SET order_index=10 WHERE video_id='v10'"],
      ]) {
        const before=await service.getCurationSnapshot(id);
        const preview=await service.previewCuration(id,draft,before.revision);
        const seo=(await db.pool.query('SELECT * FROM video_seo_pages')).rows;
        await db.pool.query(change);
        const persisted=(await db.pool.query('SELECT * FROM playlist_curations')).rows;
        await assert.rejects(service.saveCuration(id,draft,before.revision,preview.token,null),(e:unknown)=>(e as {status:number}).status===409);
        assert.deepEqual((await db.pool.query('SELECT * FROM playlist_curations')).rows,persisted);
        assert.deepEqual((await db.pool.query('SELECT * FROM video_seo_pages')).rows,seo);
        await db.pool.query(restore);
      }
    });
  } finally { await getDb().end(); await db.cleanup(); }
});

test('catalog preview does not import curation service at runtime',()=>{
  assert.doesNotMatch(readFileSync('frontend/server/videos-catalog-page.ts','utf8'),/from ['"].*curation-service['"]/);
});
