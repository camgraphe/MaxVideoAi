import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { resolveFalModelId, resolveEngineIdFromModelSlug } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { getFalEngineById } from '@/config/falEngines';
import { fetchFalJobMedia } from '@/server/fal-job-sync';
import { detectHasAudioStream } from '@/server/media/detect-has-audio';

function fallbackThumbnail(aspectRatio?: string | null): string {
  const normalized = aspectRatio?.trim().toLowerCase();
  if (normalized === '9:16') return '/assets/frames/thumb-9x16.svg';
  if (normalized === '1:1') return '/assets/frames/thumb-1x1.svg';
  return '/assets/frames/thumb-16x9.svg';
}

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
  has_audio: boolean | null;
  render_ids: unknown;
  hero_render_id: string | null;
};

const COMPLETED_STATUSES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS']);
const FAILED_STATUSES = new Set(['FAILED', 'ERROR', 'CANCELLED', 'CANCELED', 'ABORTED']);
const RUNNING_STATUSES = new Set(['RUNNING', 'IN_PROGRESS', 'PROCESSING']);
const QUEUED_STATUSES = new Set(['QUEUED', 'IN_QUEUE', 'PENDING']);

const PROVIDER_ENGINE_MAP: Record<string, string> = {
  openai: 'sora-2',
  'openai-sora': 'sora-2',
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'openai-sora-2-pro': 'sora-2-pro',
  'sora-pro': 'sora-2-pro',
  sora: 'sora-2',
  pika: 'pika-text-to-video',
  'pika-labs': 'pika-text-to-video',
  'pika-2.2': 'pika-text-to-video',
  'google-veo': 'veo-3-fast',
  google: 'veo-3-fast',
  veo: 'veo-3-fast',
  luma: 'luma-dream-machine',
  'luma-dream-machine': 'luma-dream-machine',
};

type WebhookIdentifiers = {
  jobId?: string | null;
  localKey?: string | null;
};

function extractStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return null;
}

function extractIdentifiersFromPayload(payload: unknown): WebhookIdentifiers {
  const identifiers: WebhookIdentifiers = {};
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length && (!identifiers.jobId || !identifiers.localKey)) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    if (!identifiers.jobId) {
      const candidate = extractStringField(record, ['app_job_id', 'job_id', 'jobId', 'id']);
      if (candidate && candidate.startsWith('job_')) {
        identifiers.jobId = candidate;
      } else if (!identifiers.jobId && record === current) {
        const requestIdCandidate = extractStringField(record, ['request_id']);
        if (requestIdCandidate && requestIdCandidate.startsWith('job_')) {
          identifiers.jobId = requestIdCandidate;
        }
      }
    }
    if (!identifiers.localKey) {
      const candidate = extractStringField(record, ['app_local_key', 'local_key', 'localKey']);
      if (candidate) {
        identifiers.localKey = candidate;
      }
    }

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return identifiers;
}

