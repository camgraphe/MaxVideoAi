import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  getBytePlusArkConfig,
  getBytePlusModelArkClient,
  isBytePlusModelArkEnabled,
  getBytePlusTaskFailureCode,
  getBytePlusUserSafeTaskFailureMessage,
  resolveBytePlusPollTransport,
  resolveBytePlusSeedanceModelId,
  scrubBytePlusError,
} from '@/server/video-providers/byteplus-modelark';
import {
  expectedBytePlusTokens,
  getBytePlusAccounting,
  getBytePlusUnitPriceUsdPer1kTokens,
} from './byteplus-accounting';
import {
  markBytePlusJobFailed,
  recordBytePlusPollEvent,
} from './byteplus-poll-failure';
import { applyBytePlusTrialOutcomeSafely } from './byteplus-trial-outcomes';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { isRecord } from './byteplus-record-utils';
import {
  buildNextBytePlusStorageCopyState,
  getBytePlusStorageCopyState,
  isBytePlusStorageCopyRetryDue,
  resolveBytePlusStorageCopyMaxAttempts,
  shouldApplyBytePlusProviderTimeout,
  shouldRetryBytePlusStorageCopy,
  type BytePlusStorageCopyState,
} from './byteplus-storage-copy';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type BytePlusPollDeps = {
  nowFn?: () => number;
  queryFn?: QueryFn;
  getBytePlusArkConfigFn?: typeof getBytePlusArkConfig;
  getBytePlusModelArkClientFn?: typeof getBytePlusModelArkClient;
  ensureFastStartVideoFn?: typeof ensureFastStartVideo;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  upsertLegacyJobOutputsFn?: typeof upsertLegacyJobOutputs;
  generateAndPersistJobPreviewVideoFn?: typeof generateAndPersistJobPreviewVideo;
  generateAndPersistJobKeyframesFn?: typeof generateAndPersistJobKeyframes;
  applyBytePlusTrialOutcomeSafelyFn?: typeof applyBytePlusTrialOutcomeSafely;
  markBytePlusJobFailedFn?: typeof markBytePlusJobFailed;
  recordBytePlusPollEventFn?: typeof recordBytePlusPollEvent;
};

export {
  getBytePlusAccounting,
  getBytePlusUnitPriceUsdPer1kTokens,
} from './byteplus-accounting';
export type { BytePlusStorageCopyState } from './byteplus-storage-copy';
export {
  buildNextBytePlusStorageCopyState,
  getBytePlusStorageCopyState,
  isBytePlusStorageCopyRetryDue,
  resolveBytePlusStorageCopyMaxAttempts,
  shouldApplyBytePlusProviderTimeout,
  shouldRetryBytePlusStorageCopy,
} from './byteplus-storage-copy';

const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 35 * 60_000;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];
const STALLED_MESSAGE = 'This render needs manual review before retrying or refunding.';

async function deferStorageCopyRetry(
  job: BytePlusPendingJob,
  state: BytePlusStorageCopyState,
  providerStatus: string | null | undefined,
  queryFn: QueryFn,
  recordBytePlusPollEventFn: typeof recordBytePlusPollEvent,
) {
  await queryFn(
    `UPDATE app_jobs
        SET status = 'processing',
            progress = GREATEST(progress, 90),
            message = $2,
            settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{byteplusStorageCopy}', $3::jsonb, true),
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($4::text[])`,
    [
      job.job_id,
      'Generated video is ready. Preparing it for download.',
      JSON.stringify(state),
      ACTIVE_JOB_STATUSES,
    ]
  );
  await recordBytePlusPollEventFn(job, 'poll:storage-copy-retry', {
    providerStatus: providerStatus ?? null,
    attempts: state.attempts,
    maxAttempts: resolveBytePlusStorageCopyMaxAttempts(),
  });
}

async function markBytePlusJobPollingStalled(
  job: BytePlusPendingJob,
  queryFn: QueryFn,
  recordBytePlusPollEventFn: typeof recordBytePlusPollEvent,
) {
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
  await recordBytePlusPollEventFn(job, 'poll:stalled', {
    reason: 'provider_still_processing_after_expected_window',
  });
}

