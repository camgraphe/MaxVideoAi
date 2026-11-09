import { FEATURES } from '@/content/feature-flags';
import { query } from '@/lib/db';
import type { LibraryBrowseAsset, LibraryBrowseScope } from '@/lib/library-browse';
import { mapAssetRow, normalizeMetadata } from '../media-library-records';
import { serializeLibraryAsset } from './asset-response';
import { createLibraryMediaReadAccess } from './read-access';
import { projectMissingAudioDurations } from './audio-duration-projection';
import { buildMediaLibrarySearchPattern } from './pagination';
import { LibraryOrganizationError, requireLibraryOwner, onlyFields } from './organization-validation';
import { normalizeLibraryBrowseScope, libraryBrowseLimit, parseBrowseCursor, browseCursorBinding, encodeBrowseCursor } from './browse-validation';
import { listStoryboardKlingFirstFrameOutputs } from './job-outputs';
import { buildRecentOutputStoryboardHandoff, buildRecentOutputImage } from './output-handoff';
import { libraryBrowseCtes, browseOrder } from './browse-sql';
import { assertBrowseCollection, browseRowReference, type BrowseRow } from './browse-projection';
export async function browseLibrary(input: {
    userId: string;
    scope: LibraryBrowseScope;
    limit?: number;
    cursor?: string | null;
}, policy: { toolsEnabled?: boolean } = {}) {
    onlyFields(input, ['userId', 'scope', 'limit', 'cursor']);
    requireLibraryOwner(input.userId);
    const toolsEnabled = policy.toolsEnabled ?? FEATURES.workflows.toolsSection;
    const scope = normalizeLibraryBrowseScope(input.scope), limit = libraryBrowseLimit(input.limit), binding = browseCursorBinding(input.userId, scope, toolsEnabled), cursor = parseBrowseCursor(input.cursor, binding);
    await assertBrowseCollection(input.userId, scope, { query });
    const comparison = scope.sort === 'recent' ? '<' : '>';
    const cursorCondition = scope.sort === 'name' ? `(sort_name COLLATE "C",created_at,organization_key)>($4::text COLLATE "C",$5::timestamptz,$6::text)` : `(created_at,organization_key)${comparison}($5::timestamptz,$6::text)`;
    const [result] = await query<{
        total_count: string;
        error: string | null;
        rows: BrowseRow[];
    }>(`WITH ${libraryBrowseCtes(toolsEnabled)}, page AS (
    SELECT * FROM browse_filtered WHERE $5::timestamptz IS NULL OR ${cursorCondition} ORDER BY ${browseOrder(scope.sort)} LIMIT $7)
    SELECT $4::text AS cursor_name,(SELECT count(*) FROM browse_filtered) AS total_count,(SELECT min(identity_error) FROM browse_ranked WHERE matches_search) AS error,
      COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY ${browseOrder(scope.sort)}) FROM page),'[]'::jsonb) AS rows`, [input.userId, JSON.stringify(scope), buildMediaLibrarySearchPattern(scope.q), cursor?.name ?? null, cursor?.time ?? null, cursor?.key ?? null, limit + 1]);
    if (result.error)
        throw new LibraryOrganizationError(result.error, 409);
    const rows = result.rows.slice(0, limit), hasMore = result.rows.length > limit;
    const records = await projectMissingAudioDurations(input.userId, rows.map(row => mapAssetRow({ ...row, id: row.display_id, url: row.display_url, user_id: input.userId, source_job_id: row.jobId, source_output_id: row.outputId,
        metadata: { ...normalizeMetadata(row.metadata), ...(row.original_name ? { originalName: row.original_name } : {}) } })));
    const firstFrames = scope.surface === 'storyboard' ? await listStoryboardKlingFirstFrameOutputs({ userId: input.userId, parentJobIds: rows.flatMap(row => row.jobId ? [row.jobId] : []) }, { ensureSchema: false }) : new Map();
    const assets: LibraryBrowseAsset[] = await Promise.all(records.map(async (record, index) => {
        const row = rows[index], libraryRef = browseRowReference(row);
        return { ...serializeLibraryAsset(record, await createLibraryMediaReadAccess(input.userId, record, browseRowReference(row))),
            ...(libraryRef.type === 'job-output' ? { ref: { type: 'job-output' as const, jobId: libraryRef.jobId, outputId: libraryRef.outputId, kind: libraryRef.kind } } : {}),
            libraryRef, sourceRevision: row.revision, organization: { key: row.organization_key, favorite: row.favorite, trashedAt: row.trashed_at, collectionIds: row.collection_ids },
            position: row.position ?? undefined, status: 'ready', isSaved: Boolean(row.saved_asset_id), savedAssetId: row.saved_asset_id,
            storyboard: scope.surface === 'storyboard' ? buildRecentOutputStoryboardHandoff({ ...record, jobId: row.jobId!, storageUrl: null, position: row.position ?? 0, jobPrompt: row.job_prompt, jobDurationSec: row.job_duration_sec, jobAspectRatio: row.job_aspect_ratio }) : null,
            klingFirstFrame: scope.surface === 'storyboard' ? buildRecentOutputImage(firstFrames.get(row.jobId!)) : null, role: normalizeMetadata(row.metadata).role === 'last_frame' ? 'last_frame' : undefined };
    }));
    const last = rows.at(-1);
    return { assets, totalCount: Number(result.total_count), hasMore, nextCursor: hasMore && last ? encodeBrowseCursor({ v: 1, binding, time: typeof last.created_at === 'string' ? last.created_at : last.created_at.toISOString(), key: last.organization_key, name: scope.sort === 'name' ? last.sort_name : '' }) : null };
}
