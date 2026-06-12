import { authFetch } from '@/lib/authFetch';

export const VERCEL_FUNCTION_BODY_LIMIT_BYTES = 4.5 * 1024 * 1024;
export const DIRECT_VIDEO_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

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

type DirectUploadPayload = {
  upload?: {
    uploadUrl?: unknown;
    key?: unknown;
    url?: unknown;
    headers?: unknown;
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

function parseHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
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

async function uploadVideoDirectly(file: File, request: RequestFn): Promise<UploadedVideoAsset> {
  const createResponse = await request('/api/uploads/video/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mime: file.type || 'video/mp4',
      size: file.size,
    }),
  });
  const createPayload = (await readJson(createResponse)) as (Record<string, unknown> & DirectUploadPayload) | null;
  if (!createResponse.ok || !createPayload?.ok) {
    throw createUploadFailure(createResponse.status, createPayload as UploadFailurePayload, 'Upload failed');
  }

  const upload = createPayload.upload;
  if (!upload || typeof upload !== 'object') {
    throw new Error('Upload failed');
  }
  const uploadUrl = typeof upload?.uploadUrl === 'string' ? upload.uploadUrl : '';
  const key = typeof upload?.key === 'string' ? upload.key : '';
  if (!uploadUrl || !key) {
    throw new Error('Upload failed');
  }

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: parseHeaders(upload.headers),
    body: file,
  });
  if (!putResponse.ok) {
    throw new Error('The video upload to storage failed. Please retry in a moment.');
  }

  const completeResponse = await request('/api/uploads/video/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      fileName: file.name,
      mime: file.type || 'video/mp4',
      size: file.size,
    }),
  });
  const completePayload = await readJson(completeResponse);
  const asset = readAssetPayload(completePayload);
  if (!completeResponse.ok || !completePayload?.ok || !asset) {
    throw createUploadFailure(completeResponse.status, completePayload, 'Upload failed');
  }
  return asset;
}

export function shouldUseDirectVideoUpload(file: { size: number }): boolean {
  return Number.isFinite(file.size) && file.size > DIRECT_VIDEO_UPLOAD_THRESHOLD_BYTES;
}

export async function uploadVideoFile(
  file: File,
  options: { request?: RequestFn } = {}
): Promise<UploadedVideoAsset> {
  const request = options.request ?? authFetch;
  return shouldUseDirectVideoUpload(file)
    ? uploadVideoDirectly(file, request)
    : uploadVideoThroughApi(file, request);
}
