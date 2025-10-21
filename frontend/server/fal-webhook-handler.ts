import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { sendRenderCompletedEmail } from '@/lib/email';
import { getUserIdentity } from '@/server/supabase-admin';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';

type FalWebhookPayload = {
  request_id?: string;
  requestId?: string;
  status?: string;
  response?: unknown;
  data?: unknown;
  result?: unknown;
  error?: unknown;
};

type AppJobRow = {
  job_id: string;
  user_id: string | null;
  engine_id: string;
  engine_label: string | null;
  duration_sec: number | null;
  status: string;
  progress: number;
  video_url: string | null;
  thumb_url: string | null;
  aspect_ratio: string | null;
  preview_frame: string | null;
  message: string | null;
};

const COMPLETED_STATUSES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'ABORTED']);
const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'PROCESSING']);
const QUEUED_STATUSES = new Set(['QUEUED', 'IN_QUEUE', 'PENDING']);

function extractMediaUrls(payload: unknown): { videoUrl?: string | null; thumbUrl?: string | null } {
  if (!payload || typeof payload !== 'object') return {};

  const candidates: Array<any> = [];

  const pushCandidate = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushCandidate(entry));
    } else {
      candidates.push(value);
    }
  };

  const container = payload as Record<string, unknown>;
  pushCandidate(container.video);
  pushCandidate(container.videos);
  pushCandidate(container.assets);
  pushCandidate(container.response);
  pushCandidate(container.output);
  pushCandidate(container.result);

  const flatten = candidates.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return candidate;
    const record = candidate as Record<string, unknown>;
    const nested: unknown[] = [];
    if (record.video) nested.push(record.video);
    if (record.videos) nested.push(record.videos);
    if (record.assets) nested.push(record.assets);
    if (record.response) nested.push(record.response);
    if (record.output) nested.push(record.output);
    return [candidate, ...nested];
  });

  let videoUrl: string | null | undefined;
  let thumbUrl: string | null | undefined;

  for (const candidate of flatten) {
    if (typeof candidate === 'string' && !videoUrl) {
      videoUrl = candidate;
      continue;
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      if (!videoUrl) {
        videoUrl =
          (typeof record.url === 'string' && record.url) ||
          (typeof record.video_url === 'string' && record.video_url) ||
          (typeof record.path === 'string' && record.path) ||
          null;
      }
      if (!thumbUrl) {
        thumbUrl =
          (typeof record.thumbnail === 'string' && record.thumbnail) ||
          (typeof record.thumb_url === 'string' && record.thumb_url) ||
          (typeof record.poster === 'string' && record.poster) ||
          (typeof record.preview === 'string' && record.preview) ||
          null;
      }
    }
    if (videoUrl && thumbUrl) break;
  }

  return { videoUrl, thumbUrl };
}

function normalizeStatus(
  status: string | undefined,
  previousStatus: string,
  previousProgress: number
): { status: string; progress: number } {
  if (!status) {
    return { status: previousStatus, progress: previousProgress };
  }
  const normalized = status.toUpperCase();
  if (COMPLETED_STATUSES.has(normalized)) {
    return { status: 'completed', progress: 100 };
  }
  if (FAILED_STATUSES.has(normalized)) {
    return { status: 'failed', progress: previousProgress };
  }
  if (RUNNING_STATUSES.has(normalized)) {
    return {
      status: 'running',
      progress: Math.max(previousProgress, 25),
    };
  }
  if (QUEUED_STATUSES.has(normalized)) {
    return { status: 'queued', progress: Math.max(previousProgress, 5) };
  }
  return { status: previousStatus, progress: previousProgress };
}

