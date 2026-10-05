import assert from 'node:assert/strict';
import test from 'node:test';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {ownedTimelineExportJobResponse} from '../frontend/src/server/timeline-exports/media-access';
import {resolveStudioMedia} from '../frontend/src/server/studio/media-resolver';
import {workspaceProjectAssetFromCompletedTimelineExport} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-export';

test('legacy internal export identity projects an owned public ref that the canonical Studio resolver accepts',async t => {
  const pg=await startDisposablePostgres('export-public-ref');t.after(()=>pg.cleanup());
  const source='https://cdn.maxvideoai.com/timeline-exports/owner/result.mp4';
  const internal=`url:owner:video:${source}`;
  await pg.pool.query(`CREATE TABLE media_assets(id text,public_id text,user_id text,kind text,url text,status text,deleted_at timestamptz,mime_type text,source_job_id text,source_output_id text);
    CREATE TABLE job_outputs(id text,job_id text,user_id text,status text);
    CREATE TABLE app_jobs(job_id text,user_id text,hidden boolean);`);
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,status,mime_type) VALUES ($1,'public-export','owner','video',$2,'ready','video/mp4')`,[internal,source]);
  const job={id:'export',user_id:'owner',status:'completed',progress:100,message:null,output_url:source,output_asset_id:internal,output_size_bytes:100,output_mime_type:'video/mp4'} as any;
  const before=JSON.stringify(job);
  const executor={query:async <T>(sql:string,values?:readonly unknown[])=>{
    assert.match(sql,/^SELECT/);assert.doesNotMatch(sql,/INSERT|UPDATE|CREATE|ALTER/);
    return (await pg.pool.query(sql,values as unknown[])).rows as T[];
  }};
  for(const storedId of [internal,'public-export']) {
    const response=await ownedTimelineExportJobResponse({...job,output_asset_id:storedId},'owner',executor);
    assert.equal(response.artifact!.outputAssetId,'public-export');
    const asset=workspaceProjectAssetFromCompletedTimelineExport({id:job.id,status:'completed',outputUrl:response.artifact!.outputUrl,canonicalOriginalUrl:response.artifact!.canonicalOriginalUrl,outputAssetId:response.artifact!.outputAssetId!},{projectName:'Export',exportRange:{mode:'sequence',durationSec:25}} as any)!;
    const resolved=await resolveStudioMedia('owner',asset.ref,(sql,values)=>executor.query(sql,values));
    assert.equal(resolved.url,source);assert.equal(resolved.id,internal);
  }
  assert.equal(JSON.stringify(job),before,'old job identity stays untouched');
  for(const update of [
    "UPDATE media_assets SET user_id='other'",
    "UPDATE media_assets SET user_id='owner',url='https://cdn.maxvideoai.com/other.mp4'",
    "UPDATE media_assets SET url=$1,deleted_at=NOW()",
    "UPDATE media_assets SET deleted_at=NULL,status='failed'",
    "UPDATE media_assets SET status='ready',source_job_id='foreign-job'",
  ]) {
    if(update.includes('$1')) await pg.pool.query(update,[source]);else await pg.pool.query(update);
    const response=await ownedTimelineExportJobResponse(job,'owner',executor);
    assert.equal(response.artifact!.outputAssetId,null,'never project an unavailable or mismatched asset identity');
    assert.equal(response.artifact!.outputUrl,source,'completed artifact remains readable without an insertion ref');
  }
});

test('new export publication creates a resolvable local asset with export provenance outside app_jobs',async t => {
  const {build}=await import('esbuild');const {runInNewContext}=await import('node:vm');
  const {createRequire}=await import('node:module');const {resolve}=await import('node:path');
  const {publishTimelineExportArtifactWithDependencies:publish}=await import('../frontend/src/server/timeline-exports/renderer');
  const {hydrateOwnedVideoMediaFacts}=await import('../frontend/server/media-library/owned-video-facts');
  const pg=await startDisposablePostgres('export-writer-ref');t.after(()=>pg.cleanup());
  await pg.pool.query(`CREATE TABLE media_assets(id text PRIMARY KEY,public_id text DEFAULT 'ma_'||md5(random()::text),user_id text,kind text,url text,thumb_url text,preview_url text,mime_type text,width int,height int,size_bytes bigint,source text,source_job_id text,source_output_id text,status text,metadata jsonb,created_at timestamptz DEFAULT NOW(),updated_at timestamptz DEFAULT NOW(),deleted_at timestamptz);
    CREATE TABLE job_outputs(id text,job_id text,user_id text,status text);
    CREATE TABLE app_jobs(job_id text,user_id text,hidden boolean);`);
  const execute=async <T>(sql:string,values?:readonly unknown[])=>(await pg.pool.query(sql,values as unknown[])).rows as T[];
  const stubs:Record<string,string>={
    '@/lib/db':'export const query=(sql,values)=>fixture.query(sql,values);',
    '@/lib/schema':'export const ensureMediaLibrarySchema=async()=>{};',
    '@/server/storage':'export const recordUserAsset=async()=>{};',
    './asset-listing':'export const findLibraryAssetByOrigin=()=>{throw Error("No listing");};export const listLibraryAssetPage=findLibraryAssetByOrigin;',
    './asset-media':'export const copyRemoteMedia=()=>{throw Error("No network");};export const createRemoteVideoAssetThumbnail=copyRemoteMedia;',
    './asset-resolvers':'export const resolveReusableAssetPreviewUrl=async()=>null;export const resolveReusableAssetThumbUrl=async input=>input.thumbUrl;',
  };
  const frontend=resolve('frontend');
  const bundle=await build({absWorkingDir:frontend,stdin:{contents:"export {ensureReusableAsset} from './server/media-library/assets';",resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'local-assets',setup(builder){
    builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
  }}]});
  const module={exports:{} as any};runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,fixture:{query:execute},require:createRequire(resolve(frontend,'package.json')),process:{env:{}},URL,console});
  const source='https://cdn.maxvideoai.com/timeline-exports/owner/new.mp4';
  const asset=await publish({outputPath:'/tmp/local-export-fixture.mp4',outputSize:1024,userId:'owner',exportId:'tlx_new',projectName:'Film',width:1280,height:720},{
    createLocalThumbnail:async()=>null,uploadPath:async()=>({url:source,key:'timeline-exports/owner/new.mp4'}) as any,
    ensureAsset:module.exports.ensureReusableAsset,deleteRemote:async()=>{throw Error('Unexpected cleanup');},
  });
  const row=(await pg.pool.query('SELECT * FROM media_assets')).rows[0];
  assert.equal(row.source_job_id,null);assert.equal(row.source_output_id,null);
  assert.equal(row.metadata.timelineExportId,'tlx_new');assert.equal(row.metadata.mediaFacts,undefined);
  const projected=await ownedTimelineExportJobResponse({id:'tlx_new',user_id:'owner',status:'completed',progress:100,message:null,output_url:source,output_asset_id:asset.id} as any,'owner',{query:execute});
  assert.equal(projected.artifact!.outputAssetId,row.public_id);
  const ref={type:'asset',assetId:row.public_id,kind:'video'} as const;
  assert.equal((await resolveStudioMedia('owner',ref,(sql,values)=>execute(sql,values))).url,source);
  // The existing bounded hydration owner remains responsible for measuring bytes.
  let probes=0;
  await hydrateOwnedVideoMediaFacts({userId:'owner',ref,expectedUrl:source},{query:execute,createReadUrl:async input=>input.url,
    inspectVideo:async url=>{assert.equal(url,source);probes++;return {durationSec:25,width:1280,height:720,fps:30,hasAudio:true};}});
  assert.equal(probes,1);
  const resolved=await resolveStudioMedia('owner',ref,(sql,values)=>execute(sql,values));
  assert.equal(resolved.mediaFacts?.source,'probe');assert.equal(resolved.mediaFacts?.durationSec,25);
  assert.equal((await pg.pool.query('SELECT count(*) FROM app_jobs')).rows[0].count,'0');
});
