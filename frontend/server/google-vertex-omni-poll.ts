import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  buildNextProviderVideoCopyState,
  getProviderVideoCopyState,
  isProviderVideoCopyRetryDue,
  PROVIDER_VIDEO_COPY_RETRY_MESSAGE,
  shouldRetryProviderVideoCopy,
} from '@/server/provider-output-policy';
import { isStorageConfigured, uploadFileBuffer } from '@/server/storage';
import { ensureJobThumbnail, isPlaceholderThumbnail } from '@/server/thumbnails';
import { generateAndPersistJobKeyframes } from '@/server/video-keyframes';
import { generateAndPersistJobPreviewVideo } from '@/server/video-preview';
import { upsertLegacyJobOutputs } from '@/server/media-library';
import {
  buildUserFacingRefundDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';
import { getGoogleVertexOmniClient, type GoogleVertexOmniClient } from '@/server/video-providers/google-vertex-omni/client';
import { estimateGoogleVertexOmniCost } from '@/server/video-providers/google-vertex-omni/cost';
import { classifyGoogleVertexOmniError } from '@/server/video-providers/google-vertex-omni/errors';
import {
  GOOGLE_VERTEX_OMNI_PROVIDER,
  resolveGoogleVertexOmniModelRoute,
} from '@/server/video-providers/google-vertex-omni/model-map';
import {
  extractGoogleVertexOmniVideoOutput,
  normalizeGoogleVertexOmniInteraction,
  type GoogleVertexOmniVideoOutput,
} from '@/server/video-providers/google-vertex-omni/response';
import {
  findProviderAttemptForJob,
  markProviderAttemptFailed,
  markProviderAttemptFinished,
} from '@/server/video-providers/provider-attempts';
import type { NormalizedVideoProviderTask } from '@/server/video-providers/types';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

type GoogleVertexOmniPendingJob = {
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

type GoogleVertexOmniPollDeps = {
  queryFn?: QueryFn;
  getGoogleVertexOmniClientFn?: typeof getGoogleVertexOmniClient;
  isStorageConfiguredFn?: typeof isStorageConfigured;
  uploadFileBufferFn?: typeof uploadFileBuffer;
  ensureJobThumbnailFn?: typeof ensureJobThumbnail;
  upsertLegacyJobOutputsFn?: typeof upsertLegacyJobOutputs;
  generateAndPersistJobPreviewVideoFn?: typeof generateAndPersistJobPreviewVideo;
  generateAndPersistJobKeyframesFn?: typeof generateAndPersistJobKeyframes;
};

const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 35 * 60_000;
const ACTIVE_JOB_STATUSES = ['pending', 'queued', 'running', 'processing', 'in_progress'];
const STALLED_MESSAGE = 'This render needs manual review before retrying or refunding.';

async function recordWalletRefundOnce(job: GoogleVertexOmniPendingJob, reason: string, queryFn: QueryFn) {
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

async function markJobFailed(
  job: GoogleVertexOmniPendingJob,
  message: string,
  providerStatus: string | null,
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
  const attempt = await findProviderAttemptForJob({
    publicJobId: job.job_id,
    provider: GOOGLE_VERTEX_OMNI_PROVIDER,
    providerJobId: job.provider_job_id,
    queryFn,
  });
  if (attempt) {
    await markProviderAttemptFailed({
      attemptId: attempt.id,
      errorCode: providerStatus,
      errorClass: 'provider_terminal_failure',
      fallbackEligible: false,
      responseSnapshot: { providerStatus, message: userMessage },
      queryFn,
    });
  }
  return true;
}

async function markJobPollingStalled(job: GoogleVertexOmniPendingJob, queryFn: QueryFn) {
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
    provider: GOOGLE_VERTEX_OMNI_PROVIDER,
    providerJobId: job.provider_job_id,
    queryFn,
  });
  if (attempt) {
    await markProviderAttemptFailed({
      attemptId: attempt.id,
      errorCode: 'GOOGLE_VERTEX_OMNI_POLLING_STALLED',
      errorClass: 'polling_stalled',
      fallbackEligible: false,
      responseSnapshot: { message: STALLED_MESSAGE },
      status: 'polling_stalled',
      queryFn,
    });
  }
}

async function deferStorageCopyRetry(
  job: GoogleVertexOmniPendingJob,
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

function buildCostBreakdown(job: GoogleVertexOmniPendingJob) {
  const estimate = estimateGoogleVertexOmniCost({
    engineId: job.engine_id,
    durationSec: job.duration_sec,
    audioEnabled: job.has_audio === true,
  });
  return {
    provider: GOOGLE_VERTEX_OMNI_PROVIDER,
    provider_cost_source: estimate.source,
    provider_model: resolveGoogleVertexOmniModelRoute(job.engine_id).providerModel,
    duration_sec: job.duration_sec,
    has_audio: job.has_audio === true,
    provider_cost_units: estimate.providerCostUnits,
    provider_cost_usd: estimate.providerCostUsd,
    provider_cost_usd_effective: estimate.providerCostUsd,
    vendor_cost_usd: estimate.providerCostUsd,
  };
}

async function copyGoogleOmniOutputToStorage(params: {
  output: GoogleVertexOmniVideoOutput;
  client: GoogleVertexOmniClient;
  job: GoogleVertexOmniPendingJob;
  isStorageConfiguredFn: typeof isStorageConfigured;
  uploadFileBufferFn: typeof uploadFileBuffer;
}): Promise<string | null> {
  if (!params.isStorageConfiguredFn()) return null;
  const source = params.output.data
    ? {
        data: Buffer.from(params.output.data, 'base64'),
        mime: params.output.mimeType || 'video/mp4',
      }
    : params.output.uri
      ? await params.client.downloadOutputUri(params.output.uri)
      : null;
  if (!source?.data.length) return null;

  const upload = await params.uploadFileBufferFn({
    data: source.data,
    mime: source.mime || 'video/mp4',
    userId: params.job.user_id ?? undefined,
    prefix: 'renders',
    fileName: `${params.job.job_id}-google-omni.mp4`,
    cacheControl: 'public, max-age=5184000, immutable',
  });
  return upload.url;
}

export async function runGoogleVertexOmniPoll(options: { deps?: GoogleVertexOmniPollDeps } = {}) {
  const deps = options.deps ?? {};
  const queryFn = deps.queryFn ?? query;
  const getGoogleVertexOmniClientFn = deps.getGoogleVertexOmniClientFn ?? getGoogleVertexOmniClient;
  const isStorageConfiguredFn = deps.isStorageConfiguredFn ?? isStorageConfigured;
  const uploadFileBufferFn = deps.uploadFileBufferFn ?? uploadFileBuffer;
  const ensureJobThumbnailFn = deps.ensureJobThumbnailFn ?? ensureJobThumbnail;
  const upsertLegacyJobOutputsFn = deps.upsertLegacyJobOutputsFn ?? upsertLegacyJobOutputs;
  const generateAndPersistJobPreviewVideoFn =
    deps.generateAndPersistJobPreviewVideoFn ?? generateAndPersistJobPreviewVideo;
  const generateAndPersistJobKeyframesFn =
    deps.generateAndPersistJobKeyframesFn ?? generateAndPersistJobKeyframes;

  if ((process.env.GOOGLE_VERTEX_OMNI_ENABLED ?? '').trim().toLowerCase() !== 'true' && !deps.queryFn) {
    return NextResponse.json({ ok: true, enabled: false, checked: 0, updates: 0 });
  }

  const rows = await queryFn<GoogleVertexOmniPendingJob>(
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
    [GOOGLE_VERTEX_OMNI_PROVIDER, ACTIVE_JOB_STATUSES]
  );

  if (!rows.length) {
    return NextResponse.json({ ok: true, enabled: true, checked: 0, updates: 0 });
  }

  const client = getGoogleVertexOmniClientFn();
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
      const attempt = await findProviderAttemptForJob({
        publicJobId: job.job_id,
        provider: GOOGLE_VERTEX_OMNI_PROVIDER,
        providerJobId: job.provider_job_id,
        queryFn,
      });
      const interaction = await client.fetchInteraction(job.provider_job_id);
      const task = normalizeGoogleVertexOmniInteraction(interaction, job.provider_job_id);
      const estimate = estimateGoogleVertexOmniCost({
        engineId: job.engine_id,
        durationSec: job.duration_sec,
        audioEnabled: job.has_audio === true,
      });

      if (task.status === 'queued' || task.status === 'running') {
        await queryFn(
          `UPDATE app_jobs
              SET status = 'running',
                  progress = GREATEST(progress, 50),
                  message = $2,
                  updated_at = NOW()
            WHERE job_id = $1
              AND status = ANY($3::text[])`,
          [job.job_id, 'Render is in progress.', ACTIVE_JOB_STATUSES]
        );
        if (attempt) {
          await markProviderAttemptFinished({
            attemptId: attempt.id,
            status: 'polling',
            responseSnapshot: interaction,
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
          queryFn
        );
        if (failed) updates += 1;
        continue;
      }

      const output = extractGoogleVertexOmniVideoOutput(interaction);
      if (!output) {
        const failed = await markJobFailed(job, 'The render completed but returned no video output.', task.rawStatus, queryFn);
        if (failed) updates += 1;
        continue;
      }

      const currentCopyState = getProviderVideoCopyState(job.settings_snapshot);
      if (!isProviderVideoCopyRetryDue(currentCopyState)) {
        continue;
      }

      const copiedVideoUrl = await copyGoogleOmniOutputToStorage({
        output,
        client,
        job,
        isStorageConfiguredFn,
        uploadFileBufferFn,
      }).catch((error) => {
        console.warn('[google-vertex-omni-poll] output copy failed', { jobId: job.job_id, error });
        return null;
      });
      if (!copiedVideoUrl) {
        await deferStorageCopyRetry(job, task, queryFn);
        updates += 1;
        continue;
      }

      let thumb = job.thumb_url ?? '/assets/frames/thumb-16x9.svg';
      if (isPlaceholderThumbnail(thumb)) {
        const generatedThumb = await ensureJobThumbnailFn({
          jobId: job.job_id,
          userId: job.user_id ?? undefined,
          videoUrl: copiedVideoUrl,
          aspectRatio: job.aspect_ratio ?? '16:9',
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
                provisional = FALSE,
                updated_at = NOW()
          WHERE job_id = $1
            AND status = ANY($5::text[])
          RETURNING job_id`,
        [job.job_id, copiedVideoUrl, thumb, JSON.stringify(costBreakdown), ACTIVE_JOB_STATUSES]
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
          responseSnapshot: interaction,
          providerCostUnits: estimate.providerCostUnits,
          providerCostUsd: estimate.providerCostUsd,
          queryFn,
        });
      }
      updates += 1;
    } catch (error) {
      const normalized = classifyGoogleVertexOmniError(error);
      console.warn('[google-vertex-omni-poll] status fetch failed', {
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        errorClass: normalized.errorClass,
        code: normalized.code,
      });
    }
  }

  return NextResponse.json({ ok: true, enabled: true, checked: rows.length, updates });
}
