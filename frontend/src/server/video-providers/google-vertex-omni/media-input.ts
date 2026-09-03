import type { GeneratePayload } from '@/lib/fal';
import { uploadGoogleVertexGcsObject } from '../google-vertex-gcs';

export type GoogleVertexOmniMediaInput =
  | {
      type: 'image';
      uri: string;
      mime_type: string;
    }
  | {
      type: 'video';
      uri: string;
      mime_type: string;
    };

type UploadGoogleVertexGcsObjectFn = typeof uploadGoogleVertexGcsObject;

const MEDIA_FETCH_TIMEOUT_MS = 90_000;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

function cleanUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function extensionFromMime(mime: string, kind: 'image' | 'video'): string {
  const normalized = mime.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic') return 'heic';
  if (normalized === 'image/heif') return 'heif';
  if (normalized === 'video/webm') return 'webm';
  if (normalized === 'video/quicktime') return 'mov';
  return kind === 'video' ? 'mp4' : 'png';
}

export function inferGoogleVertexOmniMediaMime(uri: string, kind: 'image' | 'video'): string {
  const pathname = uri.split(/[?#]/, 1)[0]?.toLowerCase() ?? '';
  if (kind === 'video') {
    if (pathname.endsWith('.webm')) return 'video/webm';
    if (pathname.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.heic')) return 'image/heic';
  if (pathname.endsWith('.heif')) return 'image/heif';
  return 'image/png';
}

async function stageMediaUri(params: {
  uri: string;
  kind: 'image' | 'video';
  inputGcsPrefix: string;
  objectNamespace: string;
  accessToken: string;
  fetchFn: typeof fetch;
  uploadGoogleVertexGcsObjectFn: UploadGoogleVertexGcsObjectFn;
}): Promise<string> {
  if (params.uri.startsWith('gs://')) return params.uri;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);
  try {
    const response = await params.fetchFn(params.uri, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Google Vertex Omni input fetch failed (${response.status}).`);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (params.kind === 'image' && Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new Error('Google Vertex Omni images must not exceed 30 MB.');
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length) throw new Error('Google Vertex Omni input media is empty.');
    if (params.kind === 'image' && data.length > MAX_IMAGE_BYTES) {
      throw new Error('Google Vertex Omni images must not exceed 30 MB.');
    }
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim()
      || inferGoogleVertexOmniMediaMime(params.uri, params.kind);
    return params.uploadGoogleVertexGcsObjectFn({
      prefix: params.inputGcsPrefix,
      data,
      mime,
      extension: extensionFromMime(mime, params.kind),
      accessToken: params.accessToken,
      objectNamespace: params.objectNamespace,
      fetchFn: params.fetchFn,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function stageGoogleVertexOmniPayloadMedia(params: {
  falPayload: GeneratePayload;
  inputGcsPrefix: string;
  objectNamespace: string;
  accessToken: string;
  deps?: {
    fetchFn?: typeof fetch;
    uploadGoogleVertexGcsObjectFn?: UploadGoogleVertexGcsObjectFn;
  };
}): Promise<GeneratePayload> {
  const fetchFn = params.deps?.fetchFn ?? fetch;
  const uploadGoogleVertexGcsObjectFn =
    params.deps?.uploadGoogleVertexGcsObjectFn ?? uploadGoogleVertexGcsObject;
  const stage = (uri: string, kind: 'image' | 'video') => stageMediaUri({
    uri,
    kind,
    inputGcsPrefix: params.inputGcsPrefix,
    objectNamespace: params.objectNamespace,
    accessToken: params.accessToken,
    fetchFn,
    uploadGoogleVertexGcsObjectFn,
  });

  return {
    ...params.falPayload,
    ...(params.falPayload.imageUrl
      ? { imageUrl: await stage(params.falPayload.imageUrl, 'image') }
      : {}),
    ...(params.falPayload.referenceImages?.length
      ? { referenceImages: await Promise.all(params.falPayload.referenceImages.map((uri) => stage(uri, 'image'))) }
      : {}),
    ...(params.falPayload.videoUrl
      ? { videoUrl: await stage(params.falPayload.videoUrl, 'video') }
      : {}),
    ...(params.falPayload.endImageUrl
      ? { endImageUrl: await stage(params.falPayload.endImageUrl, 'image') }
      : {}),
  };
}

export function buildOmniSourceImageInput(falPayload: GeneratePayload): GoogleVertexOmniMediaInput | null {
  const uri = cleanUrl(falPayload.imageUrl);
  return uri ? { type: 'image', uri, mime_type: inferGoogleVertexOmniMediaMime(uri, 'image') } : null;
}

export function buildOmniEndImageInput(falPayload: GeneratePayload): GoogleVertexOmniMediaInput | null {
  const uri = cleanUrl(falPayload.endImageUrl);
  return uri ? { type: 'image', uri, mime_type: inferGoogleVertexOmniMediaMime(uri, 'image') } : null;
}

export function buildOmniReferenceImageInputs(falPayload: GeneratePayload): GoogleVertexOmniMediaInput[] {
  return (falPayload.referenceImages ?? [])
    .map(cleanUrl)
    .filter((uri): uri is string => Boolean(uri))
    .map((uri) => ({ type: 'image', uri, mime_type: inferGoogleVertexOmniMediaMime(uri, 'image') }));
}

export function buildOmniSourceVideoInput(falPayload: GeneratePayload): GoogleVertexOmniMediaInput | null {
  const uri = cleanUrl(falPayload.videoUrl);
  return uri ? { type: 'video', uri, mime_type: inferGoogleVertexOmniMediaMime(uri, 'video') } : null;
}
