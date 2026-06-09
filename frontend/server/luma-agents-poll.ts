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
import { getLumaAgentsClient } from '@/server/video-providers/luma-agents/client';
import { estimateLumaAgentsVideoCost } from '@/server/video-providers/luma-agents/cost';
import { classifyLumaAgentsError } from '@/server/video-providers/luma-agents/errors';
import {
  LUMA_AGENTS_DIRECT_PROVIDER,
  resolveLumaAgentsModelRoute,
} from '@/server/video-providers/luma-agents/model-map';
import { normalizeLumaAgentsGeneration } from '@/server/video-providers/luma-agents/response';
import {
  findProviderAttemptForJob,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
  type ProviderAttemptRef,
} from '@/server/video-providers/provider-attempts';
import type { NormalizedVideoProviderTask, ProviderCostEstimate } from '@/server/video-providers/types';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type LumaAgentsPollClient = {
  getGeneration(id: string): Promise<unknown>;
};

type LumaAgentsPendingJob = {
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

type LumaAgentsPollDeps = {
  queryFn?: QueryFn;
  getLumaAgentsClientFn?: () => LumaAgentsPollClient;
  ensureFastStartVideoFn?: typeof ensureFastStartVideo;
  detectVideoDimensionsFn?: typeof detectVideoDimensions;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  upsertLegacyJobOutputsFn?: typeof upsertLegacyJobOutputs;
  generateAndPersistJobPreviewVideoFn?: typeof generateAndPersistJobPreviewVideo;
  generateAndPersistJobKeyframesFn?: typeof generateAndPersistJobKeyframes;
};

const DEFAULT_POLL_INITIAL_DELAY_MS = 5_000;
const DEFAULT_POLL_MAX_DURATION_MINUTES = 35;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];
const STALLED_MESSAGE = 'This render needs manual review before retrying or refunding.';

function flagEnabled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function getPollInitialDelayMs(): number {
  return positiveInt(process.env.LUMA_AGENTS_POLL_INTERVAL_MS, DEFAULT_POLL_INITIAL_DELAY_MS);
}

function getPollMaxDurationMs(): number {
  const minutes = positiveInt(process.env.LUMA_AGENTS_VIDEO_POLL_MAX_MINUTES, DEFAULT_POLL_MAX_DURATION_MINUTES);
  return minutes * 60_000;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getNestedString(snapshot: unknown, key: string): string | null {
  const record = asRecord(snapshot);
  return cleanString(record?.[key]) ?? cleanString(asRecord(record?.core)?.[key]);
}

function getModeFromJob(job: LumaAgentsPendingJob): string {
  return getNestedString(job.settings_snapshot, 'inputMode') ?? getNestedString(job.settings_snapshot, 'mode') ?? 't2v';
}

function getResolutionFromJob(job: LumaAgentsPendingJob): string | null {
  return getNestedString(job.settings_snapshot, 'resolution');
}

function estimateCostForJob(job: LumaAgentsPendingJob): ProviderCostEstimate {
  return estimateLumaAgentsVideoCost({
    engineId: job.engine_id,
    mode: getModeFromJob(job),
    durationSec: job.duration_sec,
    audioEnabled: job.has_audio === true,
    resolution: getResolutionFromJob(job),
  });
}

function buildCostBreakdown(job: LumaAgentsPendingJob) {
  const mode = getModeFromJob(job);
  const resolution = getResolutionFromJob(job) ?? '720p';
  const estimate = estimateCostForJob(job);
  const route = resolveLumaAgentsModelRoute({ engineId: job.engine_id, mode });
  return {
    provider: LUMA_AGENTS_DIRECT_PROVIDER,
    provider_cost_source: estimate.source,
    provider_model: route.providerModel,
    mode,
    duration_sec: job.duration_sec,
    has_audio: job.has_audio === true,
    resolution,
    provider_cost_units: estimate.providerCostUnits,
    provider_cost_usd: estimate.providerCostUsd,
    provider_cost_usd_effective: estimate.providerCostUsd,
    vendor_cost_usd: estimate.providerCostUsd,
  };
}

function normalizePolledGeneration(raw: unknown, providerJobId: string): NormalizedVideoProviderTask {
  const record = asRecord(raw);
  return normalizeLumaAgentsGeneration(record && 'raw' in record ? record.raw : raw, providerJobId);
}

async function recordWalletRefundOnce(job: LumaAgentsPendingJob, reason: string, queryFn: QueryFn) {
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
    `UPDATE app_jobs
        SET payment_status = 'refunded_wallet',
            updated_at = NOW()
      WHERE job_id = $1
        AND payment_status = 'paid_wallet'`,
    [job.job_id]
  );
  return true;
}

