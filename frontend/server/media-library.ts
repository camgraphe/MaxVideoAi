import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { buildStoredImageRenderEntries, parseStoredImageRenders } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';
import { recordUserAsset, uploadFileBuffer, uploadImageToStorage } from '@/server/storage';

export type MediaKind = 'image' | 'video' | 'audio';
export type MediaAssetSource = 'upload' | 'saved_job_output' | 'character' | 'angle' | 'upscale' | 'import';

export type LegacyJobMediaRow = {
  job_id: string;
  user_id?: string | null;
  surface?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  thumb_url?: string | null;
  preview_frame?: string | null;
  render_ids?: unknown;
  duration_sec?: number | null;
  status?: string | null;
};

export type JobOutputRecord = {
  id: string;
  jobId: string;
  userId: string | null;
  kind: MediaKind;
  url: string;
  storageUrl: string | null;
  thumbUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  position: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type MediaAssetRecord = {
  id: string;
  userId: string | null;
  kind: MediaKind;
  url: string;
  thumbUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  source: MediaAssetSource;
  sourceJobId: string | null;
  sourceOutputId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type MediaAssetInsert = {
  id: string;
  userId: string;
  kind: MediaKind;
  url: string;
  thumbUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  source: MediaAssetSource;
  sourceJobId: string | null;
  sourceOutputId: string | null;
  status: 'ready';
  metadata: Record<string, unknown>;
};

type DbJobOutputRow = {
  id: string;
  job_id: string;
  user_id: string | null;
  kind: MediaKind;
  url: string;
  storage_url: string | null;
  thumb_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  position: number;
  status: string;
  metadata: unknown;
  created_at: string;
};

type DbMediaAssetRow = {
  id: string;
  user_id: string | null;
  kind: MediaKind;
  url: string;
  thumb_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  size_bytes: string | number | null;
  source: MediaAssetSource | string | null;
  source_job_id: string | null;
  source_output_id: string | null;
  status: string | null;
  metadata: unknown;
  created_at: string;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeMediaUrl(trimmed) ?? trimmed;
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function inferMimeFromUrl(url: string, kind: MediaKind, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const clean = url.split('?')[0]?.toLowerCase() ?? '';
  if (kind === 'video') {
    if (clean.endsWith('.webm')) return 'video/webm';
    if (clean.endsWith('.mov')) return 'video/quicktime';
    return 'video/mp4';
  }
  if (kind === 'audio') {
    if (clean.endsWith('.wav')) return 'audio/wav';
    if (clean.endsWith('.ogg')) return 'audio/ogg';
    if (clean.endsWith('.m4a')) return 'audio/mp4';
    return 'audio/mpeg';
  }
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function outputId(jobId: string, kind: MediaKind, position: number): string {
  return `${jobId}:${kind}:${position}`;
}

export function normalizeMediaAssetSource(value: unknown): MediaAssetSource {
  if (typeof value !== 'string') return 'import';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'upload' || normalized === 'character' || normalized === 'angle' || normalized === 'upscale') {
    return normalized;
  }
  if (normalized === 'generated' || normalized === 'job_output' || normalized === 'saved_job_output') {
    return 'saved_job_output';
  }
  return 'import';
}

export function mapLegacyJobRowToOutputs(row: LegacyJobMediaRow): JobOutputRecord[] {
  const jobId = row.job_id;
  const userId = row.user_id ?? null;
  const status = row.status === 'failed' ? 'failed' : 'ready';
  const outputs: JobOutputRecord[] = [];
  const thumbUrl = normalizeString(row.thumb_url) ?? normalizeString(row.preview_frame);

  const videoUrl = normalizeString(row.video_url);
  if (videoUrl) {
    outputs.push({
      id: outputId(jobId, 'video', 0),
      jobId,
      userId,
      kind: 'video',
      url: videoUrl,
      storageUrl: null,
      thumbUrl,
      mimeType: inferMimeFromUrl(videoUrl, 'video'),
      width: null,
      height: null,
      durationSec: normalizeInteger(row.duration_sec),
      position: 0,
      status,
      metadata: { legacy: true, surface: row.surface ?? null },
    });
  }

  const audioUrl = normalizeString(row.audio_url);
  if (audioUrl) {
    outputs.push({
      id: outputId(jobId, 'audio', 0),
      jobId,
      userId,
      kind: 'audio',
      url: audioUrl,
      storageUrl: null,
      thumbUrl: null,
      mimeType: inferMimeFromUrl(audioUrl, 'audio'),
      width: null,
      height: null,
      durationSec: normalizeInteger(row.duration_sec),
      position: 0,
      status,
      metadata: { legacy: true, surface: row.surface ?? null },
    });
  }

  parseStoredImageRenders(row.render_ids).entries.forEach((entry, index) => {
    const url = normalizeString(entry.url);
    if (!url) return;
    outputs.push({
      id: outputId(jobId, 'image', index),
      jobId,
      userId,
      kind: 'image',
      url,
      storageUrl: null,
      thumbUrl: normalizeString(entry.thumbUrl) ?? url,
      mimeType: inferMimeFromUrl(url, 'image', entry.mimeType),
      width: normalizeInteger(entry.width),
      height: normalizeInteger(entry.height),
      durationSec: null,
      position: index,
      status,
      metadata: { legacy: true, surface: row.surface ?? null },
    });
  });

  return outputs;
}

export function resolveLibraryAssetIdentity(params: {
  userId: string;
  kind: MediaKind;
  url: string;
  source: MediaAssetSource;
  sourceOutputId?: string | null;
}): string {
  if (params.sourceOutputId) return `output:${params.sourceOutputId}`;
  return `url:${params.userId}:${params.kind}:${params.url}`;
}

export function buildMediaAssetInsert(params: {
  userId: string;
  kind: MediaKind;
  url: string;
  thumbUrl?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  source?: unknown;
  sourceJobId?: string | null;
  sourceOutputId?: string | null;
  metadata?: Record<string, unknown>;
}): MediaAssetInsert {
  const source = normalizeMediaAssetSource(params.source);
  return {
    id: resolveLibraryAssetIdentity({
      userId: params.userId,
      kind: params.kind,
      url: params.url,
      source,
      sourceOutputId: params.sourceOutputId ?? null,
    }),
    userId: params.userId,
    kind: params.kind,
    url: params.url,
    thumbUrl: params.thumbUrl ?? null,
    mimeType: params.mimeType ?? inferMimeFromUrl(params.url, params.kind),
    width: params.width ?? null,
    height: params.height ?? null,
    sizeBytes: params.sizeBytes ?? null,
    source,
    sourceJobId: params.sourceJobId ?? null,
    sourceOutputId: params.sourceOutputId ?? null,
    status: 'ready',
    metadata: params.metadata ?? {},
  };
}

function mapOutputRow(row: DbJobOutputRow): JobOutputRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    kind: row.kind,
    url: row.storage_url ?? row.url,
    storageUrl: row.storage_url,
    thumbUrl: row.thumb_url,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    durationSec: row.duration_sec,
    position: row.position,
    status: row.status,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

function mapAssetRow(row: DbMediaAssetRow): MediaAssetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    url: row.url,
    thumbUrl: row.thumb_url,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    sizeBytes: typeof row.size_bytes === 'string' ? Number(row.size_bytes) : row.size_bytes,
    source: normalizeMediaAssetSource(row.source),
    sourceJobId: row.source_job_id,
    sourceOutputId: row.source_output_id,
    status: row.status ?? 'ready',
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
  };
}

export async function upsertJobOutputs(outputs: JobOutputRecord[]): Promise<void> {
  if (!outputs.length) return;
  await ensureMediaLibrarySchema();
  for (const output of outputs) {
    await query(
      `INSERT INTO job_outputs (
         id, job_id, user_id, kind, url, storage_url, thumb_url, mime_type, width, height,
         duration_sec, position, status, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
       ON CONFLICT (job_id, kind, position)
       DO UPDATE SET
         url = EXCLUDED.url,
         storage_url = EXCLUDED.storage_url,
         thumb_url = EXCLUDED.thumb_url,
         mime_type = EXCLUDED.mime_type,
         width = EXCLUDED.width,
         height = EXCLUDED.height,
         duration_sec = EXCLUDED.duration_sec,
         status = EXCLUDED.status,
         metadata = COALESCE(job_outputs.metadata, '{}'::jsonb) || EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        output.id,
        output.jobId,
        output.userId,
        output.kind,
        output.url,
        output.storageUrl,
        output.thumbUrl,
        output.mimeType,
        output.width,
        output.height,
        output.durationSec,
        output.position,
        output.status,
        JSON.stringify(output.metadata ?? {}),
      ]
    );
  }
}

export async function upsertLegacyJobOutputs(row: LegacyJobMediaRow): Promise<void> {
  await upsertJobOutputs(mapLegacyJobRowToOutputs(row));
}

export async function listJobOutputsByJobIds(jobIds: string[]): Promise<Map<string, JobOutputRecord[]>> {
  const ids = Array.from(new Set(jobIds.filter(Boolean)));
  const map = new Map<string, JobOutputRecord[]>();
  if (!ids.length) return map;
  await ensureMediaLibrarySchema();
  const rows = await query<DbJobOutputRow>(
    `SELECT id, job_id, user_id, kind, url, storage_url, thumb_url, mime_type, width, height,
            duration_sec, position, status, metadata, created_at
       FROM job_outputs
      WHERE job_id = ANY($1::text[])
        AND status <> 'deleted'
      ORDER BY job_id ASC, kind ASC, position ASC`,
    [ids]
  );
  rows.forEach((row) => {
    const output = mapOutputRow(row);
    const existing = map.get(output.jobId) ?? [];
    existing.push(output);
    map.set(output.jobId, existing);
  });
  return map;
}

export function applyOutputsToJobPayload<T extends {
  jobId: string;
  thumbUrl?: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  renderIds?: string[] | null;
  renderThumbUrls?: string[] | null;
}>(job: T, outputs: JobOutputRecord[] | undefined): T {
  if (!outputs?.length) return job;
  const videos = outputs.filter((output) => output.kind === 'video').sort((a, b) => a.position - b.position);
  const audios = outputs.filter((output) => output.kind === 'audio').sort((a, b) => a.position - b.position);
  const images = outputs.filter((output) => output.kind === 'image').sort((a, b) => a.position - b.position);
  const firstVideo = videos[0];
  const firstAudio = audios[0];
  const imageEntries = images.map((output) => ({
    url: output.url,
    thumbUrl: output.thumbUrl ?? output.url,
    width: output.width,
    height: output.height,
    mimeType: output.mimeType,
  }));
  const renderEntries = buildStoredImageRenderEntries(imageEntries);
  return {
    ...job,
    videoUrl: firstVideo?.url ?? job.videoUrl,
    audioUrl: firstAudio?.url ?? job.audioUrl,
    thumbUrl: firstVideo?.thumbUrl ?? images[0]?.thumbUrl ?? job.thumbUrl,
    renderIds: images.length ? images.map((output) => output.url) : job.renderIds,
    renderThumbUrls: renderEntries.length ? renderEntries.map((entry) => entry.thumb_url) : job.renderThumbUrls,
  };
}

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
    `SELECT id, user_id, kind, url, thumb_url, mime_type, width, height, size_bytes, source,
            source_job_id, source_output_id, status, metadata, created_at
       FROM media_assets
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND ($3::text IS NULL OR kind = $3::text)
        AND ($4::text IS NULL OR source = $4::text)
        AND ($5::text IS NULL OR url = $5::text OR metadata->>'originUrl' = $5::text)
      ORDER BY created_at DESC
      LIMIT $2`,
    values
  );
  const assets = rows.map(mapAssetRow);

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
        AND ($3::text IS NULL OR (
          CASE
            WHEN COALESCE(mime_type, '') LIKE 'video/%' THEN 'video'
            WHEN COALESCE(mime_type, '') LIKE 'audio/%' THEN 'audio'
            ELSE 'image'
          END
        ) = $3::text)
        AND ($4::text IS NULL OR (
          CASE
            WHEN source IN ('upload', 'character', 'angle', 'upscale') THEN source
            WHEN source = 'generated' THEN 'saved_job_output'
            ELSE 'import'
          END
        ) = $4::text)
        AND ($5::text IS NULL OR url = $5::text OR metadata->>'originUrl' = $5::text)
      ORDER BY created_at DESC
      LIMIT $2`,
    values
  );

  const seen = new Set(assets.map((asset) => asset.id));
  legacyRows.forEach((row) => {
    if (seen.has(row.asset_id)) return;
    const kind: MediaKind = row.mime_type?.startsWith('video/')
      ? 'video'
      : row.mime_type?.startsWith('audio/')
        ? 'audio'
        : 'image';
    const metadata = normalizeMetadata(row.metadata);
    assets.push({
      id: row.asset_id,
      userId: row.user_id,
      kind,
      url: row.url,
      thumbUrl: typeof metadata.thumbUrl === 'string' ? metadata.thumbUrl : null,
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
    });
    seen.add(row.asset_id);
  });

  return assets
    .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))
    .slice(0, limit);
}

