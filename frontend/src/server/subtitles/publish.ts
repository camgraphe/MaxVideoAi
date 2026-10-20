import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withOwnedSubtitleSource} from './source';
import type {SubtitleOperationRecord} from './jobs';
/** Runs only in the bounded media worker. Storage, thumbnail and canonical asset owners remain shared. */
export async function renderAndPublishSubtitles(operation:SubtitleOperationRecord,signal?:AbortSignal):Promise<Record<string,unknown>>{
  const document=operation.request_snapshot.document;
  if(!document||!operation.job_id)throw new Error('SUBTITLE_RENDER_REQUEST_INVALID');
  const directory=await mkdtemp(join(tmpdir(),'subtitle-export-'));
  try{
    const outputPath=join(directory,'subtitles.mp4');
    const {renderSubtitleVideo}=await import('./render');
    const facts=await withOwnedSubtitleSource(operation.user_id,document.source.ref,loaded=>renderSubtitleVideo({document,sourcePath:loaded.path,outputPath,signal}),{expectedFingerprint:document.source.fingerprint,signal});
    const [{publishTimelineExportArtifactWithDependencies},storage,{createVideoThumbnailFromFile},{ensureReusableAsset}]=await Promise.all([
      import('../timeline-exports/renderer'),import('@/server/storage'),import('@/server/upload-thumbnails'),import('@/server/media-library'),
    ]);
    signal?.throwIfAborted();
    const asset=await publishTimelineExportArtifactWithDependencies({outputPath,outputSize:facts.sizeBytes,userId:operation.user_id,exportId:operation.id,projectName:'Subtitles',width:facts.width,height:facts.height},{
      createLocalThumbnail:createVideoThumbnailFromFile,
      uploadPath:params=>storage.uploadFilePath({...params,prefix:'renders'}),
      ensureAsset:params=>ensureReusableAsset({...params,sourceJobId:operation.job_id,durationSec:facts.durationMs/1000,
        metadata:{toolId:'subtitles',subtitleDocumentId:document.id,subtitleRevision:document.revision,subtitleOperationId:operation.id,sourceRefs:[document.source.ref],sourceFingerprint:document.source.fingerprint,
          mediaFacts:{source:'probe',durationSec:facts.durationMs/1000,width:facts.width,height:facts.height,hasAudio:facts.hasAudio}}}),
      deleteRemote:storage.deleteStorageObjectByUrl,
    });
    return {assetId:asset.publicId??asset.id,ref:{type:'asset',assetId:asset.publicId??asset.id,kind:'video'},originalUrl:asset.url,thumbnailUrl:asset.thumbUrl,documentId:document.id,revision:document.revision};
  }finally{await rm(directory,{recursive:true,force:true});}
}
