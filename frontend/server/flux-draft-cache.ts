import { createHash } from 'node:crypto';
import { validateFluxLtxSource } from '@/lib/flux-ltx-operations';
import { openPublicHttpsResponse, publicMediaTransport, type ReferenceFileDownloaderDependencies, type ReferenceHttpsResponse } from './public-media-transport';

export type FluxDraftOrigin = {ownerId:string;jobId:string;outputId:string;providerRequestId:string;attemptId:number;endpoint:string;outputUrl:string;outputSha256:string};
export type FluxDraftPairProof = {providerRequestId:string;providerVideoUrl:string;cacheUrl:string;videoIdentity:string;audioIdentity:string|null;ownedVideoIdentity:string;ownedAudioIdentity:string|null;ownedSha256:string;durationSec:number;fps:number;decodedFrameCount:number};
export type QualifiedFluxDraftSource = FluxDraftOrigin & {cacheUrl:string;cacheIdentity:string;providerVideoUrl:string;durationSec:number;fps:number;decodedFrameCount:number;fingerprint:string;expiresAt:string|null;invalidatedAt:string|null};
export const FLUX_NATIVE_DRAFT_ENDPOINTS = ['text-to-video','image-to-video','first-last-frame-to-video','keyframes-to-video'].map(mode=>`blackforestlabs/flux-3/${mode}/draft`);
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function fluxProviderMediaUrl(value:string):URL {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||!(url.hostname==='fal.media'||url.hostname.endsWith('.fal.media'))) throw new Error('Draft provider media is unavailable.');
  return url;
}
/** Only server-recovered terminal results and paired decoded bytes may call this owner. */
export function qualifyFluxDraftPair(source:FluxDraftOrigin,proof:FluxDraftPairProof):QualifiedFluxDraftSource {
  const cache=fluxProviderMediaUrl(proof.cacheUrl);fluxProviderMediaUrl(proof.providerVideoUrl);
  if(!FLUX_NATIVE_DRAFT_ENDPOINTS.includes(source.endpoint)||!source.ownerId||!source.jobId||!source.outputId||!source.attemptId
    ||proof.providerRequestId!==source.providerRequestId||!proof.videoIdentity||proof.videoIdentity!==proof.ownedVideoIdentity
    ||proof.audioIdentity!==proof.ownedAudioIdentity||proof.ownedSha256!==source.outputSha256||!/^[a-f0-9]{64}$/.test(source.outputSha256)
    ||!Number.isFinite(proof.fps)||proof.fps<=0||!Number.isSafeInteger(proof.decodedFrameCount)||proof.decodedFrameCount<1
    ||validateFluxLtxSource('flux-draft-enhance',proof)) throw new Error('This Draft does not have a qualified paired cache.');
  const cacheIdentity=digest([source.providerRequestId,cache.origin+cache.pathname]);
  const fingerprint=digest([source,cacheIdentity,proof.videoIdentity,proof.audioIdentity,proof.durationSec,proof.fps,proof.decodedFrameCount]);
  return {...source,cacheUrl:proof.cacheUrl,providerVideoUrl:proof.providerVideoUrl,cacheIdentity,durationSec:proof.durationSec,fps:proof.fps,decodedFrameCount:proof.decodedFrameCount,fingerprint,expiresAt:null,invalidatedAt:null};
}
export const FLUX_CACHE_AVAILABILITY_TIMEOUT_MS = 30_000;
/** One deadline covers DNS, connection and the first nonempty body chunk. GET with
 * pinned public DNS and no redirects supports hosts without HEAD. This is current
 * reachability evidence only, not a guarantee of future supplier acceptance. */
export async function checkFluxDraftCacheAvailability(source:QualifiedFluxDraftSource,dependencies:ReferenceFileDownloaderDependencies=publicMediaTransport,options:{timeoutMs?:number}={}):Promise<void> {
  fluxProviderMediaUrl(source.cacheUrl);
  if(source.invalidatedAt || (source.expiresAt!==null && (!Number.isFinite(Date.parse(source.expiresAt))||Date.parse(source.expiresAt)<=Date.now()))) throw new Error('The Draft cache is no longer available.');
  const timeoutMs = Math.min(options.timeoutMs??FLUX_CACHE_AVAILABILITY_TIMEOUT_MS,FLUX_CACHE_AVAILABILITY_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs)||timeoutMs<=0) throw new Error('Invalid cache availability deadline.');
  const controller = new AbortController();
  let response:ReferenceHttpsResponse|undefined;
  const cancel = () => { const current=response;response=undefined;current?.cancel?.(); };
  let timer:ReturnType<typeof setTimeout>|undefined;
  const deadline = new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new Error('The Draft cache availability check timed out.');
      controller.abort(error);cancel();reject(error);
    },timeoutMs);
  });
  const read = async () => {
    const opened=await openPublicHttpsResponse(source.cacheUrl,dependencies,{signal:controller.signal,timeoutMs,redirect:'error'});
    // A late injected/transport response must not retain a socket after the deadline.
    if(controller.signal.aborted){opened.cancel?.();controller.signal.throwIfAborted();}
    response=opened;
    if(response.statusCode!==200&&response.statusCode!==206) throw new Error('The Draft cache could not be read.');
    for await(const chunk of response.body) {controller.signal.throwIfAborted();if(chunk.byteLength>0)return;}
    throw new Error('The Draft cache is empty.');
  };
  try { await Promise.race([read(),deadline]); }
  finally {clearTimeout(timer);cancel();}
}
/** Public-safe quote binding. Cache URLs never enter request, quote, history or reuse data. */
export function fluxDraftQuoteBinding(source:QualifiedFluxDraftSource|undefined) {
  return source ? {fluxDraftSource:{sourceJobId:source.jobId,outputId:source.outputId,fingerprint:source.fingerprint,durationSec:source.durationSec,
    quantityPolicy:'measured_owned_native_draft_up_to_21s_v1',expiry:source.expiresAt??'unknown',supplierCostIsEstimate:true}} : {};
}
