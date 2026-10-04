import assert from 'node:assert/strict';
import test from 'node:test';
import {inspect} from 'node:util';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const requireFrontend = createRequire(resolve('frontend/package.json'));

process.env.S3_BUCKET = 'export-private-fixture';
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'fixture-key';
process.env.S3_SECRET_ACCESS_KEY = 'fixture-secret';
process.env.S3_PUBLIC_BASE_URL = 'https://export-private-fixture.s3.us-east-1.amazonaws.com';
const base = process.env.S3_PUBLIC_BASE_URL;
const original = `${base}/renders/owner/source.mp4`;
const audio = `${base}/media-assets/owner/voice.mp3`;
const requestOrigin = 'https://maxvideoai.com';
const manifest = () => ({version: 1,source: 'maxvideoai-editor',projectName: 'Film',sequenceId: 'main',sequenceName: 'Main',createdAt: '2026-10-01',status: 'ready',durationSec: 3,exportRange: {mode: 'sequence',startSec: 0,endSec: 3,durationSec: 3},issues: [],tracks: [
  {id: 'video',durationSec: 3,clips: [{id: 'v',mediaKind: 'video',mediaUrl: original}]},
  {id: 'audio',durationSec: 3,clips: [{id: 'a',mediaKind: 'audio',mediaUrl: audio}]},
]}) as any;

