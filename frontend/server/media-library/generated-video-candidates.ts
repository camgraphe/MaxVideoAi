import { readMediaFacts } from '@/lib/media-identity';
import { readGeneratedVideoFacts, videoDuration } from '@/lib/generated-video-media-facts';
import type { GeneratedVideoCandidate } from '@/lib/generated-video-candidates';
import { query } from '@/lib/db';
import { applicationJobSql } from '@/server/app-job-origin';
import { RECENT_GENERATIONS_SELECT, mapRecentGenerationRecordToWeb, type RecentGenerationRecord, RECENT_IMAGE_ENGINE_ALIASES, type RecentGenerationQueryParam, ECMASCRIPT_TRIM_CHARACTERS_SQL } from '@/server/generations/recent-generations';
import { COMPLETED_GENERATION_STATUSES } from '@/server/generations/agent-generation-policy';
import { generatedVideoJobSurfaceSql } from './generated-video-candidate-sql';
import { historicalJobProjectionSql } from './visibility-sql';
import { libraryIdentityCtes } from './browse-identity-sql';
import { libraryBrowseLimit } from './browse-validation';
import { organizationHash } from './organization-identity';
import { LibraryOrganizationError, requireLibraryOwner } from './organization-validation';
/** Picker-only projection. Activity and historical receipts retain their own visibility. */
export async function listGeneratedVideoCandidates(input: {
    userId: string;
    surface?: 'video' | 'upscale';
    limit?: number;
    cursor?: string | null;
}) {
    requireLibraryOwner(input.userId);
    const limit = libraryBrowseLimit(input.limit), surface = input.surface ?? 'video';
    if (!['video', 'upscale'].includes(surface))
        throw new LibraryOrganizationError('INVALID_SURFACE');
    const binding = organizationHash(['generated-video-v1', input.userId, surface]);
    let cursor: {
        time: string;
        key: string;
    } | null = null;
    if (input.cursor) {
        try {
            if (input.cursor.length > 4096)
                throw Error();
            const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString());
            if (parsed.binding !== binding || typeof parsed.time !== 'string' || !Number.isFinite(Date.parse(parsed.time)) || typeof parsed.key !== 'string' || parsed.key.length > 512)
                throw Error();
            cursor = parsed;
        }
        catch {
            throw new LibraryOrganizationError('INVALID_CURSOR');
        }
    }
    const params: RecentGenerationQueryParam[] = [input.userId, RECENT_IMAGE_ENGINE_ALIASES, surface];
    const surfaceFilter = `${generatedVideoJobSurfaceSql()}=$3`;
    params.push([...COMPLETED_GENERATION_STATUSES]);
    const statuses = params.length;
    params.push(cursor?.time ?? '', cursor?.key ?? '', limit + 1);
    const time = params.length - 2, key = params.length - 1, size = params.length;
    const [result] = await query<{
        error: string | null;
        rows: (RecentGenerationRecord & {
            candidate_key: string;
            candidate_url: string;
            output_id: string | null;
            output_thumb: string | null;
            output_duration: number | null;
            output_width: number | null;
            output_height: number | null;
            output_metadata: Record<string, unknown> | null;
            revision: string | null;
            organization_key: string | null;
        })[];
    }>(`
    WITH ${libraryIdentityCtes()}, owned_jobs AS MATERIALIZED (
      SELECT ${RECENT_GENERATIONS_SELECT} FROM app_jobs j
      WHERE user_id=$1 AND hidden IS NOT TRUE AND ${applicationJobSql('j')}
        AND ${surfaceFilter}
        AND LOWER(BTRIM(COALESCE(status,''),${ECMASCRIPT_TRIM_CHARACTERS_SQL}))=ANY($${statuses}::text[])
    ), candidates AS MATERIALIZED (
      SELECT j.*, 'output:'||o.id AS candidate_key,COALESCE(o.storage_url,o.url) AS candidate_url,o.id AS output_id,o.thumb_url AS output_thumb,o.duration_sec AS output_duration,o.width AS output_width,o.height AS output_height,o.metadata AS output_metadata,li.revision,li.organization_key,li.identity_error,org.trashed_at
      FROM owned_jobs j JOIN job_outputs o ON o.job_id=j.job_id AND o.user_id=$1 AND o.kind='video' AND o.status='ready'
      JOIN library_identities li ON li.type='job-output' AND li.id=o.id AND li.kind='video'
      LEFT JOIN library_organization org ON org.user_id=$1 AND org.key=li.organization_key
      UNION ALL
      SELECT j.*,'job:'||j.job_id,j.video_url,NULL::text,NULL::text,NULL::double precision,NULL::integer,NULL::integer,NULL::jsonb,NULL::text,NULL::text,projection.identity_error,projection.trashed_at
      FROM owned_jobs j CROSS JOIN LATERAL (${historicalJobProjectionSql('j.job_id', 'j.video_url')}) projection WHERE $3='video' AND NOT EXISTS(SELECT 1 FROM job_outputs o WHERE o.job_id=j.job_id)
    ), visible AS MATERIALIZED (
      SELECT * FROM candidates c WHERE trashed_at IS NULL
        AND candidate_url ~ '^https?://' AND candidate_url !~ '^https?://[^/]*@'
        AND NOT EXISTS(SELECT 1 FROM mcp_reference_upload_object_fences f
          WHERE f.state IN ('deleting','deleted') AND f.object_key=COALESCE(reference_storage_object_key(c.candidate_url),unrecognized_reference_storage_object_key(c.candidate_url)))
    ), page AS (
      SELECT * FROM visible WHERE $${time}::text='' OR (created_at,candidate_key)<($${time}::timestamptz,$${key}::text)
      ORDER BY created_at DESC,candidate_key DESC LIMIT $${size}
    ) SELECT (SELECT min(identity_error) FROM candidates) AS error,
      COALESCE((SELECT jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,candidate_key DESC) FROM page),'[]'::jsonb) AS rows`, params);
    if (result.error)
        throw new LibraryOrganizationError(result.error, 409);
    const hasMore = result.rows.length > limit, rows = result.rows.slice(0, limit);
    const jobs: GeneratedVideoCandidate[] = rows.map(row => {
        const job = mapRecentGenerationRecordToWeb(row);
        // Persisted siblings are separate originals. Job-level facts describe only the
        // primary job video and are never defaults for a persisted candidate.
        const metadata = row.output_metadata ?? {};
        const measured = metadata.mediaFacts;
        const facts = measured && typeof measured === 'object' && 'version' in measured
            && !readGeneratedVideoFacts(measured, row.candidate_url) ? undefined : readMediaFacts(measured);
        const width = positiveDimension(facts?.width ?? row.output_width);
        const height = positiveDimension(facts?.height ?? row.output_height);
        const durationSec = row.output_id
            ? videoDuration(metadata, row.candidate_url, facts?.durationSec ?? row.output_duration) : job.durationSec;
        return { jobId: job.jobId, videoUrl: row.output_id ? row.candidate_url : job.videoUrl!, thumbUrl: row.output_id ? row.output_thumb : job.thumbUrl, engineLabel: job.engineLabel, durationSec, width, height, aspectRatio: row.output_id ? dimensionRatio(width, height) : job.aspectRatio, createdAt: job.createdAt, hasAudio: row.output_id ? facts?.hasAudio ?? null : job.hasAudio ?? null,
            ...(row.output_id ? { sourceOutputId: row.output_id, sourceRevision: row.revision!, ref: { type: 'job-output' as const, jobId: job.jobId, outputId: row.output_id, kind: 'video' as const } } : {}) };
    });
    const last = rows.at(-1);
    return { jobs, hasMore, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ binding, time: last.created_at, key: last.candidate_key })).toString('base64url') : null };
}

function positiveDimension(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}
function dimensionRatio(width: number | null, height: number | null): string | null {
    if (!width || !height) return null;
    let a = width, b = height;
    while (b) [a, b] = [b, a % b];
    return `${width / a}:${height / a}`;
}
