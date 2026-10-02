import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {writeFileSync} from 'node:fs';
import test from 'node:test';
import {build} from 'esbuild';

const frontend = resolve('frontend');
const base = 'https://export-boundary-fixture.s3.us-east-1.amazonaws.com';
const env = {S3_BUCKET:'export-boundary-fixture',S3_REGION:'us-east-1',S3_ACCESS_KEY_ID:'fixture-key',S3_SECRET_ACCESS_KEY:'fixture-secret',S3_PUBLIC_BASE_URL:base};
const original = `${base}/renders/owner/clip.mp4`;
const output = `${base}/timeline-exports/owner/film.mp4`;
const manifest = {version:1,source:'maxvideoai-editor',projectName:'Film',sequenceId:'main',sequenceName:'Main',createdAt:'2026-10-02T00:00:00Z',status:'ready',durationSec:3,exportRange:{mode:'sequence',startSec:0,endSec:3,durationSec:3},issues:[],tracks:[{id:'video',durationSec:3,clips:[{id:'v',outputNodeId:'v',assetId:'v',title:'Clip',track:'video',mediaKind:'video',mediaUrl:original,startSec:0,endSec:3,durationSec:3,sourceStartSec:0,sourceEndSec:3,sourceDurationSec:3}]}]};
const makeJob = () => ({id:'offline-private-boundary',user_id:'owner',status:'completed',progress:100,message:null,render_manifest:structuredClone(manifest),export_settings:{includeAudio:true},project_name:'Film',fps:30,resolution:'720p',billing_status:'free_reserved',amount_cents:0,output_url:output,output_asset_id:'asset',output_size_bytes:128,output_mime_type:'video/mp4'});

async function load(contents: string,stubs: Record<string,string>,fixture: object) {
  const result = await build({absWorkingDir:frontend,stdin:{contents,resolveDir:frontend,loader:'ts'},tsconfig:resolve(frontend,'tsconfig.json'),bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'offline-boundaries',setup(builder){
    builder.onResolve({filter:/.*/},args => args.path in stubs ? {path:args.path,namespace:'fixture'} : undefined);
    builder.onLoad({filter:/.*/,namespace:'fixture'},args => ({contents:stubs[args.path],loader:'js',resolveDir:frontend}));
  }}]});
  const module = {exports:{} as any};
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,fixture,require:createRequire(resolve(frontend,'package.json')),process:{env,cwd:()=>frontend},URL,Response,AbortController,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,console});
  return module.exports;
}

const common = {
  '@/lib/db':'export const query = () => {throw Error("Unexpected database call");};',
  '@/lib/schema':'export const ensureAssetSchema = () => {throw Error("Unexpected schema write");};',
};

test('GET and POST replay return readable owned artifacts without recreating a job, reservation or worker', async () => {
  const fixture = {job:makeJob(),authorized:true,reservations:[] as any[],response:null as Response|null};
  const utils = 'export const resolveStudioRouteContext = async () => fixture.authorized ? {userId:"owner"} : {response:new Response(null,{status:401})};';
  const route = await load(`export {GET} from './app/api/studio/timeline-exports/[exportId]/route'; export {POST} from './app/api/studio/timeline-exports/route';`,{
    ...common,
    '@/lib/db':`export const query = async (sql,values) => {if (!sql.startsWith('SELECT') || !sql.includes('FROM media_assets')) throw Error('Unexpected DB operation');return [{id:'asset',public_id:'public-asset',user_id:'owner',kind:'video',status:'ready',url:fixture.job.output_url,mime_type:'video/mp4'}];};`,
    'next/server':'export const NextResponse = {json:(body,init) => new Response(JSON.stringify(body),init)};',
    '../../_lib/studio-route-utils':utils,'../_lib/studio-route-utils':utils,
    '@/server/timeline-exports/repository':'export const readTimelineExportJob = async input => input.userId === "owner" && input.exportId === fixture.job.id ? fixture.job : null; export const readTimelineExportJobByIdempotencyKey = async () => fixture.job; export const failTimelineExportJob = () => {throw Error("Unexpected failure write");};',
    '@/server/timeline-exports/billing':'export const createTimelineExportJobWithReservation = async input => {fixture.reservations.push(input); return {job:fixture.job,reused:true,billing:null};}; export const releaseFailedTimelineExportBilling = () => {throw Error("Unexpected refund");};',
    '@/server/timeline-exports/ecs-runner':'export const assertTimelineExportWorkerLauncherConfigured = () => {throw Error("Unexpected launcher");}; export const launchTimelineExportWorkerTask = assertTimelineExportWorkerLauncherConfigured;',
    '@/server/timeline-exports/manifest-resolver':'export const resolveOwnedTimelineExportRequest = async input => input.request;',
    '@/server/timeline-exports/estimate-token':'export const resolveTimelineExportEstimateSecret = () => "fixture";',
  },fixture);
  const before = JSON.stringify(fixture.job);
  const result = await route.GET({}, {params:Promise.resolve({exportId:fixture.job.id})});
  assert.equal(result.status,200);
  const getPayload = await result.json();assert.equal(getPayload.export.artifact.outputUrl,'/api/studio/timeline-exports/offline-private-boundary/media');
  const body = {estimateToken:'fixture',request:{version:1,source:'maxvideoai-editor',projectId:'project',idempotencyKey:'fixture-private-replay',createdAt:manifest.createdAt,status:'ready',manifest,exportSettings:{format:'mp4-h264',qualityPreset:'draft',includeAudio:true,serverRenderMode:'server'}}};
  const response = await route.POST({json:async()=>body,nextUrl:{origin:'https://maxvideoai.com'}});
  const postPayload = await response.json();assert.equal(response.status,200,JSON.stringify(postPayload));assert.equal(postPayload.reused,true);
  assert.deepEqual(postPayload.export,getPayload.export);assert.equal(postPayload.export.artifact.outputAssetId,'public-asset');assert.equal(postPayload.export.artifact.canonicalOriginalUrl,output);assert.doesNotMatch(JSON.stringify(postPayload),/X-Amz-/);
  assert.doesNotMatch(JSON.stringify(fixture.reservations),/X-Amz-/);assert.equal(JSON.stringify(fixture.job),before);
  fixture.authorized = false;
  assert.equal((await route.GET({}, {params:Promise.resolve({exportId:fixture.job.id})})).status,401);
});

