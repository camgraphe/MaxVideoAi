import { createHash } from 'node:crypto';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { ensureExecutableFfmpegPath } from './ffmpeg-runtime';
import { createFalClient } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { withDbTransaction } from '@/lib/db';
import { createOwnedMediaReadUrl } from './owned-media-read-access';
import { downloadVideoExcerptMedia, inspectVideoExcerptBytes, withVideoExcerptSlot } from './video-excerpts/media';
import { qualifyFluxDraftPair, fluxProviderMediaUrl, checkFluxDraftCacheAvailability, fluxDraftQuoteBinding } from './flux-draft-cache';
import { resolveFluxDraftOrigin, persistQualifiedFluxDraftSource } from './flux-draft-cache-store';

/** Recovery SDK receives an isolated GET-only transport, never the submission client. */
export function createFluxDraftRecoveryFetch(origin:{endpoint:string;providerRequestId:string}, fetcher:typeof fetch=fetch):typeof fetch {
  if(!/^[a-zA-Z0-9_-]+$/.test(origin.providerRequestId)) throw new Error('Invalid Draft recovery identity.');
  const result=`https://queue.fal.run/${origin.endpoint.split('/').slice(0,2).join('/')}/requests/${origin.providerRequestId}`;
  return async(request,init)=>{
    const method=(init?.method??(request instanceof Request?request.method:'GET')).toUpperCase();
    const url=new URL(typeof request==='string'||request instanceof URL?request:request.url).toString();
    if(method!=='GET'||![result,result+'/status?logs=0'].includes(url)) throw new Error('Invalid Draft recovery route.');
    const response=await fetcher(request,{...init,redirect:'error',signal:AbortSignal.timeout(30_000)});
    if(response.url&&response.url!==url) throw new Error('Invalid Draft recovery response.');
    if(!response.body) throw new Error('Empty Draft recovery response.');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try {for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>2*1024*1024)throw new Error('Draft recovery response is too large.');chunks.push(chunk.value);}}
    finally{await reader.cancel();}
    return new Response(Buffer.concat(chunks),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
}
function recoveryClient(origin:{endpoint:string;providerRequestId:string}) {
  return createFalClient({credentials:ENV.FAL_API_KEY,retry:{maxRetries:0},fetch:createFluxDraftRecoveryFetch(origin)});
}

/** Compare decoded content, not container bytes: delivery may legitimately remux. */
export async function inspectFluxDraftContent(bytes:Buffer,mimeType:string) {
  const facts=await inspectVideoExcerptBytes(bytes,mimeType,{decodedFrames:true});
  if(!facts.decodedFrameCount) throw new Error('Draft video measurement is unavailable.');
  const directory=await mkdtemp(join(tmpdir(),'flux-draft-pair-'));
  try {
    const path=join(directory,'source');await writeFile(path,bytes,{mode:0o600});
    const executable=await ensureExecutableFfmpegPath(ffmpeg.path);
    const run=(args:string[])=>promisify(execFile)(executable,['-v','error','-nostdin','-threads','2','-protocol_whitelist','file,pipe','-i',path,...args],{timeout:45_000,maxBuffer:4*1024*1024});
    const video=await run(['-map','0:v:0','-an','-vsync','0','-f','framehash','-hash','sha256','-']);
    const frames=video.stdout.split('\n').filter(line=>line.trim()&&!line.startsWith('#')).map(line=>line.split(',').at(-1)!.trim());
    if(frames.length!==facts.decodedFrameCount) throw new Error('Decoded Draft frame identity is incomplete.');
    const audio=facts.hasAudio?await run(['-map','0:a:0','-vn','-c:a','pcm_s16le','-f','hash','-hash','sha256','-']):null;
    return {facts,sha256:createHash('sha256').update(bytes).digest('hex'),
      videoIdentity:createHash('sha256').update(JSON.stringify([facts.width,facts.height,frames])).digest('hex'),audioIdentity:audio?.stdout.trim()??null};
  } finally {await rm(directory,{recursive:true,force:true});}
}
/** GET-only terminal recovery for a known owned Draft, never submit or recreate.
 * Optional cache failure is isolated from successful original Draft delivery. */
export async function recoverOwnedFluxDraftCache(input:Parameters<typeof resolveFluxDraftOrigin>[0],dependencies={
  origin:resolveFluxDraftOrigin,client:recoveryClient,read:createOwnedMediaReadUrl,download:downloadVideoExcerptMedia,inspect:inspectFluxDraftContent,
  transaction:withDbTransaction,persist:persistQualifiedFluxDraftSource,availability:checkFluxDraftCacheAvailability,
}) {
  return withVideoExcerptSlot(input.userId,async()=>{
    const origin=await dependencies.origin(input);
    const client=dependencies.client(origin);
    const status=await client.queue.status(origin.endpoint,{requestId:origin.providerRequestId,logs:false});
    if(status.status!=='COMPLETED'||status.request_id!==origin.providerRequestId) throw new Error('Draft provider result is not completed.');
    const result=await client.queue.result(origin.endpoint,{requestId:origin.providerRequestId});
    // The SDK derives requestId from a response header which can be absent.
    // Exact bound GET plus completed status identity remains mandatory in that case.
    if(typeof result.requestId!=='string'||(result.requestId!==''&&result.requestId!==origin.providerRequestId)) throw new Error('Draft provider request changed.');
    const data=result.data as {video?:{url?:string};draft_cache?:{url?:string}|null};
    if(!data.draft_cache?.url) return {enhanceable:false as const,reason:'cache_missing' as const};
    const providerUrl=fluxProviderMediaUrl(data.video?.url??'').toString();fluxProviderMediaUrl(data.draft_cache.url);
    const providerBytes=await dependencies.download({file_id:'paired-provider-video',download_url:providerUrl});
    const access=await dependencies.read({url:origin.outputUrl,userId:input.userId,expiresInSeconds:300});
    const ownedBytes=await dependencies.download({file_id:'paired-owned-video',download_url:access});
    const provider=await dependencies.inspect(providerBytes.bytes,providerBytes.mimeType);
    const owned=await dependencies.inspect(ownedBytes.bytes,ownedBytes.mimeType);
    if(Math.abs(provider.facts.durationSec-owned.facts.durationSec)>0.000001||provider.facts.fps!==owned.facts.fps) throw new Error('Draft timing changed in delivery.');
    const pair=qualifyFluxDraftPair(origin,{providerRequestId:origin.providerRequestId,providerVideoUrl:providerUrl,cacheUrl:data.draft_cache.url,
      videoIdentity:provider.videoIdentity,audioIdentity:provider.audioIdentity,ownedVideoIdentity:owned.videoIdentity,ownedAudioIdentity:owned.audioIdentity,
      ownedSha256:owned.sha256,durationSec:owned.facts.durationSec,fps:owned.facts.fps,decodedFrameCount:owned.facts.decodedFrameCount!});
    await dependencies.availability(pair);
    await dependencies.transaction(async executor=>{
      // Serialize with ordinary job lifecycle mutations before re-reading current output identity.
      await executor.query('SELECT j.id,o.id FROM app_jobs j JOIN job_outputs o ON o.job_id=j.job_id WHERE j.job_id=$1 AND j.user_id=$2 AND o.id::text=$3 FOR UPDATE OF j,o',[origin.jobId,origin.ownerId,origin.outputId]);
      await dependencies.persist(pair,executor);
    });
    return {enhanceable:true as const,...fluxDraftQuoteBinding(pair)};
  });
}
