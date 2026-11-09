import { FEATURES } from '@/content/feature-flags';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import { LibraryOrganizationError, onlyFields } from './organization-validation';
import { organizationHash } from './organization-identity';
import { normalizeLibraryBrowseScope as normalizeScope } from '@/lib/library-browse-scope';
export function normalizeLibraryBrowseScope(value: unknown): LibraryBrowseScope {
    try {
        return normalizeScope(value);
    }
    catch (error) {
        throw new LibraryOrganizationError(error instanceof Error ? error.message : 'INVALID_SCOPE');
    }
}
function invalid(code: string): never { throw new LibraryOrganizationError(code); }
export function libraryBrowseLimit(value: unknown): number {
    if (value === undefined)
        return 30;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
        invalid('INVALID_LIMIT');
    return Math.min(value, 100);
}
export type BrowseCursor = {
    v: 1;
    binding: string;
    time: string;
    key: string;
    name: string;
};
export function browseCursorBinding(userId: string, scope: LibraryBrowseScope, toolsEnabled: boolean = FEATURES.workflows.toolsSection) { return organizationHash([userId, scope, toolsEnabled]); }
export function parseBrowseCursor(value: unknown, binding: string): BrowseCursor | null {
    if (value === undefined || value === null)
        return null;
    if (typeof value !== 'string' || !value || value.length > 4096)
        invalid('INVALID_CURSOR');
    try {
        const c = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
        onlyFields(c, ['v', 'binding', 'time', 'key', 'name']);
        if (c.v !== 1 || c.binding !== binding || typeof c.time !== 'string' || !Number.isFinite(Date.parse(c.time)) || typeof c.key !== 'string' || !/^lo_[a-f0-9]{64}$/.test(c.key) || typeof c.name !== 'string')
            invalid('INVALID_CURSOR');
        return c as BrowseCursor;
    }
    catch {
        invalid('INVALID_CURSOR');
    }
}
export function encodeBrowseCursor(value: BrowseCursor) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
