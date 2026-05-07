import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { dispatchAnalyticsEvent } from '@/lib/analytics-client';
import { authFetch } from '@/lib/authFetch';
import { prepareImageFileForUpload } from '@/lib/client-image-upload';
import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';
import type { AngleCopy } from './angle-workspace-copy';
import type { AnglePreviewImage, PersistedAngleToolState, UploadedImage } from './angle-workspace-types';

export const ENGINES = listAngleToolEngines();
export const DEFAULT_ENGINE_ID = ENGINES[0]?.id ?? 'flux-multiple-angles';
export const DEFAULT_UPLOAD_LIMIT_MB = Number.isFinite(Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25'))
  ? Number(process.env.NEXT_PUBLIC_ASSET_MAX_IMAGE_MB ?? '25')
  : 25;
export const ANGLE_GUEST_EXAMPLE_SOURCE_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d49ec543-8b71-42bb-aa7e-ce5289e28187.webp';
export const ANGLE_GUEST_EXAMPLE_OUTPUT_URL =
  'https://media.maxvideoai.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/44d08767-2bba-4ece-9e37-00991db207af.webp';
export const ANGLE_TOOL_STORAGE_KEY = 'maxvideoai.tools.angle.v1';

export function getAngleBillingProductKey(engineId: AngleToolEngineId, generateBestAngles: boolean): string {
  const family = engineId === 'qwen-multiple-angles' ? 'qwen' : 'flux';
  return `angle-${family}-${generateBestAngles ? 'multi' : 'single'}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRotation(value: number): number {
  return ((value % 360) + 360) % 360;
}

export function snap(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(step < 1 ? 1 : 0));
}

export function sanitizeParams(params: AngleToolNumericParams): AngleToolNumericParams {
  return {
    rotation: normalizeRotation(snap(params.rotation, 1)),
    tilt: clamp(snap(params.tilt, 1), -30, 30),
    zoom: clamp(snap(params.zoom, 0.1), 0, 10),
  };
}

export function emitClientMetric(event: string, payload?: Record<string, unknown>) {
  dispatchAnalyticsEvent(event, payload);
}

export function isAuthRequiredError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { status?: number; code?: string };
  return record.status === 401 || record.code === 'auth_required' || record.code === 'UNAUTHORIZED';
}

export function formatUsdCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  return `$${value.toFixed(2)}`;
}

export function formatTemplate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => {
    return result.replaceAll(`{${key}}`, String(value));
  }, template);
}

export function cleanupSourcePreview(image: UploadedImage | null) {
  if (!image?.previewUrl?.startsWith('blob:')) return;
  try {
    URL.revokeObjectURL(image.previewUrl);
  } catch {
    // Ignore preview cleanup failures.
  }
}

export function collectAnglePreviewImages(
  renderIds?: string[] | null,
  renderThumbUrls?: string[] | null,
  fallbackUrl?: string | null
): AnglePreviewImage[] {
  const full = Array.isArray(renderIds) ? renderIds.filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
  const thumbs = Array.isArray(renderThumbUrls)
    ? renderThumbUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const count = Math.max(full.length, thumbs.length);

  if (count > 0) {
    const outputs: AnglePreviewImage[] = [];
    for (let index = 0; index < count; index += 1) {
      const url = full[index] ?? thumbs[index];
      if (!url) continue;
      outputs.push({
        url,
        thumbUrl: thumbs[index] ?? full[index] ?? null,
      });
    }
    if (outputs.length) return outputs;
  }

  if (fallbackUrl) {
    return [{ url: fallbackUrl, thumbUrl: fallbackUrl }];
  }

  return [];
}

export function parsePersistedAngleToolState(value: string): PersistedAngleToolState | null {
  try {
    const raw = JSON.parse(value) as Partial<PersistedAngleToolState> | null;
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
    const engineId =
      raw.engineId === 'flux-multiple-angles' || raw.engineId === 'qwen-multiple-angles'
        ? raw.engineId
        : null;
    if (!engineId) return null;
    const params =
      raw.params && typeof raw.params === 'object'
        ? sanitizeParams({
            rotation: Number((raw.params as AngleToolNumericParams).rotation ?? 0),
            tilt: Number((raw.params as AngleToolNumericParams).tilt ?? 0),
            zoom: Number((raw.params as AngleToolNumericParams).zoom ?? 0),
          })
        : { rotation: 8, tilt: 2, zoom: 1.2 };
    const sourceImage =
      raw.sourceImage &&
      typeof raw.sourceImage === 'object' &&
      typeof raw.sourceImage.url === 'string' &&
      raw.sourceImage.url.trim().length
        ? {
            id: typeof raw.sourceImage.id === 'string' ? raw.sourceImage.id : null,
            url: raw.sourceImage.url,
            previewUrl:
              typeof raw.sourceImage.previewUrl === 'string' && raw.sourceImage.previewUrl.trim().length
                ? raw.sourceImage.previewUrl
                : raw.sourceImage.url,
            width: typeof raw.sourceImage.width === 'number' ? raw.sourceImage.width : null,
            height: typeof raw.sourceImage.height === 'number' ? raw.sourceImage.height : null,
            name: typeof raw.sourceImage.name === 'string' ? raw.sourceImage.name : null,
            source:
              raw.sourceImage.source === 'upload' || raw.sourceImage.source === 'library' || raw.sourceImage.source === 'paste'
                ? raw.sourceImage.source
                : undefined,
          }
        : null;
    const result =
      raw.result &&
      typeof raw.result === 'object' &&
      Array.isArray(raw.result.outputs)
        ? (raw.result as AngleToolResponse)
        : null;
    const selectedOutputIndex =
      typeof raw.selectedOutputIndex === 'number' && Number.isFinite(raw.selectedOutputIndex)
        ? Math.max(0, Math.floor(raw.selectedOutputIndex))
        : 0;

    return {
      version: 1,
      engineId,
      params,
      safeMode: raw.safeMode !== false,
      generateBestAngles: raw.generateBestAngles === true,
      sourceImage,
      result,
      selectedOutputIndex,
    };
  } catch {
    return null;
  }
}

export function getUploadTooLargeMessage(copy: AngleCopy, maxMB: number): string {
  return formatTemplate(copy.uploadTooLarge, { maxMB });
}

export async function uploadImage(file: File, copy: AngleCopy): Promise<UploadedImage> {
  const preparedFile = await prepareImageFileForUpload(file, {
    maxBytes: DEFAULT_UPLOAD_LIMIT_MB * 1024 * 1024,
  });

  const formData = new FormData();
  formData.set('file', preparedFile, preparedFile.name);

  const response = await authFetch('/api/uploads/image', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        ok?: boolean;
        error?: string;
        maxMB?: number;
        asset?: {
          url: string;
          width?: number | null;
          height?: number | null;
          name?: string | null;
        };
      }
    | null;

  if (!response.ok || !payload?.ok || !payload.asset?.url) {
    if (payload?.error === 'FILE_TOO_LARGE' || response.status === 413) {
      throw new Error(getUploadTooLargeMessage(copy, payload?.maxMB ?? DEFAULT_UPLOAD_LIMIT_MB));
    }
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }

  return {
    url: payload.asset.url,
    width: payload.asset.width,
    height: payload.asset.height,
    name: payload.asset.name,
  };
}
