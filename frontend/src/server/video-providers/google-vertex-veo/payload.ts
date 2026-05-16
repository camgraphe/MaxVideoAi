import type { GeneratePayload } from '@/lib/fal';
import type { Mode } from '@/types/engines';
import { GoogleVertexVeoError } from './errors';
import { isGoogleVertexVeoSupportedImageMime, resolveGoogleVertexVeoModelRoute } from './model-map';

type GoogleImage = {
  mimeType: string;
  bytesBase64Encoded?: string;
  gcsUri?: string;
};

export type GoogleVertexVeoPredictRequest = {
  providerModel: string;
  body: {
    instances: Array<Record<string, unknown>>;
    parameters: Record<string, unknown>;
  };
};

type BuildGoogleVertexVeoPayloadParams = {
  engineId: string;
  mode: Mode;
  prompt: string;
  negativePrompt?: string | null;
  durationSec: number;
  aspectRatio: string | null;
  audioEnabled: boolean | undefined;
  falPayload: GeneratePayload;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const CAMERA_CONTROL_VALUES = new Set([
  'fixed',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'truck_left',
  'truck_right',
  'pedestal_up',
  'pedestal_down',
  'push_in',
  'pull_out',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return undefined;
}

function normalizeStringOption(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

function imageMimeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function imageBytesFromDataUrl(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:[^,]+,(.+)$/i);
  if (!match) return null;
  const isBase64 = /^data:[^,]+;base64,/i.test(dataUrl);
  return Buffer.from(match[1], isBase64 ? 'base64' : 'utf8');
}

function inferMimeFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
    if (pathname.endsWith('.png')) return 'image/png';
    if (pathname.endsWith('.webp')) return 'image/webp';
    if (pathname.endsWith('.gif')) return 'image/gif';
    if (pathname.endsWith('.avif')) return 'image/avif';
  } catch {
    return null;
  }
  return null;
}

