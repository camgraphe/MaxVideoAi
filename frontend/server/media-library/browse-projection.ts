import type { QueryExecutor } from '@/lib/db';
import type { LibraryBrowseScope } from '@/lib/library-browse';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import type { DbMediaAssetRow } from '../media-library-records';
import { LibraryOrganizationError } from './organization-validation';
export type BrowseRow = DbMediaAssetRow & {
    type: 'asset' | 'legacy' | 'job-output';
    display_id: string;
    display_url: string;
    revision: string;
    organization_key: string;
    jobId: string | null;
    outputId: string | null;
    identity_error: string | null;
    original_name: string | null;
    sort_name: string;
    favorite: boolean;
    trashed_at: string | null;
    collection_ids: string[];
    position: number | null;
    saved_asset_id: string | null;
    job_prompt: string | null;
    job_duration_sec: number | null;
    job_aspect_ratio: string | null;
};
export function browseRowReference(row: BrowseRow): LibraryMediaReference {
    return { ...(row.type === 'job-output' ? { type: row.type, jobId: row.jobId!, outputId: row.id, kind: row.kind } : { type: row.type, assetId: row.public_id ?? row.id, kind: row.kind }), sourceRevision: row.revision };
}
export async function assertBrowseCollection(userId: string, scope: LibraryBrowseScope, executor: QueryExecutor) {
    if (scope.collectionId && !(await executor.query('SELECT id FROM library_collections WHERE user_id=$1 AND id=$2', [userId, scope.collectionId])).length)
        throw new LibraryOrganizationError('COLLECTION_NOT_FOUND', 404);
}