export async function listRecentOutputs(params: {
  userId: string;
  kind?: MediaKind | null;
  surface?: string | null;
  limit?: number;
}): Promise<JobOutputRecord[]> {
  await ensureMediaLibrarySchema();
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const rows = await query<DbJobOutputRow>(
    `SELECT o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.mime_type,
            o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at
       FROM job_outputs o
       JOIN app_jobs j ON j.job_id = o.job_id
      WHERE o.user_id = $1
        AND j.hidden IS NOT TRUE
        AND o.status = 'ready'
        AND ($3::text IS NULL OR o.kind = $3::text)
        AND ($4::text IS NULL OR j.surface = $4::text OR j.settings_snapshot->>'surface' = $4::text)
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [params.userId, limit, params.kind ?? null, params.surface ?? null]
  );
  return rows.map(mapOutputRow);
}

async function copyRemoteMedia(params: {
  userId: string;
  url: string;
  kind: MediaKind;
  mimeType?: string | null;
  fileName?: string | null;
}): Promise<{ url: string; mimeType: string | null; width: number | null; height: number | null; sizeBytes: number | null }> {
  const parsed = new URL(params.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const response = await fetch(parsed.toString(), { signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`FETCH_FAILED:${response.status}`);
  }
  const mimeType = response.headers.get('content-type') ?? params.mimeType ?? inferMimeFromUrl(params.url, params.kind);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error('EMPTY_MEDIA');
  if (params.kind === 'image') {
    const upload = await uploadImageToStorage({
      data: buffer,
      mime: mimeType,
      userId: params.userId,
      prefix: 'media-assets',
      fileName: params.fileName,
    });
    return {
      url: upload.url,
      mimeType: upload.mime,
      width: upload.width,
      height: upload.height,
      sizeBytes: upload.size,
    };
  }
  const upload = await uploadFileBuffer({
    data: buffer,
    mime: mimeType,
    userId: params.userId,
    prefix: 'media-assets',
    fileName: params.fileName,
  });
  return {
    url: upload.url,
    mimeType,
    width: null,
    height: null,
    sizeBytes: buffer.length,
  };
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

  const existing = await query<DbMediaAssetRow>(
    `SELECT id, user_id, kind, url, thumb_url, mime_type, width, height, size_bytes, source,
            source_job_id, source_output_id, status, metadata, created_at
       FROM media_assets
      WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [identity, params.userId]
  );
  if (existing[0]) return mapAssetRow(existing[0]);

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
        mimeType: params.mimeType ?? inferMimeFromUrl(normalizedUrl, params.kind),
        width: params.width ?? null,
        height: params.height ?? null,
        sizeBytes: params.sizeBytes ?? null,
      };

  const insert = buildMediaAssetInsert({
    userId: params.userId,
    kind: params.kind,
    url: copied.url,
    thumbUrl: params.thumbUrl ?? null,
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
    },
  });
  insert.id = identity;

  const rows = await query<DbMediaAssetRow>(
    `INSERT INTO media_assets (
       id, user_id, kind, url, thumb_url, mime_type, width, height, size_bytes, source,
       source_job_id, source_output_id, status, metadata
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     ON CONFLICT (id)
     DO UPDATE SET
       deleted_at = NULL,
       url = EXCLUDED.url,
       thumb_url = EXCLUDED.thumb_url,
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
     RETURNING id, user_id, kind, url, thumb_url, mime_type, width, height, size_bytes, source,
               source_job_id, source_output_id, status, metadata, created_at`,
    [
      insert.id,
      insert.userId,
      insert.kind,
      insert.url,
      insert.thumbUrl,
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
    `SELECT id, job_id, user_id, kind, url, storage_url, thumb_url, mime_type, width, height,
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