async function markAttemptFailedWithCost(params: {
  job: LumaAgentsPendingJob;
  attempt: ProviderAttemptRef | null;
  status?: 'failed' | 'polling_stalled';
  errorCode: string | null;
  errorClass: string;
  responseSnapshot: unknown;
  queryFn: QueryFn;
}) {
  if (!params.attempt) return;
  const estimate = estimateCostForJob(params.job);
  await markProviderAttemptFailed({
    attemptId: params.attempt.id,
    errorCode: params.errorCode,
    errorClass: params.errorClass,
    fallbackEligible: false,
    responseSnapshot: params.responseSnapshot,
    status: params.status,
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

async function findLumaAttempt(job: LumaAgentsPendingJob, queryFn: QueryFn) {
  return findProviderAttemptForJob({
    publicJobId: job.job_id,
    provider: LUMA_AGENTS_DIRECT_PROVIDER,
    providerJobId: job.provider_job_id,
    queryFn,
  });
}

async function markJobFailed(
  job: LumaAgentsPendingJob,
  message: string,
  providerStatus: string | null,
  responseSnapshot: unknown,
  queryFn: QueryFn
) {
  const userMessage = toUserFacingFailureMessage(message);
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
    [job.job_id, userMessage, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return false;

  const refunded = await recordWalletRefundOnce(job, userMessage, queryFn);
  await queryFn(
    `UPDATE app_jobs
        SET payment_status = CASE WHEN $2 THEN 'refunded_wallet' ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, refunded]
  );

  await markAttemptFailedWithCost({
    job,
    attempt: await findLumaAttempt(job, queryFn),
    errorCode: providerStatus,
    errorClass: 'provider_terminal_failure',
    responseSnapshot: responseSnapshot ?? { providerStatus, message: userMessage },
    queryFn,
  });
  return true;
}

async function markJobPollingStalled(job: LumaAgentsPendingJob, queryFn: QueryFn) {
  const rows = await queryFn<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'provider_polling_stalled',
            progress = GREATEST(progress, 90),
            message = $2,
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($3::text[])
      RETURNING job_id`,
    [job.job_id, STALLED_MESSAGE, ACTIVE_JOB_STATUSES]
  );
  if (!rows.length) return false;

  await markAttemptFailedWithCost({
    job,
    attempt: await findLumaAttempt(job, queryFn),
    status: 'polling_stalled',
    errorCode: 'LUMA_AGENTS_POLLING_STALLED',
    errorClass: 'polling_stalled',
    responseSnapshot: { message: STALLED_MESSAGE },
    queryFn,
  });
  return true;
}

async function deferStorageCopyRetry(
  job: LumaAgentsPendingJob,
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
      task.rawStatus,
      task.raw,
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

export async function runLumaAgentsPoll(options: { deps?: LumaAgentsPollDeps } = {}) {
  const deps = options.deps ?? {};
  const queryFn = deps.queryFn ?? query;
  const getLumaAgentsClientFn = deps.getLumaAgentsClientFn ?? getLumaAgentsClient;
  const ensureFastStartVideoFn = deps.ensureFastStartVideoFn ?? ensureFastStartVideo;
  const detectVideoDimensionsFn = deps.detectVideoDimensionsFn ?? detectVideoDimensions;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const upsertLegacyJobOutputsFn = deps.upsertLegacyJobOutputsFn ?? upsertLegacyJobOutputs;
  const generateAndPersistJobPreviewVideoFn =
    deps.generateAndPersistJobPreviewVideoFn ?? generateAndPersistJobPreviewVideo;
  const generateAndPersistJobKeyframesFn =
    deps.generateAndPersistJobKeyframesFn ?? generateAndPersistJobKeyframes;

  if (
    (!flagEnabled(process.env.LUMA_AGENTS_ENABLED) || !flagEnabled(process.env.LUMA_AGENTS_VIDEO_DIRECT_ENABLED)) &&
    !deps.queryFn
  ) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }

  const rows = await queryFn<LumaAgentsPendingJob>(
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
    [LUMA_AGENTS_DIRECT_PROVIDER, ACTIVE_JOB_STATUSES]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: true, enabled: true, checked: 0, updates: 0 });
  }

  const client = getLumaAgentsClientFn();
  const pollInitialDelayMs = getPollInitialDelayMs();
  const pollMaxDurationMs = getPollMaxDurationMs();
  let updates = 0;

  for (const job of rows) {
    const now = Date.now();
    const updatedAtMs = Date.parse(job.updated_at);
    if (Number.isFinite(updatedAtMs) && now - updatedAtMs < pollInitialDelayMs) {
      continue;
    }
    const createdAtMs = Date.parse(job.created_at);
    if (Number.isFinite(createdAtMs) && now - createdAtMs > pollMaxDurationMs) {
      if (await markJobPollingStalled(job, queryFn)) {
        updates += 1;
      }
      continue;
    }

    try {
      const attempt = await findLumaAttempt(job, queryFn);
      const rawGeneration = await client.getGeneration(job.provider_job_id);
      const task = normalizePolledGeneration(rawGeneration, job.provider_job_id);
      const estimate = estimateCostForJob(job);

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
            providerCostUnits: estimate.providerCostUnits,
            providerCostUsd: estimate.providerCostUsd,
            queryFn,
          });
        }
        updates += 1;
        continue;
      }

      if (task.status === 'failed') {
        const failed = await markJobFailed(
          job,
          task.message ?? 'The render failed before producing a usable output.',
          task.rawStatus,
          task.raw,
          queryFn
        );
        if (failed) updates += 1;
        continue;
      }

      if (!task.videoUrl) {
        const failed = await markJobFailed(
          job,
          'The render completed but returned no video URL.',
          task.rawStatus,
          task.raw,
          queryFn
        );
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

      const costBreakdown = buildCostBreakdown(job);
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
          providerCostUnits: estimate.providerCostUnits,
          providerCostUsd: estimate.providerCostUsd,
          queryFn,
        });
      }
      updates += 1;
    } catch (error) {
      const normalized = classifyLumaAgentsError(error);
      console.warn('[luma-agents-poll] status fetch failed', {
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        errorClass: normalized.errorClass,
        code: normalized.code,
      });
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
