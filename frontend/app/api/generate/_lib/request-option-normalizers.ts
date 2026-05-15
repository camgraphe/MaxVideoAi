import {
  normalizeMaxVideoProviderElements,
  type MaxVideoProviderElement,
} from '@/lib/video-provider-elements';

export type MultiPromptEntry = {
  prompt: string;
  duration: number;
};

export type GenerationElement = MaxVideoProviderElement;

export function normalizeMultiPrompt(value: unknown): MultiPromptEntry[] | null {
  if (!Array.isArray(value)) return null;
  const entries = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const promptValue = typeof record.prompt === 'string' ? record.prompt.trim() : '';
      const durationValue =
        typeof record.duration === 'number'
          ? Math.round(record.duration)
          : typeof record.duration === 'string'
            ? Math.round(Number(record.duration.replace(/[^\d.]/g, '')))
            : 0;
      if (!promptValue) return null;
      return { prompt: promptValue, duration: durationValue };
    })
    .filter((entry: MultiPromptEntry | null): entry is MultiPromptEntry => Boolean(entry));

  return entries.length ? entries : null;
}

export function normalizeSeed(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim().length && Number.isFinite(Number(value))) {
    return Math.trunc(Number(value));
  }
  return null;
}

export function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : null;
  return values
    ? values.map((entry: unknown) => (typeof entry === 'string' ? entry.trim() : '')).filter(isPresentString)
    : [];
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length) {
      return value.trim();
    }
  }
  return undefined;
}

function pickStringArray(record: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = record[key];
    const normalized = normalizeStringArray(value);
    if (normalized.length) {
      return normalized;
    }
  }
  return undefined;
}

export function normalizeGenerationElements(value: unknown): GenerationElement[] | null {
  if (!Array.isArray(value)) return null;
  const elements = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const element: GenerationElement = {
        id: pickString(record, 'id'),
        frontalImageUrl: pickString(record, 'frontalImageUrl', 'frontal_image_url'),
        frontalAssetId: pickString(record, 'frontalAssetId', 'frontal_asset_id'),
        referenceImageUrls: pickStringArray(record, 'referenceImageUrls', 'reference_image_urls'),
        referenceAssetIds: pickStringArray(record, 'referenceAssetIds', 'reference_asset_ids'),
        videoUrl: pickString(record, 'videoUrl', 'video_url'),
        videoAssetId: pickString(record, 'videoAssetId', 'video_asset_id'),
      };
      return element;
    })
    .filter((entry: GenerationElement | null): entry is GenerationElement => Boolean(entry));
  const normalized = normalizeMaxVideoProviderElements(elements);

  return normalized.length ? normalized : null;
}

export function trimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function isPresentString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}
