import type { EngineCaps, EngineInputField } from '@/types/engines';

export type MediaFieldConstraint = {
  maxSizeMB?: number;
  acceptedMimeTypes: string[];
  acceptedFileExtensions: string[];
  unmappedDeclaredFormats?: string[];
};

export type MediaFileConstraintValidation =
  | { ok: true }
  | {
      ok: false;
      reason: 'size' | 'format';
      maxSizeMB?: number;
      acceptedFileExtensions?: string[];
    };

function normalizeList(values: readonly string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim().toLowerCase().replace(/^\./, ''))
        .filter(Boolean)
    )
  );
}

function fallbackMaxSizeMB(engine: EngineCaps, field: EngineInputField): number | undefined {
  const constraints = engine.inputSchema?.constraints;
  if (field.type === 'image') {
    return constraints?.maxImageSizeMB ?? engine.inputLimits.imageMaxMB;
  }
  if (field.type === 'video') {
    return constraints?.maxVideoSizeMB ?? engine.inputLimits.videoMaxMB;
  }
  if (field.type === 'audio') {
    return constraints?.maxAudioSizeMB ?? engine.inputLimits.audioMaxMB;
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

function declaredFormats(engine: EngineCaps): string[] {
  return normalizeList(
    Array.isArray(engine.inputSchema?.constraints?.supportedFormats)
      ? engine.inputSchema.constraints.supportedFormats.filter((value): value is string => typeof value === 'string')
      : undefined,
  );
}

function formatsForField(engine: EngineCaps, field: EngineInputField): string[] {
  const formats = declaredFormats(engine);
  const mimePrefix = `${field.type}/`;
  return formats.filter((format) =>
    (FORMAT_MIME_TYPES[format] ?? []).some((mime) => mime.startsWith(mimePrefix)));
}

export function hasFieldSpecificMediaConstraint(field: EngineInputField): boolean {
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
  engine: EngineCaps;
  field: EngineInputField;
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

function fileExtension(name: string): string | null {
  const withoutQuery = name.split(/[?#]/, 1)[0]?.trim().toLowerCase() ?? '';
  const match = /\.([a-z0-9]+)$/.exec(withoutQuery);
  return match?.[1] ?? null;
}

export function validateMediaFileAgainstConstraint({
  name,
  mimeType,
  sizeBytes,
  constraint,
}: {
  name: string;
  mimeType: string;
  sizeBytes: number;
  constraint: MediaFieldConstraint;
}): MediaFileConstraintValidation {
  if (
    typeof constraint.maxSizeMB === 'number' &&
    Number.isFinite(constraint.maxSizeMB) &&
    constraint.maxSizeMB > 0 &&
    sizeBytes > constraint.maxSizeMB * 1024 * 1024
  ) {
    return { ok: false, reason: 'size', maxSizeMB: constraint.maxSizeMB };
  }

  if (constraint.unmappedDeclaredFormats?.length) {
    return {
      ok: false,
      reason: 'format',
      acceptedFileExtensions: constraint.acceptedFileExtensions,
    };
  }

  const normalizedMime = mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  const extension = fileExtension(name);
  const mimeRejected =
    constraint.acceptedMimeTypes.length > 0 &&
    !constraint.acceptedMimeTypes.includes(normalizedMime);
  const extensionRejected =
    constraint.acceptedFileExtensions.length > 0 &&
    (extension === null || !constraint.acceptedFileExtensions.includes(extension));
  if (mimeRejected || extensionRejected) {
    return {
      ok: false,
      reason: 'format',
      acceptedFileExtensions: constraint.acceptedFileExtensions,
    };
  }

  return { ok: true };
}
