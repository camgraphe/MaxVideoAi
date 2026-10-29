import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {hydrateOwnedVideoMediaFacts} from '@/server/media-library/owned-video-facts';
import {AgentApiError} from '@/server/agent-api/errors';
import type {ResolvedReference} from '@/server/agent-api/reference-types';
import {resolveStudioMedia,type StudioResolvedMedia} from './media-resolver';

export type StudioAttachmentFactsDependencies={resolveMedia?:typeof resolveStudioMedia;hydrateVideoFacts?:typeof hydrateOwnedVideoMediaFacts};
const completeVideoFacts=(media:StudioResolvedMedia)=>typeof media.durationSec==='number'&&Number.isFinite(media.durationSec)&&media.durationSec>0
  &&typeof media.width==='number'&&Number.isSafeInteger(media.width)&&media.width>0
  &&typeof media.height==='number'&&Number.isSafeInteger(media.height)&&media.height>0;
const identity=(media:StudioResolvedMedia)=>JSON.stringify([media.id,media.ref,media.kind,media.url,media.mime,media.sizeBytes??null,media.originalName??null]);
const unavailable=()=>new AgentApiError('REFERENCE_INVALID','The attached media is no longer available.');
const unverified=()=>new AgentApiError('REFERENCE_INVALID','Studio could not verify the saved video’s duration and dimensions. Keep the original selected and retry verification, or choose another saved original.');

/** Explicit new-message intake only. Read routes and recorded-response recovery never repair media. */
export async function resolveStudioConversationAttachments(
  actor:{userId:string},attachments:NonNullable<ImageTurnInput['attachments']>,
  dependencies:StudioAttachmentFactsDependencies & {qualifyMissingVideoFacts?:boolean}={},
):Promise<ResolvedReference[]> {
  const resolve=dependencies.resolveMedia??resolveStudioMedia;
  const unique=[...new Map(attachments.map(ref=>[JSON.stringify(ref),ref])).values()];
  const sources=new Map<string,StudioResolvedMedia>();
  // Authorize the entire selection before inspecting or persisting any source.
  for(const ref of unique){
    if(ref.type!=='asset'||ref.kind==='image')throw unavailable();
    let media:StudioResolvedMedia;
    try{media=await resolve(actor.userId,ref);}catch{throw unavailable();}
    if(media.kind!==ref.kind||media.ref.type!=='asset'||media.ref.assetId!==ref.assetId)throw unavailable();
    sources.set(JSON.stringify(ref),media);
  }
  const missing=dependencies.qualifyMissingVideoFacts===false?[]:unique.filter(ref=>{
    const media=sources.get(JSON.stringify(ref))!;return media.kind==='video'&&!completeVideoFacts(media);
  });
  // Match the existing editing qualification bound. Each exact original keeps
  // its owner's 100 MiB, 30-second download and 15-second local probe limits.
  if(missing.length>12)throw new AgentApiError('REFERENCE_INVALID','Select at most twelve saved videos with missing file facts for verification in one message.');
  for(const ref of missing){
    const media=sources.get(JSON.stringify(ref))!;
    try{await(dependencies.hydrateVideoFacts??hydrateOwnedVideoMediaFacts)({userId:actor.userId,ref,expectedUrl:media.url});}
    catch{throw unverified();}
  }
  if(missing.length){
    // Do not trust a returned probe alone: reread persisted canonical facts and
    // all original identities after the final qualification, before fingerprinting.
    for(const ref of unique){
      const key=JSON.stringify(ref),previous=sources.get(key)!;
      let current:StudioResolvedMedia;
      try{current=await resolve(actor.userId,ref);}catch{throw unavailable();}
      if(identity(current)!==identity(previous))throw unavailable();
      if(missing.includes(ref)&&!completeVideoFacts(current))throw unverified();
      sources.set(key,current);
    }
  }
  return attachments.map(ref=>{
    const media=sources.get(JSON.stringify(ref))!;
    return {assetId:ref.type==='asset'?ref.assetId:ref.outputId,role:'reference',mediaKind:media.kind,storageUrl:media.url,mimeType:media.mime,
      width:media.width??media.mediaFacts?.width??null,height:media.height??media.mediaFacts?.height??null,
      durationSec:media.durationSec??media.mediaFacts?.durationSec??null,sizeBytes:media.sizeBytes??null,originalName:media.originalName??null};
  });
}
