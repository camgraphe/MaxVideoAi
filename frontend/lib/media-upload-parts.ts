import type { MediaReadAccess } from '@/lib/media-read-access';
import { mediaReadAccessFields } from './library-media-access';
import { canonicalMediaAssetFields, readMediaFacts, type MediaFacts } from './media-identity';
import type { ToolAssetRef } from '@/lib/toolbox/contract';

export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
export const CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;
export const DIRECT_VIDEO_UPLOAD_THRESHOLD_BYTES = CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES;
export const CHUNKED_VIDEO_UPLOAD_CHUNK_BYTES = 3_670_016;

export type UploadedVideoAsset = MediaReadAccess & {
  assetId?: string;
  legacyAssetId?: string;
  ref?: ToolAssetRef;
  mediaFacts?: MediaFacts;
  durationSec?: number;
  id: string;
  url: string;
  /** Temporary read access for playback; url remains the stored original identity. */
  previewUrl?: string;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  name?: string | null;
  thumbUrl?: string | null;
};

type UploadFailurePayload = { error?: unknown; maxMB?: unknown } | null;

type UploadFailure = Error & {
  code?: string;
  maxMB?: number;
  status?: number;
};

export type RequestFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ChunkedUploadPayload = {
  upload?: {
    uploadId?: unknown;
    key?: unknown;
    url?: unknown;
    chunkSizeBytes?: unknown;
  };
};

type ChunkedPartPayload = {
  part?: {
    partNumber?: unknown;
    etag?: unknown;
    key?: unknown;
    size?: unknown;
  };
};

export function createUploadFailure(
  status: number,
  payload: UploadFailurePayload,
  fallback: string,
): UploadFailure {
  const code = typeof payload?.error === 'string' ? payload.error : undefined;
  const maxMB =
    typeof payload?.maxMB === 'number' && Number.isFinite(payload.maxMB) ? payload.maxMB : undefined;
  const error = new Error(code ?? fallback) as UploadFailure;
  error.code = code;
  error.maxMB = maxMB;
  error.status = status;
  return error;
}

export function readAssetPayload(
  payload: unknown,
  kind: 'audio' | 'video' = 'video',
): UploadedVideoAsset | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const asset = (payload as { asset?: unknown }).asset;
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return null;
  const url = (asset as { url?: unknown }).url;
  const id = (asset as { id?: unknown }).id;
  if (typeof url !== 'string' || !url) return null;
  return {
    ...mediaReadAccessFields(asset as MediaReadAccess),
    ...canonicalMediaAssetFields((asset as { assetId?: unknown }).assetId, kind),
    mediaFacts: readMediaFacts((asset as { mediaFacts?: unknown }).mediaFacts),
    durationSec: readMediaFacts((asset as { mediaFacts?: unknown }).mediaFacts)?.durationSec,
    legacyAssetId:
      typeof (asset as { legacyAssetId?: unknown }).legacyAssetId === 'string'
        ? (asset as { legacyAssetId: string }).legacyAssetId
        : undefined,
    id: typeof id === 'string' && id ? id : `video_${Date.now().toString(36)}`,
    url,
    width:
      typeof (asset as { width?: unknown }).width === 'number' ? (asset as { width: number }).width : null,
    height:
      typeof (asset as { height?: unknown }).height === 'number'
        ? (asset as { height: number }).height
        : null,
    size: typeof (asset as { size?: unknown }).size === 'number' ? (asset as { size: number }).size : null,
    mime: typeof (asset as { mime?: unknown }).mime === 'string' ? (asset as { mime: string }).mime : null,
    name: typeof (asset as { name?: unknown }).name === 'string' ? (asset as { name: string }).name : null,
    thumbUrl:
      typeof (asset as { thumbUrl?: unknown }).thumbUrl === 'string'
        ? (asset as { thumbUrl: string }).thumbUrl
        : null,
  };
}

export async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

type MediaUploadPart = { appendTo(form: FormData): void; release?(): void };
export type MediaPartSource = {
  name: string;
  type: string;
  size: number;
  part(start: number, end: number): MediaUploadPart | Promise<MediaUploadPart>;
};