async function inferEngineFromPayload(
  payload: FalWebhookPayload
): Promise<{ engineId: string; engineLabel: string | null }> {
  const modelSlug =
    findFirstString(payload, ['model', 'model_slug', 'modelId', 'model_id', 'fal_model_id', 'falModelId', 'endpoint']) ??
    null;
  if (modelSlug) {
    const engineId = (await resolveEngineIdFromModelSlug(modelSlug)) ?? null;
    if (engineId) {
      const engine = getFalEngineById(engineId);
      const engineLabel =
        engine?.marketingName ??
        (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
        engineId;
      return { engineId, engineLabel };
    }
  }

  const provider = findFirstString(payload, ['provider', 'vendor', 'source'])?.toLowerCase() ?? null;
  if (provider && PROVIDER_ENGINE_MAP[provider]) {
    const engineId = PROVIDER_ENGINE_MAP[provider];
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  const requestEngine = findFirstString(payload, ['engine_id', 'engineId', 'engine']) ?? null;
  if (requestEngine && requestEngine !== 'fal-unknown') {
    const normalized = requestEngine.trim();
    const engineId =
      PROVIDER_ENGINE_MAP[normalized.toLowerCase()] ??
      (await resolveEngineIdFromModelSlug(normalized)) ??
      normalized;
    const engine = getFalEngineById(engineId);
    const engineLabel =
      engine?.marketingName ??
      (typeof (engine as { label?: string } | undefined)?.label === 'string' ? (engine as { label?: string }).label : null) ??
      engineId;
    return { engineId, engineLabel };
  }

  return { engineId: 'fal-unknown', engineLabel: null };
}

function findFirstString(payload: unknown, keys: string[]): string | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    const candidate = extractStringField(record, keys);
    if (candidate) return candidate;

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return null;
}

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

function normalizeRenderIdList(value: unknown): string[] {
  const collect = (entries: unknown[]): string[] =>
    entries
      .map((entry) => {
        if (typeof entry === 'string' && entry.trim().length) {
          return normalizeMediaUrl(entry) ?? entry;
        }
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          if (typeof record.url === 'string' && record.url.trim().length) {
            return normalizeMediaUrl(record.url) ?? record.url;
          }
        }
        return null;
      })
      .filter((entry): entry is string => Boolean(entry));

  if (Array.isArray(value)) {
    return collect(value);
  }
  if (typeof value === 'string' && value.trim().length) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return collect(parsed);
      }
    } catch {
      return [];
    }
  }
  return [];
}

function extractImageUrlsFromPayload(payload: unknown): string[] {
  if (!payload) return [];
  const urls = new Set<string>();
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (typeof current === 'string') {
      if (/^https?:\/\//i.test(current)) {
        urls.add(normalizeMediaUrl(current) ?? current);
      }
      continue;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    if (typeof current === 'object') {
      const record = current as Record<string, unknown>;
      if (Array.isArray(record.images)) {
        record.images.forEach((entry) => stack.push(entry));
      }
      const directUrl =
        (typeof record.url === 'string' && record.url.trim().length ? record.url : null) ||
        (typeof record.image_url === 'string' && record.image_url.trim().length ? record.image_url : null) ||
        (typeof record.thumbnail === 'string' && record.thumbnail.trim().length ? record.thumbnail : null);
      if (directUrl) {
        urls.add(normalizeMediaUrl(directUrl) ?? directUrl);
      }
      for (const value of Object.values(record)) {
        if (value && (typeof value === 'object' || typeof value === 'string')) {
          stack.push(value);
        }
      }
    }
  }

  return Array.from(urls);
}

const ERROR_MESSAGE_KEYS = [
  'error_message',
  'errorMessage',
  'message',
  'detail',
  'error',
  'reason',
  'status_message',
  'statusMessage',
  'status_reason',
  'statusReason',
  'status_detail',
  'statusDetail',
  'status_description',
  'statusDescription',
  'description',
  'failure',
  'failureReason',
  'cause',
];

function normalizeErrorText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) return null;
    if (/^(error|failed|null|undefined)$/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Error) {
    return normalizeErrorText(value.message);
  }
  return null;
}

function findFirstErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return normalizeErrorText(payload);
  }

  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      const text = normalizeErrorText(current);
      if (text) return text;
      continue;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    for (const key of ERROR_MESSAGE_KEYS) {
      if (key in record) {
        const candidate = normalizeErrorText(record[key]);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      } else {
        const text = normalizeErrorText(value);
        if (text) return text;
      }
    }
  }

  return null;
}

