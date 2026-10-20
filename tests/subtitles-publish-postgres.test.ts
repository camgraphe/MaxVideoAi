import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFile,readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {build} from 'esbuild';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {probeSubtitleMedia} from '../frontend/src/server/subtitles/media';
import {normalizeScribeTranscript} from '../frontend/src/lib/subtitles/document';
import {publishTimelineExportArtifactWithDependencies} from '../frontend/src/server/timeline-exports/renderer';
import {conversationLibraryInsertTiming} from '../frontend/lib/studio/conversation-timeline-editing';

test('published subtitle MP4 retains probed facts through the owned Studio media route',async t=>{
  const pg=await startDisposablePostgres('subtitle-publish');t.after(()=>pg.cleanup());
  await pg.pool.query(`CREATE TABLE media_assets(id text PRIMARY KEY,public_id text DEFAULT 'ma_'||md5(random()::text),user_id text,kind text,url text,thumb_url text,preview_url text,mime_type text,width int,height int,size_bytes bigint,source text,source_job_id text,source_output_id text,status text,metadata jsonb,created_at timestamptz DEFAULT NOW(),updated_at timestamptz DEFAULT NOW(),deleted_at timestamptz);
    CREATE TABLE job_outputs(id text,job_id text,user_id text,status text);
    CREATE TABLE app_jobs(job_id text,user_id text,hidden boolean);
    INSERT INTO app_jobs VALUES('subtitle-render-job','owner',false);`);
  const frontend=resolve('frontend'),localOutput=resolve('tests/fixtures/studio-media/pattern-b.mp4');
  const bytes=await readFile(localOutput),measured=await probeSubtitleMedia(localOutput);
  const base='https://subtitle-publish-fixture.s3.us-east-1.amazonaws.com';
  const originalUrl=`${base}/renders/owner/subtitles.mp4`,thumbnailUrl=`${base}/renders/thumbs/owner/subtitles.jpg`;
  const sourceRef={type:'asset' as const,assetId:`ma_${'1'.repeat(32)}`,kind:'video' as const};
  const document=normalizeScribeTranscript({text:'Edited captions',language_code:'eng',words:[{type:'word',text:'Edited captions',start:1,end:2}]},{
    id:'subtitle-document',source:{ref:sourceRef,fingerprint:createHash('sha256').update(bytes).digest('hex'),durationMs:measured.durationMs+28},
  });
  let uploaded=0,rendered=0;
  const fixture={
    owner:'owner' as string|null,
    query:async(sql:string,values:unknown[])=>(await pg.pool.query(sql,values)).rows,
    publishArtifact:publishTimelineExportArtifactWithDependencies,
    withOwnedSource:async(userId:string,ref:unknown,consume:(loaded:{path:string})=>Promise<unknown>,options:{expectedFingerprint:string})=>{
      assert.equal(userId,'owner');assert.deepEqual(ref,sourceRef);assert.equal(options.expectedFingerprint,document.source.fingerprint);
      return consume({path:localOutput});
    },
    renderVideo:async(input:{sourcePath:string;outputPath:string})=>{
      assert.equal(input.sourcePath,localOutput);rendered++;
      await copyFile(localOutput,input.outputPath);
      return {...await probeSubtitleMedia(input.outputPath),sizeBytes:(await stat(input.outputPath)).size};
    },
    upload:async(input:{path:string;userId:string;prefix:string;sizeBytes:number})=>{
      assert.equal(input.userId,'owner');assert.equal(input.prefix,'renders');assert.equal(input.sizeBytes,bytes.length);
      assert.deepEqual(await readFile(input.path),bytes);uploaded++;
      return {url:originalUrl,key:'renders/owner/subtitles.mp4'};
    },
  };
  // Keep publication, canonical asset persistence and the route/resolver real.
  // Only renderer/storage boundaries and authenticated account context are offline.
  const stubs:Record<string,string>={
    './source':'export const withOwnedSubtitleSource=(...args)=>fixture.withOwnedSource(...args);',
    './render':'export const renderSubtitleVideo=input=>fixture.renderVideo(input);',
    '../timeline-exports/renderer':'export const publishTimelineExportArtifactWithDependencies=fixture.publishArtifact;',
    '@/lib/db':'export const query=(sql,values)=>fixture.query(sql,values);',
    '@/lib/schema':'export const ensureMediaLibrarySchema=async()=>{};export const ensureAssetSchema=async()=>{};',
    '@/server/media-library':"export {ensureReusableAsset} from './server/media-library/assets';",
    '@/server/storage':`export {extractStorageKeyFromUrl,ownedMediaStorageKeyForUrl,getStorageObjectMetadata,isAllowedAssetHost} from './server/storage';export const uploadFilePath=input=>fixture.upload(input);export const recordUserAsset=async()=>{};export const deleteStorageObjectByUrl=async()=>{throw Error('Unexpected remote deletion');};`,
    '@/server/upload-thumbnails':`export const createVideoThumbnailFromFile=async()=>${JSON.stringify(thumbnailUrl)};`,
    './asset-listing':'export const findLibraryAssetByOrigin=()=>{throw Error("No listing");};export const listLibraryAssetPage=findLibraryAssetByOrigin;',
    './asset-media':'export const copyRemoteMedia=()=>{throw Error("No remote copy");};export const createRemoteVideoAssetThumbnail=copyRemoteMedia;',
    './asset-resolvers':'export const resolveReusableAssetPreviewUrl=async()=>null;export const resolveReusableAssetThumbUrl=async input=>input.thumbUrl;',
    '../../_lib/studio-route-utils':'export const resolveStudioRouteContext=async()=>fixture.owner?{userId:fixture.owner}:{response:new Response(null,{status:401})};export const studioJson=(body,init)=>new Response(JSON.stringify(body),init);',
  };
  const bundle=await build({absWorkingDir:frontend,stdin:{contents:"export {renderAndPublishSubtitles} from './src/server/subtitles/publish';export {POST} from './app/api/studio/media/resolve/route';",resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',packages:'external',write:false,plugins:[{name:'subtitle-publication',setup(builder){
    builder.onResolve({filter:/.*/},args=>args.path in stubs?{path:args.path,namespace:'fixture'}:undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
  }}]});
  const module={exports:{} as {renderAndPublishSubtitles:(operation:unknown)=>Promise<any>;POST:(request:unknown)=>Promise<Response>}};
  runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,fixture,require:createRequire(resolve(frontend,'package.json')),process:{env:{S3_PUBLIC_BASE_URL:base}},URL,Response,Buffer,console});
  const result=await module.exports.renderAndPublishSubtitles({id:'subtitle-operation',user_id:'owner',job_id:'subtitle-render-job',request_snapshot:{document}});
  assert.equal(rendered,1);assert.equal(uploaded,1);
  assert.match(result.assetId,/^ma_[a-f0-9]{32}$/u);
  assert.deepEqual(JSON.parse(JSON.stringify(result.ref)),{type:'asset',assetId:result.assetId,kind:'video'});
  assert.equal(result.originalUrl,originalUrl);assert.equal(result.thumbnailUrl,thumbnailUrl);
  const row=(await pg.pool.query('SELECT * FROM media_assets')).rows[0];
  assert.equal(row.public_id,result.assetId);assert.equal(row.user_id,'owner');assert.equal(row.source_job_id,'subtitle-render-job');
  assert.equal(row.url,originalUrl);assert.equal(row.metadata.originUrl,originalUrl);
  assert.deepEqual(row.metadata.sourceRefs,[sourceRef]);assert.equal(row.metadata.sourceFingerprint,document.source.fingerprint);
  assert.equal(row.metadata.subtitleDocumentId,document.id);assert.equal(row.metadata.subtitleRevision,document.revision);
  const read=()=>module.exports.POST({json:async()=>({refs:[result.ref]})});
  const response=await read();assert.equal(response.status,200);
  const media=(await response.json()).assets[0];
  assert.deepEqual(media.mediaFacts,{source:'probe',durationSec:measured.durationMs/1000,width:measured.width,height:measured.height,hasAudio:measured.hasAudio});
  assert.equal(media.durationSec,measured.durationMs/1000,'Publish the measured output duration, not the source document duration.');
  assert.deepEqual(media.originalAccess,{type:'owned-storage',storageKey:'renders/owner/subtitles.mp4'});
  assert.equal(media.url,originalUrl);
  assert.deepEqual(conversationLibraryInsertTiming({kind:'video',mediaFacts:media.mediaFacts,timelineDurationSec:4,fps:30}),{startFrame:120,durationFrames:Math.floor(measured.durationMs*30/1000)});
  assert.ok(media.mediaFacts.durationSec>=2,'A two-second replacement remains eligible.');
  fixture.owner='other';assert.equal((await read()).status,404);
  fixture.owner=null;assert.equal((await read()).status,401);
  fixture.owner='owner';await pg.pool.query("UPDATE app_jobs SET hidden=true WHERE job_id='subtitle-render-job'");
  assert.equal((await read()).status,404);
  await pg.pool.query("UPDATE app_jobs SET hidden=false WHERE job_id='subtitle-render-job';UPDATE media_assets SET url=replace(url,'/owner/','/other/')");
  assert.equal((await read()).status,404,'An owned row never authorizes another account’s object.');
});
