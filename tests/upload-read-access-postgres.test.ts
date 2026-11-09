import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {build} from 'esbuild';
import {startDisposablePostgres} from './helpers/disposable-postgres';
const requireFrontend=createRequire(resolve('frontend/package.json'));
test('successful tool upload DTOs carry exact stored read leases into real consumer adapters', {timeout:60000},async t=>{
 const pg=await startDisposablePostgres('upload-read'),folder=mkdtempSync(join(tmpdir(),'upload-read-'));
 const previous=process.env.DATABASE_URL;process.env.DATABASE_URL=pg.databaseUrl;
 const base='https://upload-read-fixture.s3.us-east-1.amazonaws.com';Object.assign(process.env,{S3_BUCKET:'upload-read-fixture',S3_REGION:'us-east-1',S3_ACCESS_KEY_ID:'fixture-key',S3_SECRET_ACCESS_KEY:'fixture-secret',S3_PUBLIC_BASE_URL:base});
 const fixture={userId:'alice',stored:{} as any};(globalThis as any).__uploadRead=fixture;let close:(()=>Promise<void>)|undefined;
 t.after(async()=>{await close?.();if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;delete (globalThis as any).__uploadRead;rmSync(folder,{recursive:true,force:true});await pg.cleanup();});
 const stubs:Record<string,string>={
 '@/lib/supabase-ssr':'export const createSupabaseServerClient=()=>{throw Error("unexpected server auth")};export const getRouteAuthContext=async()=>({userId:globalThis.__uploadRead.userId});',
 '@/server/uploads/store-media-upload':`export class MediaUploadError extends Error{};export const getMaxAudioUploadMB=()=>100;export const getMaxVideoUploadMB=()=>100;export const storeAudioUpload=async()=>globalThis.__uploadRead.stored;export const storeVideoUpload=async()=>globalThis.__uploadRead.stored;`,
 '@/server/media/detect-has-audio':'export const probeMediaBuffer=()=>{throw Error("unexpected probe")};export const detectMediaBufferDuration=async()=>5;',
 };
 const outfile=join(folder,'routes.cjs');await build({stdin:{loader:'ts',resolveDir:process.cwd(),contents:`export{createImageUploadPostHandler}from'./frontend/src/server/uploads/create-image-upload-post-handler';export * as video from'./frontend/app/api/uploads/video/route';export * as audio from'./frontend/app/api/uploads/audio/route';export{uploadVideoFile}from'./frontend/lib/client-video-upload';export{selectCreatorSource}from'./frontend/src/components/tools/creator/creator-source-selection';export{libraryReadRevision}from'./frontend/server/media-library/read-access';export{getDb}from'@/lib/db';export{ensureAssetSchema,ensureMediaLibrarySchema,ensureMediaLibraryOrganizationSchema}from'@/lib/schema';`},outfile,define:{'import.meta.url':JSON.stringify('file://'+resolve('frontend/server/upload-thumbnails.ts'))},bundle:true,platform:'node',format:'cjs',packages:'external',tsconfig:'frontend/tsconfig.json',plugins:[{name:'external-upload-boundaries',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'ts'}));b.onResolve({filter:/^(next\/server|pg)$/},a=>({path:requireFrontend.resolve(a.path),external:true}));}}]});
 const api=requireFrontend(outfile);close=()=>api.getDb().end();const{NextRequest}=requireFrontend('next/server');
 await api.ensureAssetSchema();await api.ensureMediaLibrarySchema();await api.ensureMediaLibraryOrganizationSchema();await pg.pool.query('CREATE TABLE app_jobs(job_id text PRIMARY KEY,user_id text,hidden boolean DEFAULT false)');
 for(const [i,kind]of ['image','video','audio'].entries()){
  const id='stored-'+kind,assetId='ma_'+String(i+1).repeat(32),url=base+'/user-assets/alice/'+kind,thumb=base+'/user-assets/alice/'+kind+'.webp';
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,thumb_url,source,metadata)VALUES($1,$2,'alice',$3,$4,$5,'upload','{}')`,[id,assetId,kind,url,thumb]);
  fixture.stored={assetId,legacyAssetId:id,storageUrl:url,url,width:960,height:540,mimeType:kind==='image'?'image/png':kind+'/mp4',sizeBytes:3,durationSec:5,mediaFacts:{source:'probe',width:960,height:540,durationSec:5}};
  const routeAsset={assetId:id,canonicalAssetId:assetId,url,width:960,height:540,mimeType:'image/png',sizeBytes:3,thumbUrl:thumb};
  const image=api.createImageUploadPostHandler({getRouteAuthContext:async()=>({userId:fixture.userId}),storeImageUpload:async()=>({assetId:id,width:960,height:540}),loadStoredImageUploadRouteAsset:async()=>routeAsset});
  const request=()=>{const form=new FormData();form.append('file',new File([new Uint8Array([1,2,3])],'source.'+kind,{type:kind==='image'?'image/png':kind+'/mp4'}));form.append('readAccessRevision','forged');return new NextRequest('https://app.test/api/uploads/'+kind,{method:'POST',body:form});};
  const response=await(kind==='image'?image(request()):api[kind].POST(request()));assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/private.*no-store/);const dto=(await response.json()).asset;
  assert.equal(dto.readAccessOwnerId,'alice',kind+' producer emits owned display descriptor');assert.deepEqual(dto.readAccessRef,{type:'asset',assetId,kind});assert.equal(dto.readAccessRevision,api.libraryReadRevision({url,thumbUrl:thumb,previewUrl:null,metadata:{}}));assert.equal(dto.url,url);assert.ok(new URL(dto.accessUrl).searchParams.get('X-Amz-Signature'));
  const selected=api.selectCreatorSource(dto,kind);assert.equal(selected.url,url);assert.equal(selected.accessUrl,dto.accessUrl);assert.deepEqual(selected.readAccessRef,dto.readAccessRef);
  if(kind==='video'){const uploaded=await api.uploadVideoFile(new File(['video'],'video.mp4',{type:'video/mp4'}),{request:async()=>Response.json({ok:true,asset:dto})});assert.equal(uploaded.url,url);assert.equal(uploaded.accessUrl,dto.accessUrl);assert.deepEqual(uploaded.readAccessRef,dto.readAccessRef);}
  // Failed read authorization/signing after durable persistence must keep upload success,
  // return no grant, and retain a private marker instead of permitting raw fallback.
  await pg.pool.query('UPDATE media_assets SET thumb_url=$1 WHERE id=$2',[base+'/user-assets/bob/foreign-thumb',id]);
  const unsigned=await(kind==='image'?image(request()):api[kind].POST(request()));assert.equal(unsigned.status,200);const retryable=(await unsigned.json()).asset;assert.equal(retryable.accessUrl,undefined);assert.match(retryable.readAccessRevision,/^ra_/);assert.equal(retryable.readAccessExpiresAt,new Date(0).toISOString());
  await pg.pool.query('UPDATE media_assets SET url=$1 WHERE id=$2',[base+'/user-assets/bob/foreign',id]);
  const failure=await(kind==='image'?image(request()):api[kind].POST(request()));assert.equal(failure.status,200);const blocked=(await failure.json()).asset;assert.equal(blocked.accessUrl,undefined);assert.equal(blocked.readAccessOwnerId,'alice');assert.equal((await pg.pool.query('SELECT count(*)::int n FROM media_assets WHERE id=$1',[id])).rows[0].n,1);
  await pg.pool.query("UPDATE media_assets SET status='deleted' WHERE id=$1",[id]);const unavailable=await(kind==='image'?image(request()):api[kind].POST(request()));assert.equal(unavailable.status,200);const missing=(await unavailable.json()).asset;assert.equal(missing.readAccessOwnerId,'alice');assert.equal(missing.readAccessRevision,undefined,'lookup failure never invents a revision');assert.equal(missing.accessUrl,undefined);
 }
});
