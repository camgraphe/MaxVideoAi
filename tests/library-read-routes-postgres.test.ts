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
const owner='00000000-0000-4000-8000-000000000091';
const other='00000000-0000-4000-8000-000000000092';

test('library GETs read the migrated schema without DDL, seeds or repair writes', {timeout:60_000},async t=>{
  const pg=await startDisposablePostgres('library-read-only');
  const folder=mkdtempSync(join(tmpdir(),'library-read-routes-'));
  const fixture={userId:owner as string|null,statements:[] as string[]};
  const globals=globalThis as typeof globalThis&{__libraryReads?:typeof fixture};globals.__libraryReads=fixture;
  const previousUrl=process.env.DATABASE_URL;
  let close:undefined|(()=>Promise<void>);
  t.after(async()=>{await close?.();if(previousUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previousUrl;delete globals.__libraryReads;rmSync(folder,{recursive:true,force:true});await pg.cleanup();});
  await pg.pool.query('CREATE TABLE profiles(id uuid PRIMARY KEY, preferred_currency text)');
  const boot=spawnSync('frontend/node_modules/.bin/tsx',['--tsconfig','frontend/tsconfig.json','scripts/bootstrap-application-schema.ts','--allow-local-postgres-test'],{
    env:{PATH:process.env.PATH,NODE_ENV:'test',APPLICATION_DATABASE_URL:pg.databaseUrl},encoding:'utf8',
  });assert.equal(boot.status,0,boot.stderr);
  await pg.pool.query(`ALTER TABLE app_jobs ALTER COLUMN engine_id SET DEFAULT 'gpt-image-2', ALTER COLUMN engine_label SET DEFAULT 'Fixture', ALTER COLUMN duration_sec SET DEFAULT 1, ALTER COLUMN thumb_url SET DEFAULT 'https://example.invalid/thumb.png'`);
  await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,surface,status,prompt,settings_snapshot,render_ids,hidden) VALUES
    ('character-A',$1,'character','completed','private fixture brief','{"surface":"character-builder"}','[{"url":"https://example.invalid/character.png","thumb_url":"https://example.invalid/character-thumb.png"}]',false),
    ('character-B',$2,'character','completed','other private brief','{"surface":"character-builder"}','["https://example.invalid/other.png"]',false),
    ('storyboard_A',$1,'storyboard','completed','board fixture','{}',null,false),
    ('storyboard_hidden',$1,'storyboard','completed','hidden fixture','{}',null,true),
    ('storyboard_B',$2,'storyboard','completed','other board','{}',null,false),
    ('storyboard_kling_first_frame_A',$1,'storyboard','completed','first frame','{"storyboard":{"parentJobId":"storyboard_A"}}',null,true)`,[owner,other]);
  await pg.pool.query(`INSERT INTO job_outputs(id,job_id,user_id,kind,url,status,metadata) VALUES
    ('board-output','storyboard_A',$1,'image','https://example.invalid/board.png','ready','{}'),
    ('hidden-output','storyboard_hidden',$1,'image','https://example.invalid/hidden.png','ready','{}'),
    ('other-output','storyboard_B',$2,'image','https://example.invalid/other.png','ready','{}'),
    ('first-frame','storyboard_kling_first_frame_A',$1,'image','https://example.invalid/first.png','ready','{}')`,[owner,other]);
  await pg.pool.query(`INSERT INTO media_assets(id,user_id,kind,url,source,source_output_id,status,metadata)
    VALUES('saved-A',$1,'image','https://example.invalid/board.png','saved_job_output','board-output','ready','{}')`,[owner]);
  const dbPath=resolve('frontend/src/lib/db.ts');
  const outputsPath=resolve('frontend/server/media-library/job-outputs.ts');
  const outfile=join(folder,'routes.cjs');
  await build({stdin:{loader:'ts',resolveDir:process.cwd(),contents:`export{GET as characters}from'./frontend/app/api/character-references/route';export{GET as recent}from'./frontend/app/api/media-library/recent-outputs/route';export{getDb}from'@/lib/db';`},outfile,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',
    plugins:[{name:'library-read-boundaries',setup(b){
      const mocks:Record<string,string>={
        '@/lib/supabase-ssr':`export const getRouteAuthContext=async()=>({userId:globalThis.__libraryReads.userId});`,
        '@/lib/db':`export * from ${JSON.stringify(dbPath)};import * as real from ${JSON.stringify(dbPath)};export async function query(sql,params){globalThis.__libraryReads.statements.push(sql);return real.query(sql,params)}`,
        '@/server/media-library':`export{listRecentOutputPage,listStoryboardKlingFirstFrameOutputs}from ${JSON.stringify(outputsPath)};`,
        './mcp-output-assets':`export async function promoteCompletedMcpJobOutputs(){throw Error('unexpected write in GET')}`,
      };
      b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,namespace:'fixture'}:/^(next\/server|pg)$/.test(a.path)?{path:requireFrontend.resolve(a.path),external:true}:undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:mocks[a.path],loader:'ts',resolveDir:process.cwd()}));
    }}],
  });
  const routes=requireFrontend(outfile);
  const {NextRequest}=requireFrontend('next/server');
  const readonly=new URL(pg.databaseUrl);readonly.searchParams.set('options','-c default_transaction_read_only=on');
  process.env.DATABASE_URL=readonly.toString();close=()=>routes.getDb().end();
  const request=(path:string)=>new NextRequest('http://localhost/api/'+path);
  await t.test('cold character references require one SELECT and preserve account and thumbnail identity',async()=>{
    fixture.statements.length=0;
    const response=await routes.characters(request('character-references?limit=60'));
    assert.equal(response.status,200);const body=await response.json();
    assert.equal(body.characters.length,1);assert.equal(body.characters[0].jobId,'character-A');
    assert.equal(body.characters[0].thumbUrl,'https://example.invalid/character-thumb.png');
    assert.equal(fixture.statements.length,1);assert.ok(fixture.statements.every(sql=>/^\s*SELECT\b/i.test(sql)));
  });
  await t.test('cold storyboard outputs enrich the included first frame with two read-only SELECTs',async()=>{
    fixture.statements.length=0;
    const response=await routes.recent(request('media-library/recent-outputs?limit=18&kind=image&surface=storyboard'));
    assert.equal(response.status,200);const body=await response.json();
    assert.deepEqual(body.outputs.map((x:any)=>x.id),['board-output']);
    assert.equal(body.outputs[0].isSaved,true);assert.equal(body.outputs[0].savedAssetId,'saved-A');
    assert.equal(body.outputs[0].klingFirstFrame.url,'https://example.invalid/first.png');
    assert.equal(body.outputs[0].jobPrompt,undefined);
    assert.equal(fixture.statements.length,2);assert.ok(fixture.statements.every(sql=>/^\s*SELECT\b/i.test(sql)));
  });
  await t.test('recent filters and exact foreign job lookups remain account-scoped',async()=>{
    fixture.statements.length=0;
    const response=await routes.recent(request('media-library/recent-outputs?kind=image&jobId=storyboard_B'));
    assert.equal(response.status,200);assert.deepEqual((await response.json()).outputs,[]);
    assert.equal(fixture.statements.length,1);
    const filtered=await routes.recent(request('media-library/recent-outputs?surface=storyboard&q=board%20fixture'));
    assert.deepEqual((await filtered.json()).outputs.map((x:any)=>x.id),['board-output']);
  });
  await t.test('unauthenticated reads perform no SQL and never return private media',async()=>{
    fixture.userId=null;fixture.statements.length=0;
    const recent=await routes.recent(request('media-library/recent-outputs'));assert.equal(recent.status,401);
    const characters=await routes.characters(request('character-references'));const data=await characters.json();assert.deepEqual(data.characters,[]);
    assert.ok([200,401].includes(characters.status));assert.equal(fixture.statements.length,0);fixture.userId=owner;
  });
  await t.test('missing primary schemas fail honestly and are never recreated by a GET',async()=>{
    const error=console.error;console.error=()=>{};
    try{
      for(const [table,handler,url] of [['app_jobs',routes.characters,'character-references'],['job_outputs',routes.recent,'media-library/recent-outputs']] as const){
        await pg.pool.query(`ALTER TABLE ${table} RENAME TO fixture_unavailable`);
        try{const response=await handler(request(url));assert.equal(response.status,500);assert.equal((await response.json()).ok,false);}
        finally{await pg.pool.query(`ALTER TABLE fixture_unavailable RENAME TO ${table}`);}
      }
    }finally{console.error=error;}
  });
});
