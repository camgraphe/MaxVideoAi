import type {ToolAssetRef} from '@/lib/toolbox/contract';
import {hydrateOwnedVideoMediaFacts,type OwnedVideoFactsDependencies} from '@/server/media-library/owned-video-facts';
import {resolveStudioMedia,type StudioResolvedMedia} from '@/server/studio/media-resolver';

export const promptAnalysisSourceIdentity=(source:StudioResolvedMedia)=>JSON.stringify([source.id,source.ref,source.kind,source.url,source.mime,source.sizeBytes??null]);
const hasDuration=(source:StudioResolvedMedia)=>typeof source.durationSec==='number'&&Number.isFinite(source.durationSec)&&source.durationSec>0;

/** Quote preparation only. Read/recovery and paid confirmation never repair media. */
export async function resolvePromptAnalysisSource(userId:string,ref:ToolAssetRef,signal:AbortSignal,
  dependencies:{resolve?:typeof resolveStudioMedia;hydrate?:typeof hydrateOwnedVideoMediaFacts;facts?:OwnedVideoFactsDependencies}={}) {
  signal.throwIfAborted();
  const resolve=dependencies.resolve??resolveStudioMedia;
  let source=await resolve(userId,ref);
  signal.throwIfAborted();
  if(source.kind!==ref.kind)throw new Error('REFERENCE_INVALID');
  if(source.kind==='video'&&!hasDuration(source)) {
    const original=promptAnalysisSourceIdentity(source);
    try{await(dependencies.hydrate??hydrateOwnedVideoMediaFacts)({userId,ref,expectedUrl:source.url,signal},dependencies.facts);}
    catch{throw new Error('REFERENCE_DURATION_UNKNOWN');}
    signal.throwIfAborted();
    source=await resolve(userId,ref);
    signal.throwIfAborted();
    if(promptAnalysisSourceIdentity(source)!==original)throw new Error('REFERENCE_INVALID');
  }
  if(!hasDuration(source))throw new Error('REFERENCE_DURATION_UNKNOWN');
  return source;
}

/** One free-preparation budget starts before context/auth reads, below the browser's 30s wait. */
export async function withinPromptAnalysisPreparation<T>(work:(signal:AbortSignal)=>Promise<T>,signal=AbortSignal.timeout(20_000)):Promise<T> {
  let abort:()=>void=()=>{};
  const expired=new Promise<never>((_resolve,reject)=>{abort=()=>reject(new Error('REFERENCE_DURATION_UNKNOWN'));signal.addEventListener('abort',abort,{once:true});});
  try{signal.throwIfAborted();return await Promise.race([work(signal),expired]);}
  catch(error){if(signal.aborted)throw new Error('REFERENCE_DURATION_UNKNOWN');throw error;}
  finally{signal.removeEventListener('abort',abort);}
}
