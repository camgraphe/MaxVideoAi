import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  PUBLIC_SEEDANCE_ENGINE_ID,
  getBytePlusArkConfig,
  getBytePlusModelArkClient,
  isBytePlusModelArkEnabled,
  scrubBytePlusError,
} from '@/server/video-providers/byteplus-modelark';
import {
  expectedBytePlusTokens,
  getBytePlusAccounting,
  getBytePlusUnitPriceUsdPer1kTokens,
} from './byteplus-accounting';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { isRecord } from './byteplus-record-utils';
import {
  buildNextBytePlusStorageCopyState,
  getBytePlusStorageCopyState,
  isBytePlusStorageCopyRetryDue,
  resolveBytePlusStorageCopyMaxAttempts,
  shouldRetryBytePlusStorageCopy,
  type BytePlusStorageCopyState,
} from './byteplus-storage-copy';

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
  shouldRetryBytePlusStorageCopy,
} from './byteplus-storage-copy';

const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 35 * 60_000;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];

async function recordPollEvent(
  job: Pick<BytePlusPendingJob, 'job_id' | 'provider_job_id' | 'engine_id'>,
  status: string,
  payload: Record<string, unknown>
) {
  try {
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        job.job_id,
        BYTEPLUS_MODELARK_PROVIDER,
        job.provider_job_id,
        job.engine_id,
        status,
        JSON.stringify({
          at: new Date().toISOString(),
          ...payload,
        }),
      ]
    );
  } catch (error) {
    console.warn('[byteplus-poll] failed to record poll event', { jobId: job.job_id, status }, error);
  }
}

