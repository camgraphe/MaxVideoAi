import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';
import { getDb } from '../frontend/src/lib/db';
import { getFalEngineBySlug } from '../frontend/src/config/falEngines';
import { getPublicVideoIds, getPublicVideosByIds, listModelExamplePlaylist } from '../frontend/server/videos';
import { readPlaylistVideoSelection } from '../frontend/server/videos-playlists';
import { projectModelPageGallery } from '../frontend/server/model-gallery-projection';
import { pickHeroMedia, toGalleryCard, type FeaturedMedia } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';
import { startDisposablePostgres } from './helpers/disposable-postgres';

type Statement = { sql: string; values?: unknown[]; rows: number; bytes: number };
type Selection = Awaited<ReturnType<typeof listModelExamplePlaylist>>;
type PlanNode = { 'Relation Name'?: string; Filter?: string; 'Actual Loops': number; Plans?: PlanNode[] };

function dimensionLookups(node: PlanNode): number[] {
  const own = node['Relation Name'] === 'job_outputs' && /width IS NOT NULL/.test(node.Filter ?? '')
    ? [node['Actual Loops']] : [];
  return own.concat((node.Plans ?? []).flatMap(dimensionLookups));
}

test('model opening, eligibility and projection survive selecting and hydrating a bounded playlist together', async () => {
  const db = await startDisposablePostgres('model-playlist-page');
  const previous = process.env.DATABASE_URL;
  const readonly = new URL(db.databaseUrl);
  readonly.searchParams.set('options', '-c default_transaction_read_only=on');
  process.env.DATABASE_URL = readonly.toString();
  const model = 'flux-3-max';
  const slug = 'examples-' + model;
  const engine = getFalEngineBySlug(model)!;
  const original = 'clip-012';
  const editorial = 'clip-014';
  const fallback: FeaturedMedia = { id:'absent', label:'Absent', prompt:'', videoUrl:'/fallback.mp4', posterUrl:'/fallback.jpg', href:null, hasAudio:false, durationSec:null };
  const pick = async (selection: Selection) => {
    const result = await projectModelPageGallery({
      engine, examples:selection.videos, managed:selection.managed, preferred:{hero:original,demo:null}, featuredIds:[],
      getPublicVideosByIds, getPublicVideoIds, toCard:v=>toGalleryCard(v),
    });
    return pickHeroMedia(result.galleryVideos, result.preferredIds.hero, fallback, {preserveOrder:result.managed});
  };
  let trace: Statement[] | null = null;
  const delayMs = process.env.MODEL_PLAYLIST_PERF_EVIDENCE ? 35 : 0;
  getDb().on('connect', client => {
    const query = client.query.bind(client);
    client.query = (async (text: string, values?: unknown[]) => {
      if (!trace) return query(text, values);
      if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
      const result = await query(text, values);
      trace.push({sql:text,values,rows:result.rows.length,bytes:Buffer.byteLength(JSON.stringify(result.rows))});
      return result;
    }) as typeof client.query;
  });
  const measure = async (read: () => Promise<Selection>) => {
    const statements: Statement[] = [];
    trace = statements;
    const start = performance.now();
    try {
      const selected = await read();
      return {selected,statements,ms:performance.now()-start,bytes:statements.reduce((n,entry)=>n+entry.bytes,0)};
    } finally { trace = null; }
  };
  try {
    await promisify(execFile)('pnpm',['exec','tsx','--tsconfig','frontend/tsconfig.json','performance/gallery-final/seed-fixture.ts'], {
      env:{...process.env,FIXTURE_DATABASE_URL:db.databaseUrl},timeout:30000,
    });
    await db.pool.query(`INSERT INTO app_jobs(job_id,user_id,engine_id,engine_label,duration_sec,prompt,thumb_url,video_url,
      aspect_ratio,has_audio,status,surface,visibility,indexable,created_at,settings_snapshot)
      SELECT 'clip-'||lpad(n::text,3,'0'),'fixture',$1,'FLUX fixture',8,repeat('public prompt ',100),
        '/poster-'||n||'.jpg','/video-'||n||'.mp4','16:9',true,'completed','video','public',true,
        '2026-08-01'::timestamptz + (n/3) * INTERVAL '1 minute','{"core":{"resolution":"1080p"},"inputMode":"t2v"}'
      FROM generate_series(1,260) n`,[model]);
    const {rows:[playlist]}=await db.pool.query('INSERT INTO playlists(slug,is_public) VALUES($1,true) RETURNING id',[slug]);
    await db.pool.query("INSERT INTO playlist_items(playlist_id,video_id,order_index) VALUES($1,'clip-012',8),($1,'clip-014',NULL),($1,'clip-017',NULL)",[playlist.id]);
    const readLegacy=()=>readPlaylistVideoSelection({slug,limit:200});
    const readFast=()=>listModelExamplePlaylist(slug,200);
    const pre=await readLegacy(),post=await readFast();
    assert.deepEqual(post,pre,'legacy null positions, stored order, price, mode and media projections');
    assert.deepEqual(post.videos.map(v=>v.id),[original,'clip-017',editorial]);
    assert.equal(post.videos[0].generationMode,undefined);
    assert.equal((await pick(post)).id,original);
    await db.pool.query("INSERT INTO playlist_curations(playlist_id,mode,ordered_ids,excluded_ids,opening_ids) VALUES($1,'hybrid',$2,$3,$4)",
      [playlist.id,[original,editorial],['clip-013'],[editorial,'clip-013','clip-018','clip-019']]);
    const reference=await measure(readLegacy);
    const candidate=await measure(readFast);
    assert.deepEqual(candidate.selected,reference.selected,'full ordered card DTOs');
    assert.deepEqual(await listModelExamplePlaylist(slug,0),{managed:true,videos:[]});
    assert.deepEqual(await listModelExamplePlaylist(slug,501),await readPlaylistVideoSelection({slug,limit:501}));
    assert.deepEqual(candidate.selected.videos.slice(0,4).map(v=>v.id),[editorial,'clip-018','clip-019',original]);
    assert.deepEqual(candidate.selected.videos.slice(4,7).map(v=>v.id),['clip-258','clip-259','clip-260'], 'equal hybrid timestamps use the persisted job ID order');
    assert.equal(candidate.selected.videos[0].generationMode,'t2v');
    assert.equal(candidate.selected.videos.length,200);
    assert.equal((await pick(candidate.selected)).posterUrl,'/poster-14.jpg');
    assert.equal(reference.statements.length,3);
    assert.ok(reference.statements.some(s=>s.rows===260),'control fetches every candidate before limiting the selection');
    assert.equal(candidate.statements.length,1);
    assert.equal(candidate.statements[0].rows,200);
    assert.ok(candidate.bytes<reference.bytes);
    if (process.env.MODEL_PLAYLIST_PERF_EVIDENCE) {
      const report = (entry: typeof candidate)=>({ms:entry.ms,bytes:entry.bytes,rows:entry.statements.map(s=>s.rows)});
      const stmt=candidate.statements[0];
      const plan=await db.pool.query('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) '+stmt.sql,stmt.values);
      await writeFile(process.env.MODEL_PLAYLIST_PERF_EVIDENCE,JSON.stringify({delayMs,reference:report(reference),candidate:report(candidate),plan:plan.rows[0]},null,2)+'\n');
    }
    await db.pool.query("UPDATE app_jobs SET visibility='private' WHERE job_id=$1",[editorial]);
    assert.equal((await pick(candidate.selected)).id,'clip-018','fresh public revalidation excludes a just-hidden selected hero');
    await db.pool.query("UPDATE playlist_curations SET opening_ids=NULL,ordered_ids=$2,mode='manual' WHERE playlist_id=$1",[playlist.id,['clip-019',original]]);
    assert.equal((await pick(await readFast())).id,'clip-019');
    await db.pool.query('UPDATE playlists SET is_public=false WHERE id=$1',[playlist.id]);
    assert.deepEqual(await readFast(),{managed:true,videos:[]});
    assert.equal((await pick(await readFast())).id,fallback.id);
    await db.pool.query('UPDATE playlists SET is_public=true WHERE id=$1',[playlist.id]);
    await db.pool.query(`CREATE TABLE marketing_media(video_id text PRIMARY KEY,publication jsonb,state text,
      tombstone boolean,source_snapshot jsonb,recreation_snapshot jsonb);
      INSERT INTO marketing_media(video_id,publication,state,tombstone)
        SELECT job_id,to_jsonb(app_jobs)||'{"thumb_url":"/public-copy.jpg"}'::jsonb,'ready',false FROM app_jobs WHERE job_id='clip-019';
      INSERT INTO marketing_media(video_id,state,tombstone) VALUES('clip-012','deleted',true)`);
    const previousMediaFlag = process.env.MARKETING_MEDIA_ENABLED;
    process.env.MARKETING_MEDIA_ENABLED='1';
    try {
      const {selected:published,statements:[overlayRead]}=await measure(readFast);
      assert.deepEqual(published,await readLegacy(),'the public marketing copy and its tombstone override the underlying legacy rows');
      assert.deepEqual(published.videos.map(v=>[v.id,v.thumbUrl]),[['clip-019','/public-copy.jpg']]);
      const overlayPlan=await db.pool.query('EXPLAIN (ANALYZE, FORMAT JSON) '+overlayRead.sql,overlayRead.values);
      const lookups=dimensionLookups(overlayPlan.rows[0]['QUERY PLAN'][0].Plan);
      assert.ok(lookups.some(n=>n>0),'the selected card uses legacy output dimensions');
      assert.ok(lookups.every(n=>n<=published.videos.length),
        'each dimension lookup should only run for the selected public card; actual loops: '+lookups.join(','));
    } finally {
      if (previousMediaFlag==null) delete process.env.MARKETING_MEDIA_ENABLED;
      else process.env.MARKETING_MEDIA_ENABLED=previousMediaFlag;
    }
    await db.pool.query('ALTER TABLE playlist_curations RENAME TO unavailable_curations');
    assert.deepEqual(await readFast(),await readLegacy(),'optional schema fallback keeps legacy membership and visibility');
  } finally {
    await getDb().end();
    if (previous==null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=previous;
    await db.cleanup();
  }
});
