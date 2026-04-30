import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { shouldUseFalApis } from '@/lib/result-provider';
import type { PricingSnapshot } from '@/types/engines';
import { ensureBillingSchema } from '@/lib/schema';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { normalizeMediaUrl } from '@/lib/media';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { extractRenderIds, extractRenderThumbUrls, parseStoredImageRenders } from '@/lib/image-renders';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { getVisitorImageLikeJob, getVisitorStarterJob } from '@/server/visitor-workspace';
import { deriveJobSurface } from '@/lib/job-surface';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

const FAL_COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);
const FAL_FAILED_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'ABORTED']);

type DbJobRow = {
  id: number;
  job_id: string;
  user_id: string | null;
  status: string;
  progress: number;
  provider_job_id: string | null;
  surface: string | null;
  billing_product_key: string | null;
  video_url: string | null;
  audio_url: string | null;
  thumb_url: string | null;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  created_at: string;
  final_price_cents: number | null;
  pricing_snapshot: PricingSnapshot | null;
  settings_snapshot: unknown;
  currency: string | null;
  payment_status: string | null;
  vendor_account_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  batch_id: string | null;
  group_id: string | null;
  iteration_index: number | null;
  iteration_count: number | null;
  render_ids: unknown;
  hero_render_id: string | null;
  local_key: string | null;
  message: string | null;
  eta_seconds: number | null;
  eta_label: string | null;
  aspect_ratio: string | null;
};

const JOB_DETAIL_SELECT = `SELECT id, job_id, user_id, status, progress, provider_job_id, surface, billing_product_key, video_url, audio_url, thumb_url, engine_id, engine_label, duration_sec, prompt, created_at, final_price_cents, pricing_snapshot, settings_snapshot, currency, payment_status, vendor_account_id, stripe_payment_intent_id, stripe_charge_id, batch_id, group_id, iteration_index, iteration_count, render_ids, hero_render_id, local_key, message, eta_seconds, eta_label, aspect_ratio
       FROM app_jobs
       WHERE job_id = $1
       LIMIT 1`;

