import { query } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';
import {
  mapAssetRow,
  normalizeMediaAssetSource,
  normalizeString,
  resolveLibraryAssetIdentity,
  type DbMediaAssetRow,
  type MediaAssetRecord,
  type MediaKind,
} from '../media-library-records';
import {
  buildMediaLibrarySearchPattern,
  decodeMediaLibraryCursor,
  resolveMediaLibraryLimit,
  sliceMediaLibraryPage,
  type MediaLibraryPage,
} from './pagination';

export async function findLibraryAssetByOrigin(params: {
  userId: string;
  originUrl: string;
  kind?: MediaKind | null;
  source?: string | null;
}): Promise<MediaAssetRecord | null> {
  const originUrl = normalizeString(params.originUrl);
  if (!originUrl) return null;

  await ensureMediaLibrarySchema();
  await ensureAssetSchema();

  const source = params.source && params.source !== 'all' ? normalizeMediaAssetSource(params.source) : null;
  const queryParams = [params.userId, params.kind ?? null, source, originUrl];
  if (params.kind) {
    const identity = resolveLibraryAssetIdentity({
      userId: params.userId,
      kind: params.kind,
      url: originUrl,
      source: source ?? 'import',
    });
    const identityRows = await query<DbMediaAssetRow>(
      `/* media-library:exact-origin:identity */
       SELECT id, public_id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes,
              source, source_job_id, source_output_id, status, metadata, created_at
         FROM media_assets
        WHERE id = $1
          AND user_id = $2
          AND deleted_at IS NULL
          AND kind = $3
          AND (
            $4::text IS NULL
            OR source = $4
            OR (
              $4 = 'saved_job_output'
              AND source = 'import'
              AND (
                source_job_id IS NOT NULL
                OR metadata->>'jobId' IS NOT NULL
                OR metadata->>'sourceJobId' IS NOT NULL
              )
            )
          )
        LIMIT 1`,
      [identity, params.userId, params.kind, source]
    );
    if (identityRows[0]) return mapAssetRow(identityRows[0]);
  }

  const canonicalRows = await query<DbMediaAssetRow>(
    `/* media-library:exact-origin:canonical */
     SELECT id, public_id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes,
            source, source_job_id, source_output_id, status, metadata, created_at
       FROM (
         SELECT
           a.id,
           a.public_id,
           a.user_id,
           a.kind,
           a.url,
           a.thumb_url,
           a.preview_url,
           a.mime_type,
           a.width,
           a.height,
           a.size_bytes,
           CASE
             WHEN a.source = 'import'
               AND (
                 a.source_job_id IS NOT NULL
                 OR a.metadata->>'jobId' IS NOT NULL
                 OR a.metadata->>'sourceJobId' IS NOT NULL
               )
               THEN 'saved_job_output'
             ELSE a.source
           END AS source,
           a.source_job_id,
           a.source_output_id,
           a.status,
           COALESCE(a.metadata, '{}'::jsonb) AS metadata,
           a.created_at
         FROM media_assets a
         WHERE a.user_id = $1
           AND a.deleted_at IS NULL
           AND COALESCE(a.source, '') <> 'storyboard_template_reference'
           AND (a.url = $4 OR a.metadata->>'originUrl' = $4)
       ) AS candidate
      WHERE ($2::text IS NULL OR kind = $2::text)
        AND ($3::text IS NULL OR source = $3::text)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    queryParams
  );
  if (canonicalRows[0]) return mapAssetRow(canonicalRows[0]);

  const legacyRows = await query<DbMediaAssetRow>(
    `/* media-library:exact-origin:legacy */
     SELECT id, public_id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes,
            source, source_job_id, source_output_id, status, metadata, created_at
       FROM (
         SELECT
           u.asset_id AS id,
           NULL::text AS public_id,
           u.user_id,
           CASE
             WHEN COALESCE(u.mime_type, '') LIKE 'video/%'
               OR u.url ~* '\\.(mp4|webm|mov|m4v|avi|mkv)([?#].*)?$' THEN 'video'
             WHEN COALESCE(u.mime_type, '') LIKE 'audio/%'
               OR u.url ~* '\\.(mp3|wav|ogg|m4a|aac|flac)([?#].*)?$' THEN 'audio'
             ELSE 'image'
           END AS kind,
           u.url,
           u.metadata->>'thumbUrl' AS thumb_url,
           u.metadata->>'previewUrl' AS preview_url,
           u.mime_type,
           u.width,
           u.height,
           u.size_bytes,
           CASE
             WHEN u.source IN ('upload', 'storyboard', 'character', 'angle', 'upscale', 'background-removal')
               THEN u.source
             WHEN u.source = 'generated'
               OR (
                 u.source = 'import'
                 AND (u.metadata->>'jobId' IS NOT NULL OR u.metadata->>'sourceJobId' IS NOT NULL)
               )
               THEN 'saved_job_output'
             ELSE 'import'
           END AS source,
           COALESCE(u.metadata->>'jobId', u.metadata->>'sourceJobId') AS source_job_id,
           NULL::text AS source_output_id,
           'ready'::text AS status,
           COALESCE(u.metadata, '{}'::jsonb) AS metadata,
           u.created_at
         FROM user_assets u
         WHERE u.user_id = $1
           AND COALESCE(u.source, '') <> 'storyboard_template_reference'
           AND (u.url = $4 OR u.metadata->>'originUrl' = $4)
       ) AS candidate
      WHERE ($2::text IS NULL OR kind = $2::text)
        AND ($3::text IS NULL OR source = $3::text)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    queryParams
  );

  return legacyRows[0] ? mapAssetRow(legacyRows[0]) : null;
}