async function expectedSignature(url: string, method: 'HEAD'|'GET') {
  const {S3Client,HeadObjectCommand,GetObjectCommand} = requireFrontend('@aws-sdk/client-s3');
  const {getSignedUrl} = requireFrontend('@aws-sdk/s3-request-presigner');
  const parsed = new URL(url);
  const date = parsed.searchParams.get('X-Amz-Date')!;
  const signingDate = new Date(date.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
  const client = new S3Client({region: 'us-east-1',credentials: {accessKeyId: 'fixture-key',secretAccessKey: 'fixture-secret'}});
  const command = new (method === 'HEAD' ? HeadObjectCommand : GetObjectCommand)({Bucket: 'export-private-fixture',Key: decodeURIComponent(parsed.pathname.slice(1))});
  const expected = new URL(await getSignedUrl(client,command,{expiresIn: Number(parsed.searchParams.get('X-Amz-Expires')),signingDate}));
  return expected.searchParams.get('X-Amz-Signature');
}

test('private validation uses a HEAD-specific grant and returns canonical URLs for hashes and persistence', async () => {
  const {validateTimelineExportManifestMediaUrls} = await import('../frontend/src/server/timeline-exports/media-security');
  const input = manifest();
  const before = JSON.stringify(input);
  const fetched: string[] = [];
  const validated = await validateTimelineExportManifestMediaUrls({manifest: input,userId: 'owner',requestOrigin,fetchImpl: async (url, options) => {
    const grant = String(url);fetched.push(grant);
    assert.ok(new URL(grant).searchParams.get('X-Amz-Signature'),'Private HEAD must carry a signature');
    assert.equal(options?.method,'HEAD');assert.equal(options?.redirect,'error');
    assert.equal(new URL(grant).searchParams.get('X-Amz-Signature'),await expectedSignature(grant,'HEAD'));
    return new Response(null,{headers: {'content-type': grant.includes('voice.mp3') ? 'audio/mpeg' : 'video/mp4','content-length': '128'}});
  }});
  assert.equal(fetched.length,2);
  assert.equal(JSON.stringify(validated),before);assert.equal(JSON.stringify(input),before);
  assert.doesNotMatch(JSON.stringify(validated),/X-Amz-/);
});

test('render preparation signs GET with the canonical job owner without mutating its manifest', async () => {
  const module = await import('../frontend/src/server/timeline-exports/media-security');
  assert.equal(typeof module.prepareTimelineExportRenderMedia,'function');
  const input = manifest();const before = JSON.stringify(input);
  const rendered = await module.prepareTimelineExportRenderMedia({manifest: input,userId: 'owner',requestOrigin});
  for (const clip of rendered.tracks.flatMap(track => track.clips)) {
    const url = new URL(clip.mediaUrl);
    assert.equal(url.searchParams.get('X-Amz-Signature'),await expectedSignature(clip.mediaUrl,'GET'));
    assert.equal(url.searchParams.get('X-Amz-Expires'),'3600');
  }
  assert.equal(JSON.stringify(input),before);
});

test('foreign and ownerless private sources are denied before fetch; public sources retain bounded validation', async () => {
  const {validateTimelineExportManifestMediaUrls} = await import('../frontend/src/server/timeline-exports/media-security');
  let reads = 0;
  for (const userId of ['other',undefined]) await assert.rejects(validateTimelineExportManifestMediaUrls({manifest: manifest(),userId,requestOrigin,fetchImpl: async () => {reads++;throw Error('unexpected');}}),/EXPORT_MEDIA_NOT_OWNED/);
  assert.equal(reads,0);
  const input = manifest();input.tracks = [input.tracks[0]];input.tracks[0].clips[0].mediaUrl = 'https://cdn.maxvideoai.com/public.mp4';
  const result = await validateTimelineExportManifestMediaUrls({manifest: input,requestOrigin,fetchImpl: async url => {
    assert.equal(String(url),'https://cdn.maxvideoai.com/public.mp4');
    return new Response(null,{headers: {'content-type':'video/mp4','content-length':'128'}});
  }});
  assert.deepEqual(result,input);
});

test('private probe failures never surface their grant in errors', async () => {
  const {validateTimelineExportManifestMediaUrls} = await import('../frontend/src/server/timeline-exports/media-security');
  const error = await validateTimelineExportManifestMediaUrls({manifest: manifest(),userId: 'owner',requestOrigin,fetchImpl: async url => {throw new Error('Private request failed: '+String(url));}}).catch(error => error);
  assert.equal(error.message,'EXPORT_MEDIA_UNAVAILABLE');assert.doesNotMatch(inspect(error),/X-Amz-|fixture-secret/);
});

function assetExecutor(url: string) {
  return {query: async <T>() => [{id:'asset',public_id:'public-asset',user_id:'owner',kind:'video',status:'ready',url,mime_type:'video/mp4'}] as T[]};
}

test('artifact projection is stable across polls, separates the canonical original and preserves exact ownership', async () => {
  const module = await import('../frontend/src/server/timeline-exports/media-access').catch(() => null);
  assert.ok(module?.ownedTimelineExportJobResponse);
  const job = {id:'export',user_id:'owner',status:'completed',progress:100,message:null,output_url:`${base}/timeline-exports/owner/film.mp4`,output_asset_id:'asset',output_size_bytes:128,output_mime_type:'video/mp4'} as any;
  const before = JSON.stringify(job);
  const response = await module.ownedTimelineExportJobResponse(job,'owner',assetExecutor(job.output_url));
  assert.equal(response.artifact!.outputUrl,'/api/studio/timeline-exports/export/media');
  assert.equal(response.artifact!.canonicalOriginalUrl,job.output_url);
  assert.deepEqual(await module.ownedTimelineExportJobResponse(job,'owner',assetExecutor(job.output_url)),response);
  assert.doesNotMatch(JSON.stringify(response),/X-Amz-/);
  assert.equal(JSON.stringify(job),before);
  await assert.rejects(module.ownedTimelineExportJobResponse(job,'other'),/EXPORT_NOT_FOUND/);
  await assert.rejects(module.ownedTimelineExportJobResponse({...job,output_url:original.replace('/owner/','/other/')},'owner'),/EXPORT_MEDIA_NOT_OWNED/);
  assert.equal((await module.ownedTimelineExportJobResponse({...job,status:'failed'},'owner')).artifact,null);
});

test('owned project history projects stable read URLs after its scoped SELECT and never writes grants', async () => {
  const {listStudioProjectTimelineExports} = await import('../frontend/src/server/timeline-exports/repository');
  const job = {id:'history',user_id:'owner',status:'completed',progress:100,message:null,output_url:`${base}/timeline-exports/owner/history.mp4`,output_asset_id:'asset',output_size_bytes:128,output_mime_type:'video/mp4',idempotency_key:'same-key'} as any;
  const before = JSON.stringify(job);
  const queries: string[] = [];
  const result = await listStudioProjectTimelineExports({userId:'owner',projectId:'film'},{query: async <T>(sql: string,values: unknown[] = []) => {
    queries.push(sql);assert.match(sql,/^SELECT/);assert.doesNotMatch(sql,/INSERT|UPDATE|CREATE/);
    if (sql.includes('to_regclass')) return [{name:'app_timeline_exports'}] as T[];
    if (sql.includes('FROM media_assets')) return assetExecutor(job.output_url).query<T>();
    assert.deepEqual(values,['film','owner']);assert.match(sql,/p.user_id=\$2/);assert.match(sql,/p.deleted_at IS NULL/);
    return [job] as T[];
  }});
  assert.equal(result.length,1);assert.equal(result[0].idempotencyKey,'same-key');
  assert.equal(result[0].artifact!.outputUrl,'/api/studio/timeline-exports/history/media');
  assert.equal(result[0].artifact!.canonicalOriginalUrl,job.output_url);
  assert.doesNotMatch(JSON.stringify(result),/X-Amz-/);
  assert.equal(JSON.stringify(job),before);assert.equal(queries.length,4);
});

test('private access preserves metadata, size, timeout, URL and canonical-grant rejection guards', async () => {
  const {validateLegacyTimelineExportMediaUrl,prepareTimelineExportRenderMedia} = await import('../frontend/src/server/timeline-exports/media-security');
  for (const [headers,error] of [
    [{'content-type':'audio/mpeg','content-length':'128'},'EXPORT_MEDIA_TYPE_MISMATCH'],
    [{'content-type':'video/mp4'},'EXPORT_MEDIA_SIZE_REQUIRED'],
    [{'content-type':'video/mp4','content-length':String(513*1024*1024)},'EXPORT_MEDIA_TOO_LARGE'],
  ] as const) {
    await assert.rejects(validateLegacyTimelineExportMediaUrl({url:original,userId:'owner',mediaKind:'video',requestOrigin,fetchImpl:async()=>new Response(null,{headers})}),new RegExp(error));
  }
  await assert.rejects(validateLegacyTimelineExportMediaUrl({url:original,userId:'owner',mediaKind:'video',requestOrigin,timeoutMs:100,fetchImpl:async(_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError'))))}),/EXPORT_MEDIA_PROBE_TIMEOUT/);
  for (const url of ['https://evil.example/private.mp4','http://127.0.0.1/metadata',`${original}?X-Amz-Signature=already-signed`]) {
    let reads=0;
    await assert.rejects(validateLegacyTimelineExportMediaUrl({url,userId:'owner',mediaKind:'video',requestOrigin,fetchImpl:async()=>{reads++;throw Error('unexpected');}}),/EXPORT_MEDIA_URL_NOT_ALLOWED/);
    assert.equal(reads,0);
  }
  await assert.rejects(prepareTimelineExportRenderMedia({manifest:manifest(),userId:'other',requestOrigin}),/EXPORT_MEDIA_NOT_OWNED/);
});
