import {mkdtemp,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {SubtitleSequenceSnapshot} from './sequence-source';
import {resolveStudioMedia} from '../studio/media-resolver';
import {extractSubtitleAudio,subtitleFileFingerprint,probeSubtitleMedia} from './media';
/** The accepted sequence is frozen; later edits cannot retarget this already paid operation. */
export async function prepareSubtitleSequenceAudio(userId:string,snapshot:SubtitleSequenceSnapshot,signal?:AbortSignal){
  for(const expected of snapshot.media){const current=await resolveStudioMedia(userId,expected.ref);if(current.id!==expected.id||current.url!==expected.url)throw new Error('SUBTITLE_SOURCE_CHANGED');}
  const directory=await mkdtemp(join(tmpdir(),'subtitle-owned-mix-'));
  try{
    const {renderSubtitleSequenceAudio}=await import('./sequence-render'),mixed=join(directory,'mix.wav'),prepared=join(directory,'transcription.wav');
    await renderSubtitleSequenceAudio({manifest:snapshot.manifest,userId,outputPath:mixed,signal});await extractSubtitleAudio({sourcePath:mixed,outputPath:prepared,signal});
    const facts=await probeSubtitleMedia(prepared),fingerprint=await subtitleFileFingerprint(prepared),storage=await import('@/server/storage');
    const sizeBytes=(await stat(prepared)).size;
    const upload=await storage.uploadFilePath({path:prepared,sizeBytes,mime:'audio/wav',userId,prefix:'renders',fileName:'studio-subtitle-mix.wav',cacheControl:'private, max-age=0'});
    try{
      const audioUrl=await storage.createSignedDownloadUrl(upload.key,{expiresInSeconds:3600});
      const {ensureReusableAsset}=await import('@/server/media-library');
      const asset=await ensureReusableAsset({userId,url:upload.url,kind:'audio',source:'import',mimeType:'audio/wav',sizeBytes,durationSec:facts.durationMs/1000,label:'Studio subtitle audio mix',metadata:{toolId:'subtitles',sequenceId:snapshot.sequenceId,sequenceRevision:snapshot.revision,audioManifestHash:snapshot.audioManifestHash}});
      return {audioUrl,storageKey:upload.key,storageUrl:upload.url,retainAsAsset:true,source:{ref:{type:'asset' as const,assetId:asset.publicId??asset.id,kind:'audio' as const},fingerprint,durationMs:facts.durationMs,sequenceMix:{sequenceId:snapshot.sequenceId,revision:snapshot.revision,audioManifestHash:snapshot.audioManifestHash}}};
    }catch(error){await storage.deleteStorageObjectByUrl(upload.url).catch(()=>false);throw error;}
  }finally{await rm(directory,{recursive:true,force:true});}
}