export function browserMediaParts(file: File): MediaPartSource {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    part(start, end) {
      const blob = file.slice(start, end, file.type || 'application/octet-stream');
      return { appendTo: (form) => form.append('chunk', blob, file.name) };
    },
  };
}
export async function uploadMediaInChunks(
  file: MediaPartSource,
  request: RequestFn,
  abortRequest: RequestFn,
  kind: 'audio' | 'video',
): Promise<UploadedVideoAsset> {
  let uploadId = '';
  let key = '';
  const parts: Array<{ partNumber: number; etag: string; key: string; size: number }> = [];

  try {
    const startResponse = await request('/api/uploads/video/multipart/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(kind === 'audio' ? { kind } : {}),
        fileName: file.name,
        mime:
          file.type ||
          (kind === 'audio' ? (/\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mpeg') : 'video/mp4'),
        size: file.size,
      }),
    });
    const startPayload = (await readJson(startResponse)) as
      | (Record<string, unknown> & ChunkedUploadPayload)
      | null;
    if (!startResponse.ok || !startPayload?.ok) {
      throw createUploadFailure(startResponse.status, startPayload as UploadFailurePayload, 'Upload failed');
    }

    const upload = startPayload.upload;
    uploadId = typeof upload?.uploadId === 'string' ? upload.uploadId : '';
    key = typeof upload?.key === 'string' ? upload.key : '';
    const responseChunkSize =
      typeof upload?.chunkSizeBytes === 'number' && Number.isFinite(upload.chunkSizeBytes)
        ? Math.floor(upload.chunkSizeBytes)
        : CHUNKED_VIDEO_UPLOAD_CHUNK_BYTES;
    const chunkSize = Math.min(
      responseChunkSize > 0 ? responseChunkSize : CHUNKED_VIDEO_UPLOAD_CHUNK_BYTES,
      CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES,
    );
    if (!uploadId || !key) {
      throw new Error('Upload failed');
    }

    let partNumber = 1;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, file.size);
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('key', key);
      formData.append('partNumber', String(partNumber));
      const chunk = await file.part(offset, end);
      let partResponse: Response;
      try {
        chunk.appendTo(formData);
        partResponse = await request('/api/uploads/video/multipart/part', { method: 'POST', body: formData });
      } finally {
        chunk.release?.();
      }
      const partPayload = (await readJson(partResponse)) as
        | (Record<string, unknown> & ChunkedPartPayload)
        | null;
      if (!partResponse.ok || !partPayload?.ok) {
        throw createUploadFailure(partResponse.status, partPayload as UploadFailurePayload, 'Upload failed');
      }

      const part = partPayload.part;
      const returnedPartNumber = typeof part?.partNumber === 'number' ? part.partNumber : partNumber;
      const etag = typeof part?.etag === 'string' && part.etag ? part.etag : '';
      const partKey = typeof part?.key === 'string' && part.key ? part.key : etag;
      const size = typeof part?.size === 'number' && Number.isFinite(part.size) ? part.size : end - offset;
      if (!etag || !partKey || !Number.isSafeInteger(size) || size <= 0) {
        throw new Error('Upload failed');
      }

      parts.push({
        partNumber,
        etag,
        key: partKey,
        size,
      });
      // Retain the acknowledged key for cleanup even when the part cannot be completed.
      if (returnedPartNumber !== partNumber || size !== end - offset)
        throw createUploadFailure(400, { error: 'SIZE_MISMATCH' }, 'Incomplete transfer');
      partNumber += 1;
    }

    const completeResponse = await request('/api/uploads/video/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        key,
        ...(kind === 'audio' ? { kind } : {}),
        fileName: file.name,
        mime:
          file.type ||
          (kind === 'audio' ? (/\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mpeg') : 'video/mp4'),
        size: file.size,
        parts,
      }),
    });
    const completePayload = await readJson(completeResponse);
    const asset = readAssetPayload(completePayload, kind);
    if (!completeResponse.ok || !completePayload?.ok || !asset) {
      throw createUploadFailure(completeResponse.status, completePayload, 'Upload failed');
    }
    return asset;
  } catch (error) {
    if (uploadId && parts.length > 0) {
      abortRequest('/api/uploads/video/multipart/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key, parts }),
      }).catch(() => undefined);
    }
    throw error;
  }
}
