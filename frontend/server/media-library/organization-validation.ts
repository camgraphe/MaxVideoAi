import type { LibraryMediaReference, LibraryOrganizationOperation } from '@/lib/media-library-organization';
export class LibraryOrganizationError extends Error {
    constructor(message: string, readonly status = 400) { super(message); }
}
export function requireLibraryOwner(userId: string): void {
    if (typeof userId !== 'string' || !userId.trim())
        throw new LibraryOrganizationError('UNAUTHORIZED', 401);
}
export function validateLibraryReference(value: unknown): value is LibraryMediaReference {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const row = value as Record<string, unknown>;
    if (typeof row.kind !== 'string' || !['image', 'video', 'audio'].includes(row.kind))
        return false;
    if (row.sourceRevision !== undefined && (typeof row.sourceRevision !== 'string' || !/^sr_[a-f0-9]{64}$/.test(row.sourceRevision)))
        return false;
    const fields = row.type === 'job-output' ? ['jobId', 'outputId'] : row.type === 'asset' || row.type === 'legacy' ? ['assetId'] : [];
    return fields.length > 0 && fields.every(key => typeof row[key] === 'string' && (row[key] as string).length > 0 && (row[key] as string).length <= 16384 && (row[key] as string).trim() === row[key])
        && Object.keys(row).every(key => ['type', 'kind', 'sourceRevision', ...fields].includes(key));
}
export function validateOrganizationOperation(value: unknown): asserts value is LibraryOrganizationOperation {
    if (typeof value !== 'string' || !['favorite', 'unfavorite', 'trash', 'restore', 'add-to-collection', 'remove-from-collection'].includes(value))
        throw new LibraryOrganizationError('INVALID_OPERATION');
}
export function validateLibraryReferences(value: unknown): asserts value is LibraryMediaReference[] {
    if (!Array.isArray(value))
        throw new LibraryOrganizationError('INVALID_REFERENCES');
    if (value.length > 500)
        throw new LibraryOrganizationError('REFERENCE_LIMIT');
}
export function libraryCollectionName(value: unknown): string {
    if (typeof value !== 'string' || [...value.trim()].length < 1 || [...value.trim()].length > 120)
        throw new LibraryOrganizationError('INVALID_COLLECTION_NAME');
    return value.trim();
}
export function onlyFields(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key)))
        throw new LibraryOrganizationError('INVALID_BODY');
}
