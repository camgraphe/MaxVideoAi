import { getReferenceUploadPolicy } from './create-reference-upload-link';
import { createReferenceFileDownloader as createDownloader, type DownloadMediaPolicy } from '@/server/bounded-media-download';
import { publicMediaTransport, type ReferenceFileDownloaderDependencies } from '@/server/public-media-transport';
export { createPinnedLookup, REFERENCE_DOWNLOAD_TIMEOUT_MS } from '@/server/public-media-transport';
export type { ReferenceFileDownloaderDependencies, ReferenceHttpsResponse, ResolvedReferenceAddress } from '@/server/public-media-transport';
export { createBoundedMediaDownloader } from '@/server/bounded-media-download';
export function createReferenceFileDownloader(dependencies:ReferenceFileDownloaderDependencies,policy?:{accepted:readonly string[];maxBytes:number}) {
  const defaults:DownloadMediaPolicy={accepted:['image','video','audio'].flatMap(kind=>getReferenceUploadPolicy(kind as 'image'|'video'|'audio').accepted),
    maxBytes:mime=>getReferenceUploadPolicy(mime.startsWith('image/')?'image':mime.startsWith('video/')?'video':'audio').maxBytes};
  return createDownloader(dependencies,policy??defaults);
}
export const downloadReferenceFile=createReferenceFileDownloader(publicMediaTransport);
