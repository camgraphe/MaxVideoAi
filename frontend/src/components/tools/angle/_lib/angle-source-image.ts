import { parseImageDisplay } from '@/lib/image-display';
import { isSignedMediaUrl } from '@/lib/media';
import { readMediaFacts } from '@/lib/media-identity';
import type { UploadedImage } from './angle-workspace-types';

/** Account draft identity only. Live grants and local blob URLs never enter storage. */
export function serializeAngleSourceImage(image: UploadedImage): UploadedImage | null {
  if (isSignedMediaUrl(image.url) || image.url.startsWith('blob:')) return null;
  const durablePreview = (url?: string | null) => typeof url === 'string' && url.trim() && !url.startsWith('blob:') && !isSignedMediaUrl(url) ? url : undefined;
  const display = parseImageDisplay(image.imageDisplay, image.url, image.previewUrl);
  return {
    id: image.id, assetId: image.assetId, ref: image.ref, libraryRef: image.libraryRef,
    sourceRevision: image.sourceRevision, jobId: image.jobId, sourceOutputId: image.sourceOutputId,
    url: image.url, kind: image.kind,
    name: typeof image.name === 'string' ? image.name : null,
    source: ['upload', 'library', 'paste', 'example'].includes(image.source ?? '') ? image.source : undefined,
    width: typeof image.width === 'number' ? image.width : null,
    height: typeof image.height === 'number' ? image.height : null,
    size: image.size, mime: image.mime,
    mediaFacts: readMediaFacts(image.mediaFacts),
    thumbUrl: durablePreview(image.thumbUrl), previewUrl: display?.url ?? durablePreview(image.previewUrl),
    imageDisplay: display,
    readAccessOwnerId: image.readAccessOwnerId, readAccessRef: image.readAccessRef,
    readAccessRevision: image.readAccessRevision,
  };
}
