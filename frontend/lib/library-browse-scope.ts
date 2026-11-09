import type { LibraryBrowseScope } from './library-browse';
const fields = ['view', 'kind', 'sort', 'source', 'q', 'jobId', 'surface', 'collectionId', 'favorite', 'trash'];
function invalid(code = 'INVALID_SCOPE'): never { throw new Error(code); }
export function normalizeLibraryBrowseScope(value: unknown): LibraryBrowseScope {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key)))
        invalid();
    const input = value as Record<string, unknown>;
    const scope: LibraryBrowseScope = { view: 'all', kind: 'all', sort: 'recent' };
    for (const [key, values] of Object.entries({ view: ['all', 'saved', 'review'], kind: ['all', 'image', 'video', 'audio'], sort: ['recent', 'oldest', 'name'] })) {
        if (input[key] !== undefined) {
            if (typeof input[key] !== 'string' || !values.includes(input[key] as string))
                invalid();
            Object.assign(scope, { [key]: input[key] });
        }
    }
    for (const key of ['source', 'q', 'jobId', 'surface', 'collectionId'] as const) {
        const v = input[key];
        if (v === undefined)
            continue;
        if (typeof v !== 'string')
            invalid();
        if (key === 'q') {
            const q = v.trim().slice(0, 200);
            if (q)
                scope.q = q;
            continue;
        }
        if (!v || v.trim() !== v || v.length > 256)
            invalid();
        if (key === 'source' && !['all', 'upload', 'generated', 'job_output', 'saved_job_output', 'storyboard', 'character', 'angle', 'upscale', 'background-removal', 'import'].includes(v))
            invalid();
        if (key === 'source' && v === 'all')
            continue;
        scope[key] = key === 'source' && (v === 'generated' || v === 'job_output') ? 'saved_job_output' : v;
    }
    for (const key of ['favorite', 'trash'] as const) {
        if (input[key] !== undefined && typeof input[key] !== 'boolean')
            invalid();
        if (input[key] === true)
            scope[key] = true;
    }
    return scope;
}
