import { query } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';
import {
  mapAssetRow,
  mapOutputRow,
  normalizeMediaAssetSource,
  normalizeMetadata,
  normalizeString,
  resolveLibraryAssetDedupeKey,
  resolveLibraryAssetIdentity,
  resolveLibraryAssetOriginDedupeKey,
  type DbJobOutputRow,
  type DbMediaAssetRow,
  type JobOutputRecord,
  type MediaAssetRecord,
  type MediaKind,
} from '../media-library-records';
import {
  decodeMediaLibraryCursor,
  resolveMediaLibraryLimit,
  sliceMediaLibraryPage,
  type MediaLibraryPage,
} from './pagination';

function inferLegacyAssetKind(url: string, mimeType: string | null): MediaKind {
  const normalizedMime = mimeType?.toLowerCase() ?? '';
  const normalizedUrl = url.split(/[?#]/)[0]?.toLowerCase() ?? '';
  if (normalizedMime.startsWith('video/') || /\.(mp4|webm|mov|m4v|avi|mkv)$/.test(normalizedUrl)) return 'video';
  if (normalizedMime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(normalizedUrl)) return 'audio';
  return 'image';
}

function mediaAssetFromJobOutput(output: JobOutputRecord): MediaAssetRecord {
  return {
    id: resolveLibraryAssetIdentity({
      userId: output.userId ?? 'anonymous',
      kind: output.kind,
      url: output.url,
      source: 'saved_job_output',
      sourceOutputId: output.id,
    }),
    userId: output.userId,
    kind: output.kind,
    url: output.url,
    thumbUrl: output.thumbUrl,
    previewUrl: output.previewUrl,
    mimeType: output.mimeType,
    width: output.width,
    height: output.height,
    sizeBytes: null,
    durationSec: output.durationSec,
    source: 'saved_job_output',
    sourceJobId: output.jobId,
    sourceOutputId: output.id,
    status: output.status,
    metadata: {
      ...output.metadata,
      durationSec: output.durationSec,
      jobId: output.jobId,
      sourceOutputId: output.id,
    },
    createdAt: output.createdAt,
  };
}

export async function listLibraryAssetPage(params: {
  userId: string;
  kind?: MediaKind | null;
  source?: string | null;
  originUrl?: string | null;
  includeOutputs?: boolean;
  limit?: number;
  cursor?: string | null;
}): Promise<MediaLibraryPage<MediaAssetRecord>> {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();
  const limit = resolveMediaLibraryLimit(params.limit);
  const pageLimit = limit + 1;
  const cursor = decodeMediaLibraryCursor(params.cursor);
  const source = params.source && params.source !== 'all' ? normalizeMediaAssetSource(params.source) : null;
  const originUrl = normalizeString(params.originUrl) ?? null;
  const shouldIncludeJobOutputs = Boolean(params.includeOutputs) && (!source || source === 'saved_job_output');
  const outputCursorId = cursor?.id?.startsWith('output:') ? cursor.id.slice('output:'.length) : cursor?.id ?? null;
  const values: unknown[] = [
    params.userId,
    pageLimit,
    params.kind ?? null,
    source,
    originUrl,
    cursor?.createdAt ?? null,
    cursor?.id ?? null,
  ];
  const rows = await query<DbMediaAssetRow>(
    `SELECT id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes, source,
            source_job_id, source_output_id, status, metadata, created_at
      FROM media_assets
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND COALESCE(source, '') <> 'storyboard_template_reference'
        AND ($3::text IS NULL OR kind = $3::text)
        AND (
          $4::text IS NULL
          OR source = $4::text
          OR (
            $4::text = 'saved_job_output'
            AND source = 'import'
            AND (
              source_job_id IS NOT NULL
              OR metadata->>'jobId' IS NOT NULL
              OR metadata->>'sourceJobId' IS NOT NULL
            )
          )
        )
        AND ($5::text IS NULL OR url = $5::text OR metadata->>'originUrl' = $5::text)
        AND (
          $6::timestamptz IS NULL
          OR (created_at, id) < ($6::timestamptz, $7::text)
        )
      ORDER BY created_at DESC, id DESC
      LIMIT $2`,
    values
  );
  const assets: MediaAssetRecord[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    const asset = mapAssetRow(row);
    const dedupeKey = resolveLibraryAssetDedupeKey(asset);
    const originDedupeKey = resolveLibraryAssetOriginDedupeKey(asset);
    if (seen.has(asset.id) || seen.has(dedupeKey) || seen.has(originDedupeKey)) return;
    assets.push(asset);
    seen.add(asset.id);
    seen.add(dedupeKey);
    seen.add(originDedupeKey);
  });

  if (shouldIncludeJobOutputs) {
    const outputValues = [...values];
    outputValues[6] = outputCursorId;
    const outputRows = await query<DbJobOutputRow>(
      `SELECT o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.preview_url, o.mime_type,
              o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at,
              saved.id AS saved_asset_id,
              j.prompt AS job_prompt,
              j.duration_sec AS job_duration_sec,
              j.aspect_ratio AS job_aspect_ratio
         FROM job_outputs o
         JOIN app_jobs j
           ON j.job_id = o.job_id
          AND j.user_id = o.user_id
         LEFT JOIN media_assets saved
           ON saved.user_id = $1
          AND saved.source_output_id = o.id
          AND saved.deleted_at IS NULL
        WHERE o.user_id = $1
          AND j.hidden IS NOT TRUE
          AND o.status = 'ready'
          AND ($3::text IS NULL OR o.kind = $3::text)
          AND ($4::text IS NULL OR $4::text = 'saved_job_output')
          AND ($5::text IS NULL OR o.url = $5::text OR o.storage_url = $5::text OR o.metadata->>'originUrl' = $5::text)
          AND (
            $6::timestamptz IS NULL
            OR (o.created_at, o.id) < ($6::timestamptz, $7::text)
          )
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $2`,
      outputValues
    );

    outputRows.forEach((row) => {
      const outputAsset = mediaAssetFromJobOutput(mapOutputRow(row));
      const dedupeKey = resolveLibraryAssetDedupeKey(outputAsset);
      const originDedupeKey = resolveLibraryAssetOriginDedupeKey(outputAsset);
      if (seen.has(outputAsset.id) || seen.has(dedupeKey) || seen.has(originDedupeKey)) return;
      assets.push(outputAsset);
      seen.add(outputAsset.id);
      seen.add(dedupeKey);
      seen.add(originDedupeKey);
    });
  }

  const legacyRows = await query<{
    asset_id: string;
    user_id: string | null;
    url: string;
    mime_type: string | null;
    width: number | null;
    height: number | null;
    size_bytes: string | number | null;
    source: string | null;
    metadata: unknown;
    created_at: string;
  }>(
    `SELECT asset_id, user_id, url, mime_type, width, height, size_bytes, source, metadata, created_at
      FROM user_assets
      WHERE user_id = $1
        AND COALESCE(source, '') <> 'storyboard_template_reference'
        AND ($3::text IS NULL OR (
          CASE
            WHEN COALESCE(mime_type, '') LIKE 'video/%'
              OR url ~* '\\.(mp4|webm|mov|m4v|avi|mkv)([?#].*)?$' THEN 'video'
            WHEN COALESCE(mime_type, '') LIKE 'audio/%'
              OR url ~* '\\.(mp3|wav|ogg|m4a|aac|flac)([?#].*)?$' THEN 'audio'
            ELSE 'image'
          END
        ) = $3::text)
        AND (
          $4::text IS NULL
          OR (
            CASE
            WHEN source IN ('upload', 'storyboard', 'character', 'angle', 'upscale', 'background-removal') THEN source
              WHEN source = 'generated' THEN 'saved_job_output'
              ELSE 'import'
            END
          ) = $4::text
          OR (
            $4::text = 'saved_job_output'
            AND source = 'import'
            AND (
              metadata->>'jobId' IS NOT NULL
              OR metadata->>'sourceJobId' IS NOT NULL
            )
          )
        )
        AND ($5::text IS NULL OR url = $5::text OR metadata->>'originUrl' = $5::text)
        AND (
          $6::timestamptz IS NULL
          OR (created_at, asset_id) < ($6::timestamptz, $7::text)
        )
      ORDER BY created_at DESC, asset_id DESC
      LIMIT $2`,
    values
  );

  legacyRows.forEach((row) => {
    if (seen.has(row.asset_id)) return;
    const kind = inferLegacyAssetKind(row.url, row.mime_type);
    const metadata = normalizeMetadata(row.metadata);
    const legacyAsset: MediaAssetRecord = {
      id: row.asset_id,
      userId: row.user_id,
      kind,
      url: row.url,
      thumbUrl: typeof metadata.thumbUrl === 'string' ? metadata.thumbUrl : null,
      previewUrl: typeof metadata.previewUrl === 'string' ? metadata.previewUrl : null,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      sizeBytes: typeof row.size_bytes === 'string' ? Number(row.size_bytes) : row.size_bytes,
      durationSec: typeof metadata.durationSec === 'number' && Number.isFinite(metadata.durationSec) ? metadata.durationSec : null,
      source: normalizeMediaAssetSource(row.source),
      sourceJobId: typeof metadata.jobId === 'string' ? metadata.jobId : null,
      sourceOutputId: null,
      status: 'ready',
      metadata,
      createdAt: row.created_at,
    };
    const dedupeKey = resolveLibraryAssetDedupeKey(legacyAsset);
    const originDedupeKey = resolveLibraryAssetOriginDedupeKey(legacyAsset);
    if (seen.has(dedupeKey) || seen.has(originDedupeKey)) return;
    assets.push(legacyAsset);
    seen.add(row.asset_id);
    seen.add(dedupeKey);
    seen.add(originDedupeKey);
  });

  return sliceMediaLibraryPage(assets, limit);
}
