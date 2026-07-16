import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { shouldUseFalApis } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { normalizeMediaUrl } from '@/lib/media';
import {
  buildNextProviderVideoCopyState,
  getProviderVideoCopyState,
  isProviderVideoCopyRetryDue,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  shouldFailVideoJobOnProviderCopyMiss,
  shouldRetryProviderVideoCopy,
} from '@/server/provider-output-policy';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { getVisitorImageLikeJob, getVisitorStarterJob } from '@/server/visitor-workspace';
import { deriveJobSurface } from '@/lib/job-surface';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { applyOutputsToJobPayload, listJobOutputsByJobIds, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  mapGenerationStatusRecordToWeb,
  readOwnedGenerationRecord,
  type GenerationStatusRecord,
} from '@/server/generations/generation-status';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

const FAL_COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);
const FAL_FAILED_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'ABORTED']);

export async function GET(_req: NextRequest, props: { params: Promise<{ jobId: string }> }) {
  const params = await props.params;
  const jobId = params.jobId;

  if (!isDatabaseConfigured()) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { userId } = await getRouteAuthContext(_req);
  if (!userId) {
    if (VISITOR_WORKSPACE_ENABLED) {
      const visitorJob = await getVisitorStarterJob(jobId);
      if (visitorJob) {
        return json({
          ok: true,
          jobId: visitorJob.jobId,
          createdAt: visitorJob.createdAt,
          status: 'completed',
          progress: 100,
          videoUrl: visitorJob.videoUrl ?? undefined,
          thumbUrl: visitorJob.thumbUrl ?? undefined,
          aspectRatio: visitorJob.aspectRatio ?? undefined,
          pricing: visitorJob.pricingSnapshot ?? undefined,
          settingsSnapshot: undefined,
          finalPriceCents: visitorJob.finalPriceCents ?? undefined,
          currency: visitorJob.currency ?? 'USD',
          paymentStatus: visitorJob.paymentStatus ?? 'curated',
          vendorAccountId: undefined,
          stripePaymentIntentId: undefined,
          stripeChargeId: undefined,
          batchId: undefined,
          groupId: undefined,
          iterationIndex: undefined,
          iterationCount: undefined,
          renderIds: visitorJob.renderIds ?? undefined,
          renderThumbUrls: visitorJob.renderThumbUrls ?? undefined,
          heroRenderId: visitorJob.heroRenderId ?? undefined,
          localKey: visitorJob.localKey ?? undefined,
          message: undefined,
          etaSeconds: undefined,
          etaLabel: undefined,
        });
      }
      const visitorImageJob = await getVisitorImageLikeJob(jobId);
      if (visitorImageJob) {
        return json({
          ok: true,
          jobId: visitorImageJob.jobId,
          createdAt: visitorImageJob.createdAt,
          status: 'completed',
          progress: 100,
          videoUrl: undefined,
          audioUrl: undefined,
          thumbUrl: visitorImageJob.thumbUrl ?? undefined,
          aspectRatio: visitorImageJob.aspectRatio ?? undefined,
          pricing: visitorImageJob.pricingSnapshot ?? undefined,
          settingsSnapshot: undefined,
          finalPriceCents: visitorImageJob.finalPriceCents ?? undefined,
          currency: visitorImageJob.currency ?? 'USD',
          paymentStatus: visitorImageJob.paymentStatus ?? 'curated',
          vendorAccountId: undefined,
          stripePaymentIntentId: undefined,
          stripeChargeId: undefined,
          batchId: undefined,
          groupId: undefined,
          iterationIndex: undefined,
          iterationCount: undefined,
          renderIds: visitorImageJob.renderIds ?? undefined,
          renderThumbUrls: visitorImageJob.renderThumbUrls ?? undefined,
          heroRenderId: visitorImageJob.heroRenderId ?? undefined,
          localKey: visitorImageJob.localKey ?? undefined,
          message: undefined,
          etaSeconds: undefined,
          etaLabel: undefined,
        });
      }
    }
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/jobs] schema init failed', error);
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let job: GenerationStatusRecord | null;
  try {
    job = await readOwnedGenerationRecord({ userId, jobId });
  } catch (error) {
    console.warn('[api/jobs] query failed', error);
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  if (!job) {
    return json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  let normalizedVideoUrl = normalizeMediaUrl(job.video_url);
  let normalizedPreviewVideoUrl = normalizeMediaUrl(job.preview_video_url);
  let normalizedAudioUrl = normalizeMediaUrl(job.audio_url);
  let normalizedThumbUrl = normalizeMediaUrl(job.thumb_url);
  let parsedRenders = parseStoredImageRenders(job.render_ids);
  let parsedRenderIds = extractRenderIds(parsedRenders.entries);
  let parsedRenderThumbUrls = extractRenderThumbUrls(parsedRenders);
  let surface = deriveJobSurface({
    surface: job.surface,
    settingsSnapshot: job.settings_snapshot,
    jobId: job.job_id,
    engineId: job.engine_id,
    videoUrl: job.video_url,
    renderIds: job.render_ids,
  });

  try {
    let outputMap = await listJobOutputsByJobIds([job.job_id]);
    if (!outputMap.has(job.job_id)) {
      await upsertLegacyJobOutputs({
        job_id: job.job_id,
        user_id: job.user_id,
        surface: job.surface,
        video_url: job.video_url,
        audio_url: job.audio_url,
        thumb_url: job.thumb_url,
        preview_frame: job.preview_frame,
        preview_video_url: job.preview_video_url,
        render_ids: job.render_ids,
        duration_sec: job.duration_sec,
        status: job.status,
      });
      outputMap = await listJobOutputsByJobIds([job.job_id]);
    }
    const enriched = applyOutputsToJobPayload(
      {
        jobId: job.job_id,
        videoUrl: normalizedVideoUrl,
        audioUrl: normalizedAudioUrl,
        previewVideoUrl: normalizedPreviewVideoUrl,
        thumbUrl: normalizedThumbUrl,
        renderIds: parsedRenderIds ?? null,
        renderThumbUrls: parsedRenderThumbUrls ?? null,
      },
      outputMap.get(job.job_id)
    );
    normalizedVideoUrl = enriched.videoUrl ?? null;
    normalizedAudioUrl = enriched.audioUrl ?? null;
    normalizedPreviewVideoUrl = enriched.previewVideoUrl ?? null;
    normalizedThumbUrl = enriched.thumbUrl ?? null;
    parsedRenderIds = enriched.renderIds ?? parsedRenderIds;
    parsedRenderThumbUrls = enriched.renderThumbUrls ?? parsedRenderThumbUrls;
  } catch (error) {
    console.warn('[api/jobs] media output detail enrichment failed', { jobId, error });
  }

  // Optionally poll FAL once if pending and we have provider job id
  if (
    surface !== 'audio' &&
    shouldUseFalApis() &&
    (job.provider ?? 'fal') === 'fal' &&
    job.provider_job_id &&
    job.status !== 'completed' &&
    job.status !== 'failed'
  ) {
    try {
      const falModel = (await resolveFalModelId(job.engine_id)) ?? job.engine_id;
      const falClient = getFalClient();
      const statusInfo = (await falClient.queue
        .status(falModel, { requestId: job.provider_job_id })
        .catch(() => null)) as Record<string, unknown> | null;
      if (statusInfo) {
        const state = typeof statusInfo.status === 'string' ? statusInfo.status.toUpperCase() : undefined;
        const queueResult =
          state && FAL_COMPLETED_STATES.has(state)
            ? ((await falClient.queue.result(falModel, { requestId: job.provider_job_id }).catch(() => null)) as
                | Record<string, unknown>
                | null)
            : null;
        if (queueResult && state && FAL_COMPLETED_STATES.has(state)) {
          try {
            await updateJobFromFalWebhook({
              request_id: job.provider_job_id,
              status: 'completed',
              result: queueResult,
            });
            const refreshedJob = await readOwnedGenerationRecord({ userId, jobId });
            if (refreshedJob) {
              job = refreshedJob;
              normalizedVideoUrl = normalizeMediaUrl(job.video_url);
              normalizedPreviewVideoUrl = normalizeMediaUrl(job.preview_video_url);
              normalizedAudioUrl = normalizeMediaUrl(job.audio_url);
              normalizedThumbUrl = normalizeMediaUrl(job.thumb_url);
              parsedRenders = parseStoredImageRenders(job.render_ids);
              parsedRenderIds = extractRenderIds(parsedRenders.entries);
              parsedRenderThumbUrls = extractRenderThumbUrls(parsedRenders);
              surface = deriveJobSurface({
                surface: job.surface,
                settingsSnapshot: job.settings_snapshot,
                jobId: job.job_id,
                engineId: job.engine_id,
                videoUrl: job.video_url,
                renderIds: job.render_ids,
              });
            }
          } catch (refreshError) {
            console.warn('[api/jobs] failed to apply Fal completed result', {
              jobId,
              providerJobId: job.provider_job_id,
              error: refreshError,
            });
          }
        }
        const sj = (queueResult ? { ...statusInfo, response: queueResult, output: queueResult } : statusInfo) as {
          response?: { video?: { url?: string } };
          output?: { video?: string };
          video_url?: string;
          status?: string;
          state?: string;
          progress?: number;
          percent?: number;
        };
        const vUrl: string | undefined = sj?.response?.video?.url || sj?.output?.video || sj?.video_url;
        const st: string | undefined = sj?.status || sj?.state;
        const prog: number | undefined = sj?.progress || sj?.percent;
        let status = job.status ?? 'queued';
        let progress = job.progress ?? 0;
        let videoUrl = normalizedVideoUrl;
        let thumbUrl = normalizedThumbUrl ?? null;
        let message = job.message ?? null;
        let providerVideoCopyStateJson: string | null = null;
        if (vUrl) {
          const normalizedProviderVideoUrl = normalizeMediaUrl(vUrl) ?? vUrl;
          const strictCopyRequired = shouldFailVideoJobOnProviderCopyMiss({
            provider: job.provider ?? 'fal',
            sourceUrl: normalizedProviderVideoUrl,
            copiedUrl: null,
            currentJobStatus: job.status,
          });
          const shouldAttemptProviderCopy =
            !strictCopyRequired || isProviderVideoCopyRetryDue(getProviderVideoCopyState(job.settings_snapshot));
          const copiedVideoUrl = shouldAttemptProviderCopy
            ? await ensureFastStartVideo({
                jobId,
                userId: job.user_id ?? undefined,
                videoUrl: normalizedProviderVideoUrl,
              })
            : null;
          const providerCopyMissing = shouldFailVideoJobOnProviderCopyMiss({
            provider: job.provider ?? 'fal',
            sourceUrl: normalizedProviderVideoUrl,
            copiedUrl: copiedVideoUrl,
            currentJobStatus: job.status,
          });
          if (!providerCopyMissing) {
            status = 'completed';
            progress = 100;
            videoUrl = copiedVideoUrl ?? normalizedProviderVideoUrl;
            message = null;
            if (/^https?:\/\//i.test(vUrl) && isPlaceholderThumbnail(thumbUrl)) {
              const generatedThumb = await ensureJobThumbnail({
                jobId,
                userId: job.user_id ?? undefined,
                videoUrl,
                aspectRatio: job.aspect_ratio ?? undefined,
                existingThumbUrl: thumbUrl ?? undefined,
                force: true,
              });
              if (generatedThumb) {
                thumbUrl = generatedThumb;
              }
            }
            if (!thumbUrl) {
              thumbUrl = normalizedThumbUrl ?? null;
            }
          } else if (!shouldAttemptProviderCopy) {
            status = 'processing';
            progress = 90;
            message = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
            videoUrl = normalizedVideoUrl;
          } else {
            const nextCopyState = buildNextProviderVideoCopyState(job.settings_snapshot, {
              providerStatus: st ?? 'completed',
              reason: 'provider_video_copy_failed',
            });
            providerVideoCopyStateJson = JSON.stringify(nextCopyState);
            if (shouldRetryProviderVideoCopy({ state: nextCopyState, createdAt: String(job.created_at) })) {
              status = 'processing';
              progress = 90;
              message = PROVIDER_VIDEO_COPY_RETRY_MESSAGE;
              videoUrl = normalizedVideoUrl;
            }
          }
        } else if (st && FAL_FAILED_STATES.has(st.toUpperCase())) {
          status = 'failed';
        } else if (typeof prog === 'number') {
          progress = Math.max(progress, Math.min(100, Math.round(prog)));
          status = 'running';
        }
        if (status !== job.status || progress !== job.progress || videoUrl !== normalizedVideoUrl || thumbUrl !== normalizedThumbUrl) {
          await query(
            `UPDATE app_jobs
                SET status = $1,
                    progress = $2,
                    video_url = $3,
                    thumb_url = $4,
                    preview_frame = $5,
                    message = $7,
                    settings_snapshot = CASE
                      WHEN $8::jsonb IS NOT NULL THEN jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{providerVideoCopy}', $8::jsonb, true)
                      ELSE settings_snapshot
                    END
              WHERE job_id = $6`,
            [status, progress, videoUrl ?? null, thumbUrl ?? null, thumbUrl ?? null, jobId, message, providerVideoCopyStateJson]
          );
          return json(
            mapGenerationStatusRecordToWeb(job, {
              status,
              progress,
              videoUrl,
              previewVideoUrl: normalizedPreviewVideoUrl,
              audioUrl: normalizedAudioUrl,
              thumbUrl,
              renderIds: parsedRenderIds,
              renderThumbUrls: parsedRenderThumbUrls,
              message,
              useFallbackSettingsSnapshot: false,
            })
          );
        }
      }
    } catch {
      // ignore polling errors
    }
  }

  let responseVideoUrl = normalizedVideoUrl;
  let shouldSyncJobOutputs = false;
  if (surface !== 'audio' && job.status === 'completed' && responseVideoUrl) {
    const fastStartVideo = await ensureFastStartVideo({
      jobId,
      userId: job.user_id ?? undefined,
      videoUrl: responseVideoUrl,
    });
    if (
      shouldFailVideoJobOnProviderCopyMiss({
        provider: job.provider ?? 'fal',
        sourceUrl: responseVideoUrl,
        copiedUrl: fastStartVideo,
        currentJobStatus: job.status,
      })
    ) {
      responseVideoUrl = null;
    }
    if (fastStartVideo && fastStartVideo !== responseVideoUrl) {
      responseVideoUrl = fastStartVideo;
      shouldSyncJobOutputs = true;
      await query(
        `UPDATE app_jobs
            SET video_url = $2,
                updated_at = NOW()
          WHERE job_id = $1`,
        [jobId, fastStartVideo]
      ).catch((error) => {
        console.warn('[api/jobs] failed to persist fast-start video', { jobId, error });
      });
    }
    if (responseVideoUrl && isPlaceholderThumbnail(normalizedThumbUrl)) {
      const generatedThumb = await ensureJobThumbnail({
        jobId,
        userId: job.user_id ?? undefined,
        videoUrl: responseVideoUrl,
        aspectRatio: job.aspect_ratio ?? undefined,
        existingThumbUrl: normalizedThumbUrl ?? undefined,
        force: true,
      });
      if (generatedThumb) {
        normalizedThumbUrl = normalizeMediaUrl(generatedThumb) ?? generatedThumb;
        shouldSyncJobOutputs = true;
        await query(
          `UPDATE app_jobs
              SET thumb_url = $2,
                  preview_frame = $2,
                  updated_at = NOW()
            WHERE job_id = $1`,
          [jobId, normalizedThumbUrl]
        ).catch((error) => {
          console.warn('[api/jobs] failed to persist generated thumbnail', { jobId, error });
        });
      }
    }
    if (shouldSyncJobOutputs) {
      await upsertLegacyJobOutputs({
        job_id: job.job_id,
        user_id: job.user_id,
        surface: job.surface,
        video_url: responseVideoUrl,
        audio_url: normalizedAudioUrl,
        thumb_url: normalizedThumbUrl,
        preview_frame: normalizedThumbUrl,
        preview_video_url: normalizedPreviewVideoUrl,
        render_ids: job.render_ids,
        duration_sec: job.duration_sec,
        status: job.status,
      }).catch((error) => {
        console.warn('[api/jobs] failed to sync repaired job outputs', { jobId, error });
      });
    }
  }

  return json(
    mapGenerationStatusRecordToWeb(job, {
      videoUrl: responseVideoUrl,
      previewVideoUrl: normalizedPreviewVideoUrl,
      audioUrl: normalizedAudioUrl,
      thumbUrl: normalizedThumbUrl,
      renderIds: parsedRenderIds,
      renderThumbUrls: parsedRenderThumbUrls,
    })
  );
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await props.params;
  if (!isDatabaseConfigured()) {
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as { hidden?: unknown } | null;
  if (payload?.hidden !== true) {
    return json({ ok: false, error: 'Unsupported patch' }, { status: 400 });
  }

  try {
    const rows = await query<{ job_id: string }>(
      `UPDATE app_jobs
          SET hidden = $1,
              updated_at = NOW()
        WHERE job_id = $2
          AND user_id = $3
        RETURNING job_id`,
      [true, jobId, userId]
    );
    if (!rows.length) {
      return json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    return json({ ok: true, jobId, hidden: true });
  } catch (error) {
    console.warn('[api/jobs] failed to patch job', { jobId, error });
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }
}
