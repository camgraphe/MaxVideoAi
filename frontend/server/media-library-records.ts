import { parseStoredImageRenders } from '@/lib/image-renders';
import { normalizeMediaUrl } from '@/lib/media';

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
  preview_url?: string | null;
  preview_video_url?: string | null;
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
  previewUrl: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  position: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
  savedAssetId?: string | null;
  isSaved?: boolean;
};

export type MediaAssetRecord = {
  id: string;
  userId: string | null;
  kind: MediaKind;
  url: string;
  thumbUrl: string | null;
  previewUrl: string | null;
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
  previewUrl: string | null;
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

export type DbJobOutputRow = {
  id: string;
  job_id: string;
  user_id: string | null;
  kind: MediaKind;
  url: string;
  storage_url: string | null;
  thumb_url: string | null;
  preview_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  position: number;
  status: string;
  metadata: unknown;
  created_at: string;
  saved_asset_id?: string | null;
};

export type DbMediaAssetRow = {
  id: string;
  user_id: string | null;
  kind: MediaKind;
  url: string;
  thumb_url: string | null;
  preview_url: string | null;
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

export function normalizeString(value: unknown): string | null {
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

export function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function inferMimeFromUrl(url: string, kind: MediaKind, fallback?: string | null): string {
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
  const previewUrl = normalizeString(row.preview_url) ?? normalizeString(row.preview_video_url);

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
      previewUrl,
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
      previewUrl: null,
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
      previewUrl: null,
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

export function resolveLibraryAssetDedupeKey(params: {
  id: string;
  userId: string | null;
  kind: MediaKind;
  url: string;
  source?: MediaAssetSource | string | null;
  sourceOutputId?: string | null;
}): string {
  if (params.sourceOutputId) return `output:${params.sourceOutputId}`;
  return `url:${params.userId ?? 'anonymous'}:${params.kind}:${normalizeString(params.url) ?? params.url}`;
}

export function resolveLibraryAssetOriginDedupeKey(params: {
  userId: string | null;
  kind: MediaKind;
  url: string;
  metadata?: unknown;
}): string {
  const metadata = normalizeMetadata(params.metadata);
  const originUrl = normalizeString(metadata.originUrl) ?? normalizeString(params.url) ?? params.url;
  return `origin-url:${params.userId ?? 'anonymous'}:${params.kind}:${originUrl}`;
}

export function buildMediaAssetInsert(params: {
  userId: string;
  kind: MediaKind;
  url: string;
  thumbUrl?: string | null;
  previewUrl?: string | null;
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
    previewUrl: params.previewUrl ?? null,
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

export function mapOutputRow(row: DbJobOutputRow): JobOutputRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    userId: row.user_id,
    kind: row.kind,
    url: row.storage_url ?? row.url,
    storageUrl: row.storage_url,
    thumbUrl: row.thumb_url,
    previewUrl: row.preview_url,
    mimeType: row.mime_type,
    width: row.width,
    height: row.height,
    durationSec: row.duration_sec,
    position: row.position,
    status: row.status,
    metadata: normalizeMetadata(row.metadata),
    createdAt: row.created_at,
    savedAssetId: row.saved_asset_id ?? null,
    isSaved: Boolean(row.saved_asset_id),
  };
}

export function mapAssetRow(row: DbMediaAssetRow): MediaAssetRecord {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    url: row.url,
    thumbUrl: row.thumb_url,
    previewUrl: row.preview_url,
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