export async function updateJobFromFalWebhook(rawPayload: unknown): Promise<void> {
  const payload = (rawPayload ?? {}) as FalWebhookPayload;
  const requestId = payload.request_id ?? payload.requestId;
  if (!requestId) {
    throw new Error('Missing request_id in webhook payload');
  }

  const jobRows = await query<AppJobRow>(
    `SELECT job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message
     FROM app_jobs
     WHERE provider_job_id = $1
     LIMIT 1`,
    [requestId]
  );

  if (!jobRows.length) {
    throw new Error(`No job found for provider_job_id=${requestId}`);
  }

  const job = jobRows[0];

  let finalPayload = payload.result ?? payload.response ?? payload.data ?? null;
  const statusInfo = normalizeStatus(payload.status, job.status, job.progress);

  if (!finalPayload || statusInfo.status === 'completed') {
    try {
      const falModel = (await resolveFalModelId(job.engine_id)) ?? job.engine_id;
      const falClient = getFalClient();
      const queueResult = await falClient.queue.result(falModel, { requestId });
      finalPayload = queueResult?.data ?? finalPayload ?? queueResult ?? null;
    } catch (error) {
      if (statusInfo.status === 'completed') {
        console.warn('[fal-webhook] Failed to fetch final result', error);
      }
    }
  }

  const media = extractMediaUrls(finalPayload);
  const nextVideoUrl = media.videoUrl ? normalizeMediaUrl(media.videoUrl) : null;
  const nextThumbUrl = media.thumbUrl ? normalizeMediaUrl(media.thumbUrl) : null;
  const nextMessage =
    typeof payload.error === 'string'
      ? payload.error
      : statusInfo.status === 'failed'
        ? payload.error
        : null;

  const rawVideoSource = media.videoUrl ?? job.video_url;
  let resolvedThumbUrl = nextThumbUrl ?? job.thumb_url;
  if (
    rawVideoSource &&
    typeof rawVideoSource === 'string' &&
    /^https?:\/\//i.test(rawVideoSource) &&
    isPlaceholderThumbnail(resolvedThumbUrl)
  ) {
    const generatedThumb = await ensureJobThumbnail({
      jobId: job.job_id,
      userId: job.user_id ?? undefined,
      videoUrl: rawVideoSource,
      aspectRatio: job.aspect_ratio ?? undefined,
      existingThumbUrl: resolvedThumbUrl ?? undefined,
    });
    if (generatedThumb) {
      resolvedThumbUrl = generatedThumb;
    }
  }

  const finalVideoUrl = nextVideoUrl ?? job.video_url;
  const finalThumbUrl = resolvedThumbUrl ?? job.thumb_url;
  const finalPreviewFrame = finalThumbUrl ?? job.preview_frame;

  await query(
    `UPDATE app_jobs
     SET status = $2,
         progress = $3,
         video_url = COALESCE($4, video_url),
         thumb_url = COALESCE($5, thumb_url),
         preview_frame = COALESCE($6, preview_frame),
         message = COALESCE($7, message),
         updated_at = NOW()
     WHERE job_id = $1`,
    [
      job.job_id,
      statusInfo.status,
      statusInfo.progress,
      finalVideoUrl ?? job.video_url,
      finalThumbUrl ?? job.thumb_url,
      finalPreviewFrame ?? job.preview_frame,
      nextMessage ?? job.message,
    ]
  );

  const wasCompleted = job.status === 'completed';
  const isCompleted = statusInfo.status === 'completed';
  if (isCompleted && !wasCompleted && job.user_id) {
    void notifyRenderCompletion(job, finalVideoUrl, finalThumbUrl).catch((error) => {
      console.error('[fal-webhook] Failed to send completion email', error);
    });
  }
}

async function notifyRenderCompletion(job: AppJobRow, videoUrl: string | null, thumbUrl: string | null) {
  const identity = await getUserIdentity(job.user_id!);
  if (!identity?.email) return;
  await sendRenderCompletedEmail({
    to: identity.email,
    jobId: job.job_id,
    engineLabel: job.engine_label ?? undefined,
    durationSec: job.duration_sec ?? undefined,
    videoUrl: videoUrl ?? undefined,
    thumbnailUrl: thumbUrl ?? undefined,
    recipientName: identity.fullName,
  });
}
