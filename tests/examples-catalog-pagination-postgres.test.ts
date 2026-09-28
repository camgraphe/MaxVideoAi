import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { missingDisposablePostgresCommand, startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend = createRequire(resolve('frontend/package.json'));
type Statement = { text: string; params: unknown[]; poolMs?: number; queryMs?: number; rows?: number; bytes?: number };

test('public gallery traverses every eligible video beyond the old window and hydrates only the requested page', { timeout: 60_000 }, async (t) => {
  const missing = missingDisposablePostgresCommand();
  if (missing) return t.skip(`${missing} is unavailable`);
  const postgres = await startDisposablePostgres('catalog-pages');
  const folder = mkdtempSync(join(tmpdir(), 'catalog-pages-bundle-'));
  const previous = Object.fromEntries(['DATABASE_URL', 'NEXT_PHASE', 'EXAMPLES_PLAYLIST_SLUG', 'MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT'].map(key => [key, process.env[key]]));
  let closeDb: (() => Promise<void>) | undefined;
  t.after(async () => {
    await closeDb?.();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(folder, { recursive: true, force: true });
    await postgres.cleanup();
  });
  await postgres.pool.query(`
    CREATE TABLE playlists(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE, is_public boolean, updated_at timestamptz DEFAULT now());
    CREATE TABLE playlist_items(playlist_id uuid,video_id text,order_index int,pinned boolean DEFAULT false,created_at timestamptz DEFAULT now(),PRIMARY KEY(playlist_id,video_id));
    CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text DEFAULT 'fixture-owner',engine_id text,engine_label text DEFAULT 'Fixture',prompt text DEFAULT 'Fixture',
      thumb_url text,video_url text,status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',indexable boolean DEFAULT true,
      created_at timestamptz,duration_sec int DEFAULT 5,aspect_ratio text DEFAULT '16:9',has_audio boolean,can_upscale boolean,
      featured boolean,featured_order int,final_price_cents int DEFAULT 25,currency text DEFAULT 'USD',pricing_snapshot jsonb,settings_snapshot jsonb);
    CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
    CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
    INSERT INTO playlists(slug,is_public) VALUES ('examples',true),('family-kling',true),('examples-kling-3-pro',true),('examples-ltx-2-5-pro',true);
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at)
      SELECT 'kling-'||n,'kling-3-pro','https://media.maxvideoai.com/fixture/kling-'||n||'.webp','https://media.maxvideoai.com/fixture/kling-'||n||'.mp4',
        '2026-09-20'::timestamptz + n * interval '1 minute' FROM generate_series(1,513) n;
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at)
      SELECT engine,engine,'https://media.maxvideoai.com/fixture/'||engine||'.webp','https://media.maxvideoai.com/fixture/'||engine||'.mp4','2026-09-21'
      FROM unnest(ARRAY['seedance-2-0','veo-3-1','happy-horse-1-1','ltx-2-3-fast','wan-2-6','ltx-2-5-pro']) engine;
    INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at,visibility,indexable,status,surface)
      SELECT id,'kling-3-pro','https://media.maxvideoai.com/fixture/'||id||'.webp','https://media.maxvideoai.com/fixture/'||id||'.mp4','2026-09-22',visibility,indexable,status,surface
      FROM (VALUES ('private','private',true,'completed','video'),('hidden','public',false,'completed','video'),
        ('running','public',true,'running','video'),('image','public',true,'completed','image'),
        ('deleted-output','public',true,'completed','video'),('deleted-asset','public',true,'completed','video')) v(id,visibility,indexable,status,surface);
    INSERT INTO job_outputs(job_id,kind,status,url) VALUES ('deleted-output','video','deleted','https://media.maxvideoai.com/fixture/deleted-output.mp4');
    INSERT INTO media_assets(user_id,url,status) VALUES ('fixture-owner','https://media.maxvideoai.com/fixture/deleted-asset.mp4','deleted');
    INSERT INTO playlist_items(playlist_id,video_id,order_index)
      SELECT p.id,j.job_id,CASE WHEN j.job_id LIKE 'kling-%' THEN 1000-substring(j.job_id from 7)::int ELSE 2000 END
      FROM playlists p CROSS JOIN app_jobs j WHERE (p.slug='examples' OR p.slug='examples-kling-3-pro' AND j.engine_id='kling-3-pro'
        OR p.slug='examples-ltx-2-5-pro' AND j.engine_id='ltx-2-5-pro') AND j.job_id NOT IN ('private','hidden','running','image','deleted-output','deleted-asset');
  `);
  await postgres.pool.query(readFileSync('neon/migrations/52_playlist_curations.sql', 'utf8'));
  const dbPath = resolve('frontend/src/lib/db.ts');
  const output = join(folder, 'reader.cjs');
  await build({
    stdin: { contents: `export {loadHomepageExamples} from './frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples';
      export * from './frontend/server/videos';export * from './frontend/server/videos-playlists';
      export {getExampleWatchDetail,buildExampleWatchDetail} from './frontend/server/example-watch-detail-loader';
      export {getVideoWatchPageDataById} from './frontend/server/video-seo';
      export {getDb,statements,setBeforeQuery} from '@/lib/db';`, resolveDir: process.cwd() },
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href) },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'count-real-postgres-reads', setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({path:'react-cache',namespace:'test-react'}));
      builder.onLoad({filter:/.*/,namespace:'test-react'}, () => ({contents:'export const cache = fn => fn;',loader:'js'}));
      builder.onResolve({ filter: /^@\/lib\/db$/ }, () => ({ path: 'db', namespace: 'fixture' }));
      builder.onLoad({ filter: /^db$/, namespace: 'fixture' }, () => ({ contents: `
        export * from ${JSON.stringify(dbPath)};
        import {getDb,createQueryExecutor} from ${JSON.stringify(dbPath)};
        export const statements=[]; let beforeQuery;
        export function setBeforeQuery(hook){beforeQuery=hook;}
        export async function query(text,params=[]){
          const statement={text,params}; statements.push(statement); await beforeQuery?.(text,params);
          const started=performance.now(); const client=await getDb().connect();
          statement.poolMs=performance.now()-started; const acquired=performance.now();
          try {const rows=await createQueryExecutor(client).query(text,params); statement.queryMs=performance.now()-acquired;
            statement.rows=rows.length; statement.bytes=Buffer.byteLength(JSON.stringify(rows)); return rows;
          } finally {client.release();}
        }
      `, loader: 'js', resolveDir: process.cwd() }));
      builder.onResolve({ filter: /^pg$/ }, args => ({ path: requireFrontend.resolve(args.path), external: true }));
    } }],
  });
  const readonlyUrl = new URL(postgres.databaseUrl);
  readonlyUrl.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readonlyUrl.toString();
  process.env.EXAMPLES_PLAYLIST_SLUG = 'examples';
  delete process.env.NEXT_PHASE;
  delete process.env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT;
  const reader = requireFrontend(output);
  closeDb = () => reader.getDb().end();
  const statements: Statement[] = reader.statements;

  const read = (offset = 0, extra = {}) => reader.listExamplesPage({sort:'playlist',limit:24,offset,engineGroup:'kling',...extra});
  await t.test('legacy total counts the whole catalog before limiting and every page is reachable', async () => {
    const first = await read();
    assert.equal(first.total, 513);
    assert.equal(first.items.length, 24);
    assert.equal(first.hasMore, true);
    assert.equal(first.items[0].id, 'kling-1');
    const all = [];
    for (let offset = 0; offset < 513; offset += 24) {
      statements.length=0;
      const result=await read(offset);
      assert.equal(result.total,513);
      all.push(...result.items.map(item=>item.id));
      assert.ok(statements.filter(s=>s.text.includes('thumb_url')).every(s=>s.rows <= 24), 'media hydration never returns the whole catalog');
    }
    assert.equal(all.length,513);
    assert.equal(new Set(all).size,513);
    assert.equal(all[512],'kling-513');
    const tail=await read(504);assert.equal(tail.items.length,9);assert.equal(tail.hasMore,false);
    const absent=await read(528);assert.equal(absent.total,513);assert.deepEqual(absent.items,[]);assert.equal(absent.hasMore,false);
  });
  await t.test('date and duration sorting happen before page membership, with deterministic ties', async()=>{
    assert.equal((await read(0,{sort:'date-desc'})).items[0].id,'kling-513');
    assert.equal((await read(24,{sort:'date-desc'})).items[0].id,'kling-489');
    await postgres.pool.query("UPDATE app_jobs SET duration_sec=90 WHERE job_id='kling-500'");
    assert.equal((await read(0,{sort:'duration-desc'})).items[0].id,'kling-500');
  });
  await t.test('family inheritance deduplicates overlapping model and hub membership before counting',async()=>{
    const page=await reader.listExampleFamilyPage('kling',{sort:'playlist',limit:24,offset:504});
    assert.equal(page.total,513);assert.equal(page.items.length,9);
  });
  await t.test('the general catalog includes independently published family/model media and honors explicit selection',async()=>{
    await postgres.pool.query(`
      INSERT INTO playlists(slug,is_public) VALUES ('family-seedance',true),('examples-seedance-2-0',true);
      INSERT INTO app_jobs(job_id,engine_id,thumb_url,video_url,created_at) VALUES
        ('family-only','seedance-2-0','https://media.maxvideoai.com/family.webp','https://media.maxvideoai.com/family.mp4','2026-09-22'),
        ('model-only','seedance-2-0','https://media.maxvideoai.com/model.webp','https://media.maxvideoai.com/model.mp4','2026-09-22');
      INSERT INTO playlist_items(playlist_id,video_id,order_index)
        SELECT id,CASE WHEN slug='family-seedance' THEN 'family-only' ELSE 'model-only' END,1
        FROM playlists WHERE slug IN ('family-seedance','examples-seedance-2-0');
    `);
    const general = () => reader.listExamplesPage({sort:'date-desc',limit:24,offset:0});
    const before=await general();
    assert.ok(before.items.some(item=>item.id==='family-only'));
    assert.ok(before.items.some(item=>item.id==='model-only'));
    await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
      SELECT id,'manual',ARRAY['family-only'],'{}' FROM playlists WHERE slug='family-seedance'`);
    const curatedFamily=await general();
    assert.equal(curatedFamily.total,before.total-1);
    assert.ok(!curatedFamily.items.some(item=>item.id==='model-only'),'explicit family selection suppresses its inherited model feed');
    await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
      SELECT id,'manual',ARRAY['kling-1'],'{}' FROM playlists WHERE slug='examples'`);
    const selected=await general();assert.equal(selected.total,1);assert.equal(selected.items[0].id,'kling-1');
    await postgres.pool.query(`DELETE FROM playlist_curations WHERE playlist_id IN (SELECT id FROM playlists WHERE slug IN ('examples','family-seedance'))`);
    await postgres.pool.query(`DELETE FROM playlist_items WHERE video_id IN ('family-only','model-only');DELETE FROM app_jobs WHERE job_id IN ('family-only','model-only')`);
  });
  await t.test('configured hybrid excludes before count and rejects deleted/private sources',async()=>{
    await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
      SELECT id,'hybrid',ARRAY['kling-500','kling-1'],ARRAY['kling-2'] FROM playlists WHERE slug='examples'`);
    const page=await read();assert.equal(page.total,512);assert.equal(page.items[0].id,'kling-500');assert.equal(page.items[1].id,'kling-1');
    assert.ok(!page.items.some(item=>item.id==='kling-2'));
    await postgres.pool.query("UPDATE playlists SET is_public=false WHERE slug='examples'");
    const hidden=await read();assert.equal(hidden.total,0);assert.deepEqual(hidden.items,[]);
    await postgres.pool.query("UPDATE playlists SET is_public=true WHERE slug='examples'");
  });
  await t.test('manual empty family is authoritative; manual ordered selection is bounded',async()=>{
    await postgres.pool.query(`INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids)
      SELECT id,'manual','{}','{}' FROM playlists WHERE slug='family-kling'`);
    const empty=await reader.listExampleFamilyPage('kling',{sort:'playlist',limit:24,offset:0});assert.equal(empty.total,0);
    await postgres.pool.query(`UPDATE playlist_curations SET ordered_ids=ARRAY['kling-500','kling-20','kling-1']
      WHERE playlist_id=(SELECT id FROM playlists WHERE slug='family-kling')`);
    const picked=await reader.listExampleFamilyPage('kling',{sort:'playlist',limit:2,offset:1});
    assert.equal(picked.total,3);assert.deepEqual(picked.items.map(item=>item.id),['kling-20','kling-1']);
  });
  await t.test('missing curation schema uses the same complete legacy pagination read-only',async()=>{
    await postgres.pool.query('ALTER TABLE playlist_curations RENAME TO unavailable_curations');
    try {const legacy=await read(504);assert.equal(legacy.total,513);assert.equal(legacy.items.length,9);}
    finally {await postgres.pool.query('ALTER TABLE unavailable_curations RENAME TO playlist_curations');}
  });
  await t.test('reader rechecks public/deleted eligibility and performs only bounded read-only hydration',async()=>{
    statements.length=0;
    const detail=await reader.getExampleWatchDetail('kling-20');assert.equal(detail.id,'kling-20');
    assert.ok(!JSON.stringify(detail).includes('fixture-owner'));
    assert.ok(statements.every(statement=>/^\s*SELECT\b/i.test(statement.text)));
    assert.ok(statements.filter(statement=>statement.text.includes('FROM app_jobs')).every(statement=>statement.rows===1));
    const editorialRead=statements.find(statement=>statement.text.includes('FROM video_seo_pages'));
    assert.ok(editorialRead?.text.includes('WHERE video_id=$1'),'single-video reader must not hydrate all editorial entries');
    for(const id of ['private','hidden','running','image','deleted-output','deleted-asset','missing']) {
      assert.equal(await reader.getExampleWatchDetail(id),null);
      assert.equal(await reader.getVideoWatchPageDataById(id),null,`direct watch rejects ${id}`);
    }
    await postgres.pool.query("UPDATE app_jobs SET visibility='private' WHERE job_id='kling-20'");
    assert.equal(await reader.getExampleWatchDetail('kling-20'),null,'a previously opened public video is checked again');
  });

  await t.test('persisted admin editorial content reaches the popup and direct watch page identically',async()=>{
    for(const migration of ['23_video_seo_pages.sql','24_video_seo_canonical_slug.sql','25_video_seo_visual_context.sql','40_video_seo_rollout_exclusions.sql']) {
      await postgres.pool.query(readFileSync(`neon/migrations/${migration}`,'utf8'));
    }
    await postgres.pool.query(`UPDATE app_jobs SET prompt=$1 WHERE job_id='kling-21'`, ['An original cinematic scene showing a dancer performing precise circular movements in a sunlit courtyard. The camera slowly orbits the dancer from left to right, preserving body proportions, natural lighting, soft shadows, stable architecture, expressive choreography and coherent realistic motion through a continuous five second landscape shot.']);
    await postgres.pool.query(`INSERT INTO video_seo_pages(video_id,seo_status,seo_title,meta_description,h1,video_object_name,short_description,target_keyword,intent,model_slug,examples_slug,canonical_slug)
      VALUES('kling-21','approved','Kling dance film — MaxVideoAI','Watch an original Kling dance film with a continuous camera orbit, natural lighting and the complete generation prompt.','Kling 3 Pro cinematic dance in a sunlit courtyard','Kling dance film','An original Kling 3 Pro dance film, with a continuous camera orbit around a sunlit courtyard and realistic choreography in a single flowing shot.','Kling dance film','camera-motion','kling-3-pro','kling','kling-dance-film')`);
    const popup=await reader.getExampleWatchDetail('kling-21');
    const page=await reader.getVideoWatchPageDataById('kling-dance-film');
    assert.ok(page);assert.equal(page.isEligible,true,JSON.stringify(page.signals.editorialQaErrors));
    statements.length=0;
    const direct=await reader.buildExampleWatchDetail(page.video,page.signals);
    assert.ok(!statements.some(statement=>statement.text.includes('video_seo_pages')),
      'the prepared watch page already owns editorial reads; projecting its reader must not repeat them');
    assert.equal(popup.title,'Kling 3 Pro cinematic dance in a sunlit courtyard');assert.equal(popup.watchHref,'/video/kling-dance-film');
    assert.equal(popup.context.intro,'An original Kling 3 Pro dance film, with a continuous camera orbit around a sunlit courtyard and realistic choreography in a single flowing shot.');
    assert.deepEqual(popup,direct,'both surfaces project the same persisted editorial entry');
    await postgres.pool.query(`INSERT INTO media_assets(user_id,url,status) SELECT user_id,video_url,'deleted' FROM app_jobs WHERE job_id='kling-21'`);
    assert.equal(await reader.getVideoWatchPageDataById('kling-dance-film'),null,'an approved slug cannot expose a deleted output');
    await postgres.pool.query(`DELETE FROM media_assets WHERE url='https://media.maxvideoai.com/fixture/kling-21.mp4'`);
    await postgres.pool.query(`UPDATE video_seo_pages SET h1='A new editorial title',seo_status='disabled' WHERE video_id='kling-21'`);
    const changed=await reader.getExampleWatchDetail('kling-21');
    const disabledPage=await reader.getVideoWatchPageDataById('kling-dance-film');
    assert.equal(changed.title,'A new editorial title');assert.equal(disabledPage.isEligible,false);
    assert.equal(disabledPage.signals.title,changed.title);
  });

});
