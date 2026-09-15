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
import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';
import { getAlibabaModelStudioClient } from '@/server/video-providers/alibaba-model-studio/client';
import { estimateAlibabaProviderCost } from '@/server/video-providers/alibaba-model-studio/cost';
import { classifyAlibabaModelStudioError } from '@/server/video-providers/alibaba-model-studio/errors';
import {
  ALIBABA_MODEL_STUDIO_PROVIDER,
  resolveAlibabaModelRoute,
} from '@/server/video-providers/alibaba-model-studio/model-map';
import { normalizeAlibabaTask } from '@/server/video-providers/alibaba-model-studio/response';
import {
  findProviderAttemptForJob,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
  type ProviderAttemptRef,
} from '@/server/video-providers/provider-attempts';
import type { NormalizedVideoProviderTask, ProviderCostEstimate } from '@/server/video-providers/types';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type AlibabaPollClient = { getTask(id: string): Promise<unknown> };

type AlibabaPendingJob = {
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

type AlibabaPollDeps = {
  queryFn?: QueryFn;
  getAlibabaModelStudioClientFn?: () => AlibabaPollClient;
  ensureFastStartVideoFn?: typeof ensureFastStartVideo;
  detectVideoDimensionsFn?: typeof detectVideoDimensions;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  upsertLegacyJobOutputsFn?: typeof upsertLegacyJobOutputs;
  generateAndPersistJobPreviewVideoFn?: typeof generateAndPersistJobPreviewVideo;
  generateAndPersistJobKeyframesFn?: typeof generateAndPersistJobKeyframes;
};

const POLL_INITIAL_DELAY_MS = 5_000;
const DEFAULT_POLL_MAX_DURATION_MINUTES = 185;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];
const STALLED_MESSAGE = 'This render needs manual review before retrying or refunding.';

function flagEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nestedValue(snapshot: unknown, key: string): unknown {
  const record = asRecord(snapshot);
  return record?.[key] ?? asRecord(record?.core)?.[key];
}

function modeForJob(job: AlibabaPendingJob): string {
  return cleanString(nestedValue(job.settings_snapshot, 'inputMode'))
    ?? cleanString(nestedValue(job.settings_snapshot, 'mode'))
    ?? 't2v';
}

function resolutionForJob(job: AlibabaPendingJob): string {
  return cleanString(nestedValue(job.settings_snapshot, 'resolution')) ?? '720p';
}

function costForJob(
  job: AlibabaPendingJob,
  task?: NormalizedVideoProviderTask
): ProviderCostEstimate {
  const actualUnits = task?.providerCostUnits;
  const inputVideoDurationSec =
    typeof actualUnits === 'number'
      ? Math.max(0, actualUnits - job.duration_sec)
      : undefined;
  return estimateAlibabaProviderCost({
    engineId: job.engine_id,
    mode: modeForJob(job),
    durationSec: job.duration_sec,
    inputVideoDurationSec,
    resolution: resolutionForJob(job),
  });
}

function costBreakdown(job: AlibabaPendingJob, task: NormalizedVideoProviderTask) {
  const estimate = costForJob(job, task);
  const route = resolveAlibabaModelRoute(job.engine_id, modeForJob(job));
  return {
    provider: ALIBABA_MODEL_STUDIO_PROVIDER,
    provider_cost_source: estimate.source,
    provider_model: route?.model ?? null,
    mode: modeForJob(job),
    duration_sec: job.duration_sec,
    has_audio: job.has_audio === true,
    resolution: resolutionForJob(job),
    provider_cost_units: task.providerCostUnits ?? estimate.providerCostUnits,
    provider_cost_usd: estimate.providerCostUsd,
    provider_cost_usd_effective: estimate.providerCostUsd,
    vendor_cost_usd: estimate.providerCostUsd,
  };
}

function normalizePolledTask(raw: unknown, providerJobId: string): NormalizedVideoProviderTask {
  const record = asRecord(raw);
  const providerRaw = record && 'raw' in record ? record.raw : raw;
  return normalizeAlibabaTask(providerRaw, providerJobId);
}

