import { type MediaFacts } from '@/lib/media-identity';
import { probeMediaBuffer } from '@/server/media/detect-has-audio';
import { type GeneratedVideoFacts } from '@/lib/generated-video-media-facts';
import { measureGeneratedVideoBuffer } from '@/server/media/generated-video-facts';
import { uploadFileBuffer, uploadImageToStorage } from '@/server/storage';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import { inferMimeFromUrl, type MediaKind } from '../media-library-records';

export async function copyRemoteMedia(params: {
  userId: string;
  url: string;
  kind: MediaKind;
  mimeType?: string | null;
  fileName?: string | null;
  ownedGeneratedVideo?: { mediaFacts: GeneratedVideoFacts | null };
}, dependencies: { uploadImage?: typeof uploadImageToStorage } = {}): Promise<{ mediaFacts?: GeneratedVideoFacts | MediaFacts | null; url: string; thumbUrl: string | null; mimeType: string | null; width: number | null; height: number | null; sizeBytes: number | null }> {
  const sourceUrl = await createOwnedMediaReadUrl({ url: params.url, userId: params.userId });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response: Response;
  try {
    response = await fetch(sourceUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) {
    throw new Error(`FETCH_FAILED:${response.status}`);
  }
  let mimeType = response.headers.get('content-type') ?? params.mimeType ?? inferMimeFromUrl(params.url, params.kind);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('EMPTY_MEDIA');
  if (params.kind === 'image') {
    const upload = await (dependencies.uploadImage ?? uploadImageToStorage)({
      data: buffer,
      mime: mimeType,
      userId: params.userId,
      prefix: 'media-assets',
      fileName: params.fileName,
    });
    return {
      url: upload.url,
      thumbUrl: null,
      mimeType: upload.mime,
      width: upload.width,
      height: upload.height,
      sizeBytes: upload.size,
    };
  }
  const audioProbe = params.kind === 'audio'
    ? await probeMediaBuffer(buffer, { mimeType, fileName: params.fileName }).catch(() => null) : null;
  if (audioProbe?.kind === 'audio') mimeType = audioProbe.canonicalMime;
  const upload = await uploadFileBuffer({
    data: buffer,
    mime: mimeType,
    userId: params.userId,
    prefix: 'media-assets',
    // Library labels are display text, not trusted audio filenames (for example, Voice.v2).
    fileName: params.kind === 'audio' ? undefined : params.fileName,
  });
  const mediaFacts = params.kind === 'video' && params.ownedGeneratedVideo
    ? await measureGeneratedVideoBuffer(buffer, upload.url, params.ownedGeneratedVideo.mediaFacts).catch(() => null)
    : audioProbe?.kind === 'audio' ? { source: 'probe' as const, durationSec: audioProbe.durationSec } : null;
  const thumbUrl =
    params.kind === 'video'
      ? await createUploadVideoThumbnail({
          data: buffer,
          userId: params.userId,
          fileName: params.fileName,
        })
      : null;
  return {
    url: upload.url,
    thumbUrl,
    mimeType,
    width: null,
    height: null,
    sizeBytes: buffer.length,
    mediaFacts,
  };
}

export async function createRemoteVideoAssetThumbnail(params: {
  userId: string;
  url: string;
  fileName?: string | null;
}): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const sourceUrl = await createOwnedMediaReadUrl({ url: params.url, userId: params.userId });
    const response = await fetch(sourceUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    return createUploadVideoThumbnail({
      data: buffer,
      userId: params.userId,
      fileName: params.fileName,
    });
  } catch (error) {
    console.warn('[media-library] failed to create remote video thumbnail', {
      url: params.url,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
