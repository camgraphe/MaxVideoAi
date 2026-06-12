import { authFetch } from '@/lib/authFetch';

export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
export const CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;
export const DIRECT_VIDEO_UPLOAD_THRESHOLD_BYTES = CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES;
export const CHUNKED_VIDEO_UPLOAD_CHUNK_BYTES = 3_670_016;

export type UploadedVideoAsset = {
  id: string;
  url: string;
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

type RequestFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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

function createUploadFailure(status: number, payload: UploadFailurePayload, fallback: string): UploadFailure {
  const code = typeof payload?.error === 'string' ? payload.error : undefined;
  const maxMB = typeof payload?.maxMB === 'number' && Number.isFinite(payload.maxMB) ? payload.maxMB : undefined;
  const error = new Error(code ?? fallback) as UploadFailure;
  error.code = code;
  error.maxMB = maxMB;
  error.status = status;
  return error;
}

function readAssetPayload(payload: unknown): UploadedVideoAsset | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const asset = (payload as { asset?: unknown }).asset;
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) return null;
  const url = (asset as { url?: unknown }).url;
  const id = (asset as { id?: unknown }).id;
  if (typeof url !== 'string' || !url) return null;
  return {
    id: typeof id === 'string' && id ? id : `video_${Date.now().toString(36)}`,
    url,
    width: typeof (asset as { width?: unknown }).width === 'number' ? (asset as { width: number }).width : null,
    height: typeof (asset as { height?: unknown }).height === 'number' ? (asset as { height: number }).height : null,
    size: typeof (asset as { size?: unknown }).size === 'number' ? (asset as { size: number }).size : null,
    mime: typeof (asset as { mime?: unknown }).mime === 'string' ? (asset as { mime: string }).mime : null,
    name: typeof (asset as { name?: unknown }).name === 'string' ? (asset as { name: string }).name : null,
    thumbUrl: typeof (asset as { thumbUrl?: unknown }).thumbUrl === 'string' ? (asset as { thumbUrl: string }).thumbUrl : null,
  };
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

async function uploadVideoThroughApi(file: File, request: RequestFn): Promise<UploadedVideoAsset> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  const response = await request('/api/uploads/video', {
    method: 'POST',
    body: formData,
  });
  const payload = await readJson(response);
  const asset = readAssetPayload(payload);
  if (!response.ok || !payload?.ok || !asset) {
    throw createUploadFailure(response.status, payload, 'Upload failed');
  }
  return asset;
}

async function uploadVideoInChunks(file: File, request: RequestFn): Promise<UploadedVideoAsset> {
  let uploadId = '';
  let key = '';
  const parts: Array<{ partNumber: number; etag: string; key: string; size: number }> = [];

  try {
    const startResponse = await request('/api/uploads/video/multipart/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        mime: file.type || 'video/mp4',
        size: file.size,
      }),
    });
    const startPayload = (await readJson(startResponse)) as (Record<string, unknown> & ChunkedUploadPayload) | null;
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
    const chunkSize = responseChunkSize > 0 ? responseChunkSize : CHUNKED_VIDEO_UPLOAD_CHUNK_BYTES;
    if (!uploadId || !key) {
      throw new Error('Upload failed');
    }

    let partNumber = 1;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const chunk = file.slice(offset, Math.min(offset + chunkSize, file.size), file.type || 'application/octet-stream');
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('key', key);
      formData.append('partNumber', String(partNumber));
      formData.append('chunk', chunk, file.name);

      const partResponse = await request('/api/uploads/video/multipart/part', {
        method: 'POST',
        body: formData,
      });
      const partPayload = (await readJson(partResponse)) as (Record<string, unknown> & ChunkedPartPayload) | null;
      if (!partResponse.ok || !partPayload?.ok) {
        throw createUploadFailure(partResponse.status, partPayload as UploadFailurePayload, 'Upload failed');
      }

      const part = partPayload.part;
      const returnedPartNumber = typeof part?.partNumber === 'number' ? part.partNumber : partNumber;
      const etag = typeof part?.etag === 'string' && part.etag ? part.etag : '';
      const partKey = typeof part?.key === 'string' && part.key ? part.key : etag;
      const size = typeof part?.size === 'number' && Number.isFinite(part.size) ? part.size : chunk.size;
      if (!returnedPartNumber || !etag || !partKey || size <= 0) {
        throw new Error('Upload failed');
      }

      parts.push({
        partNumber: returnedPartNumber,
        etag,
        key: partKey,
        size,
      });
      partNumber += 1;
    }

    const completeResponse = await request('/api/uploads/video/multipart/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        key,
        fileName: file.name,
        mime: file.type || 'video/mp4',
        size: file.size,
        parts,
      }),
    });
    const completePayload = await readJson(completeResponse);
    const asset = readAssetPayload(completePayload);
    if (!completeResponse.ok || !completePayload?.ok || !asset) {
      throw createUploadFailure(completeResponse.status, completePayload, 'Upload failed');
    }
    return asset;
  } catch (error) {
    if (uploadId && parts.length > 0) {
      request('/api/uploads/video/multipart/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, key, parts }),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function uploadLargeVideoFile(file: File, request: RequestFn): Promise<UploadedVideoAsset> {
  return uploadVideoInChunks(file, request);
}

export function shouldUseChunkedVideoUpload(file: { size: number }): boolean {
  return Number.isFinite(file.size) && file.size > CHUNKED_VIDEO_UPLOAD_THRESHOLD_BYTES;
}

export function shouldUseDirectVideoUpload(file: { size: number }): boolean {
  return shouldUseChunkedVideoUpload(file);
}

export async function uploadVideoFile(
  file: File,
  options: { request?: RequestFn } = {}
): Promise<UploadedVideoAsset> {
  const request = options.request ?? authFetch;
  return shouldUseChunkedVideoUpload(file)
    ? uploadLargeVideoFile(file, request)
    : uploadVideoThroughApi(file, request);
}
