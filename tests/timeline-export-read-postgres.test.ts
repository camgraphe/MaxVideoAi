import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {startDisposablePostgres} from './helpers/disposable-postgres';

test('export status, idempotency recovery and quota read migrated tables in read-only PostgreSQL without initializing schema',async t=>{
  const pg=await startDisposablePostgres('timeline-export-read');
  const client=await pg.pool.connect();
  t.after(async()=>{await client.query('ROLLBACK');client.release();await pg.cleanup();});
  const fixture={statements:[] as string[],query:async(sql:string,values?:readonly unknown[])=>{
    fixture.statements.push(sql);
    return (await client.query(sql,values as unknown[])).rows;
  }};
  const frontend=resolve('frontend');
  const stubs:Record<string,string>={
    '@/lib/db':'export const query=(...args)=>fixture.query(...args);export const withDbTransaction=()=>{throw Error("Unexpected transaction mutation");};',
    './media-access':'export const ownedTimelineExportJobResponse=()=>{throw Error("Unexpected media projection");};export const timelineExportJobResponse=ownedTimelineExportJobResponse;',
  };
  const bundle=await build({absWorkingDir:frontend,
    stdin:{contents:"export * from './src/server/timeline-exports/repository';export {ensureTimelineExportSchema} from './src/server/timeline-exports/schema';",resolveDir:frontend,loader:'ts'},
    tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',
    plugins:[{name:'local-export-read',setup(builder){
      builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
      builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
    }}],
  });
  const module={exports:{} as any};
  runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,fixture,require:createRequire(resolve(frontend,'package.json'))});
  const repository=module.exports;
  await repository.ensureTimelineExportSchema();
  await client.query(`INSERT INTO app_timeline_exports(id,user_id,idempotency_key,project_name,billing_kind,billing_status,render_manifest,export_settings) VALUES
    ('owned-reserved','owner','owned:reserved','Film','free','free_reserved','{}','{}'),
    ('owned-completed','owner','owned:completed','Film','free','free_completed','{}','{}'),
    ('owned-failed','owner','owned:failed','Film','free','free_failed','{}','{}'),
    ('foreign','foreign','foreign:reserved','Private','free','free_reserved','{}','{}')`);
  fixture.statements.length=0;
  await client.query('BEGIN READ ONLY');
  assert.equal(await repository.countUsedFreeTimelineExports('owner'),2);
  assert.equal(await repository.countUsedFreeTimelineExports('unknown'),0);
  assert.equal((await repository.readTimelineExportJob({userId:'owner',exportId:'owned-completed'}))?.id,'owned-completed');
  assert.equal(await repository.readTimelineExportJob({userId:'owner',exportId:'foreign'}),null);
  assert.equal((await repository.readTimelineExportJobByIdempotencyKey({userId:'owner',idempotencyKey:'owned:reserved'}))?.id,'owned-reserved');
  assert.equal(await repository.readTimelineExportJobByIdempotencyKey({userId:'owner',idempotencyKey:'foreign:reserved'}),null);
  assert.ok(fixture.statements.every(sql=>/^\s*SELECT\b/i.test(sql)),'Read helpers may issue only SELECT statements.');
  await client.query('ROLLBACK');
  await client.query('DROP TABLE app_timeline_exports');
  await client.query('BEGIN READ ONLY');
  await assert.rejects(repository.readTimelineExportJob({userId:'owner',exportId:'owned-completed'}),{code:'42P01'});
  await client.query('ROLLBACK');
  assert.equal((await client.query("SELECT to_regclass('public.app_timeline_exports') AS name")).rows[0].name,null,'Missing migrated schema must remain missing after a read.');
});
