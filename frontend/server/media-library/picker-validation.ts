import type { LibraryPickerCandidate, LibraryPickerValidation } from '@/lib/library-picker-validation';
import { resolveLibraryOrganizationReferences } from './organization-resolver';
import { organizationSourceRevision } from './organization-identity';
import { referenceIdentity, sourceReference } from './organization-sources';
import {
  LibraryOrganizationError,
  onlyFields,
  requireLibraryOwner,
  validateLibraryReference,
  validateLibraryReferences,
} from './organization-validation';

/** An explicit point-in-time read, never a promotion, reservation or draft mutation. */
export async function validateLibraryPickerCandidates(
  userId: string,
  input: unknown,
): Promise<LibraryPickerValidation[]> {
  requireLibraryOwner(userId);
  onlyFields(input, ['candidates']);
  const values = input.candidates;
  validateLibraryReferences(values); // Reuse the public cap before any normalization/deduplication.
  const candidates: LibraryPickerCandidate[] = values.map((candidate: unknown) => {
    const value: unknown = candidate;
    onlyFields(value, ['reference', 'originalUrl']);
    if (
      !validateLibraryReference(value.reference) ||
      typeof value.originalUrl !== 'string' ||
      value.originalUrl.length > 16384 ||
      value.originalUrl.trim() !== value.originalUrl
    )
      throw new LibraryOrganizationError('INVALID_CANDIDATE');
    try {
      const url = new URL(value.originalUrl);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error();
    } catch {
      throw new LibraryOrganizationError('INVALID_ORIGINAL');
    }
    return { reference: value.reference, originalUrl: value.originalUrl };
  });
  const resolved = await resolveLibraryOrganizationReferences(
    userId,
    candidates.map((value) => value.reference),
  );
  return resolved.map((row, index) => {
    const { reference, key, sourceRevision, state } = row;
    if (row.error) return { reference, error: row.error };
    const source = row.identity?.sources.find(
      (source) => referenceIdentity(sourceReference(source)) === referenceIdentity(reference),
    );
    if (
      !source ||
      source.url !== candidates[index].originalUrl ||
      organizationSourceRevision(source) !== sourceRevision
    )
      return { reference, error: 'SOURCE_VERSION_CHANGED' };
    return { reference, key, sourceRevision, state, ...(state?.trashedAt ? { error: 'SOURCE_TRASHED' } : {}) };
  });
}
