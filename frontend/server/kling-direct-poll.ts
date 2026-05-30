import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  buildNextProviderVideoCopyState,
  getProviderVideoCopyState,
  isProviderVideoCopyRetryDue,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  shouldRetryProviderVideoCopy,
} from '@/server/provider-output-policy';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import { detectVideoDimensions } from '@/server/media/detect-has-audio';
import { formatAspectRatioLabel } from '@/server/fal-webhook-media';
import { getKlingDirectClient } from '@/server/video-providers/kling-direct/client';
import { computeKlingDirectProviderCostUsd } from '@/server/video-providers/kling-direct/cost';
import { classifyKlingDirectError } from '@/server/video-providers/kling-direct/errors';
import {
  resolveKlingDirectModelRoute,
  resolveKlingDirectPollPathPrefix,
} from '@/server/video-providers/kling-direct/model-map';
import {
  findProviderAttemptForJob,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import type { NormalizedVideoProviderTask } from '@/server/video-providers/types';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type KlingDirectPendingJob = {
  job_id: string;
  user_id: string | null;
  engine_id: string;
  engine_label: string;
  provider_job_id: string;
  status: string;
  duration_sec: number;
  thumb_url: string | null;
  preview_video_url: string | null;
  keyframe_urls: unknown;
  aspect_ratio: string | null;
  has_audio: boolean | null;
  final_price_cents: number | null;
  pricing_snapshot: unknown;
  settings_snapshot: unknown;
  currency: string | null;
  payment_status: string | null;
  updated_at: string;
  created_at: string;
};

type KlingDirectPollDeps = {
  queryFn?: QueryFn;
  getKlingDirectClientFn?: typeof getKlingDirectClient;
  ensureFastStartVideoFn?: typeof ensureFastStartVideo;
  detectVideoDimensionsFn?: typeof detectVideoDimensions;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  upsertLegacyJobOutputsFn?: typeof upsertLegacyJobOutputs;
  generateAndPersistJobPreviewVideoFn?: typeof generateAndPersistJobPreviewVideo;
  generateAndPersistJobKeyframesFn?: typeof generateAndPersistJobKeyframes;
};

const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 35 * 60_000;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];
const STALLED_MESSAGE = 'Kling direct polling stalled. Admin review is required before retrying or refunding.';
const KLING_DIRECT_POLL_PATHS = new Set(['/v1/videos/text2video', '/v1/videos/image2video']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getStoredPollPathPrefix(snapshot: unknown): string | null {
  const record = asRecord(snapshot);
  const value = record?.pollPathPrefix;
  if (typeof value !== 'string') return null;
  return KLING_DIRECT_POLL_PATHS.has(value) ? value : null;
}

function getModeFromSettingsSnapshot(snapshot: unknown): 't2v' | 'i2v' | null {
  const record = asRecord(snapshot);
  const directMode = record?.mode;
  if (directMode === 't2v' || directMode === 'i2v') return directMode;
  const coreMode = asRecord(record?.core)?.mode;
  return coreMode === 't2v' || coreMode === 'i2v' ? coreMode : null;
}

async function recordWalletRefundOnce(job: KlingDirectPendingJob, reason: string, queryFn: QueryFn) {
  if (job.payment_status !== 'paid_wallet' || !job.user_id || !job.final_price_cents) return false;

  const inserted = await queryFn<{ id: string }>(
    `INSERT INTO app_receipts (
       user_id,
       type,
       amount_cents,
       currency,
       description,
       job_id,
       surface,
       billing_product_key,
       pricing_snapshot,
       application_fee_cents,
       vendor_account_id,
       stripe_payment_intent_id,
       stripe_charge_id,
       platform_revenue_cents,
       destination_acct
     )
     VALUES ($1,'refund',$2,$3,$4,$5,'video',NULL,$6::jsonb,NULL,NULL,NULL,NULL,NULL,NULL)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      job.user_id,
      job.final_price_cents,
      (job.currency ?? 'USD').toUpperCase(),
      `Refund ${job.engine_label} - ${job.duration_sec}s - ${reason}`,
      job.job_id,
      JSON.stringify(job.pricing_snapshot ?? {}),
    ]
  );
  if (!inserted.length) return false;

  await queryFn(
    `UPDATE app_jobs
        SET payment_status = 'refunded_wallet',
            updated_at = NOW()
      WHERE job_id = $1
        AND payment_status = 'paid_wallet'`,
    [job.job_id]
  );
  return true;
}

async function markJobFailed(
  job: KlingDirectPendingJob,
  message: string,
  providerStatus: string | null,
  queryFn: QueryFn
) {
  const rows = await queryFn<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $2,
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($3::text[])
      RETURNING job_id`,
    [job.job_id, message, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return false;
  const refunded = await recordWalletRefundOnce(job, message, queryFn);
  await queryFn(
    `UPDATE app_jobs
        SET payment_status = CASE WHEN $2 THEN 'refunded_wallet' ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, refunded]
  );
  const attempt = await findProviderAttemptForJob({
    publicJobId: job.job_id,
    provider: 'kling_direct',
    providerJobId: job.provider_job_id,
    queryFn,
  });
  if (attempt) {
    await markProviderAttemptFailed({
      attemptId: attempt.id,
      errorCode: providerStatus,
      errorClass: 'provider_terminal_failure',
      fallbackEligible: false,
      responseSnapshot: { providerStatus, message },
      queryFn,
    });
  }
  return true;
}

async function markJobPollingStalled(job: KlingDirectPendingJob, queryFn: QueryFn) {
  await queryFn(
    `UPDATE app_jobs
        SET status = 'provider_polling_stalled',
            progress = GREATEST(progress, 90),
            message = $2,
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($3::text[])`,
    [job.job_id, STALLED_MESSAGE, ACTIVE_JOB_STATUSES]
  );
  const attempt = await findProviderAttemptForJob({
    publicJobId: job.job_id,
    provider: 'kling_direct',
    providerJobId: job.provider_job_id,
    queryFn,
  });
  if (attempt) {
    await markProviderAttemptFailed({
      attemptId: attempt.id,
      errorCode: 'KLING_DIRECT_POLLING_STALLED',
      errorClass: 'polling_stalled',
      fallbackEligible: false,
      responseSnapshot: { message: STALLED_MESSAGE },
      status: 'polling_stalled',
      queryFn,
    });
  }
}

async function deferStorageCopyRetry(
  job: KlingDirectPendingJob,
  task: NormalizedVideoProviderTask,
  queryFn: QueryFn
) {
  const nextCopyState = buildNextProviderVideoCopyState(job.settings_snapshot, {
    providerStatus: task.rawStatus,
    reason: 'provider_video_copy_failed',
  });
  if (!shouldRetryProviderVideoCopy({ state: nextCopyState, createdAt: job.created_at })) {
    await markJobFailed(
      job,
      `The output video could not be copied to MaxVideoAI storage after ${nextCopyState.attempts} attempts.`,
      task.rawStatus,
      queryFn
    );
    return;
  }
  await queryFn(
    `UPDATE app_jobs
        SET status = 'processing',
            progress = GREATEST(progress, 90),
            message = $2,
            settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{providerVideoCopy}', $3::jsonb, true),
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($4::text[])`,
    [job.job_id, PROVIDER_VIDEO_COPY_RETRY_MESSAGE, JSON.stringify(nextCopyState), ACTIVE_JOB_STATUSES]
  );
}

function buildCostBreakdown(job: KlingDirectPendingJob, task: NormalizedVideoProviderTask) {
  const providerCostUnits = task.providerCostUnits ?? null;
  const providerCostUsd = task.providerCostUsd ?? computeKlingDirectProviderCostUsd(providerCostUnits);
  return {
    provider: 'kling_direct',
    provider_cost_source: 'kling_final_unit_deduction',
    provider_model: resolveKlingDirectModelRoute(job.engine_id).providerModel,
    duration_sec: job.duration_sec,
    has_audio: job.has_audio === true,
    final_unit_deduction: providerCostUnits,
    provider_cost_units: providerCostUnits,
    provider_cost_usd: providerCostUsd,
    provider_cost_usd_effective: providerCostUsd,
    vendor_cost_usd: providerCostUsd,
  };
}

export async function runKlingDirectPoll(options: { deps?: KlingDirectPollDeps } = {}) {
  const deps = options.deps ?? {};
  const queryFn = deps.queryFn ?? query;
  const getKlingDirectClientFn = deps.getKlingDirectClientFn ?? getKlingDirectClient;
  const ensureFastStartVideoFn = deps.ensureFastStartVideoFn ?? ensureFastStartVideo;
  const detectVideoDimensionsFn = deps.detectVideoDimensionsFn ?? detectVideoDimensions;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const upsertLegacyJobOutputsFn = deps.upsertLegacyJobOutputsFn ?? upsertLegacyJobOutputs;
  const generateAndPersistJobPreviewVideoFn =
    deps.generateAndPersistJobPreviewVideoFn ?? generateAndPersistJobPreviewVideo;
  const generateAndPersistJobKeyframesFn =
    deps.generateAndPersistJobKeyframesFn ?? generateAndPersistJobKeyframes;

  if ((process.env.KLING_DIRECT_ENABLED ?? '').trim().toLowerCase() !== 'true' && !deps.queryFn) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }

  const rows = await queryFn<KlingDirectPendingJob>(
    `SELECT job_id, user_id, engine_id, engine_label, provider_job_id, status, duration_sec, thumb_url,
            to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
            to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
            aspect_ratio, has_audio, final_price_cents, pricing_snapshot, settings_snapshot, currency, payment_status, updated_at, created_at
       FROM app_jobs
      WHERE provider = $1
        AND provider_job_id IS NOT NULL
        AND status = ANY($2::text[])
      ORDER BY updated_at ASC
      LIMIT 10`,
    ['kling_direct', ACTIVE_JOB_STATUSES]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: true, enabled: true, checked: 0, updates: 0 });
  }

  const client = getKlingDirectClientFn();
  let updates = 0;

  for (const job of rows) {
    const now = Date.now();
    const updatedAtMs = Date.parse(job.updated_at);
    if (Number.isFinite(updatedAtMs) && now - updatedAtMs < POLL_INITIAL_DELAY_MS) {
      continue;
    }
    const createdAtMs = Date.parse(job.created_at);
    if (Number.isFinite(createdAtMs) && now - createdAtMs > POLL_MAX_DURATION_MS) {
      await markJobPollingStalled(job, queryFn);
      updates += 1;
      continue;
    }

    try {
      const route = resolveKlingDirectModelRoute(job.engine_id);
      const attempt = await findProviderAttemptForJob({
        publicJobId: job.job_id,
        provider: 'kling_direct',
        providerJobId: job.provider_job_id,
        queryFn,
      });
      const pollPathPrefix =
        getStoredPollPathPrefix(attempt?.requestSnapshot) ??
        resolveKlingDirectPollPathPrefix(route, getModeFromSettingsSnapshot(job.settings_snapshot) ?? 't2v');
      const task = await client.retrieveTask({
        pollPathPrefix,
        providerJobId: job.provider_job_id,
      });

      if (task.status === 'queued' || task.status === 'running') {
        await queryFn(
          `UPDATE app_jobs
              SET status = $2,
                  progress = GREATEST(progress, $3),
                  message = $4,
                  updated_at = NOW()
            WHERE job_id = $1
              AND status = ANY($5::text[])`,
          [
            job.job_id,
            task.status === 'running' ? 'running' : 'queued',
            task.status === 'running' ? 50 : 15,
            'Render is in progress.',
            ACTIVE_JOB_STATUSES,
          ]
        );
        if (attempt) {
          await markProviderAttemptFinished({
            attemptId: attempt.id,
            status: 'polling',
            responseSnapshot: task.raw,
            providerCostUnits: task.providerCostUnits ?? null,
            providerCostUsd: task.providerCostUsd ?? null,
            queryFn,
          });
        }
        updates += 1;
        continue;
      }

      if (task.status === 'failed') {
        const failed = await markJobFailed(
          job,
          task.message ?? 'Kling direct reported this render as failed.',
          task.rawStatus,
          queryFn
        );
        if (failed) updates += 1;
        continue;
      }

      if (!task.videoUrl) {
        const failed = await markJobFailed(job, 'Kling direct completed but returned no video URL.', task.rawStatus, queryFn);
        if (failed) updates += 1;
        continue;
      }

      const currentCopyState = getProviderVideoCopyState(job.settings_snapshot);
      if (!isProviderVideoCopyRetryDue(currentCopyState)) {
        continue;
      }

      const copiedVideoUrl = await ensureFastStartVideoFn({
        jobId: job.job_id,
        userId: job.user_id ?? undefined,
        videoUrl: task.videoUrl,
      });
      if (!copiedVideoUrl) {
        await deferStorageCopyRetry(job, task, queryFn);
        updates += 1;
        continue;
      }

      const detectedDimensions = await detectVideoDimensionsFn(copiedVideoUrl).catch(() => null);
      const detectedAspectRatio = detectedDimensions
        ? formatAspectRatioLabel(detectedDimensions.width, detectedDimensions.height)
        : null;
      const effectiveAspectRatio = detectedAspectRatio ?? job.aspect_ratio ?? '16:9';
      let thumb = job.thumb_url ?? '/assets/frames/thumb-16x9.svg';
      if (isPlaceholderThumbnail(thumb)) {
        const generatedThumb = await ensureJobThumbnailFn({
          jobId: job.job_id,
          userId: job.user_id ?? undefined,
          videoUrl: copiedVideoUrl,
          aspectRatio: effectiveAspectRatio,
          existingThumbUrl: thumb,
        });
        if (generatedThumb) {
          thumb = generatedThumb;
        }
      }

      const costBreakdown = buildCostBreakdown(job, task);
      const completedRows = await queryFn<{ job_id: string }>(
        `UPDATE app_jobs
            SET status = 'completed',
                progress = 100,
                video_url = $2,
                thumb_url = $3,
                preview_frame = $3,
                message = NULL,
                cost_breakdown_usd = $4::jsonb,
                aspect_ratio = COALESCE($5, aspect_ratio),
                settings_snapshot = CASE
                  WHEN $5::text IS NOT NULL
                    THEN jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{core,aspectRatio}', to_jsonb($5::text), true)
                  ELSE settings_snapshot
                END,
                provisional = FALSE,
                updated_at = NOW()
          WHERE job_id = $1
            AND status = ANY($6::text[])
          RETURNING job_id`,
        [job.job_id, copiedVideoUrl, thumb, JSON.stringify(costBreakdown), detectedAspectRatio, ACTIVE_JOB_STATUSES]
      );
      if (!completedRows.length) {
        continue;
      }
      await upsertLegacyJobOutputsFn({
        job_id: job.job_id,
        user_id: job.user_id,
        surface: 'video',
        video_url: copiedVideoUrl,
        audio_url: null,
        thumb_url: thumb,
        preview_frame: thumb,
        preview_video_url: job.preview_video_url,
        video_width: detectedDimensions?.width ?? null,
        video_height: detectedDimensions?.height ?? null,
        render_ids: null,
        duration_sec: job.duration_sec,
        status: 'completed',
      });
      await Promise.allSettled([
        generateAndPersistJobPreviewVideoFn({
          jobId: job.job_id,
          userId: job.user_id,
          videoUrl: copiedVideoUrl,
          existingPreviewVideoUrl: job.preview_video_url,
        }),
        generateAndPersistJobKeyframesFn({
          jobId: job.job_id,
          userId: job.user_id,
          videoUrl: copiedVideoUrl,
          durationSec: job.duration_sec,
          existingKeyframeUrls: job.keyframe_urls,
        }),
      ]);
      if (attempt) {
        await markProviderAttemptFinished({
          attemptId: attempt.id,
          status: 'completed',
          responseSnapshot: task.raw,
          providerCostUnits: task.providerCostUnits ?? null,
          providerCostUsd: task.providerCostUsd ?? null,
          queryFn,
        });
      }
      updates += 1;
    } catch (error) {
      const normalized = classifyKlingDirectError(error);
      console.warn('[kling-direct-poll] status fetch failed', {
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        errorClass: normalized.errorClass,
        code: normalized.code,
      });
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
