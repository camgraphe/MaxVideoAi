import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import test from 'node:test';
import { startDisposablePostgres } from './helpers/disposable-postgres';
test('picker validation is a bounded ordered SELECT-only snapshot of exact owned sources', {timeout:120000}, async t=>{
 const pg=await startDisposablePostgres('picker-validation'), previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 const db=await import('../frontend/src/lib/db');t.after(async()=>{await db.getDb().end();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;await pg.cleanup();});
 const schema=await import('../frontend/src/lib/schema');await schema.ensureMediaLibrarySchema();await schema.ensureAssetSchema();
 const orgSchema=await import('../frontend/src/lib/schema/media-library-organization-schema');await orgSchema.ensureMediaLibraryOrganizationSchema();
 await pg.pool.query(`CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false);
 INSERT INTO app_jobs VALUES ('job','alice',false);
 INSERT INTO job_outputs(id,job_id,user_id,kind,url,position) VALUES ('out','job','alice','image','https://original.test/source.png',0);
 INSERT INTO media_assets(id,public_id,user_id,kind,url,source,source_job_id,source_output_id,metadata) VALUES
 ('saved','ma_11111111111111111111111111111111','alice','image','https://durable.test/copy.png','saved_job_output','job','out','{"originUrl":"https://original.test/source.png"}'),
 ('foreign','ma_22222222222222222222222222222222','bob','image','https://durable.test/foreign.png','upload',null,null,'{}');`);
 const {validateLibraryPickerCandidates:validate}=await import('../frontend/server/media-library/picker-validation');
 const {mutateLibraryOrganization:mutate}=await import('../frontend/server/media-library/organization');
 const reference={type:'asset',assetId:'ma_11111111111111111111111111111111',kind:'image'} as const;
 const candidate={reference,originalUrl:'https://durable.test/copy.png'};
 const readOnly=async<T>(work:()=>Promise<T>)=>{await db.query('SET default_transaction_read_only=on');try{return await work();}finally{await db.query('SET default_transaction_read_only=off');}};
 const result=await readOnly(()=>validate('alice',{candidates:[candidate,candidate]}));
 assert.equal(result.length,2);assert.equal(result[0].error,undefined);assert.ok(result[0].sourceRevision);assert.deepEqual(Object.keys(result[0]).sort(),['key','reference','sourceRevision','state']);
 assert.equal((await pg.pool.query('SELECT count(*) AS n FROM library_organization')).rows[0].n,'0','read does not materialize organization');
 await mutate({userId:'alice',operation:'trash',references:[reference]});
 assert.equal((await readOnly(()=>validate('alice',{candidates:[candidate]})))[0].error,'SOURCE_TRASHED');
 await mutate({userId:'alice',operation:'restore',references:[reference]});
 assert.equal((await validate('bob',{candidates:[candidate]}))[0].error,'SOURCE_UNAVAILABLE');
 assert.equal((await validate('alice',{candidates:[{...candidate,originalUrl:'https://other.test/source.png'}]}))[0].error,'SOURCE_VERSION_CHANGED');
 assert.equal((await validate('alice',{candidates:[{...candidate,reference:{...reference,sourceRevision:'sr_'+'0'.repeat(64)}}]}))[0].error,'SOURCE_VERSION_CHANGED');
 await pg.pool.query("UPDATE media_assets SET url='https://durable.test/replaced.png' WHERE id='saved'");
 assert.equal((await validate('alice',{candidates:[candidate]}))[0].error,'SOURCE_VERSION_CHANGED');
 for(const body of [{candidates:[{...candidate,extra:true}]},{candidates:[{...candidate,reference:{...reference,extra:true}}]},{candidates:[{...candidate,originalUrl:'file:///private'}]}])await assert.rejects(validate('alice',body));
 await assert.rejects(validate('alice',{candidates:Array(501).fill(candidate)}),/REFERENCE_LIMIT/);
 await assert.rejects(validate('',{candidates:[candidate]}),/UNAUTHORIZED/);

 const {RECENT_GENERATIONS_SELECT}=await import('../frontend/src/server/generations/recent-generations');
 for(const column of RECENT_GENERATIONS_SELECT.split(', ').filter(c=>!['job_id','user_id'].includes(c))){const type=['settings_snapshot','pricing_snapshot','render_ids'].includes(column)?'jsonb':['created_at','updated_at'].includes(column)?'timestamptz':['has_audio','can_upscale','indexable'].includes(column)?'boolean':['id','duration_sec','final_price_cents','iteration_index','iteration_count','eta_seconds','progress'].includes(column)?'integer':'text';await pg.pool.query(`ALTER TABLE app_jobs ADD COLUMN ${column} ${type}`);}
 await pg.pool.query(`INSERT INTO app_jobs(job_id,user_id,hidden,surface,video_url,status,updated_at) VALUES ('historical','alice',false,'video','https://original.test/historical.mp4','completed',now())`);
 const {validateHistoricalJobVideo:validateHistorical}=await import('../frontend/server/media-library/historical-job-video-validation');
 const historical={jobId:'historical',originalUrl:'https://original.test/historical.mp4'};
 await readOnly(()=>validateHistorical('alice',historical));
 await assert.rejects(readOnly(()=>validateHistorical('bob',historical)),/SOURCE_UNAVAILABLE/);
 await assert.rejects(readOnly(()=>validateHistorical('alice',{...historical,originalUrl:'https://other.test/replaced.mp4'})),/SOURCE_VERSION_CHANGED/);
 assert.equal((await pg.pool.query("SELECT count(*) AS n FROM job_outputs WHERE job_id='historical'")).rows[0].n,'0');
 await pg.pool.query("UPDATE app_jobs SET video_url='https://original.test/replaced.mp4' WHERE job_id='historical'");
 await assert.rejects(readOnly(()=>validateHistorical('alice',historical)),/SOURCE_VERSION_CHANGED/);
 await pg.pool.query("UPDATE app_jobs SET video_url='https://original.test/historical.mp4' WHERE job_id='historical'");
 await pg.pool.query("INSERT INTO job_outputs(id,job_id,user_id,kind,url,status) VALUES ('deleted-historical','historical','alice','video','https://original.test/historical.mp4','deleted')");
 await assert.rejects(readOnly(()=>validateHistorical('alice',historical)),/PERSISTED_OUTPUT_REQUIRED/);
 await pg.pool.query("DELETE FROM job_outputs WHERE id='deleted-historical'");
 await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='historical'");
 await assert.rejects(readOnly(()=>validateHistorical('alice',historical)),/SOURCE_UNAVAILABLE/);
 await pg.pool.query("UPDATE app_jobs SET hidden=false,surface='audio' WHERE job_id='historical'");
 await assert.rejects(readOnly(()=>validateHistorical('alice',historical)),/SOURCE_UNAVAILABLE/);
 await pg.pool.query("UPDATE app_jobs SET surface='video' WHERE job_id='historical'");
 for(const invalid of [{...historical,extra:true},{...historical,originalUrl:'file:///private'},{...historical,jobId:'x'.repeat(257)}]) await assert.rejects(validateHistorical('alice',invalid));
 const directory=mkdtempSync(join(tmpdir(),'picker-route-')),requester=createRequire(resolve('frontend/package.json'));
 const fixture={userId:null as string|null};(globalThis as any).__pickerRoute=fixture;
 const outfile=join(directory,'route.cjs');
 await build({stdin:{loader:'ts',resolveDir:process.cwd(),contents:"export {POST} from './frontend/app/api/media-library/selection/validate/route';export {POST as POSTHistorical} from './frontend/app/api/media-library/selection/validate-job-video/route';export {getDb} from '@/lib/db';"},outfile,bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',plugins:[{name:'auth-boundary',setup(b){b.onResolve({filter:/^@\/lib\/supabase-ssr$/},()=>({path:'auth',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const getRouteAuthContext=async()=>({userId:globalThis.__pickerRoute.userId});',loader:'ts'}));b.onResolve({filter:/^(next\/server|pg)$/},a=>({path:requester.resolve(a.path),external:true}));}}]});
 const route=requester(outfile),{NextRequest}=requester('next/server');
 const request=(body:unknown)=>new NextRequest('http://localhost/api/media-library/selection/validate',{method:'POST',body:JSON.stringify(body)});
 delete process.env.DATABASE_URL;assert.equal((await route.POST(request({candidates:[candidate]}))).status,401,'auth precedes SQL');assert.equal((await route.POSTHistorical(request(historical))).status,401);
 const ro=new URL(pg.databaseUrl);ro.searchParams.set('options','-c default_transaction_read_only=on');process.env.DATABASE_URL=ro.toString();fixture.userId='alice';
 try{
 const historicalResponse=await route.POSTHistorical(request(historical));assert.equal(historicalResponse.status,200);assert.deepEqual(await historicalResponse.json(),{ok:true});assert.match(historicalResponse.headers.get('cache-control'),/private, no-store/);
 // Same owned job and exact URL: current persisted status, not retained media, decides availability.
 for(const status of ['failed','running','cancelled','queued','unknown',null]){
  await pg.pool.query("UPDATE app_jobs SET status=$1 WHERE job_id='historical'",[status]);
  const before=(await pg.pool.query("SELECT to_jsonb(j) AS record FROM app_jobs j WHERE job_id='historical'")).rows[0].record;
  const refused=await route.POSTHistorical(request(historical));assert.equal(refused.status,409,`historical status ${status} must refuse`);assert.deepEqual(await refused.json(),{ok:false,error:'SOURCE_UNAVAILABLE'});
  assert.deepEqual((await pg.pool.query("SELECT to_jsonb(j) AS record FROM app_jobs j WHERE job_id='historical'")).rows[0].record,before,'proof cannot update the job');
  assert.equal((await pg.pool.query("SELECT count(*) AS n FROM job_outputs WHERE job_id='historical'")).rows[0].n,'0','proof cannot repair outputs');
 }
 for(const status of ['finished','success','  SUCCEEDED  ','completed']){
  await pg.pool.query("UPDATE app_jobs SET status=$1 WHERE job_id='historical'",[status]);
  const accepted=await route.POSTHistorical(request(historical));assert.equal(accepted.status,200,`normalized completed status ${status} stays available`);assert.deepEqual(await accepted.json(),{ok:true});
 }
 assert.equal((await route.POSTHistorical(request({...historical,originalUrl:'https://other.test/replaced.mp4'}))).status,409);
 assert.equal((await route.POSTHistorical(request({...historical,extra:true}))).status,400);
 assert.equal((await route.POSTHistorical(request({jobId:'x'.repeat(257),originalUrl:historical.originalUrl}))).status,400);
 fixture.userId='bob';assert.equal((await route.POSTHistorical(request(historical))).status,409);fixture.userId='alice';
 const response=await route.POST(request({candidates:[{...candidate,originalUrl:'https://durable.test/replaced.png'}]}));assert.equal(response.status,200);assert.equal((await response.json()).results[0].error,undefined);assert.match(response.headers.get('cache-control'),/private, no-store/);
 assert.equal((await route.POST(request({candidates:Array(501).fill(candidate)}))).status,400);
 fixture.userId='bob';assert.equal((await (await route.POST(request({candidates:[candidate]}))).json()).results[0].error,'SOURCE_UNAVAILABLE');fixture.userId='alice';
 await pg.pool.query('ALTER TABLE library_organization RENAME TO missing_organization');
 assert.equal((await route.POST(request({candidates:[candidate]}))).status,500);
 assert.equal((await pg.pool.query("SELECT to_regclass('public.library_organization') AS table_name")).rows[0].table_name,null,'read must never bootstrap missing schema');
 await pg.pool.query('ALTER TABLE missing_organization RENAME TO library_organization');
 }finally{await route.getDb().end();process.env.DATABASE_URL=pg.databaseUrl;delete (globalThis as any).__pickerRoute;rmSync(directory,{recursive:true,force:true});}

});