function extractFalErrorMessage(payload: FalWebhookPayload, additionalContext?: unknown): string | null {
  const direct = normalizeErrorText(payload.error);
  if (direct) return direct;

  const nestedSources: unknown[] = [];
  if (payload.error && typeof payload.error === 'object') {
    nestedSources.push(payload.error);
  }
  if (payload.result) nestedSources.push(payload.result);
  if (payload.response) nestedSources.push(payload.response);
  if (payload.data) nestedSources.push(payload.data);
  if (additionalContext && typeof additionalContext === 'object') {
    nestedSources.push(additionalContext);
  }

  for (const source of nestedSources) {
    const candidate = findFirstErrorMessage(source);
    if (candidate) return candidate;
  }

  const fallback = findFirstErrorMessage(payload);
  if (fallback) return fallback;

  return null;
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

async function createProvisionalJobFromWebhook(params: {
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
     RETURNING job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id`,
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

export async function updateJobFromFalWebhook(rawPayload: unknown): Promise<void> {
  const payload = (rawPayload ?? {}) as FalWebhookPayload;
  const requestId = payload.request_id ?? payload.requestId;
  if (!requestId) {
    throw new Error('Missing request_id in webhook payload');
  }

  const identifiers = extractIdentifiersFromPayload(payload);

  let jobRows = await query<AppJobRow>(
    `SELECT job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id
     FROM app_jobs
     WHERE provider_job_id = $1
     LIMIT 1`,
    [requestId]
  );

  if (!jobRows.length && identifiers.jobId) {
    jobRows = await query<AppJobRow>(
      `SELECT job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id
       FROM app_jobs
       WHERE job_id = $1
       LIMIT 1`,
      [identifiers.jobId]
    );
  }

  if (!jobRows.length && identifiers.localKey) {
    jobRows = await query<AppJobRow>(
      `SELECT job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id
       FROM app_jobs
       WHERE local_key = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [identifiers.localKey]
    );
  }

  if (!jobRows.length) {
    const logRows = await query<{ job_id: string }>(
      `SELECT job_id
       FROM fal_queue_log
       WHERE provider_job_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [requestId]
    );
    if (logRows.length) {
      jobRows = await query<AppJobRow>(
        `SELECT job_id, user_id, engine_id, engine_label, duration_sec, status, progress, video_url, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id
         FROM app_jobs
         WHERE job_id = $1
         LIMIT 1`,
        [logRows[0].job_id]
      );
    }
  }

  let job: AppJobRow | null = jobRows.at(0) ?? null;

  if (!job) {
    job = await createProvisionalJobFromWebhook({ requestId, payload, identifiers });
  }

  if (!job) {
    console.warn('[fal-webhook] Unable to resolve job for provider_job_id', requestId);
    return;
  }

  const originalEngineId = job.engine_id;
  const originalEngineLabel = job.engine_label;
  let effectiveEngineId = job.engine_id;
  let effectiveEngineLabel = job.engine_label;
  if (!effectiveEngineId || effectiveEngineId === 'fal-unknown') {
    const inferred = await inferEngineFromPayload(payload);
    if (inferred.engineId !== 'fal-unknown') {
      effectiveEngineId = inferred.engineId;
      effectiveEngineLabel = inferred.engineLabel ?? effectiveEngineLabel ?? inferred.engineId;
      job.engine_id = effectiveEngineId;
      job.engine_label = effectiveEngineLabel;
    }
  }
  if (originalEngineId !== effectiveEngineId && effectiveEngineId && effectiveEngineId !== 'fal-unknown') {
    console.info('[fal-webhook] inferred engine mapping', {
      requestId,
      engineId: effectiveEngineId,
      engineLabel: effectiveEngineLabel,
      originalEngineId,
      originalEngineLabel,
    });
  }

  const inferredEngine =
    (effectiveEngineId && effectiveEngineId !== 'fal-unknown' && getFalEngineById(effectiveEngineId)) ||
    (job.engine_id && job.engine_id !== 'fal-unknown' ? getFalEngineById(job.engine_id) : null);
  const isImageEngine = (inferredEngine?.category ?? 'video') === 'image';
  const existingImageUrls = normalizeRenderIdList(job.render_ids);
  const existingHeroImage = job.hero_render_id
    ? normalizeMediaUrl(job.hero_render_id) ?? job.hero_render_id
    : null;

  let finalPayload = payload.result ?? payload.response ?? payload.data ?? null;
  const statusInfo = normalizeStatus(payload.status, job.status, job.progress);
  let nextStatus = statusInfo.status;
  let nextProgress = statusInfo.progress;

  let media = extractMediaUrls(finalPayload);

  if ((!finalPayload || nextStatus === 'completed') && effectiveEngineId && effectiveEngineId !== 'fal-unknown') {
    try {
      const falModel = (await resolveFalModelId(effectiveEngineId)) ?? effectiveEngineId;
      const falClient = getFalClient();
      const queueResult = await falClient.queue.result(falModel, { requestId });
      finalPayload = queueResult?.data ?? finalPayload ?? queueResult ?? null;
      if (!media.videoUrl && queueResult && typeof queueResult === 'object') {
        const fallbackMedia = extractMediaUrls(queueResult);
        if (!media.videoUrl && fallbackMedia.videoUrl) {
          media.videoUrl = fallbackMedia.videoUrl;
        }
        if (!media.thumbUrl && fallbackMedia.thumbUrl) {
          media.thumbUrl = fallbackMedia.thumbUrl;
        }
      }
    } catch (error) {
      if (nextStatus === 'completed') {
        console.warn('[fal-webhook] Failed to fetch final result', error);
      }
    }
  }
  if (!media.videoUrl || !media.thumbUrl) {
    const refreshed = extractMediaUrls(finalPayload);
    if (!media.videoUrl && refreshed.videoUrl) media.videoUrl = refreshed.videoUrl;
    if (!media.thumbUrl && refreshed.thumbUrl) media.thumbUrl = refreshed.thumbUrl;
  }
  let nextVideoUrl = media.videoUrl ? normalizeMediaUrl(media.videoUrl) : null;
  let nextThumbUrl = media.thumbUrl ? normalizeMediaUrl(media.thumbUrl) : null;

  const imageUrlSet = new Set<string>();
  existingImageUrls.forEach((url) => {
    if (url) imageUrlSet.add(url);
  });
  if (existingHeroImage && !imageUrlSet.has(existingHeroImage)) {
    imageUrlSet.add(existingHeroImage);
  }
  if (isImageEngine) {
    const ingest = (source: unknown) => {
      extractImageUrlsFromPayload(source).forEach((url) => {
        if (url) {
          imageUrlSet.add(url);
        }
      });
    };
    ingest(payload);
    ingest(payload.result);
    ingest(payload.response);
    ingest(payload.data);
    ingest(finalPayload);
  }
  const imageUrls = isImageEngine ? Array.from(imageUrlSet) : [];
  let heroImageUrl: string | null = null;
  if (isImageEngine && imageUrls.length) {
    if (existingHeroImage && imageUrlSet.has(existingHeroImage)) {
      heroImageUrl = existingHeroImage;
    } else {
      heroImageUrl = imageUrls[0] ?? null;
    }
  }
  if (isImageEngine && heroImageUrl && !nextThumbUrl) {
    nextThumbUrl = heroImageUrl;
  }
  const hasImageMedia = isImageEngine && imageUrls.length > 0;

  if (
    nextStatus === 'completed' &&
    (!nextVideoUrl || !nextThumbUrl) &&
    requestId &&
    effectiveEngineId &&
    effectiveEngineId !== 'fal-unknown'
  ) {
    try {
      const fallback = await fetchFalJobMedia({
        jobId: job.job_id,
        engineId: effectiveEngineId,
        providerJobId: requestId,
        userId: job.user_id,
        aspectRatio: job.aspect_ratio,
        existingThumbUrl: job.thumb_url,
      });
      if (fallback.normalizedResult) {
        finalPayload = fallback.normalizedResult;
      }
      if (!nextVideoUrl && fallback.videoUrl) {
        nextVideoUrl = normalizeMediaUrl(fallback.videoUrl) ?? fallback.videoUrl;
      }
      if (!nextThumbUrl && fallback.thumbUrl) {
        nextThumbUrl = normalizeMediaUrl(fallback.thumbUrl) ?? fallback.thumbUrl;
      }
    } catch (error) {
      console.warn('[fal-webhook] Fal media recovery failed', {
        jobId: job.job_id,
        providerJobId: requestId,
        error,
      });
    }
  }

  const extractedErrorMessage = extractFalErrorMessage(payload, nextStatus === 'failed' ? finalPayload : null);
  let nextMessage =
    extractedErrorMessage ??
    (nextStatus === 'failed'
      ? 'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
      : null);

  if (nextMessage && /^video_[A-Za-z0-9_-]+$/i.test(nextMessage)) {
    nextMessage = null;
  }

  const rawVideoSource = nextVideoUrl ?? media.videoUrl ?? job.video_url;
  let resolvedThumbUrl = nextThumbUrl ?? job.thumb_url;
  if (!resolvedThumbUrl) {
    resolvedThumbUrl = fallbackThumbnail(job.aspect_ratio);
  }
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
  const finalThumbUrl = resolvedThumbUrl ?? fallbackThumbnail(job.aspect_ratio);
  const finalPreviewFrame = finalThumbUrl ?? job.preview_frame;
  const isMediaMissing = !finalVideoUrl && !hasImageMedia;
  const renderIdsJson = hasImageMedia ? JSON.stringify(imageUrls) : null;
  const heroRenderId = hasImageMedia
    ? heroImageUrl ?? imageUrls[0] ?? job.hero_render_id ?? null
    : job.hero_render_id ?? null;

  if (hasImageMedia) {
    nextStatus = 'completed';
    nextProgress = 100;
    nextMessage = null;
  }

  let forcedNoMediaFailure = false;
  if ((finalVideoUrl || hasImageMedia) && nextStatus !== 'failed') {
    nextStatus = 'completed';
    nextProgress = 100;
  } else if (nextStatus === 'completed' && isMediaMissing) {
    forcedNoMediaFailure = true;
    nextStatus = 'failed';
    nextProgress = Math.min(nextProgress, 1);
    if (!nextMessage) {
      nextMessage = 'The provider finished this render but returned no video. Please retry or contact support if it persists.';
    }
  }

  const shouldClearVideo = isImageEngine || (!finalVideoUrl && !hasImageMedia) || forcedNoMediaFailure;
  const shouldClearThumb =
    nextStatus === 'failed' &&
    (!nextThumbUrl || !resolvedThumbUrl || (resolvedThumbUrl && isPlaceholderThumbnail(resolvedThumbUrl)));

  let detectedHasAudio: boolean | null = null;
  if (shouldClearVideo || isImageEngine) {
    detectedHasAudio = false;
  } else if (finalVideoUrl && (!job.has_audio || finalVideoUrl !== job.video_url)) {
    detectedHasAudio = await detectHasAudioStream(finalVideoUrl);
  }

  if ((finalVideoUrl || hasImageMedia) && nextStatus === 'failed') {
    const providerStatus = typeof payload.status === 'string' ? payload.status.toUpperCase() : null;
    const isProviderSuccess =
      providerStatus && (COMPLETED_STATUSES.has(providerStatus) || providerStatus === 'OK');
    if (isProviderSuccess || !nextMessage) {
      console.warn('[fal-webhook] overriding failed status because media is present', {
        jobId: job.job_id,
        requestId,
        providerStatus,
        previousMessage: nextMessage,
      });
      nextStatus = 'completed';
      nextProgress = 100;
      nextMessage = null;
    }
  }

  const messageToPersist =
    nextStatus === 'failed'
      ? nextMessage ??
        job.message ??
        'The service reported a failure without details. Try again. If it fails repeatedly, contact support with your request ID.'
      : nextMessage ?? null;
  const normalizedMessage = messageToPersist ? messageToPersist.replace(/\s+/g, ' ').trim() : null;
  const engineIdForUpdate =
    effectiveEngineId && effectiveEngineId !== 'fal-unknown' ? effectiveEngineId : null;
  const engineLabelForUpdate =
    effectiveEngineLabel && effectiveEngineLabel !== 'fal-unknown' ? effectiveEngineLabel : null;

  if (nextStatus === 'failed') {
    console.error('[fal-webhook] job failed', {
      jobId: job.job_id,
      requestId,
      engineId: job.engine_id,
      message: normalizedMessage,
      payload: payload.error ?? payload,
    });
  }

  await query(
    `UPDATE app_jobs
     SET status = $2,
         progress = $3,
         video_url = CASE WHEN $9 THEN NULL ELSE COALESCE($4, video_url) END,
         thumb_url = CASE WHEN $10 THEN NULL ELSE COALESCE($5, thumb_url) END,
         preview_frame = CASE WHEN $10 THEN NULL ELSE COALESCE($6, preview_frame) END,
         message = $7::text,
         provider_job_id = COALESCE($8::text, provider_job_id),
         provisional = FALSE,
         has_audio = CASE WHEN $9 THEN FALSE ELSE COALESCE($13, has_audio) END,
         engine_id = COALESCE($11, engine_id),
         engine_label = COALESCE($12, engine_label),
         render_ids = CASE WHEN $14::jsonb IS NOT NULL THEN $14::jsonb ELSE render_ids END,
         hero_render_id = CASE WHEN $15::text IS NOT NULL THEN $15::text ELSE hero_render_id END,
         updated_at = NOW()
     WHERE job_id = $1`,
    [
      job.job_id,
      nextStatus,
      nextProgress,
      finalVideoUrl ?? null,
      finalThumbUrl ?? null,
      finalPreviewFrame ?? null,
      normalizedMessage,
      requestId,
      shouldClearVideo,
      shouldClearThumb,
      engineIdForUpdate,
      engineLabelForUpdate,
      detectedHasAudio,
      renderIdsJson,
      heroRenderId,
    ]
  );

  console.info('[fal-webhook] lifecycle update', {
    at: new Date().toISOString(),
    jobId: job.job_id,
    providerJobId: requestId,
    previousStatus: job.status,
    nextStatus,
    previousProgress: job.progress,
    nextProgress,
    videoUrl: finalVideoUrl ?? null,
    thumbUrl: finalThumbUrl ?? null,
    imageCount: hasImageMedia ? imageUrls.length : 0,
    message: normalizedMessage ?? null,
    falStatus: payload.status ?? null,
    falError: extractedErrorMessage ?? null,
    hasResult: Boolean(payload.result),
    hasResponse: Boolean(payload.response),
    hasData: Boolean(payload.data),
  });

  const normalizedLogStatus = (() => {
    const baseStatus = nextStatus ?? statusInfo.status ?? payload.status ?? 'running';
    const lower = baseStatus.toString().toLowerCase();
    if (lower === 'completed') return 'completed';
    if (['failed', 'error', 'errored', 'canceled', 'cancelled', 'aborted'].includes(lower)) {
      return 'failed';
    }
    if (['queued', 'running', 'in_progress', 'processing', 'pending'].includes(lower)) {
      return 'running';
    }
    return lower;
  })();

  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        job.job_id,
        'fal',
        requestId,
        effectiveEngineId ?? job.engine_id ?? 'fal-unknown',
        normalizedLogStatus,
        JSON.stringify({
          at: new Date().toISOString(),
          falStatus: payload.status ?? null,
          appStatus: nextStatus ?? statusInfo.status ?? null,
          message: normalizedMessage ?? null,
          missingMedia: forcedNoMediaFailure || undefined,
        }),
      ]
    );
  } catch (logError) {
    console.warn('[fal-webhook] failed to record Fal lifecycle log', { jobId: job.job_id, providerJobId: requestId }, logError);
  }

  if (forcedNoMediaFailure) {
    console.warn('[fal-webhook] Fal reported completion without media', {
      jobId: job.job_id,
      providerJobId: requestId,
    });
    try {
      await query(
        `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`
        , [
          job.job_id,
          'fal',
          requestId,
          effectiveEngineId ?? job.engine_id ?? 'fal-unknown',
          'manual:no-media',
          JSON.stringify({
            at: new Date().toISOString(),
            note: 'Fal reported completion without returning media.',
          }),
        ]
      );
    } catch (noMediaLogError) {
      console.warn('[fal-webhook] failed to record no-media log', { jobId: job.job_id, providerJobId: requestId }, noMediaLogError);
    }
  }

}
