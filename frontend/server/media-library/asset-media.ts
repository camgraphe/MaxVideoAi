import { uploadFileBuffer, uploadImageToStorage } from '@/server/storage';
import { createUploadVideoThumbnail } from '@/server/upload-thumbnails';
import { inferMimeFromUrl, type MediaKind } from '../media-library-records';

export async function copyRemoteMedia(params: {
  userId: string;
  url: string;
  kind: MediaKind;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<{ url: string; thumbUrl: string | null; mimeType: string | null; width: number | null; height: number | null; sizeBytes: number | null }> {
  const parsed = new URL(params.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(parsed.toString(), { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`FETCH_FAILED:${response.status}`);
  }
  const mimeType = response.headers.get('content-type') ?? params.mimeType ?? inferMimeFromUrl(params.url, params.kind);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('EMPTY_MEDIA');
  if (params.kind === 'image') {
    const upload = await uploadImageToStorage({
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
  const upload = await uploadFileBuffer({
    data: buffer,
    mime: mimeType,
    userId: params.userId,
    prefix: 'media-assets',
    fileName: params.fileName,
  });
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
  };
}

export async function createRemoteVideoAssetThumbnail(params: {
  userId: string;
  url: string;
  fileName?: string | null;
}): Promise<string | null> {
  const parsed = new URL(params.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(parsed.toString(), { signal: controller.signal });
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
