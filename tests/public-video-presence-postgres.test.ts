import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import type { GalleryVideo } from '../frontend/server/videos-normalization';
import { startDisposablePostgres } from './helpers/disposable-postgres';

type Statement = {text:string;params:unknown[];rows?:number;bytes?:number;error?:unknown};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const median = (values: number[]) => {
  const sorted = [...values].sort((a,b)=>a-b), middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};

test('public presence and full readers have identical PostgreSQL membership and final model cards', {timeout:60_000}, async t => {
  const postgres = await startDisposablePostgres('public-video-presence');
  const folder = mkdtempSync(join(tmpdir(), 'public-video-presence-pg-'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const previous = Object.fromEntries(['DATABASE_URL','NEXT_PHASE','MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT'].map(key=>[key,process.env[key]]));
  let reader: any;
  try {
    const serverVersion = (await postgres.pool.query("SELECT current_setting('server_version') AS version")).rows[0].version;
    assert.match(serverVersion, /^17\./);
    await postgres.pool.query(`
      CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text DEFAULT 'fixture-owner',engine_id text DEFAULT 'sora-2',engine_label text DEFAULT 'Fixture',
        prompt text DEFAULT 'Original playlist prompt',thumb_url text DEFAULT 'https://media.maxvideoai.com/fixture/original.webp',
        video_url text DEFAULT 'https://media.maxvideoai.com/fixture/original.mp4',preview_video_url text,keyframe_urls jsonb,
        status text DEFAULT 'completed',surface text DEFAULT 'video',visibility text DEFAULT 'public',indexable boolean DEFAULT true,
        created_at timestamptz DEFAULT '2026-10-09',duration_sec int DEFAULT 5,aspect_ratio text DEFAULT '16:9',has_audio boolean DEFAULT true,
        can_upscale boolean,featured boolean,featured_order int,final_price_cents int DEFAULT 25,currency text DEFAULT 'USD',pricing_snapshot jsonb,settings_snapshot jsonb);
      CREATE TABLE job_outputs(job_id text,kind text,status text,width int,height int,position int,created_at timestamptz,thumb_url text,url text,storage_url text);
      CREATE UNIQUE INDEX job_outputs_job_kind_position_idx ON job_outputs(job_id,kind,position);
      CREATE INDEX job_outputs_job_idx ON job_outputs(job_id);
      CREATE INDEX job_outputs_kind_idx ON job_outputs(kind);
      CREATE TABLE media_assets(user_id text,url text,status text,deleted_at timestamptz);
      INSERT INTO app_jobs(job_id,visibility,indexable,status,surface,video_url) VALUES
        ('public-true','public',true,'completed','video','/public.mp4'),
        ('public-null','public',null,'completed','video','/null.mp4'),
        ('public-false','public',false,'completed','video','/false.mp4'),
        ('private-true','private',true,'completed','video','/private.mp4'),
        ('private-null','private',null,'completed','video','/private-null.mp4'),
        ('private-false','private',false,'completed','video','/private-false.mp4'),
        ('null-visibility',null,true,'completed','video','/visibility.mp4'),
        ('running','public',true,'running','video','/running.mp4'),
        ('failed','public',true,'failed','video',NULL),
        ('image','public',true,'completed','image',NULL),
        ('empty-source','public',true,'completed','video','  '),
        ('null-state','public',null,NULL,NULL,NULL),
        ('deleted-output','public',true,'completed','video','/deleted-output.mp4'),
        ('deleted-asset','public',true,'completed','video','/deleted-asset.mp4');
      INSERT INTO job_outputs(job_id,kind,status,url) VALUES ('deleted-output','video','deleted','/deleted-output.mp4');
      INSERT INTO media_assets(user_id,url,status) VALUES ('fixture-owner','/deleted-asset.mp4','deleted');
      INSERT INTO app_jobs(job_id,engine_id,prompt,aspect_ratio) VALUES
        ('portrait','sora2','Original portrait prompt','9:16'),('landscape','sora-2','Original landscape prompt','16:9'),
        ('revoked','sora-2','Loaded before visibility changed','16:9'),('removed','sora-2','Loaded before deletion','16:9'),
        ('wrong-model','wan-3','Wrong model','16:9'),('editorial-prompt','sora-2','John Lennon with the Beatles','16:9'),
        ('lennon-id','sora-2','ID exclusion','16:9'),('editorial-excerpt','sora-2','Safe stored prompt','16:9'),
        ('featured','sora-2','Hydrated featured prompt','16:9'),('preferred','sora-2','Hydrated preferred prompt','9:16');
      INSERT INTO app_jobs(job_id,engine_id,prompt,thumb_url,video_url,preview_video_url,pricing_snapshot,settings_snapshot)
        SELECT 'gallery-'||n,'wan-3',repeat('A cinematic tabletop product render with camera movement and natural sound. ',8),
          NULL,'https://media.maxvideoai.com/fixture/gallery-'||n||'.mp4','https://media.maxvideoai.com/fixture/gallery-'||n||'-preview.mp4',
          jsonb_build_object('totalCents',25,'currency','USD','base',jsonb_build_object('seconds',5),'description',repeat('Recorded quote settings. ',12)),
          jsonb_build_object('core',jsonb_build_object('resolution','1080p'),'prompt',repeat('Stored prompt context. ',20))
        FROM generate_series(1,200) n;
      INSERT INTO job_outputs(job_id,kind,status,width,height,position,created_at,thumb_url,url)
        SELECT job_id,'video','ready',1920,1080,0,'2026-10-09',NULL,video_url FROM app_jobs WHERE job_id LIKE 'gallery-%';
      INSERT INTO job_outputs(job_id,kind,status,position,created_at,thumb_url,url)
        SELECT job_id,'image','ready',1,'2026-10-09','https://media.maxvideoai.com/fixture/'||job_id||'.webp',
          'https://media.maxvideoai.com/fixture/'||job_id||'-original.webp' FROM app_jobs WHERE job_id LIKE 'gallery-%';
      ANALYZE app_jobs; ANALYZE job_outputs;
    `);
    const dbPath = resolve('frontend/src/lib/db.ts');
    const output = join(folder, 'reader.cjs');
    await build({
      stdin: {contents:`export {getPublicVideoIds,getPublicVideosByIds,getVideosByIds} from './frontend/server/videos';
        export {projectModelPageGallery} from './frontend/server/model-gallery-projection';
        export {toGalleryCard} from './frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media';
        export {getDb,statements,setCapture} from '@/lib/db';`,resolveDir:process.cwd()},
      outfile:output,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',
      define:{'import.meta.url':JSON.stringify(pathToFileURL(resolve('frontend/server/video-keyframes.ts')).href)},
      plugins:[{name:'measure-real-public-readers',setup(builder){
        builder.onResolve({filter:/^@\/lib\/db$/},()=>({path:'db',namespace:'fixture'}));
        builder.onLoad({filter:/^db$/,namespace:'fixture'},()=>({contents:`
          export * from ${JSON.stringify(dbPath)};
          import {query as realQuery} from ${JSON.stringify(dbPath)};
          export const statements=[];let capture=true;
          export function setCapture(value){capture=value;}
          export async function query(text,params=[]){
            if(!capture)return realQuery(text,params);
            const statement={text,params};statements.push(statement);
            try {const rows=await realQuery(text,params);statement.rows=rows.length;statement.bytes=Buffer.byteLength(JSON.stringify(rows));return rows;}
            catch(error){statement.error=error;throw error;}
          }
        `,loader:'js',resolveDir:process.cwd()}));
        builder.onResolve({filter:/^pg$/},args=>({path:requireFrontend.resolve(args.path),external:true}));
      }}],
    });
    const readonlyUrl = new URL(postgres.databaseUrl);
    readonlyUrl.searchParams.set('options','-c default_transaction_read_only=on');
    process.env.DATABASE_URL = readonlyUrl.toString();
    delete process.env.NEXT_PHASE;
    delete process.env.MAXVIDEOAI_PUBLIC_EXAMPLES_SNAPSHOT;
    reader = requireFrontend(output);
    const statements: Statement[] = reader.statements;
    const metrics = () => ({statements:statements.length,rows:statements.reduce((sum,s)=>sum+(s.rows??0),0),
      bytes:statements.reduce((sum,s)=>sum+(s.bytes??0),0),trace:statements.map(({text,rows,bytes})=>({text,rows,bytes}))});
    const assertReadOnly = () => assert.ok(statements.every(s=>/^\s*SELECT\b/i.test(s.text)), 'application reads execute only SELECTs');
    assert.equal((await reader.getDb().query("SELECT current_setting('default_transaction_read_only') AS read_only")).rows[0].read_only,'on');
    await t.test('same exact public predicate accepts legacy status and media states', async () => {
      const expected = ['public-true','public-null','running','failed','image','empty-source','null-state','deleted-output','deleted-asset'];
      const requested = [...expected,'public-false','private-true','private-null','private-false','null-visibility','absent','public-true'];
      statements.length=0;
      const full = await reader.getPublicVideosByIds(requested);
      const ids = await reader.getPublicVideoIds(requested);
      assert.deepEqual([...ids].sort(),expected.sort());
      assert.deepEqual(ids,new Set(full.keys()));
      assert.equal(statements.length,2);
      assert.deepEqual(statements[0].params,statements[1].params);
      assert.equal((statements[1].params[0] as string[]).length,new Set(requested).size);
      assertReadOnly();
      assert.doesNotMatch(statements[1].text,/status|surface|job_outputs|media_assets/);
    });
    await t.test('empty input executes no SQL in either reader', async () => {
      statements.length=0;
      assert.deepEqual(await reader.getPublicVideoIds([]),new Set());
      assert.deepEqual(await reader.getPublicVideosByIds([]),new Map());
      assert.deepEqual(statements,[]);
    });
    await t.test('fresh validation, original card fields, exclusions, additions and order match the fallback', async () => {
      const originalIds=['portrait','wrong-model','editorial-prompt','landscape','revoked','removed','lennon-id','editorial-excerpt'];
      const loaded:Map<string,GalleryVideo> = await reader.getVideosByIds(originalIds);
      const examples=originalIds.map(id=>loaded.get(id)!);
      examples.find(video=>video.id==='editorial-excerpt')!.promptExcerpt='The Beatles';
      // This original playlist object is no longer available by validation time.
      examples.push({...examples[0],id:'absent'});
      await postgres.pool.query("UPDATE app_jobs SET visibility='private' WHERE job_id='revoked'");
      await postgres.pool.query("DELETE FROM app_jobs WHERE job_id='removed'");
      await postgres.pool.query("UPDATE app_jobs SET prompt='New validation prompt',thumb_url='/new-validation.webp' WHERE job_id='portrait'");
      const options={engine:{modelSlug:'sora-2',id:'sora-2'},examples,preferred:{hero:'preferred',demo:'missing-preferred'},
        featuredIds:['featured','landscape','missing-featured'],getPublicVideosByIds:reader.getPublicVideosByIds,
        toCard:(video:GalleryVideo)=>reader.toGalleryCard(video)};
      for (const managed of [true,false]) {
        statements.length=0;
        const old=await reader.projectModelPageGallery({...options,managed});
        const fullTrace=[...statements];
        statements.length=0;
        const current=await reader.projectModelPageGallery({...options,managed,getPublicVideoIds:reader.getPublicVideoIds});
        assert.deepEqual(current,old,'exact full projection remains unchanged for admin/fallback callers');
        assert.deepEqual(current.galleryVideos.map((card:{id:string})=>card.id),managed?['portrait','landscape']:['featured','landscape','portrait','preferred']);
        assert.deepEqual(current.galleryVideos.find((card:{id:string})=>card.id==='portrait'),reader.toGalleryCard(loaded.get('portrait')),
          'fresh membership does not replace any original playlist card field');
        assert.equal(current.galleryVideos.find((card:{id:string})=>card.id==='portrait').promptFull,'Original portrait prompt');
        assert.match(statements[0].text,/^SELECT job_id FROM app_jobs/);
        assert.deepEqual(statements.map(s=>s.params),fullTrace.map(s=>s.params));
        assert.equal(statements.length,managed?1:3);
        assert.ok(statements.slice(1).every(s=>/SELECT job_id, user_id, engine_id/.test(s.text)), 'missing featured/preferred cards retain full hydration');
        assertReadOnly();
      }
    });
    await t.test('actual PostgreSQL errors propagate as their original objects', async () => {
      await postgres.pool.query('ALTER TABLE app_jobs RENAME TO unavailable_jobs');
      try {
        for (const read of [reader.getPublicVideoIds,reader.getPublicVideosByIds]) {
          statements.length=0;
          await assert.rejects(read(['portrait']),(error:unknown)=>{
            assert.equal(error,statements[0].error);
            assert.equal((error as {code:string}).code,'42P01');
            return true;
          });
        }
      } finally {await postgres.pool.query('ALTER TABLE unavailable_jobs RENAME TO app_jobs');}
    });
    const evidence:Record<string,unknown>={fixture:'Disposable PostgreSQL 17, synthetic model galleries, migration 16 job_outputs indexes, warm local reads; no production traffic',
      serverVersion,nodeVersion:process.version,cases:{}};
    for (const size of [8,200]) for (const managed of [true,false]) {
      await t.test(`${size}-record ${managed?'managed':'unmanaged'} gallery parity and returned SQL bytes`,async()=>{
        const ids=Array.from({length:size},(_,i)=>`gallery-${i+1}`);
        const loaded:Map<string,GalleryVideo>=await reader.getVideosByIds(ids);
        const options={engine:{modelSlug:'wan-3',id:'wan-3'},examples:ids.map(id=>loaded.get(id)!),managed,
          preferred:{hero:'preferred',demo:null},featuredIds:['featured'],getPublicVideosByIds:reader.getPublicVideosByIds,
          toCard:(video:GalleryVideo)=>reader.toGalleryCard(video)};
        const load=(optimized:boolean)=>reader.projectModelPageGallery({...options,...(optimized?{getPublicVideoIds:reader.getPublicVideoIds}:{})});
        statements.length=0;
        const old=await load(false),full=metrics();
        statements.length=0;
        const current=await load(true),presence=metrics();
        assert.deepEqual(current,old);
        assertReadOnly();
        assert.equal(full.statements,managed?1:3);
        assert.equal(presence.statements,full.statements);
        assert.equal(presence.rows,full.rows);
        assert.ok(presence.bytes<full.bytes,'ID validation returns fewer SQL bytes');
        const result={size,managed,full,presence,outputSha256:digest(current),timings:[] as unknown[]};
        (evidence.cases as Record<string,unknown>)[`${size}-${managed?'managed':'unmanaged'}`]=result;
        t.diagnostic(`${size}/${managed?'managed':'unmanaged'}: SQL statements ${full.statements}→${presence.statements}, rows ${full.rows}→${presence.rows}, bytes ${full.bytes}→${presence.bytes}`);
        // Timing is opt-in so ordinary regression checks do not become a benchmark.
        // Run only after the separate baseline build has completed. Metrics/serialization
        // instrumentation is disabled inside the timed window for both variants.
        if (process.env.MODEL_PUBLIC_PRESENCE_EVIDENCE) {
          reader.setCapture(false);
          try {
            await load(false);await load(true);await load(false);await load(true);
            const samples={A:[] as number[],B:[] as number[]};
            for (const variant of ['A','B','B','A','A','B'] as const) {
              const durations:number[]=[];
              for (let iteration=0;iteration<20;iteration++) {
                const start=performance.now(),output=await load(variant==='B'),durationMs=performance.now()-start;
                durations.push(durationMs);assert.deepEqual(output,old);
              }
              samples[variant].push(...durations);
              result.timings.push({variant,iterations:durations.length,durationsMs:durations,medianMs:median(durations)});
            }
            Object.assign(result,{medianMs:{full:median(samples.A),presence:median(samples.B)}});
          } finally {reader.setCapture(true);}
        }
      });
    }
    if (process.env.MODEL_PUBLIC_PRESENCE_EVIDENCE) writeFileSync(process.env.MODEL_PUBLIC_PRESENCE_EVIDENCE,JSON.stringify(evidence,null,2));
  } finally {
    await reader?.getDb().end();
    for (const [key,value] of Object.entries(previous)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
    rmSync(folder,{recursive:true,force:true});
    await postgres.cleanup();
  }
});
