import { ownedAuthFetch } from '@/lib/owned-auth-fetch';
import { normalizeLibraryBrowseScope } from './library-browse-scope';
import type { LibraryBrowseScope, LibraryBrowseResponse } from './library-browse';
export type LibraryBrowseKey = readonly [
    string,
    string
];
export function libraryBrowseScopeFromSearchParams(params: URLSearchParams): LibraryBrowseScope {
    const raw: Record<string, unknown> = {};
    for (const key of ['view', 'kind', 'sort', 'source', 'q', 'jobId', 'surface', 'collectionId', 'favorite', 'trash', 'job']) {
        if (!params.has(key))
            continue;
        if (params.getAll(key).length !== 1 || (key === 'job' && params.has('jobId')))
            throw new Error('INVALID_SCOPE');
        const value = params.get(key)!;
        if (key === 'favorite' || key === 'trash') {
            if (value !== 'true' && value !== 'false')
                throw new Error('INVALID_SCOPE');
            raw[key] = value === 'true';
        }
        else
            raw[key === 'job' ? 'jobId' : key] = value;
    }
    return normalizeLibraryBrowseScope(raw);
}
export function buildLibraryBrowseKey(input: {
    userId: string | null | undefined;
    scope: LibraryBrowseScope;
    limit?: number;
    cursor?: string | null;
}): LibraryBrowseKey | null {
    if (!input.userId)
        return null;
    const scope = normalizeLibraryBrowseScope(input.scope), params = new URLSearchParams();
    for (const [key, value] of Object.entries(scope))
        params.set(key, String(value));
    params.set('limit', String(input.limit ?? 30));
    if (input.cursor)
        params.set('cursor', input.cursor);
    return [`/api/media-library/browse?${params}`, input.userId];
}
export async function fetchLibraryBrowse([url, userId]: LibraryBrowseKey): Promise<LibraryBrowseResponse> {
    const response = await ownedAuthFetch(url, userId), body = await response.json().catch(() => null);
    if (!response.ok || !body?.ok)
        throw new Error(body?.error ?? 'LOAD_FAILED');
    return body;
}
