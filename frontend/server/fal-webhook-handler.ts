import { query } from '@/lib/db';
import { maybeAutoRefundWalletCharge } from './fal-webhook-refunds';
import { createProvisionalJobFromWebhook } from './fal-webhook-provisional';
import type { AppJobRow } from './fal-webhook-types';
import { normalizeMediaUrl } from '@/lib/media';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import {
  buildNextProviderVideoCopyState,
  buildSafeProviderMediaLog,
  getProviderVideoCopyState,
  isProviderVideoCopyRetryDue,
  PROVIDER_VIDEO_COPY_FAILURE_MESSAGE,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  shouldFailVideoJobOnProviderCopyMiss,
  shouldRetryProviderVideoCopy,
} from '@/server/provider-output-policy';
import { getFalEngineById } from '@/config/falEngines';
import { fetchFalJobMedia } from '@/server/fal-job-sync';
import { detectHasAudioStream, detectVideoDimensions } from '@/server/media/detect-has-audio';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import {
  extractFalErrorMessage,
  extractIdentifiersFromPayload,
  extractImageUrlsFromPayload,
  extractMediaUrls,
  fallbackThumbnail,
  formatAspectRatioLabel,
  getUpscaleToolMediaType,
  inferEngineFromPayload,
  isCompletedFalStatus,
  isFailedFalStatus,
  normalizeRenderIdList,
  normalizeStatus,
  type FalWebhookPayload,
  type WebhookIdentifiers,
} from './fal-webhook-mapping';

