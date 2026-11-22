export { validateMediaFileAgainstConstraint, type MediaFieldConstraint, type MediaFileConstraintValidation } from './media-file-constraint';
import type { MediaFieldConstraint } from './media-file-constraint';

export type MediaConstraintEngine = {
  inputLimits?: { imageMaxMB?: number; videoMaxMB?: number; audioMaxMB?: number };
  inputSchema?: { constraints?: {
    supportedFormats?: readonly string[];
    maxImageSizeMB?: number;
    maxVideoSizeMB?: number;
    maxAudioSizeMB?: number;
  } };
};
type ConstraintField = {
  type: string;
  maxSizeMB?: number;
  acceptedMimeTypes?: readonly string[];
  acceptedFileExtensions?: readonly string[];
};

/** A reference slot may have stricter timing in an edit workflow than in Create. */
export function resolveMediaFieldMinDuration(
  field: { minDurationSecByMode?: Partial<Record<string, number>>; minDurationSec?: number },
  mode?: string,
): number | undefined {
  return (mode ? field.minDurationSecByMode?.[mode] : undefined) ?? field.minDurationSec;
}

export function validateImageAspectRatio(
  field: { type: string; imageAspectRatio?: { min: number; max: number } },
  width: number | null | undefined,
  height: number | null | undefined,
): 'valid' | 'unverified' | 'unsupported' {
  const range = field.type === 'image' ? field.imageAspectRatio : undefined;
  if (!range) return 'valid';
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || Number(width) <= 0 || Number(height) <= 0) return 'unverified';
  const ratio = Number(width) / Number(height);
  return ratio >= range.min && ratio <= range.max ? 'valid' : 'unsupported';
}

function normalizeList(values: readonly string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
    )
  );
}

function fallbackMaxSizeMB(engine: MediaConstraintEngine, field: ConstraintField): number | undefined {
  const constraints = engine.inputSchema?.constraints;
  if (field.type === 'image') {
    return constraints?.maxImageSizeMB ?? engine.inputLimits?.imageMaxMB;
  }
  if (field.type === 'video') {
    return constraints?.maxVideoSizeMB ?? engine.inputLimits?.videoMaxMB;
  }
  if (field.type === 'audio') {
    return constraints?.maxAudioSizeMB ?? engine.inputLimits?.audioMaxMB;
  }
  return undefined;
}

const FORMAT_MIME_TYPES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  avif: ['image/avif'],
  bmp: ['image/bmp', 'image/x-ms-bmp'],
  tif: ['image/tiff'],
  tiff: ['image/tiff'],
  heic: ['image/heic'],
  heif: ['image/heif'],
  mp4: ['video/mp4'],
  webm: ['video/webm'],
  mov: ['video/quicktime'],
  m4v: ['video/x-m4v', 'video/mp4'],
  mpeg: ['video/mpeg'],
  mpg: ['video/mpeg'],
  wmv: ['video/x-ms-wmv'],
  '3gpp': ['video/3gpp'],
  mp3: ['audio/mpeg'],
  wav: ['audio/wav', 'audio/x-wav'],
});

function declaredFormats(engine: MediaConstraintEngine): string[] {
  return normalizeList(
    Array.isArray(engine.inputSchema?.constraints?.supportedFormats)
      ? engine.inputSchema.constraints.supportedFormats.filter((value): value is string => typeof value === 'string')
      : undefined,
  );
}

function formatsForField(engine: MediaConstraintEngine, field: ConstraintField): string[] {
  const formats = declaredFormats(engine);
  const mimePrefix = `${field.type}/`;
  return formats.filter((format) =>
    (FORMAT_MIME_TYPES[format] ?? []).some((mime) => mime.startsWith(mimePrefix)));
}

export function hasFieldSpecificMediaConstraint(field: ConstraintField): boolean {
  return (
    typeof field.maxSizeMB === 'number' ||
    Boolean(field.acceptedMimeTypes?.length) ||
    Boolean(field.acceptedFileExtensions?.length)
  );
}

export function resolveEngineMediaFieldConstraint({
  engine,
  field,
}: {
  engine: MediaConstraintEngine;
  field: ConstraintField;
}): MediaFieldConstraint {
  const fallbackFormats = formatsForField(engine, field);
  const acceptedFileExtensions = normalizeList(field.acceptedFileExtensions);
  const acceptedMimeTypes = normalizeList(field.acceptedMimeTypes);
  const usesDeclaredFormats = !acceptedFileExtensions.length || !acceptedMimeTypes.length;
  const unmappedDeclaredFormats = usesDeclaredFormats
    ? declaredFormats(engine).filter((format) => !FORMAT_MIME_TYPES[format]?.length)
    : [];
  return {
    maxSizeMB: field.maxSizeMB ?? fallbackMaxSizeMB(engine, field),
    acceptedMimeTypes: acceptedMimeTypes.length
      ? acceptedMimeTypes
      : Array.from(new Set(fallbackFormats.flatMap((format) => FORMAT_MIME_TYPES[format] ?? []))),
    acceptedFileExtensions: acceptedFileExtensions.length
      ? acceptedFileExtensions
      : fallbackFormats,
    ...(unmappedDeclaredFormats.length ? { unmappedDeclaredFormats } : {}),
  };
}
