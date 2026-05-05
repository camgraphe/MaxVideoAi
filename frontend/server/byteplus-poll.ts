import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { ensureFastStartVideo } from '@/server/video-faststart';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import {
  BYTEPLUS_MODELARK_PROVIDER,
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  PUBLIC_SEEDANCE_ENGINE_ID,
  getBytePlusArkConfig,
  getBytePlusModelArkClient,
  isBytePlusModelArkEnabled,
  scrubBytePlusError,
} from '@/server/video-providers/byteplus-modelark';

type BytePlusPendingJob = {
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

const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 35 * 60_000;
const BYTEPLUS_OUTPUT_COPY_WINDOW_MS = 3 * 60 * 60_000;
const DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS = 6;
const BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS = [2, 5, 15, 45, 90].map((minutes) => minutes * 60_000);
const BYTEPLUS_FAST_UNIT_PRICE_USD_PER_1K_TOKENS = 0.0056;
const BYTEPLUS_STANDARD_UNIT_PRICE_USD_PER_1K_TOKENS = 0.007;
// Live V1a smoke test: 720p / 16:9 / 5.041667s returned 108,900 tokens, $0.60984 provider cost.
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];

const BYTEPLUS_TOKEN_DIMENSIONS: Record<string, Record<string, { width: number; height: number }>> = {
  '480p': {
    '21:9': { width: 1120, height: 480 },
    '16:9': { width: 854, height: 480 },
    '4:3': { width: 640, height: 480 },
    '1:1': { width: 480, height: 480 },
    '3:4': { width: 480, height: 640 },
    '9:16': { width: 480, height: 854 },
  },
  '720p': {
    '21:9': { width: 1680, height: 720 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 960, height: 720 },
    '1:1': { width: 720, height: 720 },
    '3:4': { width: 720, height: 960 },
    '9:16': { width: 720, height: 1280 },
  },
  '1080p': {
    '21:9': { width: 2520, height: 1080 },
    '16:9': { width: 1920, height: 1080 },
    '4:3': { width: 1440, height: 1080 },
    '1:1': { width: 1080, height: 1080 },
    '3:4': { width: 1080, height: 1440 },
    '9:16': { width: 1080, height: 1920 },
  },
};

function expectedBytePlusTokens(job: Pick<BytePlusPendingJob, 'duration_sec' | 'settings_snapshot'>): number {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const core = isRecord(settings.core) ? settings.core : {};
  const resolution = typeof core.resolution === 'string' ? core.resolution : '720p';
  const aspectRatio =
    typeof core.aspectRatio === 'string' && BYTEPLUS_SEEDANCE_ASPECT_RATIOS.includes(core.aspectRatio as never)
      ? core.aspectRatio
      : '16:9';
  const dimensions = BYTEPLUS_TOKEN_DIMENSIONS[resolution]?.[aspectRatio] ?? BYTEPLUS_TOKEN_DIMENSIONS['720p']['16:9'];
  return (dimensions.width * dimensions.height * Math.max(1, Math.round(job.duration_sec)) * 24) / 1024;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export type BytePlusStorageCopyState = {
  attempts: number;
  firstFailedAt: string | null;
  lastFailedAt: string | null;
  lastProviderStatus?: string | null;
  lastReason?: string | null;
  nextRetryAt?: string | null;
};

export function resolveBytePlusStorageCopyMaxAttempts(raw = process.env.PROVIDER_VIDEO_COPY_MAX_ATTEMPTS ?? process.env.BYTEPLUS_STORAGE_COPY_MAX_ATTEMPTS): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : DEFAULT_PROVIDER_VIDEO_COPY_MAX_ATTEMPTS;
}

export function getBytePlusStorageCopyState(settingsSnapshot: unknown): BytePlusStorageCopyState {
  const settings = isRecord(settingsSnapshot) ? settingsSnapshot : {};
  const raw = isRecord(settings.byteplusStorageCopy) ? settings.byteplusStorageCopy : {};
  const attempts = Number(raw.attempts);
  return {
    attempts: Number.isFinite(attempts) && attempts > 0 ? Math.floor(attempts) : 0,
    firstFailedAt: typeof raw.firstFailedAt === 'string' && raw.firstFailedAt.length ? raw.firstFailedAt : null,
    lastFailedAt: typeof raw.lastFailedAt === 'string' && raw.lastFailedAt.length ? raw.lastFailedAt : null,
    lastProviderStatus: typeof raw.lastProviderStatus === 'string' ? raw.lastProviderStatus : null,
    lastReason: typeof raw.lastReason === 'string' ? raw.lastReason : null,
    nextRetryAt: typeof raw.nextRetryAt === 'string' && raw.nextRetryAt.length ? raw.nextRetryAt : null,
  };
}

