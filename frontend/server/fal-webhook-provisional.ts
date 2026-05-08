import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { extractMediaUrls, findFirstString, inferEngineFromPayload, normalizeStatus, type FalWebhookPayload, type WebhookIdentifiers } from './fal-webhook-mapping';
import type { AppJobRow } from './fal-webhook-types';

export async function createProvisionalJobFromWebhook(params: {
  requestId: string;
  payload: FalWebhookPayload;
  identifiers: WebhookIdentifiers;
}): Promise<AppJobRow | null> {
  const placeholderThumb = '/assets/frames/thumb-16x9.svg';
  const jobId =
    (params.identifiers.jobId && params.identifiers.jobId.trim().length
      ? params.identifiers.jobId.trim()
      : null) ??
    (params.requestId.startsWith('job_') ? params.requestId : `job_${params.requestId}`);

  let engineId = findFirstString(params.payload, ['engine_id', 'engineId', 'model']) ?? 'fal-unknown';
  let engineLabel = findFirstString(params.payload, ['engine_label', 'engineLabel']) ?? engineId;
  if (!engineId || engineId === 'fal-unknown') {
    const inferred = await inferEngineFromPayload(params.payload);
    engineId = inferred.engineId;
    if (!engineLabel || engineLabel === 'fal-unknown' || engineLabel === engineId) {
      engineLabel = inferred.engineLabel ?? engineId;
    }
  }
  if (!engineId || engineId === 'fal-unknown') {
    console.warn('[fal-webhook] provisional job has unknown engine', {
      requestId: params.requestId,
      fallbackModel: findFirstString(params.payload, ['model', 'model_slug', 'modelId', 'model_id']),
      provider: findFirstString(params.payload, ['provider']),
    });
  }
  const prompt =
    findFirstString(params.payload, ['prompt', 'description', 'text']) ?? '[webhook recovery]';
  const aspectRatio = findFirstString(params.payload, ['aspect_ratio', 'aspectRatio']) ?? null;
  const durationString = findFirstString(params.payload, ['duration', 'duration_seconds', 'durationSec']);
  const parsedDuration = durationString ? Number.parseInt(durationString, 10) : 0;
  const normalizedDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 0;
  const media = extractMediaUrls(params.payload.result ?? params.payload.response ?? params.payload.data ?? null);
  const normalizedVideoUrl = media.videoUrl ? normalizeMediaUrl(media.videoUrl) : null;
  const normalizedThumbUrl = media.thumbUrl ? normalizeMediaUrl(media.thumbUrl) : null;
  const statusInfo = normalizeStatus(params.payload.status, 'queued', 0);

  const inserted = await query<AppJobRow>(
    `INSERT INTO app_jobs (
       job_id,
       user_id,
       engine_id,
       engine_label,
       duration_sec,
       prompt,
       thumb_url,
       aspect_ratio,
       preview_frame,
       provider_job_id,
       status,
       progress,
       visibility,
       indexable,
       provisional,
       has_audio,
       video_url
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
     )
     ON CONFLICT (job_id) DO UPDATE
       SET provider_job_id = COALESCE(EXCLUDED.provider_job_id, app_jobs.provider_job_id),
           thumb_url = COALESCE(EXCLUDED.thumb_url, app_jobs.thumb_url),
           preview_frame = COALESCE(EXCLUDED.preview_frame, app_jobs.preview_frame),
           video_url = COALESCE(EXCLUDED.video_url, app_jobs.video_url),
           status = EXCLUDED.status,
           progress = EXCLUDED.progress,
           updated_at = NOW()
     RETURNING job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id`,
    [
      jobId,
      null,
      engineId,
      engineLabel || engineId,
      normalizedDuration,
      prompt,
      normalizedThumbUrl ?? placeholderThumb,
      aspectRatio,
      normalizedThumbUrl ?? placeholderThumb,
      params.requestId,
      statusInfo.status,
      statusInfo.progress,
      'private',
      false,
      true,
      false,
      normalizedVideoUrl,
    ]
  );

  return inserted[0] ?? null;
}