async function fetchImageAsGoogleImage(url: string): Promise<GoogleImage> {
  if (url.startsWith('gs://')) {
    const inferred = inferMimeFromUrl(url) ?? 'image/png';
    if (!isGoogleVertexVeoSupportedImageMime(inferred)) {
      throw new GoogleVertexVeoError('Google Vertex Veo only supports JPEG or PNG image inputs.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { mimeType: inferred },
      });
    }
    return { gcsUri: url, mimeType: inferred };
  }

  if (url.startsWith('data:')) {
    const mimeType = imageMimeFromDataUrl(url);
    const data = imageBytesFromDataUrl(url);
    if (!mimeType || !data?.length) {
      throw new GoogleVertexVeoError('Invalid image data URL for Google Vertex Veo.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_IMAGE',
        errorClass: 'invalid_request',
      });
    }
    if (!isGoogleVertexVeoSupportedImageMime(mimeType)) {
      throw new GoogleVertexVeoError('Google Vertex Veo only supports JPEG or PNG image inputs.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { mimeType },
      });
    }
    return { mimeType, bytesBase64Encoded: data.toString('base64') };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) {
      throw new GoogleVertexVeoError('Failed to fetch image input for Google Vertex Veo.', {
        status: response.status,
        code: 'GOOGLE_VERTEX_VEO_IMAGE_FETCH_FAILED',
        errorClass: response.status >= 500 ? 'provider_unavailable' : 'invalid_request',
        raw: { imageHost: safeHost(url) },
      });
    }
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
    const mimeType = contentType || inferMimeFromUrl(url) || 'image/png';
    if (!isGoogleVertexVeoSupportedImageMime(mimeType)) {
      throw new GoogleVertexVeoError('Google Vertex Veo only supports JPEG or PNG image inputs.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { mimeType },
      });
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      throw new GoogleVertexVeoError('Google Vertex Veo image input is too large.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { contentLength },
      });
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length || data.length > MAX_IMAGE_BYTES) {
      throw new GoogleVertexVeoError('Google Vertex Veo image input is empty or too large.', {
        code: 'GOOGLE_VERTEX_VEO_UNSUPPORTED_PARAMS',
        errorClass: 'unsupported_params',
        raw: { byteLength: data.length },
      });
    }
    return { mimeType, bytesBase64Encoded: data.toString('base64') };
  } catch (error) {
    if (error instanceof GoogleVertexVeoError) throw error;
    const isAbort = error instanceof Error && error.name === 'AbortError';
    throw new GoogleVertexVeoError(isAbort ? 'Timed out fetching Google Vertex Veo image input.' : 'Image fetch failed.', {
      code: isAbort ? 'GOOGLE_VERTEX_VEO_TIMEOUT' : 'GOOGLE_VERTEX_VEO_IMAGE_FETCH_FAILED',
      errorClass: isAbort ? 'timeout' : 'provider_unavailable',
      raw: { imageHost: safeHost(url) },
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function getCameraControl(extraInputValues: Record<string, unknown>): string | null {
  const raw = normalizeStringOption(extraInputValues.camera_control ?? extraInputValues.cameraControl);
  if (!raw) return null;
  if (CAMERA_CONTROL_VALUES.has(raw)) return raw;
  const parsed = (() => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  })();
  const record = asRecord(parsed);
  const type = normalizeStringOption(record?.type);
  if (type && CAMERA_CONTROL_VALUES.has(type)) return type;
  return null;
}

function applyOptionalParameters(params: {
  parameters: Record<string, unknown>;
  falPayload: GeneratePayload;
  negativePrompt?: string | null;
}) {
  const extra = params.falPayload.extraInputValues ?? {};
  const seed = typeof params.falPayload.seed === 'number' && Number.isFinite(params.falPayload.seed)
    ? Math.trunc(params.falPayload.seed)
    : null;
  if (seed !== null) {
    params.parameters.seed = seed;
  }
  if (params.negativePrompt?.trim()) {
    params.parameters.negativePrompt = params.negativePrompt.trim();
  }
  const enhancePrompt = normalizeBoolean(extra.enhance_prompt ?? extra.enhancePrompt);
  if (typeof enhancePrompt === 'boolean') {
    params.parameters.enhancePrompt = enhancePrompt;
  }
  const personGeneration = normalizeStringOption(extra.person_generation ?? extra.personGeneration);
  if (personGeneration) {
    params.parameters.personGeneration = personGeneration;
  }
  const compressionQuality = normalizeStringOption(extra.compression_quality ?? extra.compressionQuality);
  if (compressionQuality) {
    params.parameters.compressionQuality = compressionQuality;
  }
  const storageUri = (process.env.GOOGLE_VERTEX_VEO_OUTPUT_GCS_URI ?? '').trim();
  if (storageUri) {
    params.parameters.storageUri = storageUri;
  }
}

export async function buildGoogleVertexVeoPayload(
  params: BuildGoogleVertexVeoPayloadParams
): Promise<GoogleVertexVeoPredictRequest> {
  const route = resolveGoogleVertexVeoModelRoute(params.engineId);
  const instance: Record<string, unknown> = {};
  if (params.prompt.trim()) {
    instance.prompt = params.prompt;
  }

  if (params.mode === 'i2v') {
    if (!params.falPayload.imageUrl) {
      throw new GoogleVertexVeoError('Google Vertex Veo image-to-video requires an image.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_REQUEST',
        errorClass: 'invalid_request',
      });
    }
    instance.image = await fetchImageAsGoogleImage(params.falPayload.imageUrl);
  }

  if (params.mode === 'fl2v') {
    if (!params.falPayload.imageUrl || !params.falPayload.endImageUrl) {
      throw new GoogleVertexVeoError('Google Vertex Veo first/last-frame mode requires both frames.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_REQUEST',
        errorClass: 'invalid_request',
      });
    }
    instance.image = await fetchImageAsGoogleImage(params.falPayload.imageUrl);
    instance.lastFrame = await fetchImageAsGoogleImage(params.falPayload.endImageUrl);
  }

  if (params.mode === 'ref2v') {
    const references = params.falPayload.referenceImages ?? [];
    if (!references.length) {
      throw new GoogleVertexVeoError('Google Vertex Veo reference mode requires reference images.', {
        code: 'GOOGLE_VERTEX_VEO_INVALID_REQUEST',
        errorClass: 'invalid_request',
      });
    }
    instance.referenceImages = await Promise.all(
      references.slice(0, 3).map(async (url) => ({
        image: await fetchImageAsGoogleImage(url),
        referenceType: 'asset',
      }))
    );
  }

  const cameraControl = getCameraControl(params.falPayload.extraInputValues ?? {});
  if (cameraControl) {
    instance.cameraControl = cameraControl;
  }

  const resolution = params.falPayload.resolution === '4k' ? '4k' : params.falPayload.resolution ?? '720p';
  const audioEnabled = params.audioEnabled ?? route.defaultAudioEnabled;
  const parameters: Record<string, unknown> = {
    sampleCount: 1,
    fps: 24,
    durationSeconds: params.durationSec,
    aspectRatio: params.aspectRatio ?? '16:9',
    resolution,
    generateAudio: audioEnabled,
  };
  applyOptionalParameters({
    parameters,
    falPayload: params.falPayload,
    negativePrompt: params.negativePrompt,
  });

  return {
    providerModel: route.providerModel,
    body: {
      instances: [instance],
      parameters,
    },
  };
}
