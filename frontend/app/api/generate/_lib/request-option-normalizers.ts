import {
  normalizeMaxVideoProviderElements,
  type MaxVideoProviderElement,
} from '@/lib/video-provider-elements';

export type MultiPromptEntry = {
  prompt: string;
  duration: number;
};

export type GenerationElement = MaxVideoProviderElement;

export function normalizeGenerationControls(body: Record<string, unknown>, engineId: string) {
  try {
    const multiPrompt = normalizeMultiPrompt(body.multiPrompt, engineId);
    const elements = normalizeGenerationElements(body.elements, engineId);
    if (engineId === 'kling-v4' && multiPrompt) {
      const total = multiPrompt.reduce((sum, scene) => sum + scene.duration, 0);
      if ([body.durationSec, body.duration, body.durationOption].some(value => value != null && Number(value) !== total)) {
        throw new Error('Kling V4 shot durations must equal the requested duration.');
      }
    }
    return {ok:true as const, multiPrompt, elements};
  } catch (error) {
    return {ok:false as const, error:error instanceof Error ? error.message : 'Invalid generation inputs.'};
  }
}

export function normalizeMultiPrompt(value: unknown, engineId?: string): MultiPromptEntry[] | null {
  if (engineId === 'kling-v4' && value !== undefined && value !== null) {
    if (!Array.isArray(value) || !value.length || value.length > 30) throw new Error('Kling V4 requires a non-empty shot plan within thirty seconds.');
    const scenes = Array.from(value).map(entry => {
      if (!entry || typeof entry !== 'object' || typeof entry.prompt !== 'string'
        || !entry.prompt.trim() || entry.prompt.trim().length > 512
        || !Number.isInteger(entry.duration) || entry.duration < 1 || entry.duration > 30) {
        throw new Error('Kling V4 shot prompts require 1–512 characters and whole-second durations from 1 through 30.');
      }
      return {prompt: entry.prompt.trim(), duration: entry.duration as number};
    });
    const total = scenes.reduce((sum, scene) => sum + scene.duration, 0);
    if (total < 3 || total > 30) throw new Error('Kling V4 shot durations must total 3–30 seconds.');
    return scenes;
  }
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

export function normalizeGenerationElements(value: unknown, engineId?: string): GenerationElement[] | null {
  if (engineId === 'kling-v4' && value != null && (!Array.isArray(value) || value.length > 7
    || Array.from(value).some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry)))) {
    throw new Error('Kling V4 elements must be an array of at most seven subjects.');
  }
  if (!Array.isArray(value)) return null;
  const elements = value
    .map((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      if (engineId === 'kling-v4') assertKlingV4ElementFields(record);
      const element: GenerationElement = {
        ...(engineId === 'kling-v4' ? {voiceId: pickString(record, 'voiceId', 'voice_id')} : {}),
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
  const normalized = normalizeMaxVideoProviderElements(elements, {engineId});

  return normalized.length ? normalized : null;
}

function assertKlingV4ElementFields(record: Record<string, unknown>): void {
  // Validate the authored representation before the legacy pickers trim/filter it.
  for (const key of ['id', 'voiceId', 'voice_id', 'frontalImageUrl', 'frontal_image_url',
    'frontalAssetId', 'frontal_asset_id', 'videoUrl', 'video_url', 'videoAssetId', 'video_asset_id']) {
    const value = record[key];
    if (value != null && (typeof value !== 'string' || !value.trim())) {
      throw new Error(`Kling V4 element ${key} must be a non-empty string.`);
    }
  }
  for (const key of ['referenceImageUrls', 'reference_image_urls', 'referenceAssetIds', 'reference_asset_ids']) {
    const value = record[key];
    if (value != null && (!Array.isArray(value) || value.length < 1 || value.length > 3
      || Array.from(value).some(item => typeof item !== 'string' || !item.trim()))) {
      throw new Error(`Kling V4 element ${key} must contain one through three non-empty strings.`);
    }
  }
}

export function trimString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function isPresentString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}
