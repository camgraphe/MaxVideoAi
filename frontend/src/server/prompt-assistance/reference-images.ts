import sharp from 'sharp';
import {createSignedDownloadUrl} from '@/server/storage';
import {readBoundedAnalysisBody} from '@/server/studio/media-analysis/source';
import type {StudioResolvedMedia} from '@/server/studio/media-resolver';

/** Transient pixels only. Never store URLs/base64 in conversation or financial evidence. */
export async function loadPromptReferenceImage(media:StudioResolvedMedia,signal:AbortSignal) {
  if(media.kind!=='image')throw new Error('REFERENCE_INVALID');
  const url=media.originalAccess.type==='owned-storage'
    ?await createSignedDownloadUrl(media.originalAccess.storageKey,{expiresInSeconds:120}):media.url;
  const bytes=await readBoundedAnalysisBody(await fetch(url,{cache:'no-store',redirect:'error',signal}),30*1024*1024);
  signal.throwIfAborted();
  const image=await sharp(bytes,{limitInputPixels:64_000_000,animated:false}).timeout({seconds:5}).rotate()
    .resize({width:1536,height:1536,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
  signal.throwIfAborted();
  if(image.length>2*1024*1024)throw new Error('REFERENCE_IMAGE_TOO_LARGE');
  return 'data:image/jpeg;base64,'+image.toString('base64');
}