export async function listLibraryAssetPage(params: {
  userId: string;
  kind?: MediaKind | null;
  source?: string | null;
  originUrl?: string | null;
  includeOutputs?: boolean;
  limit?: number;
  cursor?: string | null;
  q?: string | null;
}): Promise<MediaLibraryPage<MediaAssetRecord>> {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();

  const limit = resolveMediaLibraryLimit(params.limit);
  const cursor = decodeMediaLibraryCursor(params.cursor);
  const source = params.source && params.source !== 'all' ? normalizeMediaAssetSource(params.source) : null;
  const originUrl = normalizeString(params.originUrl) ?? null;
  const searchPattern = buildMediaLibrarySearchPattern(params.q);

  const rows = await query<DbMediaAssetRow>(
    `WITH candidates AS (
       SELECT
         a.id,
         a.public_id,
         a.user_id,
         a.kind,
         a.url,
         a.thumb_url,
         a.preview_url,
         a.mime_type,
         a.width,
         a.height,
         a.size_bytes,
         CASE
           WHEN a.source = 'import'
             AND (
               a.source_job_id IS NOT NULL
               OR a.metadata->>'jobId' IS NOT NULL
               OR a.metadata->>'sourceJobId' IS NOT NULL
             )
             THEN 'saved_job_output'
           ELSE a.source
         END AS source,
         a.source_job_id,
         a.source_output_id,
         a.status,
         COALESCE(a.metadata, '{}'::jsonb) AS metadata,
         a.created_at,
         0 AS source_priority,
         CONCAT_WS(' ',
           a.metadata->>'label',
           COALESCE(a.metadata->>'fileName', a.metadata->>'filename'),
           a.source_job_id,
           a.metadata->>'jobId',
           a.metadata->>'sourceJobId'
         ) AS search_text
       FROM media_assets a
       WHERE a.user_id = $1
         AND a.deleted_at IS NULL
         AND COALESCE(a.source, '') <> 'storyboard_template_reference'

       UNION ALL

       SELECT
         'output:' || o.id AS id,
         NULL::text AS public_id,
         o.user_id,
         o.kind,
         COALESCE(o.storage_url, o.url) AS url,
         o.thumb_url,
         o.preview_url,
         o.mime_type,
         o.width,
         o.height,
         NULL::bigint AS size_bytes,
         'saved_job_output'::text AS source,
         o.job_id AS source_job_id,
         o.id AS source_output_id,
         o.status,
         COALESCE(o.metadata, '{}'::jsonb)
           || jsonb_build_object(
             'durationSec', o.duration_sec,
             'jobId', o.job_id,
             'sourceOutputId', o.id
           ) AS metadata,
         o.created_at,
         1 AS source_priority,
         CONCAT_WS(' ',
           j.prompt,
           o.job_id,
           o.metadata->>'label',
           COALESCE(o.metadata->>'fileName', o.metadata->>'filename')
         ) AS search_text
       FROM job_outputs o
       JOIN app_jobs j
         ON j.job_id = o.job_id
        AND j.user_id = o.user_id
       WHERE $8::boolean
         AND o.user_id = $1
         AND j.hidden IS NOT TRUE
         AND o.status = 'ready'

       UNION ALL

       SELECT
         u.asset_id AS id,
         NULL::text AS public_id,
         u.user_id,
         CASE
           WHEN COALESCE(u.mime_type, '') LIKE 'video/%'
             OR u.url ~* '\\.(mp4|webm|mov|m4v|avi|mkv)([?#].*)?$' THEN 'video'
           WHEN COALESCE(u.mime_type, '') LIKE 'audio/%'
             OR u.url ~* '\\.(mp3|wav|ogg|m4a|aac|flac)([?#].*)?$' THEN 'audio'
           ELSE 'image'
         END AS kind,
         u.url,
         u.metadata->>'thumbUrl' AS thumb_url,
         u.metadata->>'previewUrl' AS preview_url,
         u.mime_type,
         u.width,
         u.height,
         u.size_bytes,
         CASE
           WHEN u.source IN ('upload', 'storyboard', 'character', 'angle', 'upscale', 'background-removal')
             THEN u.source
           WHEN u.source = 'generated'
             OR (
               u.source = 'import'
               AND (u.metadata->>'jobId' IS NOT NULL OR u.metadata->>'sourceJobId' IS NOT NULL)
             )
             THEN 'saved_job_output'
           ELSE 'import'
         END AS source,
         COALESCE(u.metadata->>'jobId', u.metadata->>'sourceJobId') AS source_job_id,
         NULL::text AS source_output_id,
         'ready'::text AS status,
         COALESCE(u.metadata, '{}'::jsonb) AS metadata,
         u.created_at,
         2 AS source_priority,
         CONCAT_WS(' ',
           u.metadata->>'label',
           COALESCE(u.metadata->>'fileName', u.metadata->>'filename'),
           u.metadata->>'jobId',
           u.metadata->>'sourceJobId',
           u.asset_id
         ) AS search_text
       FROM user_assets u
       WHERE u.user_id = $1
         AND COALESCE(u.source, '') <> 'storyboard_template_reference'
     ),
     filtered AS (
       SELECT *,
         COALESCE(NULLIF(metadata->>'originUrl', ''), url) AS logical_origin
       FROM candidates
       WHERE ($3::text IS NULL OR kind = $3::text)
         AND ($4::text IS NULL OR source = $4::text)
         AND ($5::text IS NULL OR url = $5::text OR metadata->>'originUrl' = $5::text)
         AND ($9::text IS NULL OR search_text ILIKE $9::text ESCAPE '\\')
     ),
     deduplicated AS (
       SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY kind, logical_origin
           ORDER BY source_priority ASC, created_at DESC, id DESC
         ) AS logical_rank
       FROM filtered
     )
     SELECT id, public_id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes,
            source, source_job_id, source_output_id, status, metadata, created_at
     FROM deduplicated
     WHERE logical_rank = 1
       AND (
         $6::timestamptz IS NULL
         OR (created_at, id) < ($6::timestamptz, $7::text)
       )
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [
      params.userId,
      limit + 1,
      params.kind ?? null,
      source,
      originUrl,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      Boolean(params.includeOutputs) && (!source || source === 'saved_job_output'),
      searchPattern,
    ]
  );

  return sliceMediaLibraryPage(rows.map(mapAssetRow), limit);
}
