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
import { promoteCompletedMcpJobOutputs } from './mcp-output-assets';
import {
  buildMediaLibrarySearchPattern,
  decodeMediaLibraryCursor,
  resolveMediaLibraryLimit,
  sliceMediaLibraryPage,
  type MediaLibraryPage,
} from './pagination';

export async function upsertJobOutputs(outputs: JobOutputRecord[]): Promise<void> {
  if (!outputs.length) return;
  await ensureMediaLibrarySchema();
  for (const output of outputs) {
    const persisted = await query<{ id: string }>(
      `INSERT INTO job_outputs (
         id, job_id, user_id, kind, url, storage_url, thumb_url, preview_url, mime_type, width, height,
         duration_sec, position, status, metadata
       )
       SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb
        WHERE EXISTS (
          SELECT 1
            FROM app_jobs
           WHERE job_id = $2
             AND user_id IS NOT DISTINCT FROM $3
        )
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
         updated_at = NOW()
       WHERE job_outputs.user_id IS NOT DISTINCT FROM EXCLUDED.user_id
       RETURNING id`,
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
    if (persisted.length !== 1) {
      throw new Error('Job output ownership does not match the owning job.');
    }
  }
}

export async function upsertLegacyJobOutputs(row: LegacyJobMediaRow): Promise<void> {
  const outputs = mapLegacyJobRowToOutputs(row);
  await upsertJobOutputs(outputs);
  await promoteCompletedMcpJobOutputs(outputs).catch((error) => {
    console.warn('[media-library] failed to promote completed MCP job outputs', {
      jobId: row.job_id,
      error,
    });
  });
}

export async function listJobOutputsByJobIds(
  jobIds: string[],
  options: { ensureSchema?: boolean } = {}
): Promise<Map<string, JobOutputRecord[]>> {
  const ids = Array.from(new Set(jobIds.filter(Boolean)));
  const map = new Map<string, JobOutputRecord[]>();
  if (!ids.length) return map;
  if (options.ensureSchema !== false) await ensureMediaLibrarySchema();
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
  const requestedLimit = Math.min(200, Math.max(1, params.limit ?? 50));
  const items: JobOutputRecord[] = [];
  let cursor: string | null = null;
  do {
    const page = await listRecentOutputPage({
      ...params,
      limit: Math.min(100, requestedLimit - items.length),
      cursor,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < requestedLimit);
  return items.slice(0, requestedLimit);
}

export async function listRecentOutputPage(params: {
  userId: string;
  kind?: import('../media-library-records').MediaKind | null;
  surface?: string | null;
  limit?: number;
  cursor?: string | null;
  q?: string | null;
  jobId?: string | null;
}): Promise<MediaLibraryPage<JobOutputRecord>> {
  await ensureMediaLibrarySchema();
  const limit = resolveMediaLibraryLimit(params.limit);
  const cursor = decodeMediaLibraryCursor(params.cursor);
  const searchPattern = buildMediaLibrarySearchPattern(params.q);
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
        AND ($4::text IS NULL OR $4::text <> 'storyboard' OR o.job_id NOT LIKE 'storyboard_kling_first_frame_%')
        AND ($5::text IS NULL OR o.job_id = $5::text)
        AND (
          $6::text IS NULL
          OR COALESCE(j.prompt, '') ILIKE $6::text ESCAPE '\\'
          OR o.job_id ILIKE $6::text ESCAPE '\\'
          OR COALESCE(o.metadata->>'label', '') ILIKE $6::text ESCAPE '\\'
          OR COALESCE(o.metadata->>'fileName', o.metadata->>'filename', '') ILIKE $6::text ESCAPE '\\'
        )
        AND (
          $7::timestamptz IS NULL
          OR (o.created_at, o.id) < ($7::timestamptz, $8::text)
        )
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $2`,
    [
      params.userId,
      limit + 1,
      params.kind ?? null,
      params.surface ?? null,
      params.jobId ?? null,
      searchPattern,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
    ]
  );
  return sliceMediaLibraryPage(rows.map(mapOutputRow), limit);
}

export async function listStoryboardKlingFirstFrameOutputs(params: {
  userId: string;
  parentJobIds: string[];
}): Promise<Map<string, JobOutputRecord>> {
  await ensureMediaLibrarySchema();
  const parentJobIds = Array.from(
    new Set(
      params.parentJobIds.filter(
        (jobId) => jobId.startsWith('storyboard_') && !jobId.startsWith('storyboard_kling_first_frame_')
      )
    )
  );
  const outputs = new Map<string, JobOutputRecord>();
  if (!parentJobIds.length) return outputs;

  const rows = await query<DbJobOutputRow & { parent_job_id: string }>(
    `SELECT parent.job_id AS parent_job_id,
            o.id, o.job_id, o.user_id, o.kind, o.url, o.storage_url, o.thumb_url, o.preview_url, o.mime_type,
            o.width, o.height, o.duration_sec, o.position, o.status, o.metadata, o.created_at,
            NULL::text AS saved_asset_id,
            child.prompt AS job_prompt,
            child.duration_sec AS job_duration_sec,
            child.aspect_ratio AS job_aspect_ratio
       FROM app_jobs parent
       JOIN LATERAL (
         SELECT child.*
           FROM app_jobs child
          WHERE child.user_id = parent.user_id
            AND child.job_id LIKE 'storyboard_kling_first_frame_%'
            AND child.status = 'completed'
            AND (
              child.settings_snapshot->'storyboard'->>'parentJobId' = parent.job_id
              OR (
                child.settings_snapshot->'storyboard'->>'parentJobId' IS NULL
                AND child.created_at >= parent.created_at
                AND child.created_at <= parent.created_at + INTERVAL '20 minutes'
                AND NOT EXISTS (
                  SELECT 1
                    FROM app_jobs next_parent
                   WHERE next_parent.user_id = parent.user_id
                     AND next_parent.job_id = ANY($2::text[])
                     AND next_parent.job_id <> parent.job_id
                     AND next_parent.job_id NOT LIKE 'storyboard_kling_first_frame_%'
                     AND next_parent.created_at > parent.created_at
                     AND next_parent.created_at < child.created_at
                )
              )
            )
          ORDER BY
            CASE WHEN child.settings_snapshot->'storyboard'->>'parentJobId' = parent.job_id THEN 0 ELSE 1 END,
            child.created_at ASC
          LIMIT 1
       ) child ON TRUE
       JOIN job_outputs o
         ON o.job_id = child.job_id
        AND o.kind = 'image'
        AND o.status = 'ready'
      WHERE parent.user_id = $1
        AND parent.job_id = ANY($2::text[])`,
    [params.userId, parentJobIds]
  );

  rows.forEach((row) => {
    outputs.set(row.parent_job_id, mapOutputRow(row));
  });
  return outputs;
}