async function findAttempt(job: AlibabaPendingJob, queryFn: QueryFn) {
  return findProviderAttemptForJob({
    publicJobId: job.job_id,
    provider: ALIBABA_MODEL_STUDIO_PROVIDER,
    providerJobId: job.provider_job_id,
    queryFn,
  });
}

async function recordWalletRefundOnce(job: AlibabaPendingJob, reason: string, queryFn: QueryFn) {
  if (job.payment_status !== 'paid_wallet' || !job.user_id || !job.final_price_cents) return false;
  const inserted = await queryFn<{ id: string }>(
    `INSERT INTO app_receipts (
       user_id, type, amount_cents, currency, description, job_id, surface,
       billing_product_key, pricing_snapshot, application_fee_cents,
       vendor_account_id, stripe_payment_intent_id, stripe_charge_id,
       platform_revenue_cents, destination_acct
     )
     VALUES ($1,'refund',$2,$3,$4,$5,'video',NULL,$6::jsonb,NULL,NULL,NULL,NULL,NULL,NULL)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      job.user_id,
      job.final_price_cents,
      (job.currency ?? 'USD').toUpperCase(),
      buildUserFacingRefundDescription({
        engineLabel: job.engine_label,
        durationSec: job.duration_sec,
        reason,
      }),
      job.job_id,
      JSON.stringify(job.pricing_snapshot ?? {}),
    ]
  );
  if (!inserted.length) return false;
  await queryFn(
    `UPDATE app_jobs SET payment_status = 'refunded_wallet', updated_at = NOW()
      WHERE job_id = $1 AND payment_status = 'paid_wallet'`,
    [job.job_id]
  );
  return true;
}

async function finishFailedAttempt(params: {
  job: AlibabaPendingJob;
  attempt: ProviderAttemptRef | null;
  errorCode: string | null;
  errorClass: string;
  responseSnapshot: unknown;
  queryFn: QueryFn;
  status?: 'failed' | 'polling_stalled';
}) {
  if (!params.attempt) return;
  const estimate = costForJob(params.job);
  await markProviderAttemptFailed({
    attemptId: params.attempt.id,
    status: params.status,
    errorCode: params.errorCode,
    errorClass: params.errorClass,
    fallbackEligible: false,
    responseSnapshot: params.responseSnapshot,
    queryFn: params.queryFn,
  });
  await markProviderAttemptFinished({
    attemptId: params.attempt.id,
    status: params.status ?? 'failed',
    responseSnapshot: params.responseSnapshot,
    providerCostUnits: estimate.providerCostUnits,
    providerCostUsd: estimate.providerCostUsd,
    queryFn: params.queryFn,
  });
}

async function markJobFailed(
  job: AlibabaPendingJob,
  message: string,
  errorCode: string | null,
  responseSnapshot: unknown,
  queryFn: QueryFn
) {
  const userMessage = toUserFacingFailureMessage(message);
  const rows = await queryFn<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'failed', progress = 0, message = $2, provisional = FALSE, updated_at = NOW()
      WHERE job_id = $1 AND status = ANY($3::text[])
      RETURNING job_id`,
    [job.job_id, userMessage, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return false;
  const refunded = await recordWalletRefundOnce(job, userMessage, queryFn);
  await queryFn(
    `UPDATE app_jobs
        SET payment_status = CASE WHEN $2 THEN 'refunded_wallet' ELSE payment_status END, updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, refunded]
  );
  await finishFailedAttempt({
    job,
    attempt: await findAttempt(job, queryFn),
    errorCode,
    errorClass: 'provider_terminal_failure',
    responseSnapshot,
    queryFn,
  });
  return true;
}

async function markJobStalled(job: AlibabaPendingJob, queryFn: QueryFn) {
  const rows = await queryFn<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'provider_polling_stalled', progress = GREATEST(progress, 90),
            message = $2, provisional = FALSE, updated_at = NOW()
      WHERE job_id = $1 AND status = ANY($3::text[])
      RETURNING job_id`,
    [job.job_id, STALLED_MESSAGE, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return false;
  await finishFailedAttempt({
    job,
    attempt: await findAttempt(job, queryFn),
    status: 'polling_stalled',
    errorCode: 'ALIBABA_MODEL_STUDIO_POLLING_STALLED',
    errorClass: 'polling_stalled',
    responseSnapshot: { message: STALLED_MESSAGE },
    queryFn,
  });
  return true;
}

async function deferStorageCopyRetry(
  job: AlibabaPendingJob,
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
      `The output video could not be prepared for download after ${nextCopyState.attempts} attempts.`,
      task.errorCode ?? task.rawStatus,
      task.raw,
      queryFn
    );
    return;
  }
  await queryFn(
    `UPDATE app_jobs
        SET status = 'processing', progress = GREATEST(progress, 90), message = $2,
            settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{providerVideoCopy}', $3::jsonb, true),
            updated_at = NOW()
      WHERE job_id = $1 AND status = ANY($4::text[])`,
    [job.job_id, PROVIDER_VIDEO_COPY_RETRY_MESSAGE, JSON.stringify(nextCopyState), ACTIVE_JOB_STATUSES]
  );
}

export async function runAlibabaModelStudioPoll(options: { deps?: AlibabaPollDeps } = {}) {
  const deps = options.deps ?? {};
  const queryFn = deps.queryFn ?? query;
  if (!flagEnabled(process.env.ALIBABA_MODEL_STUDIO_ENABLED) && !deps.queryFn) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }
  const rows = await queryFn<AlibabaPendingJob>(
    `SELECT job_id, user_id, engine_id, engine_label, provider_job_id, status, duration_sec, thumb_url,
            to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
            to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
            aspect_ratio, has_audio, final_price_cents, pricing_snapshot, settings_snapshot,
            currency, payment_status, updated_at, created_at
       FROM app_jobs
      WHERE provider = $1 AND provider_job_id IS NOT NULL AND status = ANY($2::text[])
      ORDER BY updated_at ASC
      LIMIT 10`,
    [ALIBABA_MODEL_STUDIO_PROVIDER, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return NextResponse.json({ ok: true, enabled: true, checked: 0, updates: 0 });

  const client = (deps.getAlibabaModelStudioClientFn ?? getAlibabaModelStudioClient)();
  const ensureFastStartVideoFn = deps.ensureFastStartVideoFn ?? ensureFastStartVideo;
  const detectVideoDimensionsFn = deps.detectVideoDimensionsFn ?? detectVideoDimensions;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const upsertLegacyJobOutputsFn = deps.upsertLegacyJobOutputsFn ?? upsertLegacyJobOutputs;
  const generateAndPersistJobPreviewVideoFn =
    deps.generateAndPersistJobPreviewVideoFn ?? generateAndPersistJobPreviewVideo;
  const generateAndPersistJobKeyframesFn =
    deps.generateAndPersistJobKeyframesFn ?? generateAndPersistJobKeyframes;
  const maxDurationMs =
    positiveInt(process.env.ALIBABA_MODEL_STUDIO_POLL_MAX_MINUTES, DEFAULT_POLL_MAX_DURATION_MINUTES) * 60_000;
  let updates = 0;

  for (const job of rows) {
    const updatedAtMs = Date.parse(job.updated_at);
    if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < POLL_INITIAL_DELAY_MS) continue;
    const createdAtMs = Date.parse(job.created_at);
    if (Number.isFinite(createdAtMs) && Date.now() - createdAtMs > maxDurationMs) {
      if (await markJobStalled(job, queryFn)) updates += 1;
      continue;
    }

    try {
      const attempt = await findAttempt(job, queryFn);
      const task = normalizePolledTask(await client.getTask(job.provider_job_id), job.provider_job_id);
      const estimate = costForJob(job, task);
      if (task.status === 'queued' || task.status === 'running') {
        const progressRows = await queryFn<{ job_id: string }>(
          `UPDATE app_jobs
              SET status = $2, progress = GREATEST(progress, $3), message = $4, updated_at = NOW()
            WHERE job_id = $1 AND status = ANY($5::text[])
            RETURNING job_id`,
          [
            job.job_id,
            task.status === 'running' ? 'running' : 'queued',
            task.status === 'running' ? 50 : 15,
            'Render is in progress.',
            ACTIVE_JOB_STATUSES,
          ]
        );
        if (!progressRows.length) continue;
        if (attempt) {
          await markProviderAttemptFinished({
            attemptId: attempt.id,
            status: 'polling',
            responseSnapshot: task.raw,
            providerCostUnits: task.providerCostUnits ?? estimate.providerCostUnits,
            providerCostUsd: estimate.providerCostUsd,
            queryFn,
          });
        }
        updates += 1;
        continue;
      }
      if (task.status === 'failed') {
        if (await markJobFailed(
          job,
          task.message ?? 'The render failed before producing a usable output.',
          task.errorCode ?? task.rawStatus,
          task.raw,
          queryFn
        )) updates += 1;
        continue;
      }
      if (!task.videoUrl) {
        if (await markJobFailed(job, 'The render completed but returned no video URL.', task.rawStatus, task.raw, queryFn)) {
          updates += 1;
        }
        continue;
      }

      const copyState = getProviderVideoCopyState(job.settings_snapshot);
      if (!isProviderVideoCopyRetryDue(copyState)) continue;
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

      const dimensions = await detectVideoDimensionsFn(copiedVideoUrl).catch(() => null);
      const detectedAspectRatio = dimensions
        ? formatAspectRatioLabel(dimensions.width, dimensions.height)
        : null;
      const effectiveAspectRatio = detectedAspectRatio ?? job.aspect_ratio ?? '16:9';
      let thumb = job.thumb_url ?? '/assets/frames/thumb-16x9.svg';
      if (isPlaceholderThumbnail(thumb)) {
        thumb = await ensureJobThumbnailFn({
          jobId: job.job_id,
          userId: job.user_id ?? undefined,
          videoUrl: copiedVideoUrl,
          aspectRatio: effectiveAspectRatio,
          existingThumbUrl: thumb,
        }) ?? thumb;
      }
      const completedRows = await queryFn<{ job_id: string }>(
        `UPDATE app_jobs
            SET status = 'completed', progress = 100, video_url = $2, thumb_url = $3,
                preview_frame = $3, message = NULL, cost_breakdown_usd = $4::jsonb,
                aspect_ratio = COALESCE($5, aspect_ratio),
                settings_snapshot = CASE
                  WHEN $5::text IS NOT NULL
                    THEN jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{core,aspectRatio}', to_jsonb($5::text), true)
                  ELSE settings_snapshot
                END,
                provisional = FALSE, updated_at = NOW()
          WHERE job_id = $1 AND status = ANY($6::text[])
          RETURNING job_id`,
        [
          job.job_id,
          copiedVideoUrl,
          thumb,
          JSON.stringify(costBreakdown(job, task)),
          detectedAspectRatio,
          ACTIVE_JOB_STATUSES,
        ]
      );
      if (!completedRows.length) continue;
      await upsertLegacyJobOutputsFn({
        job_id: job.job_id,
        user_id: job.user_id,
        surface: 'video',
        video_url: copiedVideoUrl,
        audio_url: null,
        thumb_url: thumb,
        preview_frame: thumb,
        preview_video_url: job.preview_video_url,
        video_width: dimensions?.width ?? null,
        video_height: dimensions?.height ?? null,
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
          providerCostUnits: task.providerCostUnits ?? estimate.providerCostUnits,
          providerCostUsd: estimate.providerCostUsd,
          queryFn,
        });
      }
      updates += 1;
    } catch (error) {
      const normalized = classifyAlibabaModelStudioError(error);
      console.warn('[alibaba-model-studio-poll] status fetch failed', {
        jobId: job.job_id,
        errorClass: normalized.errorClass,
        code: normalized.code,
      });
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
