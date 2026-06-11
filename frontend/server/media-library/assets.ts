import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';
import { recordUserAsset } from '@/server/storage';
import {
  buildMediaAssetInsert,
  inferMimeFromUrl,
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
  type MediaAssetRecord,
  type MediaKind,
} from '../media-library-records';
import { copyRemoteMedia, createRemoteVideoAssetThumbnail } from './asset-media';
import { resolveReusableAssetPreviewUrl, resolveReusableAssetThumbUrl } from './asset-resolvers';

export async function listLibraryAssets(params: {
  userId: string;
  kind?: MediaKind | null;
  source?: string | null;
  originUrl?: string | null;
  limit?: number;
}): Promise<MediaAssetRecord[]> {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const source = params.source && params.source !== 'all' ? normalizeMediaAssetSource(params.source) : null;
  const originUrl = normalizeString(params.originUrl) ?? null;
  const values: unknown[] = [params.userId, limit, params.kind ?? null, source, originUrl];
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
      ORDER BY created_at DESC
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
            WHEN COALESCE(mime_type, '') LIKE 'video/%' THEN 'video'
            WHEN COALESCE(mime_type, '') LIKE 'audio/%' THEN 'audio'
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
      ORDER BY created_at DESC
      LIMIT $2`,
    values
  );

  legacyRows.forEach((row) => {
    if (seen.has(row.asset_id)) return;
    const kind: MediaKind = row.mime_type?.startsWith('video/')
      ? 'video'
      : row.mime_type?.startsWith('audio/')
        ? 'audio'
        : 'image';
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

  return assets
    .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))
    .slice(0, limit);
}

export async function ensureReusableAsset(params: {
  userId: string;
  url: string;
  kind: MediaKind;
  source?: unknown;
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
  label?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  thumbUrl?: string | null;
  previewUrl?: string | null;
}): Promise<MediaAssetRecord> {
  await ensureMediaLibrarySchema();
  const source = normalizeMediaAssetSource(params.source);
  const normalizedUrl = normalizeString(params.url);
  if (!normalizedUrl) throw new Error('URL_REQUIRED');
  const identity = resolveLibraryAssetIdentity({
    userId: params.userId,
    kind: params.kind,
    url: normalizedUrl,
    source,
    sourceOutputId: params.sourceOutputId ?? null,
  });
  let resolvedThumbUrl = await resolveReusableAssetThumbUrl({
    userId: params.userId,
    kind: params.kind,
    normalizedUrl,
    thumbUrl: params.thumbUrl,
    sourceJobId: params.sourceJobId ?? null,
    sourceOutputId: params.sourceOutputId ?? null,
  });
  const resolvedPreviewUrl = await resolveReusableAssetPreviewUrl({
    userId: params.userId,
    kind: params.kind,
    normalizedUrl,
    previewUrl: params.previewUrl,
    sourceJobId: params.sourceJobId ?? null,
    sourceOutputId: params.sourceOutputId ?? null,
  });

  const existing = await query<DbMediaAssetRow>(
    `SELECT id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes, source,
            source_job_id, source_output_id, status, metadata, created_at
       FROM media_assets
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [identity, params.userId]
  );
  if (existing[0]) {
    if (!existing[0].thumb_url && !resolvedThumbUrl && params.kind === 'video') {
      resolvedThumbUrl = await createRemoteVideoAssetThumbnail({
        userId: params.userId,
        url: existing[0].url,
        fileName: params.label ?? existing[0].id,
      });
    }
    if ((!existing[0].thumb_url && resolvedThumbUrl) || (!existing[0].preview_url && resolvedPreviewUrl)) {
      const rows = await query<DbMediaAssetRow>(
        `UPDATE media_assets
            SET thumb_url = COALESCE(thumb_url, $3),
                preview_url = COALESCE(preview_url, $4),
                metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_strip_nulls(jsonb_build_object('thumbUrl', $3::text, 'previewUrl', $4::text)),
                updated_at = NOW()
          WHERE id = $1
            AND user_id = $2
            AND deleted_at IS NULL
          RETURNING id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes, source,
                    source_job_id, source_output_id, status, metadata, created_at`,
        [identity, params.userId, resolvedThumbUrl, resolvedPreviewUrl]
      );
      return mapAssetRow(rows[0] ?? existing[0]);
    }
    return mapAssetRow(existing[0]);
  }

  const host = new URL(normalizedUrl).host.toLowerCase();
  const shouldCopy = source === 'saved_job_output' || host === 'fal.media' || host.endsWith('.fal.media');
  const copied = shouldCopy
    ? await copyRemoteMedia({
        userId: params.userId,
        url: normalizedUrl,
        kind: params.kind,
        mimeType: params.mimeType,
        fileName: params.label,
      })
    : {
        url: normalizedUrl,
        thumbUrl: null,
        mimeType: params.mimeType ?? inferMimeFromUrl(normalizedUrl, params.kind),
        width: params.width ?? null,
        height: params.height ?? null,
        sizeBytes: params.sizeBytes ?? null,
      };
  if (!resolvedThumbUrl && copied.thumbUrl) {
    resolvedThumbUrl = copied.thumbUrl;
  }
  if (!resolvedThumbUrl && params.kind === 'video') {
    resolvedThumbUrl = await createRemoteVideoAssetThumbnail({
      userId: params.userId,
      url: copied.url,
      fileName: params.label,
    });
  }

  const insert = buildMediaAssetInsert({
    userId: params.userId,
    kind: params.kind,
    url: copied.url,
    thumbUrl: resolvedThumbUrl,
    previewUrl: resolvedPreviewUrl,
    mimeType: copied.mimeType,
    width: copied.width ?? params.width ?? null,
    height: copied.height ?? params.height ?? null,
    sizeBytes: copied.sizeBytes ?? params.sizeBytes ?? null,
    source,
    sourceJobId: params.sourceJobId ?? null,
    sourceOutputId: params.sourceOutputId ?? null,
    metadata: {
      originUrl: normalizedUrl,
      label: params.label ?? null,
      jobId: params.sourceJobId ?? null,
      sourceOutputId: params.sourceOutputId ?? null,
      thumbUrl: resolvedThumbUrl,
      previewUrl: resolvedPreviewUrl,
    },
  });
  insert.id = identity;

  const rows = await query<DbMediaAssetRow>(
    `INSERT INTO media_assets (
       id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes, source,
       source_job_id, source_output_id, status, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
     ON CONFLICT (id)
     DO UPDATE SET
       deleted_at = NULL,
       url = EXCLUDED.url,
       thumb_url = COALESCE(EXCLUDED.thumb_url, media_assets.thumb_url),
       preview_url = COALESCE(EXCLUDED.preview_url, media_assets.preview_url),
       mime_type = EXCLUDED.mime_type,
       width = EXCLUDED.width,
       height = EXCLUDED.height,
       size_bytes = EXCLUDED.size_bytes,
       source = EXCLUDED.source,
       source_job_id = EXCLUDED.source_job_id,
       source_output_id = EXCLUDED.source_output_id,
       status = EXCLUDED.status,
       metadata = COALESCE(media_assets.metadata, '{}'::jsonb) || EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING id, user_id, kind, url, thumb_url, preview_url, mime_type, width, height, size_bytes, source,
               source_job_id, source_output_id, status, metadata, created_at`,
    [
      insert.id,
      insert.userId,
      insert.kind,
      insert.url,
      insert.thumbUrl,
      insert.previewUrl,
      insert.mimeType,
      insert.width,
      insert.height,
      insert.sizeBytes,
      insert.source,
      insert.sourceJobId,
      insert.sourceOutputId,
      insert.status,
      JSON.stringify(insert.metadata),
    ]
  );

  await recordUserAsset({
    assetId: rows[0]?.id ?? randomUUID(),
    userId: params.userId,
    url: rows[0]?.url ?? insert.url,
    mime: rows[0]?.mime_type ?? insert.mimeType ?? inferMimeFromUrl(insert.url, insert.kind),
    width: rows[0]?.width ?? insert.width,
    height: rows[0]?.height ?? insert.height,
    size: rows[0]?.size_bytes == null ? insert.sizeBytes : Number(rows[0].size_bytes),
    source: insert.source === 'saved_job_output' ? 'generated' : insert.source,
    metadata: insert.metadata,
  }).catch((error) => {
    console.warn('[media-library] failed to mirror media asset into user_assets', error);
  });

  return mapAssetRow(rows[0]);
}

