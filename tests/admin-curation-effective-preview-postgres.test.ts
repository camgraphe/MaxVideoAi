import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
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
      await service.saveCuration(id,{mode:'hybrid',orderedIds:[],excludedIds:[]},snapshot.revision,hybrid.token,null);
      const {loadPlaylistDestinations}=await import('../frontend/server/playlists/destinations');
      assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-wan-3')?.publicCount,200);
      await db.pool.query('DELETE FROM playlist_curations');
      assert.ok(hybrid.effective.warnings.some(w=>/200/.test(w)));
      const empty=await service.previewCuration(id,{mode:'manual',orderedIds:[],excludedIds:[]},snapshot.revision);
      assert.equal(empty.effective.total,0);
      assert.ok(empty.effective.warnings.some(w=>/empty|zero/i.test(w)));
    });
    await t.test('model preview includes unmanaged preferred additions and filtered rendered cards', async () => {
      const {PREFERRED_MEDIA}=await import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media');
      const preferred=Object.values(PREFERRED_MEDIA['wan-3']).filter(Boolean);
      for(const id of preferred) await db.pool.query("INSERT INTO app_jobs(job_id) VALUES ($1)",[id]);
      const id=ids.get('examples-wan-3')!;
      const snapshot=await service.getCurationSnapshot(id);
      const draft={mode:'manual',orderedIds:['v1'],excludedIds:[]};
      const {projectModelPageGallery}=await import('../frontend/server/model-gallery-projection');
      const {getPublicVideosByIds}=await import('../frontend/server/videos');
      const {toGalleryCard}=await import('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media');
      const publicProjection=async(managed:boolean)=>projectModelPageGallery({
        engine:{modelSlug:'wan-3',id:'wan-3'},examples:await listPlaylistVideosWithOptions({slug:'examples-wan-3',limit:200}),managed,
        preferred:PREFERRED_MEDIA['wan-3'],featuredIds:[],getPublicVideosByIds,toCard:video=>toGalleryCard(video),
      });
      const before=await publicProjection(false);
      const preview=await service.previewCuration(id,draft,snapshot.revision);
      assert.equal(preview.effective.currentTotal,before.galleryVideos.length);
      const {loadPlaylistDestinations}=await import('../frontend/server/playlists/destinations');
      assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-wan-3')?.publicCount,202);

      assert.equal(preview.effective.currentTotal,202,'the rendered legacy page includes preferred cards outside playlist membership');
      assert.equal(preview.effective.removedCount,202);
      assert.equal(preview.effective.addedCount,1);
      assert.ok(preview.effective.warnings.some(w=>/200.*playlist|playlist.*200/i.test(w)));
      assert.ok(!preview.effective.warnings.some(w=>/render at most 200/.test(w)));
      await service.saveCuration(id,draft,snapshot.revision,preview.token,null);
      const {readEffectiveModelPageGallery}=await import('../frontend/server/playlists/curation-model-preview');
      const reader={query:async <T>(sql:string,params?:readonly unknown[])=>(await db.pool.query(sql,params as unknown[])).rows as T[]};
      const actual=await readEffectiveModelPageGallery({slug:'examples-wan-3'},reader);
      assert.deepEqual(preview.effective.firstPageIds,actual.map(item=>item.id).slice(0,24));
      assert.equal(preview.effective.total,actual.length);
      const after=await publicProjection(true);
      assert.deepEqual(preview.effective.firstPageIds,after.galleryVideos.slice(0,24).map(card=>card.id));
      assert.equal(preview.effective.total,after.galleryVideos.length);
      assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-wan-3')?.publicCount,1);
      await db.pool.query('DELETE FROM playlist_curations');
      await db.pool.query('DELETE FROM app_jobs WHERE job_id=ANY($1::text[])',[preferred]);
      const sora=(await db.pool.query("INSERT INTO playlists(slug) VALUES ('examples-sora-2') RETURNING id")).rows[0].id;
      await db.pool.query("INSERT INTO app_jobs(job_id,engine_id,prompt) VALUES ('safe-sora','sora-2','A landscape'),('unsafe-sora','sora-2','John Lennon with the Beatles'),('wrong-sora','wan-3','Wrong model')");
      await db.pool.query("INSERT INTO playlist_items SELECT $1,job_id,5,false FROM app_jobs WHERE job_id IN ('safe-sora','unsafe-sora','wrong-sora')",[sora]);
      // Sora is no longer an editable destination, but its public reader's legacy filter remains policy.
      assert.deepEqual((await readEffectiveModelPageGallery({slug:'examples-sora-2'},reader)).map(item=>item.id),['safe-sora']);
      await db.pool.query('DELETE FROM playlist_curations');
      await db.pool.query('DELETE FROM playlist_items WHERE playlist_id=$1',[sora]);
      await db.pool.query('DELETE FROM playlists WHERE id=$1',[sora]);
      await db.pool.query("DELETE FROM app_jobs WHERE job_id IN ('safe-sora','unsafe-sora','wrong-sora')");
    });
    await t.test('model inventory follows filtered LTX fallback and optional schema behavior', async () => {
      const {loadPlaylistDestinations}=await import('../frontend/server/playlists/destinations');
      const {readEffectiveModelPageGallery}=await import('../frontend/server/playlists/curation-model-preview');
      const reader={query:async <T>(sql:string,params?:readonly unknown[])=>(await db.pool.query(sql,params as unknown[])).rows as T[]};
      await db.pool.query("INSERT INTO playlists(slug) VALUES ('examples-ltx-2-3-pro'),('examples-ltx-2-3')");
      const canonical=(await db.pool.query("SELECT id FROM playlists WHERE slug='examples-ltx-2-3-pro'")).rows[0].id;
      await db.pool.query("INSERT INTO app_jobs(job_id,engine_id) VALUES ('fallback-ltx','ltx-2-3-pro'),('wrong-ltx','wan-3')");
      await db.pool.query("INSERT INTO playlist_items SELECT id,job,1,false FROM playlists CROSS JOIN unnest(ARRAY['fallback-ltx','wrong-ltx']) job WHERE slug='examples-ltx-2-3'");
      try {
        const cards=await readEffectiveModelPageGallery({slug:'examples-ltx-2-3-pro'},reader);
        assert.deepEqual(cards.map(card=>card.id),['fallback-ltx']);
        assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-ltx-2-3-pro')?.publicCount,cards.length);
        await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES ($1,'manual','{}','{}')",[canonical]);
        assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-ltx-2-3-pro')?.publicCount,0,'managed empty suppresses legacy fallback');
        await db.pool.query('ALTER TABLE playlist_curations RENAME TO unavailable_curations');
        try {assert.equal((await loadPlaylistDestinations([])).find(row=>row.slug==='examples-ltx-2-3-pro')?.publicCount,1);}
        finally {await db.pool.query('ALTER TABLE unavailable_curations RENAME TO playlist_curations');}
      } finally {
        await db.pool.query('DELETE FROM playlist_curations WHERE playlist_id=$1',[canonical]);
        await db.pool.query("DELETE FROM playlist_items WHERE video_id IN ('fallback-ltx','wrong-ltx')");
        await db.pool.query("DELETE FROM playlists WHERE slug IN ('examples-ltx-2-3-pro','examples-ltx-2-3')");
        await db.pool.query("DELETE FROM app_jobs WHERE job_id IN ('fallback-ltx','wrong-ltx')");
      }
    });
    await t.test('family historical aliases survive candidate windows and a real hybrid-to-manual save', async () => {
      const candidates=await import('../frontend/server/playlists/curation-candidates-page');
      const id=ids.get('family-wan')!;
      await db.pool.query("INSERT INTO app_jobs(job_id,engine_id) VALUES ('legacy-wan','wan26')");
      await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids) VALUES ($1,'hybrid','{}','{}')",[id]);
      try {
        const before=await listCatalogPage({familyId:'wan',sort:'playlist',limit:24,offset:0});
        assert.equal(before.total,221);
        assert.equal((await candidates.searchCurationCandidatesPage({slug:'family-wan',exactId:'legacy-wan'})).total,1);
        assert.equal((await candidates.searchCurationCandidatesPage({slug:'family-wan',modelSlug:'wan-2-6',exactId:'legacy-wan'})).total,1);
        assert.equal((await candidates.searchCurationCandidatesPage({slug:'examples',familyId:'wan',modelSlug:'wan-2-6',exactId:'legacy-wan'})).total,1);
        assert.equal((await candidates.searchCurationCandidatesPage({slug:'examples-wan-2-6',exactId:'legacy-wan'})).total,0,'direct model eligibility stays unchanged');
        assert.deepEqual(await candidates.filterEligibleCurationIds('family-wan',['legacy-wan']),['legacy-wan']);
        assert.deepEqual((await candidates.loadSelectedCurationItems('family-wan',['legacy-wan'])).map(item=>item.id),['legacy-wan']);
        const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/admin/playlists'});
        const previous=new Map<string,PropertyDescriptor|undefined>();
        for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,React,IS_REACT_ACT_ENVIRONMENT:true,
          fetch:async(url:string,init?:RequestInit)=>{
            const params=new URL(url,'http://localhost').searchParams;
            if(init?.method==='POST') { const body=JSON.parse(String(init.body));return Response.json({ok:true,preview:await service.previewCuration(id,body.draft,body.revision)}); }
            if(init?.method==='PUT') { const body=JSON.parse(String(init.body));return Response.json({ok:true,snapshot:await service.saveCuration(id,body.draft,body.revision,body.token,null)}); }
            if(url.includes('/candidates')) {
              if(params.get('idsOnly')) return Response.json({ok:true,...await candidates.listCurationCandidateIdsPage('family-wan',{offset:Number(params.get('offset')),limit:500})});
              const selected=params.getAll('ids');
              return Response.json({ok:true,...(selected.length?{items:await candidates.loadSelectedCurationItems('family-wan',selected)}:await candidates.searchCurationCandidatesPage({slug:'family-wan',limit:48}))});
            }
            const snapshot=await service.getCurationSnapshot(id);
            const initialIds=await candidates.filterEligibleCurationIds('family-wan',snapshot.config?.orderedIds ?? []);
            return Response.json({ok:true,snapshot,initialIds,selectedItems:await candidates.loadSelectedCurationItems('family-wan',initialIds.slice(0,48)),selectedTotal:initialIds.length,removedCount:0});
          }})) {previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});}
        const root=createRoot(dom.window.document.getElementById('root')!);
        try {
          const {usePlacementEditor}=await import('../frontend/components/admin/playlists/usePlacementEditor');
          let state:ReturnType<typeof usePlacementEditor>;
          function Harness(){state=usePlacementEditor(id);return null;}
          await act(async()=>{root.render(React.createElement(Harness));});
          // React's act does not await database-backed effects by itself.
          for(let attempt=0;attempt<100&&!state!.loaded;attempt++) await act(async()=>{await new Promise(resolve=>setTimeout(resolve,5));});
          assert.ok(state!.loaded);
          await act(async()=>{await state!.changeMode('manual');});
          assert.ok(state!.draft.orderedIds.includes('legacy-wan'));
          await act(async()=>{await state!.makePreview();});
          assert.ok(state!.preview,state!.error ?? 'preview available');
          await act(async()=>{await state!.save();});
          assert.equal(state!.error,null);
          assert.ok((await service.getCurationSnapshot(id)).config?.orderedIds.includes('legacy-wan'));
          const after=await listCatalogPage({familyId:'wan',sort:'playlist',limit:24,offset:0});
          assert.equal(after.total,before.total);
          assert.deepEqual(after.items.map(item=>item.id),before.items.map(item=>item.id));
        } finally {await act(async()=>root.unmount());dom.window.close();for(const[key,value]of previous){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}}
      } finally {await db.pool.query('DELETE FROM playlist_curations WHERE playlist_id=$1',[id]);await db.pool.query("DELETE FROM app_jobs WHERE job_id='legacy-wan'");}
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
