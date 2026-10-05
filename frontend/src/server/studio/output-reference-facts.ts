import {readMediaFacts} from '@/lib/media-identity';
import {readGeneratedVideoFacts,videoDuration} from '@/lib/generated-video-media-facts';
import {resolveRecentOutputMetadata} from '@/server/media-library/recent-output-metadata';
import {resolveSupportedReferenceMedia} from '@/server/agent-api/reference-media-policy';
import {validReferenceMediaUrl} from '@/server/agent-api/reference-assets';
import {extractStorageKeyFromUrl,ownedMediaStorageKeyForUrl} from '@/server/storage';

export type StudioReferenceFactsRow = {
  id:string;user_id:string;kind:string;url:string;storage_url?:string|null;status:string;
  job_id?:string;source_job_id?:string|null;source_output_id?:string|null;deleted_at?:unknown;
  mime_type?:string|null;size_bytes?:number|string|null;width?:number|null;height?:number|null;
  metadata?:Record<string,unknown>;
};
export type StudioReferenceMetadataHead = (key:string,signal:AbortSignal)=>Promise<{size:number|null;mime:string|null}>;

function positiveInteger(value:unknown):number|null {
  const number=typeof value==='string'&&value.trim()?Number(value):value;
  return typeof number==='number'&&Number.isSafeInteger(number)&&number>0?number:null;
}

/** Read-only facts of the exact native original; a saved copy never replaces its identity. */
export async function completeStudioOutputReferenceFacts(
  output:StudioReferenceFactsRow,
  signal:AbortSignal,
  dependencies:{readSaved:()=>Promise<StudioReferenceFactsRow|null>;head:StudioReferenceMetadataHead},
) {
  signal.throwIfAborted();
  const url=output.storage_url||output.url;
  const originalMedia=resolveSupportedReferenceMedia(output.kind,output.mime_type);
  if(!originalMedia)throw new Error('MEDIA_NOT_AVAILABLE');
  const measured=readMediaFacts(output.metadata?.mediaFacts);
  const generated=output.kind==='video'?readGeneratedVideoFacts(output.metadata?.mediaFacts,url):null;
  const storedFacts=output.metadata?.mediaFacts;
  if(output.kind==='video'&&storedFacts&&typeof storedFacts==='object'&&'version' in storedFacts&&!generated)
    throw new Error('MEDIA_NOT_AVAILABLE');
  let sizeBytes=generated?.original.sizeBytes??positiveInteger(output.size_bytes);
  let width=positiveInteger(output.width)??positiveInteger(measured?.width);
  let height=positiveInteger(output.height)??positiveInteger(measured?.height);
  let durationSec=generated?.durationSec??measured?.durationSec??null;
  if(sizeBytes===null) {
    const saved=await dependencies.readSaved();
    signal.throwIfAborted();
    const savedUrl=saved?.storage_url||saved?.url;
    const savedMedia=saved&&resolveSupportedReferenceMedia(saved.kind,saved.mime_type);
    if(saved&&savedUrl&&saved.user_id===output.user_id&&saved.kind===output.kind&&saved.status==='ready'&&!saved.deleted_at
      &&saved.source_output_id===output.id&&saved.source_job_id===output.job_id
      &&(savedUrl===url||saved.metadata?.originUrl===url)&&validReferenceMediaUrl(savedUrl)
      &&(!extractStorageKeyFromUrl(savedUrl)||ownedMediaStorageKeyForUrl({url:savedUrl,userId:output.user_id}))
      &&savedMedia?.canonicalMime===originalMedia.canonicalMime) {
      sizeBytes=positiveInteger(saved.size_bytes);
      const savedFacts=readMediaFacts(saved.metadata?.mediaFacts);
      width??=positiveInteger(saved.width)??positiveInteger(savedFacts?.width);
      height??=positiveInteger(saved.height)??positiveInteger(savedFacts?.height);
      durationSec??=saved.kind==='video'?videoDuration(saved.metadata??{},savedUrl,null):savedFacts?.durationSec??null;
    }
  }
  const result=await resolveRecentOutputMetadata(output.id,output.user_id,signal,{
    readOutput:async()=>({id:output.id,userId:output.user_id,kind:originalMedia.kind,url,status:output.status,
      hidden:false,size:sizeBytes,mime:originalMedia.canonicalMime}),
    storageKey:(originalUrl)=>ownedMediaStorageKeyForUrl({url:originalUrl,userId:output.user_id}),
    head:dependencies.head,
  });
  if(result&&resolveSupportedReferenceMedia(output.kind,result.mime)?.canonicalMime!==originalMedia.canonicalMime)
    throw new Error('MEDIA_NOT_AVAILABLE');
  // Unmeasured external originals remain unavailable to models requiring byte facts.
  return {sizeBytes:positiveInteger(result?.size),width,height,durationSec};
}