export async function saveJobOutputToLibrary(params: {
  userId: string;
  jobId: string;
  outputId: string;
}): Promise<MediaAssetRecord> {
  await ensureMediaLibrarySchema();
  const rows = await query<DbJobOutputRow>(
    `SELECT id, job_id, user_id, kind, url, storage_url, thumb_url, preview_url, mime_type, width, height,
            duration_sec, position, status, metadata, created_at
       FROM job_outputs
      WHERE id = $1 AND job_id = $2 AND user_id = $3
      LIMIT 1`,
    [params.outputId, params.jobId, params.userId]
  );
  if (!rows[0]) throw new Error('OUTPUT_NOT_FOUND');
  const output = mapOutputRow(rows[0]);
  return ensureReusableAsset({
    userId: params.userId,
    url: output.url,
    kind: output.kind,
    source: 'saved_job_output',
    sourceJobId: output.jobId,
    sourceOutputId: output.id,
    mimeType: output.mimeType,
    width: output.width,
    height: output.height,
    thumbUrl: output.thumbUrl,
    previewUrl: output.previewUrl,
  });
}

export async function deleteLibraryAsset(params: { userId: string; assetId: string }): Promise<'deleted' | 'not_found'> {
  await ensureMediaLibrarySchema();
  const rows = await query<{ id: string }>(
    `UPDATE media_assets
        SET deleted_at = NOW(), updated_at = NOW(), status = 'deleted'
      WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL
      RETURNING id`,
    [params.assetId, params.userId]
  );
  if (!rows.length) return 'not_found';
  return 'deleted';
}
