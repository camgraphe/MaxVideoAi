import { query } from '@/lib/db';
import { buildStoredImageRenderEntries } from '@/lib/image-renders';
import { ensureMediaLibrarySchema } from '@/lib/schema';
import {
  mapLegacyJobRowToOutputs,
  mapOutputRow,
  type DbJobOutputRow,
  type JobOutputRecord,
  type LegacyJobMediaRow,
} from '../media-library-records';

export async function upsertJobOutputs(outputs: JobOutputRecord[]): Promise<void> {
  if (!outputs.length) return;
  await ensureMediaLibrarySchema();
  for (const output of outputs) {
    await query(
      `INSERT INTO job_outputs (
         id, job_id, user_id, kind, url, storage_url, thumb_url, preview_url, mime_type, width, height,
         duration_sec, position, status, metadata
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
       ON CONFLICT (job_id, kind, position)
       DO UPDATE SET
         url = EXCLUDED.url,
         storage_url = EXCLUDED.storage_url,
         thumb_url = EXCLUDED.thumb_url,
         preview_url = COALESCE(EXCLUDED.preview_url, job_outputs.preview_url),
         mime_type = EXCLUDED.mime_type,
         width = COALESCE(EXCLUDED.width, job_outputs.width),
         height = COALESCE(EXCLUDED.height, job_outputs.height),
         duration_sec = COALESCE(EXCLUDED.duration_sec, job_outputs.duration_sec),
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
        output.previewUrl,
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
    `SELECT id, job_id, user_id, kind, url, storage_url, thumb_url, preview_url, mime_type, width, height,
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
  previewVideoUrl?: string | null;
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
    previewVideoUrl: firstVideo?.previewUrl ?? job.previewVideoUrl,
    audioUrl: firstAudio?.url ?? job.audioUrl,
    thumbUrl: firstVideo?.thumbUrl ?? images[0]?.thumbUrl ?? job.thumbUrl,
    renderIds: images.length ? images.map((output) => output.url) : job.renderIds,
    renderThumbUrls: renderEntries.length ? renderEntries.map((entry) => entry.thumb_url) : job.renderThumbUrls,
  };
}

export async function listRecentOutputs(params: {
  userId: string;
  kind?: import('../media-library-records').MediaKind | null;
  surface?: string | null;
  limit?: number;
}): Promise<JobOutputRecord[]> {
  await ensureMediaLibrarySchema();
  const limit = Math.min(200, Math.max(1, params.limit ?? 50));
  const rows = await query<DbJobOutputRow>(
    `SELECT o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.preview_url, o.mime_type,
            o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at,
            saved.id AS saved_asset_id,
            j.prompt AS job_prompt,
            j.duration_sec AS job_duration_sec,
            j.aspect_ratio AS job_aspect_ratio
       FROM job_outputs o
       JOIN app_jobs j ON j.job_id = o.job_id
       LEFT JOIN media_assets saved
         ON saved.user_id = $1
        AND saved.source_output_id = o.id
        AND saved.deleted_at IS NULL
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