function buildFallbackSettingsSnapshot(job: DbJobRow): unknown {
  const surface = deriveJobSurface({
    surface: job.surface,
    settingsSnapshot: job.settings_snapshot,
    jobId: job.job_id,
    engineId: job.engine_id,
    videoUrl: job.video_url,
    renderIds: job.render_ids,
  });
  if (surface !== 'video') {
    const renderIds = extractRenderIds(parseStoredImageRenders(job.render_ids).entries) ?? [];
    return {
      schemaVersion: 1,
      surface,
      engineId: job.engine_id,
      engineLabel: job.engine_label,
      inputMode: 't2i',
      prompt: job.prompt ?? '',
      core: {
        numImages: renderIds.length || 1,
        aspectRatio: job.aspect_ratio ?? null,
        resolution: null,
      },
      refs: {
        imageUrls: [],
      },
      meta: {
        derived: true,
      },
    };
  }

  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: job.engine_id,
    engineLabel: job.engine_label,
    inputMode: 't2v',
    prompt: job.prompt ?? '',
    negativePrompt: null,
    core: {
      durationSec: job.duration_sec ?? null,
      durationOption: null,
      numFrames: null,
      aspectRatio: job.aspect_ratio ?? null,
      resolution: null,
      fps: null,
      iterationCount: null,
    },
    advanced: {
      cfgScale: null,
      loop: null,
    },
    refs: {
      imageUrl: null,
      referenceImages: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      inputs: null,
    },
    meta: {
      derived: true,
    },
  };
}

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

  let rows: DbJobRow[];
  try {
    rows = await query<DbJobRow>(
      JOB_DETAIL_SELECT,
      [jobId]
    );
  } catch (error) {
    console.warn('[api/jobs] query failed', error);
    return json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  if (!rows.length) {
    return json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  let job = rows[0];
  if (job.user_id && job.user_id !== userId) {
    return json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  let normalizedVideoUrl = normalizeMediaUrl(job.video_url);
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

  // Optionally poll FAL once if pending and we have provider job id
  if (surface !== 'audio' && shouldUseFalApis() && job.provider_job_id && job.status !== 'completed' && job.status !== 'failed') {
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
            const refreshedRows = await query<DbJobRow>(JOB_DETAIL_SELECT, [jobId]);
            if (refreshedRows[0]) {
              job = refreshedRows[0];
              normalizedVideoUrl = normalizeMediaUrl(job.video_url);
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
        let status = job.status;
        let progress = job.progress;
        let videoUrl = normalizedVideoUrl;
        let thumbUrl = normalizedThumbUrl ?? null;
        if (vUrl) {
          status = 'completed';
          progress = 100;
          const normalizedProviderVideoUrl = normalizeMediaUrl(vUrl) ?? vUrl;
          videoUrl =
            (await ensureFastStartVideo({
              jobId,
              userId: job.user_id ?? undefined,
              videoUrl: normalizedProviderVideoUrl,
            })) ?? normalizedProviderVideoUrl;
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
        } else if (st && FAL_FAILED_STATES.has(st.toUpperCase())) {
          status = 'failed';
        } else if (typeof prog === 'number') {
          progress = Math.max(progress, Math.min(100, Math.round(prog)));
          status = 'running';
        }
        if (status !== job.status || progress !== job.progress || videoUrl !== normalizedVideoUrl || thumbUrl !== normalizedThumbUrl) {
          await query(
            `UPDATE app_jobs SET status = $1, progress = $2, video_url = $3, thumb_url = $4, preview_frame = $5 WHERE job_id = $6`,
            [status, progress, videoUrl ?? null, thumbUrl ?? null, thumbUrl ?? null, jobId]
          );
          return json({
            ok: true,
            jobId,
            surface,
            billingProductKey: job.billing_product_key ?? undefined,
            createdAt: job.created_at,
            status,
            progress,
            videoUrl: videoUrl ?? undefined,
            audioUrl: normalizedAudioUrl ?? undefined,
            thumbUrl: thumbUrl ?? undefined,
            aspectRatio: job.aspect_ratio ?? undefined,
            pricing: job.pricing_snapshot ?? undefined,
            settingsSnapshot: job.settings_snapshot ?? undefined,
            finalPriceCents: job.final_price_cents ?? undefined,
            currency: job.currency ?? 'USD',
            paymentStatus: job.payment_status ?? undefined,
            vendorAccountId: job.vendor_account_id ?? undefined,
            stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
            stripeChargeId: job.stripe_charge_id ?? undefined,
            batchId: job.batch_id ?? undefined,
            groupId: job.group_id ?? undefined,
            iterationIndex: job.iteration_index ?? undefined,
            iterationCount: job.iteration_count ?? undefined,
            renderIds: parsedRenderIds,
            renderThumbUrls: parsedRenderThumbUrls,
            heroRenderId: job.hero_render_id ?? undefined,
            localKey: job.local_key ?? undefined,
            message: job.message ?? undefined,
            etaSeconds: job.eta_seconds ?? undefined,
            etaLabel: job.eta_label ?? undefined,
          });
        }
      }
    } catch {
      // ignore polling errors
    }
  }

  let responseVideoUrl = normalizedVideoUrl;
  if (surface !== 'audio' && job.status === 'completed' && responseVideoUrl) {
    const fastStartVideo = await ensureFastStartVideo({
      jobId,
      userId: job.user_id ?? undefined,
      videoUrl: responseVideoUrl,
    });
    if (fastStartVideo && fastStartVideo !== responseVideoUrl) {
      responseVideoUrl = fastStartVideo;
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
  }

  return json({
    ok: true,
    jobId,
    surface,
    billingProductKey: job.billing_product_key ?? undefined,
    createdAt: job.created_at,
    status: job.status,
    progress: job.progress,
    videoUrl: responseVideoUrl ?? undefined,
    audioUrl: normalizedAudioUrl ?? undefined,
    thumbUrl: normalizedThumbUrl ?? undefined,
    aspectRatio: job.aspect_ratio ?? undefined,
    pricing: job.pricing_snapshot ?? undefined,
    settingsSnapshot:
      job.settings_snapshot && typeof job.settings_snapshot === 'object'
        ? job.settings_snapshot
        : buildFallbackSettingsSnapshot(job),
    finalPriceCents: job.final_price_cents ?? undefined,
    currency: job.currency ?? 'USD',
    paymentStatus: job.payment_status ?? undefined,
    vendorAccountId: job.vendor_account_id ?? undefined,
    stripePaymentIntentId: job.stripe_payment_intent_id ?? undefined,
    stripeChargeId: job.stripe_charge_id ?? undefined,
    batchId: job.batch_id ?? undefined,
    groupId: job.group_id ?? undefined,
    iterationIndex: job.iteration_index ?? undefined,
    iterationCount: job.iteration_count ?? undefined,
    renderIds: parsedRenderIds,
    renderThumbUrls: parsedRenderThumbUrls,
    heroRenderId: job.hero_render_id ?? undefined,
    localKey: job.local_key ?? undefined,
    message: job.message ?? undefined,
    etaSeconds: job.eta_seconds ?? undefined,
    etaLabel: job.eta_label ?? undefined,
  });
}
