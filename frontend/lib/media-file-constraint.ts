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
