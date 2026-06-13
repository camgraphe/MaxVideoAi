import type { GeneratedImage } from '@/types/image-generation';

export type NormalizedLumaAgentsImageStatus = 'queued' | 'running' | 'completed' | 'failed';

export type NormalizedLumaAgentsImageGeneration = {
  providerJobId: string;
  status: NormalizedLumaAgentsImageStatus;
  rawStatus: string | null;
  images: GeneratedImage[];
  message: string | null;
  raw: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUrlLike(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeImageUrl(value: string): boolean {
  return /\.(?:png|jpe?g|webp|gif|avif)(?:[?#].*)?$/i.test(value.trim()) || isUrlLike(value);
}

function firstUrlLike(value: unknown): string | null {
  const stringValue = cleanString(value);
  if (stringValue && isUrlLike(stringValue)) return stringValue;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstUrlLike(entry);
      if (found) return found;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ['url', 'image_url', 'imageUrl', 'download_url', 'downloadUrl']) {
    const found = firstUrlLike(record[key]);
    if (found) return found;
  }
  return null;
}

function mimeTypeFromOutput(record: Record<string, unknown> | null): string | null {
  return (
    cleanString(record?.content_type) ??
    cleanString(record?.contentType) ??
    cleanString(record?.mime_type) ??
    cleanString(record?.mimeType) ??
    cleanString(record?.mimetype) ??
    cleanString(record?.mime)
  );
}

function toImage(value: unknown, requireImageType: boolean): GeneratedImage | null {
  const record = asRecord(value);
  const type = cleanString(record?.type)?.toLowerCase();
  const url = firstUrlLike(value);
  if (!url || (requireImageType && type !== 'image')) return null;
  if (type && type !== 'image') return null;
  if (!type && !looksLikeImageUrl(url)) return null;
  return {
    url,
    width: typeof record?.width === 'number' ? record.width : null,
    height: typeof record?.height === 'number' ? record.height : null,
    mimeType: mimeTypeFromOutput(record),
  };
}

function extractImageOutputs(raw: unknown): GeneratedImage[] {
  const record = asRecord(raw);
  const output = record?.output;
  const outputs = Array.isArray(output) ? output : output === undefined || output === null ? [] : [output];
  const typedImages = outputs
    .map((entry) => toImage(entry, true))
    .filter((entry): entry is GeneratedImage => Boolean(entry));
  if (typedImages.length) return typedImages;

  const urlLikeImages = outputs
    .map((entry) => toImage(entry, false))
    .filter((entry): entry is GeneratedImage => Boolean(entry));
  if (urlLikeImages.length) return urlLikeImages;

  const image = toImage(record?.image ?? record?.images ?? raw, false);
  return image ? [image] : [];
}

function normalizeStatus(rawStatus: string | null): NormalizedLumaAgentsImageStatus {
  const normalized = rawStatus?.toLowerCase() ?? '';
  if (normalized === 'completed' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  if (normalized === 'processing' || normalized === 'running' || normalized === 'dreaming') return 'running';
  return 'queued';
}

function extractFailureMessage(raw: unknown): string | null {
  const record = asRecord(raw);
  const detail = record?.detail;
  const detailRecord = asRecord(detail);
  return (
    cleanString(record?.failure_reason) ??
    cleanString(record?.failure_code) ??
    cleanString(detail) ??
    cleanString(detailRecord?.message) ??
    cleanString(record?.message)
  );
}

export function normalizeLumaAgentsImageGeneration(
  raw: unknown,
  fallbackGenerationId?: string | null
): NormalizedLumaAgentsImageGeneration {
  const record = asRecord(raw);
  const providerJobId = cleanString(record?.id) ?? cleanString(record?.generation_id) ?? fallbackGenerationId ?? '';
  const rawStatus = cleanString(record?.state) ?? cleanString(record?.status);
  const status = normalizeStatus(rawStatus);
  return {
    providerJobId,
    status,
    rawStatus,
    images: extractImageOutputs(raw),
    message: status === 'failed' ? extractFailureMessage(raw) : null,
    raw,
  };
}

export async function parseLumaAgentsImageJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}