test('real worker orchestration uses owned HEAD/GET transport and persists only stable artifact or sanitized failure', async () => {
  for (const fail of [false,true]) {
    const fixture = {job:makeJob(),fail,heads:[] as string[],getUrls:[] as string[],writes:[] as unknown[],
      fetch: async (url: string,options: RequestInit) => {
        assert.equal(options.method,'HEAD');assert.equal(options.redirect,'error');assert.ok(new URL(url).searchParams.get('X-Amz-Signature'));fixture.heads.push(url);
        return new Response(null,{headers:{'content-type':'video/mp4','content-length':'128'}});
      },
      render: async (options: any) => {
        const url = options.inputProps.manifest.tracks[0].clips[0].mediaUrl;fixture.getUrls.push(url);
        assert.equal(new URL(url).searchParams.get('X-Amz-Expires'),'3600');
        if (fail) throw new Error('Renderer read failed '+encodeURIComponent(url));
        writeFileSync(options.outputLocation,'offline-output');
      },
    };
    const renderer = await load(`globalThis.fetch = fixture.fetch; export {renderTimelineExportJob} from './src/server/timeline-exports/renderer';`,{
      ...common,
      '@remotion/bundler':'export const bundle = async () => "offline-bundle";',
      '@remotion/renderer':'export const makeCancelSignal = () => ({cancel:()=>{},cancelSignal:{}}); export const selectComposition = async () => ({}); export const renderMedia = async input => {try{return await fixture.render(input);}catch(error){throw new Error(error.message);}};',
      '@/server/media-library':'export const ensureReusableAsset = async input => {fixture.writes.push(input); return {id:"asset",url:input.url};};',
      '@/server/upload-thumbnails':'export const createVideoThumbnailFromFile = async () => null;',
      './billing':'export const releaseFailedTimelineExportBilling = async input => {fixture.writes.push(input);return "free_failed";};',
      './repository':'export const updateTimelineExportProgress = async input => fixture.writes.push(input); export const completeTimelineExportJob = async input => fixture.writes.push(input); export const failTimelineExportJob = async input => fixture.writes.push(input);',
      // Keep the real storage signer. Substitute only remote mutation functions in the renderer import.
      '@/server/storage':`export {createSignedDownloadUrl,extractStorageKeyFromUrl,ownedMediaStorageKeyForUrl,isAllowedAssetHost} from './server/storage'; export class StorageUploadError extends Error {}; export const buildPublicStorageUrl=()=>""; export const deleteStorageObjectByUrl=async()=>true; export const uploadFilePath=async input=>{fixture.writes.push({userId:input.userId,prefix:input.prefix});return {url:${JSON.stringify(output)}}};`,
    },fixture);
    const before = JSON.stringify(fixture.job);
    await renderer.renderTimelineExportJob(fixture.job);
    assert.equal(fixture.heads.length,1);assert.equal(fixture.getUrls.length,1);assert.equal(JSON.stringify(fixture.job),before);
    assert.doesNotMatch(JSON.stringify(fixture.writes),/X-Amz-|X-Amz%|fixture-secret/);
    if (fail) assert.ok(fixture.writes.some((value:any)=>value.message?.startsWith('Renderer read failed')));
    else assert.ok(fixture.writes.some((value:any)=>value.outputUrl === output));
  }
});


