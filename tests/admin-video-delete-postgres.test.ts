import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { startDisposablePostgres } from './helpers/disposable-postgres';

const requireFrontend=createRequire(resolve('frontend/package.json'));

test('admin video removal is atomic under pool contention and preserves unrelated jobs and billing', {timeout:60_000},async t=>{
  const pg=await startDisposablePostgres('admin-video-delete');
  const folder=mkdtempSync(join(tmpdir(),'admin-video-delete-'));
  const fixture={authorized:true,held:null as any,statements:[] as string[]};
  const globals=globalThis as typeof globalThis&{__adminDelete?:typeof fixture};globals.__adminDelete=fixture;
  const previousUrl=process.env.DATABASE_URL;
  let close:undefined|(()=>Promise<void>);
  const release=async()=>{if(fixture.held){await fixture.held.query('ROLLBACK');fixture.held.release();fixture.held=null;}};
  t.after(async()=>{await release();await close?.();if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;delete globals.__adminDelete;rmSync(folder,{recursive:true,force:true});await pg.cleanup();});
  await pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY, preferred_currency text)');
  const boot=spawnSync('frontend/node_modules/.bin/tsx',['--tsconfig','frontend/tsconfig.json','scripts/bootstrap-application-schema.ts','--allow-local-postgres-test'],{env:{PATH:process.env.PATH,NODE_ENV:'test',APPLICATION_DATABASE_URL:pg.databaseUrl},encoding:'utf8'});
  assert.equal(boot.status,0,boot.stderr);
  await pg.pool.query(`CREATE FUNCTION fixture_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture write failure'; END $$;`);
  const dbPath=resolve('frontend/src/lib/db.ts'),outfile=join(folder,'route.cjs');
  await build({stdin:{loader:'ts',resolveDir:process.cwd(),contents:`export{DELETE as remove}from'./frontend/app/api/admin/videos/[videoId]/route';export{getDb}from'@/lib/db';`},outfile,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',
    plugins:[{name:'admin-delete-host',setup(b){
      const mocks:Record<string,string>={
        '@/server/admin':`import{NextResponse}from'next/server';export async function requireAdmin(){if(!globalThis.__adminDelete.authorized)throw Error('denied')};export const adminErrorToResponse=()=>NextResponse.json({ok:false},{status:403});`,
        '@/lib/schema':`export async function ensureBillingSchema(){}`,
        '@/lib/db':`export * from ${JSON.stringify(dbPath)};import * as real from ${JSON.stringify(dbPath)};
          export async function query(sql,params){globalThis.__adminDelete.statements.push(sql);const rows=await real.query(sql,params);if(sql==='BEGIN')globalThis.__adminDelete.held=await real.getDb().connect();return rows;}
          export async function withDbTransaction(fn){return real.withDbTransaction(async(ex,client)=>{
            const competing=await real.getDb().connect();
            try{return await fn({query:(sql,params)=>{globalThis.__adminDelete.statements.push(sql);return ex.query(sql,params)}},client)}finally{competing.release()}
          });}`,
      };
      b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:/^(next\/server|pg)$/.test(a.path)?{path:requireFrontend.resolve(a.path),external:true}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'ts',resolveDir:process.cwd()}));
    }}],
  });
  const routes=requireFrontend(outfile);process.env.DATABASE_URL=pg.databaseUrl;close=()=>routes.getDb().end();
  const {NextRequest}=requireFrontend('next/server');
  const remove=(id='audit-video')=>routes.remove(new NextRequest('http://localhost/api/admin/videos/'+id,{method:'DELETE'}),{params:Promise.resolve({videoId:id})});
  const reset=async()=>{
    for(const table of ['app_jobs','playlist_items','homepage_sections'])await pg.pool.query(`DROP TRIGGER IF EXISTS fixture_fail ON ${table}`);
    await pg.pool.query(`TRUNCATE app_jobs,playlist_items,homepage_sections,app_receipts CASCADE;
      INSERT INTO app_jobs(job_id,engine_id,engine_label,duration_sec,prompt,thumb_url,video_url,visibility,indexable,featured,pricing_snapshot,payment_status)
      VALUES('audit-video','fixture','Fixture',5,'retained prompt','https://example.invalid/thumb.png','https://example.invalid/video.mp4','public',true,true,'{"totalCents":42}','paid_wallet'),
      ('other-video','fixture','Other',5,'other prompt','https://example.invalid/other-thumb.png','https://example.invalid/other.mp4','public',true,true,'{"totalCents":64}','paid_wallet');
      INSERT INTO playlist_items(playlist_id,video_id)VALUES('00000000-0000-4000-8000-000000000001','audit-video'),('00000000-0000-4000-8000-000000000001','other-video');
      INSERT INTO homepage_sections(key,type,video_id)VALUES('target','hero','audit-video'),('other','hero','other-video');
      INSERT INTO app_receipts(user_id,type,amount_cents,currency,job_id)VALUES('fixture-user','charge',42,'USD','audit-video');`);
    fixture.statements.length=0;
  };
  const snapshot=async()=>({
    jobs:(await pg.pool.query('SELECT * FROM app_jobs ORDER BY job_id')).rows,
    playlist:(await pg.pool.query('SELECT * FROM playlist_items ORDER BY video_id')).rows,
    home:(await pg.pool.query('SELECT * FROM homepage_sections ORDER BY key')).rows,
    receipts:(await pg.pool.query('SELECT * FROM app_receipts ORDER BY id')).rows,
  });
  for(const [table,verb]of [['playlist_items','DELETE'],['homepage_sections','UPDATE'],['app_jobs','UPDATE']])await t.test(`a ${table} failure rolls back every write despite a competing pool consumer`,async()=>{
    await reset();const before=await snapshot();
    await pg.pool.query(`CREATE TRIGGER fixture_fail BEFORE ${verb} ON ${table} FOR EACH ROW EXECUTE FUNCTION fixture_fail_delete()`);
    const original=console.error;console.error=()=>{};
    try{const response=await remove();assert.equal(response.status,500);assert.deepEqual(await snapshot(),before);}
    finally{console.error=original;await release();}
  });
  await t.test('successful removal clears publication and media references on the initialized NOT NULL schema',async()=>{
    await reset();const before=await snapshot();
    try{
      const response=await remove();assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
      const after=await snapshot();const removed=after.jobs.find((x:any)=>x.job_id==='audit-video');
      assert.equal(removed.visibility,'private');assert.equal(removed.indexable,false);assert.equal(removed.featured,false);
      assert.equal(removed.video_url,null);assert.equal(removed.thumb_url,'');assert.equal(removed.preview_frame,null);
      assert.equal(after.playlist.some((x:any)=>x.video_id==='audit-video'),false);
      assert.equal(after.home.find((x:any)=>x.key==='target').video_id,null);
      assert.deepEqual(after.receipts,before.receipts);
      assert.deepEqual(after.jobs.find((x:any)=>x.job_id==='other-video'),before.jobs.find((x:any)=>x.job_id==='other-video'));
      assert.deepEqual(removed.pricing_snapshot,{totalCents:42});assert.equal(removed.payment_status,'paid_wallet');assert.equal(removed.prompt,'retained prompt');
    }finally{await release();}
  });
  await t.test('a missing job returns 404 without deleting orphaned collection references',async()=>{
    await reset();await pg.pool.query("INSERT INTO playlist_items(playlist_id,video_id)VALUES('00000000-0000-4000-8000-000000000001','missing')");
    const before=await snapshot();try{assert.equal((await remove('missing')).status,404);assert.deepEqual(await snapshot(),before);}finally{await release();}
  });
  await t.test('authorization fails before schema or record access',async()=>{
    fixture.authorized=false;fixture.statements.length=0;
    assert.equal((await remove()).status,403);assert.deepEqual(fixture.statements,[]);fixture.authorized=true;
  });
});