export async function updateJobFromFalWebhook(rawPayload: unknown): Promise<void> {
  const payload = (rawPayload ?? {}) as FalWebhookPayload;
  const requestId = payload.request_id ?? payload.requestId;
  if (!requestId) {
    throw new Error('Missing request_id in webhook payload');
  }

  const identifiers = extractIdentifiersFromPayload(payload);

  let jobRows = await query<AppJobRow>(
    `SELECT job_id, user_id, engine_id, engine_label, payment_status, pricing_snapshot, vendor_account_id, currency, final_price_cents, duration_sec, status, progress, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id, created_at, settings_snapshot
     FROM app_jobs
     WHERE provider_job_id = $1
     LIMIT 1`,
    [requestId]
  );

  if (!jobRows.length && identifiers.jobId) {
    jobRows = await query<AppJobRow>(
      `SELECT job_id, user_id, engine_id, engine_label, payment_status, pricing_snapshot, vendor_account_id, currency, final_price_cents, duration_sec, status, progress, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id, created_at, settings_snapshot
       FROM app_jobs
       WHERE job_id = $1
       LIMIT 1`,
      [identifiers.jobId]
    );
  }

  if (!jobRows.length && identifiers.localKey) {
    jobRows = await query<AppJobRow>(
      `SELECT job_id, user_id, engine_id, engine_label, payment_status, pricing_snapshot, vendor_account_id, currency, final_price_cents, duration_sec, status, progress, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id, created_at, settings_snapshot
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
        `SELECT job_id, user_id, engine_id, engine_label, payment_status, pricing_snapshot, vendor_account_id, currency, final_price_cents, duration_sec, status, progress, video_url, to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url, to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls, thumb_url, aspect_ratio, preview_frame, message, has_audio, render_ids, hero_render_id, created_at, settings_snapshot
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
  const upscaleToolMediaType = effectiveEngineId ? getUpscaleToolMediaType(effectiveEngineId) : null;
  const isImageEngine = inferredEngine?.category === 'image' || upscaleToolMediaType === 'image';
  const existingImageUrls = normalizeRenderIdList(job.render_ids);
  const existingHeroImage = job.hero_render_id
    ? normalizeMediaUrl(job.hero_render_id) ?? job.hero_render_id
    : null;

  let finalPayload = payload.result ?? payload.response ?? payload.data ?? null;
  const statusInfo = normalizeStatus(payload.status, job.status, job.progress);
  let nextStatus = statusInfo.status;
  let nextProgress = statusInfo.progress;

  const media = extractMediaUrls(finalPayload);

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
  let providerVideoCopyFailed = false;
  let providerVideoCopyDeferred = false;
  let providerVideoCopyStateJson: string | null = null;

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
        currentJobStatus: job.status,
        settingsSnapshot: job.settings_snapshot,
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
      if (fallback.copyDeferred) {
        providerVideoCopyDeferred = true;
        nextStatus = 'processing';
        nextProgress = 90;
      } else if (fallback.copyFailed) {
        providerVideoCopyFailed = true;
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
  if (providerVideoCopyDeferred && !nextMessage) {
    nextMessage = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
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

  let finalVideoUrl = nextVideoUrl ?? job.video_url;
  if (finalVideoUrl && !isImageEngine && nextStatus === 'completed') {
    const sourceBeforeCopy = finalVideoUrl;
    const strictCopyRequired =
      shouldFailVideoJobOnProviderCopyMiss({
        provider: 'fal',
        sourceUrl: sourceBeforeCopy,
        copiedUrl: null,
        currentJobStatus: job.status,
      });
    if (strictCopyRequired && !isProviderVideoCopyRetryDue(getProviderVideoCopyState(job.settings_snapshot))) {
      providerVideoCopyDeferred = true;
      finalVideoUrl = null;
      nextVideoUrl = null;
      nextStatus = 'processing';
      nextProgress = 90;
      nextMessage = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
    } else {
      const fastStartVideo = await ensureFastStartVideo({
        jobId: job.job_id,
        userId: job.user_id ?? undefined,
        videoUrl: finalVideoUrl,
      });
      if (fastStartVideo) {
        finalVideoUrl = fastStartVideo;
        nextVideoUrl = fastStartVideo;
      } else if (job.status === 'completed') {
        finalVideoUrl = job.video_url;
        nextVideoUrl = job.video_url;
      } else if (strictCopyRequired) {
        providerVideoCopyFailed = true;
        finalVideoUrl = null;
        nextVideoUrl = null;
      }
    }
  }
  if (
    finalVideoUrl &&
    !isImageEngine &&
    isPlaceholderThumbnail(resolvedThumbUrl) &&
    finalVideoUrl !== rawVideoSource
  ) {
    const generatedThumb = await ensureJobThumbnail({
      jobId: job.job_id,
      userId: job.user_id ?? undefined,
      videoUrl: finalVideoUrl,
      aspectRatio: job.aspect_ratio ?? undefined,
      existingThumbUrl: resolvedThumbUrl ?? undefined,
      force: true,
    });
    if (generatedThumb) {
      resolvedThumbUrl = generatedThumb;
    }
  }
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

  if (providerVideoCopyFailed && job.status !== 'completed') {
    const nextCopyState = buildNextProviderVideoCopyState(job.settings_snapshot, {
      providerStatus: typeof payload.status === 'string' ? payload.status : nextStatus,
      reason: 'provider_video_copy_failed',
    });
    providerVideoCopyStateJson = JSON.stringify(nextCopyState);
    if (shouldRetryProviderVideoCopy({ state: nextCopyState, createdAt: String(job.created_at) })) {
      providerVideoCopyDeferred = true;
      providerVideoCopyFailed = false;
      nextStatus = 'processing';
      nextProgress = 90;
      nextMessage = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
    }
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

  if (providerVideoCopyFailed) {
    forcedNoMediaFailure = true;
    nextStatus = 'failed';
    nextProgress = Math.min(nextProgress, 1);
    nextMessage = PROVIDER_VIDEO_COPY_FAILURE_MESSAGE;
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

  let detectedAspectRatio: string | null = null;
  if (!shouldClearVideo && finalVideoUrl) {
    const dimensions = await detectVideoDimensions(finalVideoUrl).catch(() => null);
    if (dimensions) {
      detectedAspectRatio = formatAspectRatioLabel(dimensions.width, dimensions.height);
      if (detectedAspectRatio) {
        job.aspect_ratio = detectedAspectRatio;
      }
    }
  }

  if ((finalVideoUrl || hasImageMedia) && nextStatus === 'failed') {
    const providerStatus = typeof payload.status === 'string' ? payload.status.toUpperCase() : null;
    const isProviderSuccess = isCompletedFalStatus(providerStatus) || providerStatus === 'OK';
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
  const explicitAutoRefundEligibility = (() => {
    if (typeof payload.auto_refund_eligible === 'boolean') return payload.auto_refund_eligible;
    if (typeof payload.autoRefundEligible === 'boolean') return payload.autoRefundEligible;
    return null;
  })();
  const failureOrigin =
    (typeof payload.failure_origin === 'string' && payload.failure_origin.trim()) ||
    (typeof payload.failureOrigin === 'string' && payload.failureOrigin.trim()) ||
    null;
  const shouldAutoRefundFailure =
    nextStatus === 'failed'
      ? providerVideoCopyFailed
        ? true
        : explicitAutoRefundEligibility === true
        ? true
        : explicitAutoRefundEligibility === false
          ? false
          : isFailedFalStatus(payload.status)
      : false;

  if (nextStatus === 'failed') {
    console.error('[fal-webhook] job failed', {
      jobId: job.job_id,
      requestId,
      engineId: job.engine_id,
      message: normalizedMessage,
      autoRefundEligible: shouldAutoRefundFailure,
      failureOrigin,
      falStatus: payload.status ?? null,
      hasErrorPayload: Boolean(payload.error),
      providerVideoCopyFailed,
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
         aspect_ratio = COALESCE($14, aspect_ratio),
         render_ids = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE render_ids END,
         hero_render_id = CASE WHEN $16::text IS NOT NULL THEN $16::text ELSE hero_render_id END,
         settings_snapshot = CASE
           WHEN $17::jsonb IS NOT NULL THEN jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{providerVideoCopy}', $17::jsonb, true)
           ELSE settings_snapshot
         END,
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
      detectedAspectRatio,
      renderIdsJson,
      heroRenderId,
      providerVideoCopyStateJson,
    ]
  );

  await upsertLegacyJobOutputs({
    job_id: job.job_id,
    user_id: job.user_id,
    surface: isImageEngine ? 'image' : 'video',
    video_url: shouldClearVideo ? null : finalVideoUrl ?? job.video_url,
    audio_url: null,
    thumb_url: shouldClearThumb ? null : finalThumbUrl ?? job.thumb_url,
    preview_frame: shouldClearThumb ? null : finalPreviewFrame ?? job.preview_frame,
    preview_video_url: job.preview_video_url,
    render_ids: renderIdsJson ? JSON.parse(renderIdsJson) : job.render_ids,
    duration_sec: job.duration_sec,
    status: nextStatus,
  }).catch((error) => {
    console.warn('[fal-webhook] failed to persist job outputs', { jobId: job.job_id }, error);
  });

  if (nextStatus === 'completed' && finalVideoUrl && !isImageEngine) {
    await Promise.allSettled([
      generateAndPersistJobPreviewVideo({
        jobId: job.job_id,
        userId: job.user_id ?? undefined,
        videoUrl: finalVideoUrl,
        existingPreviewVideoUrl: job.preview_video_url,
      }),
      generateAndPersistJobKeyframes({
        jobId: job.job_id,
        userId: job.user_id ?? undefined,
        videoUrl: finalVideoUrl,
        durationSec: job.duration_sec,
        existingKeyframeUrls: job.keyframe_urls,
      }),
    ]);
  }

  if (nextStatus === 'failed' && shouldAutoRefundFailure) {
    await maybeAutoRefundWalletCharge(job.job_id, {
      engineLabel: engineLabelForUpdate ?? job.engine_label ?? job.engine_id,
      providerJobId: requestId,
      failureMessage: normalizedMessage ?? null,
      failureOrigin,
    });
  }

  console.info('[fal-webhook] lifecycle update', {
    at: new Date().toISOString(),
    jobId: job.job_id,
    providerJobId: requestId,
    previousStatus: job.status,
    nextStatus,
    previousProgress: job.progress,
    nextProgress,
    video: buildSafeProviderMediaLog(finalVideoUrl),
    thumb: buildSafeProviderMediaLog(finalThumbUrl),
    providerVideoCopyFailed,
    providerVideoCopyDeferred,
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