export function buildNextBytePlusStorageCopyState(
  settingsSnapshot: unknown,
  params: { nowIso?: string; providerStatus?: string | null; reason?: string | null; maxAttempts?: number } = {}
): BytePlusStorageCopyState {
  const previous = getBytePlusStorageCopyState(settingsSnapshot);
  const nowIso = params.nowIso ?? new Date().toISOString();
  const attempts = previous.attempts + 1;
  const maxAttempts = params.maxAttempts ?? resolveBytePlusStorageCopyMaxAttempts();
  const retryDelayMs = attempts < maxAttempts ? BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS[attempts - 1] : null;
  const nowMs = Date.parse(nowIso);
  return {
    attempts,
    firstFailedAt: previous.firstFailedAt ?? nowIso,
    lastFailedAt: nowIso,
    lastProviderStatus: params.providerStatus ?? previous.lastProviderStatus ?? null,
    lastReason: params.reason ?? previous.lastReason ?? null,
    nextRetryAt:
      retryDelayMs !== null && Number.isFinite(nowMs) ? new Date(nowMs + retryDelayMs).toISOString() : null,
  };
}

export function isBytePlusStorageCopyRetryDue(
  state: Pick<BytePlusStorageCopyState, 'nextRetryAt'>,
  nowMs = Date.now()
): boolean {
  if (!state.nextRetryAt) return true;
  const nextRetryAtMs = Date.parse(state.nextRetryAt);
  if (!Number.isFinite(nextRetryAtMs)) return true;
  return nowMs >= nextRetryAtMs;
}

export function shouldRetryBytePlusStorageCopy(params: {
  state: Pick<BytePlusStorageCopyState, 'attempts'>;
  createdAt: string;
  nowMs?: number;
  maxAttempts?: number;
  copyWindowMs?: number;
}): boolean {
  const maxAttempts = params.maxAttempts ?? resolveBytePlusStorageCopyMaxAttempts();
  if (params.state.attempts >= maxAttempts) return false;
  const createdAtMs = Date.parse(params.createdAt);
  if (!Number.isFinite(createdAtMs)) return true;
  const copyWindowMs = params.copyWindowMs ?? BYTEPLUS_OUTPUT_COPY_WINDOW_MS;
  return (params.nowMs ?? Date.now()) - createdAtMs < copyWindowMs;
}

export function getBytePlusAccounting(job: Pick<BytePlusPendingJob, 'settings_snapshot' | 'has_audio'>) {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const refs = isRecord(settings.refs) ? settings.refs : {};
  const mode =
    settings.inputMode === 'extend'
      ? 'extend'
      : settings.inputMode === 'v2v'
        ? 'v2v'
        : settings.inputMode === 'ref2v'
          ? 'ref2v'
          : settings.inputMode === 'i2v'
            ? 'i2v'
            : 't2v';
  const hasStartImage = mode === 'i2v' && typeof refs.imageUrl === 'string' && refs.imageUrl.trim().length > 0;
  const hasEndImage = mode === 'i2v' && typeof refs.endImageUrl === 'string' && refs.endImageUrl.trim().length > 0;
  const hasReferenceImages = Array.isArray(refs.referenceImages) && refs.referenceImages.length > 0;
  const hasReferenceVideos = Array.isArray(refs.videoUrls) && refs.videoUrls.length > 0;
  const hasReferenceAudio = typeof refs.audioUrl === 'string' || (Array.isArray(refs.audioUrls) && refs.audioUrls.length > 0);
  const inputType =
    mode === 'extend'
      ? 'video_extension'
      : mode === 'v2v'
        ? 'video_edit'
        : mode === 'ref2v'
      ? 'reference_generation'
      : hasEndImage
        ? 'first_last_frame'
        : hasStartImage
          ? 'image_input'
          : 'text_input';

  return {
    mode,
    inputType,
    hasStartImage,
    hasEndImage,
    hasReferenceImages,
    hasReferenceVideos,
    hasReferenceAudio,
    generateAudio: job.has_audio === true,
    byteplusBillingInputType: hasReferenceVideos ? 'video_input' : 'no_video_input',
  };
}

export function getBytePlusUnitPriceUsdPer1kTokens(engineId: string | null | undefined): number {
  return engineId === PUBLIC_SEEDANCE_ENGINE_ID
    ? BYTEPLUS_STANDARD_UNIT_PRICE_USD_PER_1K_TOKENS
    : BYTEPLUS_FAST_UNIT_PRICE_USD_PER_1K_TOKENS;
}

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