test('stable media GET/HEAD renew transport on demand with exact ownership and no job mutation', async () => {
  const fixture = {job:makeJob(),authorized:true,reads:0};
  const route = await load(`export {GET,HEAD} from './app/api/studio/timeline-exports/[exportId]/media/route';`,{
    ...common,
    'next/server':'export const NextResponse = {json:(body,init) => new Response(JSON.stringify(body),init)};',
    '../../../_lib/studio-route-utils':'export const resolveStudioRouteContext = async () => fixture.authorized ? {userId:"owner"} : {response:new Response(null,{status:401})};',
    '@/lib/db':`export const query = async (sql,values) => {if (!sql.startsWith('SELECT') || !sql.includes('user_id = $2')) throw Error('Non owned read');fixture.reads++;return values[0] === fixture.job.id && values[1] === fixture.job.user_id ? [fixture.job] : [];};`,
  },fixture);
  const before = JSON.stringify(fixture.job);
  const props = {params:Promise.resolve({exportId:fixture.job.id})};
  // A browser can reopen this durable URL at any later time: each request signs anew.
  for (const handler of [route.GET,route.GET,route.HEAD]) {
    const response = await handler({nextUrl:{origin:'https://maxvideoai.com'}},props);
    assert.equal(response.status,307);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    const location = new URL(response.headers.get('Location')!);
    assert.equal(location.pathname,new URL(output).pathname);assert.ok(location.searchParams.get('X-Amz-Signature'));
  }
  assert.equal(fixture.reads,3);assert.equal(JSON.stringify(fixture.job),before);
  fixture.job.user_id = 'other';assert.equal((await route.GET({},props)).status,404);
  fixture.job.user_id = 'owner';fixture.job.status = 'rendering';assert.equal((await route.GET({},props)).status,404);
  fixture.job.status = 'completed';fixture.job.output_url=output.replace('/owner/','/other/');assert.equal((await route.GET({nextUrl:{origin:'https://maxvideoai.com'}},props)).status,404);
  fixture.authorized=false;const reads=fixture.reads;assert.equal((await route.GET({},props)).status,401);assert.equal(fixture.reads,reads);
});


test('HTTP redirect preserves Range and HEAD, and reopens a completed download after its previous grant expired', async () => {
  const fixture = {job:makeJob(),now:0,origin:'',reads:[] as {method:string,range:string|undefined}[]};
  const route = await load(`export {GET,HEAD} from './app/api/studio/timeline-exports/[exportId]/media/route';`,{
    ...common,
    '../../../_lib/studio-route-utils':'export const resolveStudioRouteContext = async () => ({userId:"owner"});',
    '@/lib/db':'export const query = async () => [fixture.job];',
    '@/server/owned-media-read-access':`export const createOwnedMediaReadUrl = async input => {if(input.userId !== 'owner') throw Error('Foreign owner');return fixture.origin+'/object?method='+input.method+'&expires='+(fixture.now+300);};`,
  },fixture);
  const server = createServer(async (req,res) => {
    if (req.url!.startsWith('/object')) {
      const url=new URL(req.url!,fixture.origin);
      if(url.searchParams.get('method') !== req.method || Number(url.searchParams.get('expires')) <= fixture.now) {res.writeHead(403);res.end();return;}
      fixture.reads.push({method:req.method!,range:req.headers.range});
      res.writeHead(req.headers.range?206:200,{'Content-Type':'video/mp4','Content-Length':'8'});res.end(req.method === 'HEAD' ? undefined : 'fixture!');return;
    }
    const response=await route[req.method === 'HEAD' ? 'HEAD' : 'GET']({nextUrl:{origin:fixture.origin}},{params:Promise.resolve({exportId:fixture.job.id})});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end();
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  fixture.origin=`http://127.0.0.1:${(server.address() as any).port}`;
  const stable=fixture.origin+'/api/studio/timeline-exports/'+fixture.job.id+'/media';
  try {
    const first=await fetch(stable,{redirect:'manual'});const oldGrant=first.headers.get('Location')!;
    fixture.now=301;
    assert.equal((await fetch(oldGrant)).status,403);
    const renewed=await fetch(stable,{headers:{Range:'bytes=0-7'}});
    assert.equal(renewed.status,206);assert.equal(await renewed.text(),'fixture!');
    const head=await fetch(stable,{method:'HEAD'});assert.equal(head.status,200);
    assert.deepEqual(fixture.reads,[{method:'GET',range:'bytes=0-7'},{method:'HEAD',range:undefined}]);
  } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