async function recordWalletRefundOnce(job: BytePlusPendingJob, reason: string) {
  if (job.payment_status !== 'paid_wallet' || !job.user_id || !job.final_price_cents) return false;

  const inserted = await query<{ id: string }>(
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

  await query(
    `UPDATE app_jobs
        SET payment_status = 'refunded_wallet',
            updated_at = NOW()
      WHERE job_id = $1
        AND payment_status = 'paid_wallet'`,
    [job.job_id]
  );
  return true;
}

async function markJobFailed(job: BytePlusPendingJob, message: string, providerStatus?: string | null) {
  const claimed = await query<{ job_id: string }>(
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
  if (!claimed.length) {
    await recordPollEvent(job, 'poll:failed:skipped', {
      providerStatus: providerStatus ?? null,
      reason: 'job_not_active',
    });
    return;
  }

  const refunded = await recordWalletRefundOnce(job, message);
  await query(
    `UPDATE app_jobs
        SET payment_status = CASE WHEN $2 THEN 'refunded_wallet' ELSE payment_status END,
            updated_at = NOW()
      WHERE job_id = $1`,
    [job.job_id, refunded]
  );
  await recordPollEvent(job, 'poll:failed', { providerStatus: providerStatus ?? null, refunded });
}

async function deferStorageCopyRetry(job: BytePlusPendingJob, state: BytePlusStorageCopyState, providerStatus?: string | null) {
  await query(
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
      'Generated video is ready. Copying it to MaxVideoAI storage.',
      JSON.stringify(state),
      ACTIVE_JOB_STATUSES,
    ]
  );
  await recordPollEvent(job, 'poll:storage-copy-retry', {
    providerStatus: providerStatus ?? null,
    attempts: state.attempts,
    maxAttempts: resolveBytePlusStorageCopyMaxAttempts(),
  });
}

export async function runBytePlusPoll() {
  if (!isBytePlusModelArkEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }

  const rows = await query<BytePlusPendingJob>(
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

  const client = getBytePlusModelArkClient();
  const config = getBytePlusArkConfig();
  let updates = 0;

  for (const job of rows) {
    const now = Date.now();
    const updatedAtMs = Date.parse(job.updated_at);
    if (Number.isFinite(updatedAtMs) && now - updatedAtMs < POLL_INITIAL_DELAY_MS) {
      continue;
    }
    const createdAtMs = Date.parse(job.created_at);
    if (Number.isFinite(createdAtMs) && now - createdAtMs > POLL_MAX_DURATION_MS) {
      await markJobFailed(job, 'Render exceeded the expected processing window.', 'timeout');
      updates += 1;
      continue;
    }

    try {
      const task = await client.retrieveTask(job.provider_job_id);
      await recordPollEvent(job, 'poll:status', {
        providerStatus: task.rawStatus,
        normalizedStatus: task.status,
        totalTokens: task.usage?.totalTokens ?? null,
        completionTokens: task.usage?.completionTokens ?? null,
        hasVideoUrl: Boolean(task.videoUrl),
      });

      if (task.status === 'queued' || task.status === 'running') {
        await query(
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
        await markJobFailed(job, task.message ?? 'The render service reported this render as failed.', task.rawStatus);
        updates += 1;
        continue;
      }

      if (!task.videoUrl) {
        await markJobFailed(job, 'The render completed but returned no video URL.', task.rawStatus);
        updates += 1;
        continue;
      }

      const currentCopyState = getBytePlusStorageCopyState(job.settings_snapshot);
      if (!isBytePlusStorageCopyRetryDue(currentCopyState)) {
        continue;
      }

      const copiedVideoUrl = await ensureFastStartVideo({
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
          await deferStorageCopyRetry(job, nextCopyState, task.rawStatus);
        } else {
          await markJobFailed(
            job,
            `The output video could not be copied to MaxVideoAI storage after ${nextCopyState.attempts} attempts.`,
            task.rawStatus
          );
        }
        updates += 1;
        continue;
      }

      let thumb = job.thumb_url ?? '/assets/frames/thumb-16x9.svg';
      if (isPlaceholderThumbnail(thumb)) {
        const generatedThumb = await ensureJobThumbnail({
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
      const unitPriceUsdPer1kTokens = getBytePlusUnitPriceUsdPer1kTokens(job.engine_id);
      const providerCostUsd = Number(((totalTokens * unitPriceUsdPer1kTokens) / 1000).toFixed(6));
      const accounting = getBytePlusAccounting(job);
      const costBreakdown = {
        provider: BYTEPLUS_MODELARK_PROVIDER,
        provider_cost_source: 'byteplus_usage_tokens',
        model: job.engine_id === PUBLIC_SEEDANCE_ENGINE_ID ? config.seedanceModelId : config.seedanceFastModelId,
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

      const completedRows = await query<{ job_id: string }>(
        `UPDATE app_jobs
            SET status = 'completed',
                progress = 100,
                video_url = $2,
                thumb_url = $3,
                preview_frame = $3,
                message = NULL,
                cost_breakdown_usd = $4::jsonb,
                provisional = FALSE,
                updated_at = NOW()
          WHERE job_id = $1
            AND status = ANY($5::text[])
          RETURNING job_id`,
        [job.job_id, copiedVideoUrl, thumb, JSON.stringify(costBreakdown), ACTIVE_JOB_STATUSES]
      );
      if (!completedRows.length) {
        await recordPollEvent(job, 'poll:completed:skipped', { reason: 'job_not_active', copiedVideo: true });
        continue;
      }
      await upsertLegacyJobOutputs({
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
        generateAndPersistJobPreviewVideo({
          jobId: job.job_id,
          userId: job.user_id,
          videoUrl: copiedVideoUrl,
          existingPreviewVideoUrl: job.preview_video_url,
        }),
        generateAndPersistJobKeyframes({
          jobId: job.job_id,
          userId: job.user_id,
          videoUrl: copiedVideoUrl,
          durationSec: job.duration_sec,
          existingKeyframeUrls: job.keyframe_urls,
        }),
      ]);
      await recordPollEvent(job, 'poll:completed', {
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
      await recordPollEvent(job, 'poll:error', { message });
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
