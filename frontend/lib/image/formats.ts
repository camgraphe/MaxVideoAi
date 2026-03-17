import type { EngineCaps } from '@/types/engines';

const FORMAT_ALIAS_GROUPS = [
  ['jpg', 'jpeg', 'jpe', 'jfif'],
  ['heic', 'heif'],
] as const;

const MIME_TO_FORMATS: Record<string, string[]> = {
  'image/avif': ['avif'],
  'image/gif': ['gif'],
  'image/heic': ['heic', 'heif'],
  'image/heif': ['heic', 'heif'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpg', 'jpeg'],
  'image/pjpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/svg+xml': ['svg'],
  'image/webp': ['webp'],
};

function normalizeFormat(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/^\./, '');
  return normalized.length ? normalized : null;
}

function getEquivalentFormats(format: string): string[] {
  for (const group of FORMAT_ALIAS_GROUPS) {
    if ((group as readonly string[]).includes(format)) {
      return [...group];
    }
  }
  return [format];
}

function dedupeFormats(formats: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const format of formats) {
    const normalized = normalizeFormat(format);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped;
}

export function getSupportedImageFormats(engine: EngineCaps | null | undefined): string[] {
  const rawFormats = engine?.inputSchema?.constraints?.supportedFormats;
  if (!Array.isArray(rawFormats)) return [];
  return dedupeFormats(rawFormats.filter((value): value is string => typeof value === 'string'));
}

export function inferImageFormatsFromMime(mime: string | null | undefined): string[] {
  if (!mime) return [];
  const normalized = mime.split(';')[0]?.trim().toLowerCase();
  if (!normalized) return [];
  const mapped = MIME_TO_FORMATS[normalized];
  if (mapped?.length) return dedupeFormats(mapped);
  if (!normalized.startsWith('image/')) return [];
  const suffix = normalizeFormat(normalized.slice('image/'.length));
  return suffix ? [suffix] : [];
}

export function inferImageFormatFromFileName(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const normalized = fileName.split('?')[0]?.split('#')[0] ?? '';
  const match = normalized.match(/\.([a-z0-9+_-]+)$/i);
  return normalizeFormat(match?.[1] ?? null);
}

export function inferImageFormatFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return inferImageFormatFromFileName(parsed.pathname);
  } catch {
    return inferImageFormatFromFileName(url);
  }
}

export function isSupportedImageFormat(allowedFormats: string[], candidate: string | null | undefined): boolean {
  if (!allowedFormats.length) return true;
  const normalized = normalizeFormat(candidate);
  if (!normalized) return false;
  const allowed = new Set(dedupeFormats(allowedFormats));
  return getEquivalentFormats(normalized).some((format) => allowed.has(format));
}

export function isSupportedImageMime(allowedFormats: string[], mime: string | null | undefined): boolean | null {
  const inferred = inferImageFormatsFromMime(mime);
  if (!inferred.length) return null;
  return inferred.some((format) => isSupportedImageFormat(allowedFormats, format));
}

export function getImageAcceptAttribute(allowedFormats: string[]): string {
  if (!allowedFormats.length) return 'image/*';
  const accept = new Set<string>();
  for (const format of dedupeFormats(allowedFormats)) {
    if (format === 'jpg' || format === 'jpeg') {
      accept.add('.jpg');
      accept.add('.jpeg');
      accept.add('image/jpeg');
      continue;
    }
    if (format === 'heic' || format === 'heif') {
      accept.add('.heic');
      accept.add('.heif');
      accept.add('image/heic');
      accept.add('image/heif');
      continue;
    }
    accept.add(`.${format}`);
    accept.add(format === 'svg' ? 'image/svg+xml' : `image/${format}`);
  }
  return Array.from(accept).join(',');
}

export function formatSupportedImageFormatsLabel(allowedFormats: string[]): string {
  return dedupeFormats(allowedFormats)
    .map((format) => format.toUpperCase())
    .join(', ');
}
