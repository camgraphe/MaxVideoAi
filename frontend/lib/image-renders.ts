import { normalizeMediaUrl } from './media';

export interface ImageRenderEntry {
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
}

export interface StoredImageRenderEntry {
  url: string;
  thumb_url: string;
  width: number | null;
  height: number | null;
  mime_type: string | null;
}

export interface ParsedStoredImageRenders {
  entries: ImageRenderEntry[];
  hasStructuredEntries: boolean;
}

function normalizeStringValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeMediaUrl(trimmed) ?? trimmed;
}

function normalizeDimension(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function normalizeMime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseRenderArray(input: unknown[]): ParsedStoredImageRenders {
  const entries: ImageRenderEntry[] = [];
  let hasStructuredEntries = false;

  input.forEach((entry) => {
    if (typeof entry === 'string') {
      const url = normalizeStringValue(entry);
      if (!url) return;
      entries.push({ url });
      return;
    }
    if (!entry || typeof entry !== 'object') {
      return;
    }

    const record = entry as Record<string, unknown>;
    const url = normalizeStringValue(record.url);
    if (!url) return;
    hasStructuredEntries = true;
    const thumbUrl = normalizeStringValue(record.thumb_url ?? record.thumbUrl);
    entries.push({
      url,
      thumbUrl,
      width: normalizeDimension(record.width),
      height: normalizeDimension(record.height),
      mimeType: normalizeMime(record.mime_type ?? record.mimeType),
    });
  });

  return { entries, hasStructuredEntries };
}

export function parseStoredImageRenders(value: unknown): ParsedStoredImageRenders {
  if (Array.isArray(value)) {
    return parseRenderArray(value);
  }
  if (typeof value === 'string' && value.trim().length) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parseRenderArray(parsed);
      }
    } catch {
      return { entries: [], hasStructuredEntries: false };
    }
  }
  return { entries: [], hasStructuredEntries: false };
}

export function extractRenderIds(entries: ImageRenderEntry[]): string[] | undefined {
  if (!entries.length) return undefined;
  return entries.map((entry) => entry.url);
}

export function extractRenderThumbUrls(payload: ParsedStoredImageRenders): string[] | undefined {
  if (!payload.hasStructuredEntries || !payload.entries.length) return undefined;
  return payload.entries.map((entry) => entry.thumbUrl ?? entry.url);
}

export function buildStoredImageRenderEntries(images: ImageRenderEntry[]): StoredImageRenderEntry[] {
  return images.reduce<StoredImageRenderEntry[]>((acc, image) => {
    const url = normalizeStringValue(image.url);
    if (!url) return acc;
    const thumbUrl = normalizeStringValue(image.thumbUrl) ?? url;
    acc.push({
      url,
      thumb_url: thumbUrl,
      width: normalizeDimension(image.width),
      height: normalizeDimension(image.height),
      mime_type: normalizeMime(image.mimeType),
    });
    return acc;
  }, []);
}

export function resolveHeroThumbFromRenders(images: ImageRenderEntry[]): string | null {
  if (!images.length) return null;
  return normalizeStringValue(images[0]?.thumbUrl) ?? normalizeStringValue(images[0]?.url);
}