export async function runBytePlusPoll(options: { deps?: BytePlusPollDeps } = {}) {
  const deps = options.deps ?? {};
  const nowFn = deps.nowFn ?? Date.now;
  const queryFn = deps.queryFn ?? query;
  const getBytePlusArkConfigFn = deps.getBytePlusArkConfigFn ?? getBytePlusArkConfig;
  const getBytePlusModelArkClientFn = deps.getBytePlusModelArkClientFn ?? getBytePlusModelArkClient;
  const ensureFastStartVideoFn = deps.ensureFastStartVideoFn ?? ensureFastStartVideo;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const upsertLegacyJobOutputsFn = deps.upsertLegacyJobOutputsFn ?? upsertLegacyJobOutputs;
  const generateAndPersistJobPreviewVideoFn =
    deps.generateAndPersistJobPreviewVideoFn ?? generateAndPersistJobPreviewVideo;
  const generateAndPersistJobKeyframesFn =
    deps.generateAndPersistJobKeyframesFn ?? generateAndPersistJobKeyframes;
  const applyBytePlusTrialOutcomeSafelyFn =
    deps.applyBytePlusTrialOutcomeSafelyFn ?? applyBytePlusTrialOutcomeSafely;
  const markBytePlusJobFailedFn = deps.markBytePlusJobFailedFn ?? markBytePlusJobFailed;
  const recordBytePlusPollEventFn = deps.recordBytePlusPollEventFn ?? recordBytePlusPollEvent;

  if (!isBytePlusModelArkEnabled() && !deps.queryFn) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }

  const rows = await queryFn<BytePlusPendingJob>(
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
    [BYTEPLUS_MODELARK_PROVIDER, ACTIVE_JOB_STATUSES]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: true, enabled: true, checked: 0, updates: 0 });
  }

  const config = getBytePlusArkConfigFn();
  let updates = 0;

  for (const job of rows) {
    const now = nowFn();
    const updatedAtMs = Date.parse(job.updated_at);
    if (Number.isFinite(updatedAtMs) && now - updatedAtMs < POLL_INITIAL_DELAY_MS) {
      continue;
    }
    try {
      const transport = resolveBytePlusPollTransport({
        providerJobId: job.provider_job_id,
        settingsSnapshot: job.settings_snapshot,
      });
      const client = getBytePlusModelArkClientFn(transport);
      const task = await client.retrieveTask(job.provider_job_id);
      await recordBytePlusPollEventFn(job, 'poll:status', {
        providerStatus: task.rawStatus,
        transport,
        providerErrorCode: task.errorCode ?? null,
        normalizedStatus: task.status,
        totalTokens: task.usage?.totalTokens ?? null,
        completionTokens: task.usage?.completionTokens ?? null,
        hasVideoUrl: Boolean(task.videoUrl),
      });

      if (task.status === 'queued' || task.status === 'running') {
        if (shouldApplyBytePlusProviderTimeout({
          createdAt: job.created_at,
          settingsSnapshot: job.settings_snapshot,
          nowMs: now,
          maxDurationMs: POLL_MAX_DURATION_MS,
        })) {
          await markBytePlusJobPollingStalled(job, queryFn, recordBytePlusPollEventFn);
          updates += 1;
          continue;
        }
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
        updates += 1;
        continue;
      }

      if (task.status === 'failed') {
        await markBytePlusJobFailedFn(
          job,
          getBytePlusUserSafeTaskFailureMessage(task.message, task.errorCode),
          task.rawStatus,
          {
            providerErrorCode: task.errorCode ?? null,
            failureCode: getBytePlusTaskFailureCode(task.message, task.errorCode),
          }
        );
        updates += 1;
        continue;
      }

      if (!task.videoUrl) {
        await markBytePlusJobFailedFn(
          job,
          'The render completed but returned no video URL.',
          task.rawStatus,
          null,
          'unknown',
        );
        updates += 1;
        continue;
      }

      const currentCopyState = getBytePlusStorageCopyState(job.settings_snapshot);
      if (!isBytePlusStorageCopyRetryDue(currentCopyState)) {
        continue;
      }

      const copiedVideoUrl = await ensureFastStartVideoFn({
        jobId: job.job_id,
        userId: job.user_id,
        videoUrl: task.videoUrl,
      });
      if (!copiedVideoUrl) {
        const nextCopyState = buildNextBytePlusStorageCopyState(job.settings_snapshot, {
          providerStatus: task.rawStatus,
          reason: 'provider_video_copy_failed',
        });
        if (shouldRetryBytePlusStorageCopy({ state: nextCopyState, createdAt: job.created_at })) {
          await deferStorageCopyRetry(
            job,
            nextCopyState,
            task.rawStatus,
            queryFn,
            recordBytePlusPollEventFn,
          );
        } else {
          await markBytePlusJobFailedFn(
            job,
            `The output video could not be copied to MaxVideoAI storage after ${nextCopyState.attempts} attempts.`,
            task.rawStatus,
            null,
            'unknown',
          );
        }
        updates += 1;
        continue;
      }

      let thumb = job.thumb_url ?? '/assets/frames/thumb-16x9.svg';
      if (isPlaceholderThumbnail(thumb)) {
        const generatedThumb = await ensureJobThumbnailFn({
          jobId: job.job_id,
          userId: job.user_id,
          videoUrl: copiedVideoUrl,
          aspectRatio: job.aspect_ratio ?? '16:9',
          existingThumbUrl: thumb,
        });
        if (generatedThumb) {
          thumb = generatedThumb;
        }
      }

      const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
      const core = isRecord(settings.core) ? settings.core : {};
      const costResolution = typeof core.resolution === 'string' ? core.resolution : '720p';
      const costAspectRatio = typeof core.aspectRatio === 'string' ? core.aspectRatio : job.aspect_ratio ?? '16:9';
      const totalTokens = task.usage?.totalTokens ?? expectedBytePlusTokens(job);
      const accounting = getBytePlusAccounting(job);
      const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(
        job.engine_id,
        accounting.byteplusBillingInputType,
        costResolution
      );
      const providerCostUsd = Number(((totalTokens * unitPriceUsdPer1kTokens) / 1000).toFixed(6));
      const costBreakdown = {
        provider: BYTEPLUS_MODELARK_PROVIDER,
        provider_cost_source: 'byteplus_usage_tokens',
        model: resolveBytePlusSeedanceModelId(job.engine_id, config),
        mode: accounting.mode,
        input_type: accounting.inputType,
        byteplus_billing_input_type: accounting.byteplusBillingInputType,
        generate_audio: accounting.generateAudio,
        has_start_image: accounting.hasStartImage,
        has_end_image: accounting.hasEndImage,
        has_reference_images: accounting.hasReferenceImages,
        has_reference_videos: accounting.hasReferenceVideos,
        has_reference_audio: accounting.hasReferenceAudio,
        resolution: costResolution,
        aspect_ratio: costAspectRatio,
        duration_sec: job.duration_sec,
        provider_tokens: totalTokens,
        total_tokens: totalTokens,
        completion_tokens: task.usage?.completionTokens ?? null,
        unit_price_usd_per_1k_tokens: unitPriceUsdPer1kTokens,
        provider_cost_usd_list: providerCostUsd,
        provider_cost_usd_effective: providerCostUsd,
        vendor_cost_usd: providerCostUsd,
      };

      const completedRows = await queryFn<{ job_id: string }>(
        `UPDATE app_jobs
            SET status = 'completed',
                progress = 100,
                video_url = $2,
                thumb_url = $3,
                preview_frame = $3,
                message = NULL,
                cost_breakdown_usd = $4::jsonb,
                mcp_trial_outcome_disposition = CASE
                  WHEN payment_status = 'included_mcp_trial' THEN 'completed'
                  ELSE mcp_trial_outcome_disposition
                END,
                provisional = FALSE,
                updated_at = NOW()
          WHERE job_id = $1
            AND status = ANY($5::text[])
          RETURNING job_id`,
        [job.job_id, copiedVideoUrl, thumb, JSON.stringify(costBreakdown), ACTIVE_JOB_STATUSES]
      );
      if (!completedRows.length) {
        await recordBytePlusPollEventFn(job, 'poll:completed:skipped', { reason: 'job_not_active', copiedVideo: true });
        continue;
      }
      await applyBytePlusTrialOutcomeSafelyFn(job, { kind: 'completed' });
      await upsertLegacyJobOutputsFn({
        job_id: job.job_id,
        user_id: job.user_id,
        surface: 'video',
        video_url: copiedVideoUrl,
        audio_url: null,
        thumb_url: thumb,
        preview_frame: thumb,
        preview_video_url: job.preview_video_url,
        render_ids: null,
        duration_sec: job.duration_sec,
        status: 'completed',
      }).catch((error) => {
        console.warn('[byteplus-poll] failed to persist media output', {
          jobId: job.job_id,
          error: error instanceof Error ? error.message : error,
        });
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
      await recordBytePlusPollEventFn(job, 'poll:completed', {
        totalTokens,
        completionTokens: task.usage?.completionTokens ?? null,
        providerCostUsd,
        copiedVideo: true,
      });
      updates += 1;
    } catch (error) {
      const message = scrubBytePlusError(error);
      console.warn('[byteplus-poll] status fetch failed', {
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        message,
      });
      await recordBytePlusPollEventFn(job, 'poll:error', { message });
      if (shouldApplyBytePlusProviderTimeout({
        createdAt: job.created_at,
        settingsSnapshot: job.settings_snapshot,
        nowMs: now,
        maxDurationMs: POLL_MAX_DURATION_MS,
      })) {
        await markBytePlusJobPollingStalled(job, queryFn, recordBytePlusPollEventFn);
        updates += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
