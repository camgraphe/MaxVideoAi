import { type QueryExecutor, withDbTransaction } from '@/lib/db';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import type { Currency } from '@/lib/currency';

const DISPLAY_CURRENCY = 'USD';

export type PaymentMode = 'wallet' | 'direct' | 'platform';

export class VideoInitialJobError extends Error {
  status: number;
  body: Record<string, unknown>;
  metricKind: 'rejected' | 'failed';
  metricCode: string;
  metricMeta?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status: number;
      body: Record<string, unknown>;
      metricKind: 'rejected' | 'failed';
      metricCode: string;
      metricMeta?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'VideoInitialJobError';
    this.status = options.status;
    this.body = options.body;
    this.metricKind = options.metricKind;
    this.metricCode = options.metricCode;
    this.metricMeta = options.metricMeta;
  }
}

export type PendingReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  snapshot: unknown;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
};

export type ExistingVideoJobRow = {
  job_id: string;
  user_id: string | null;
  status: string | null;
  video_url: string | null;
  thumb_url: string | null;
  provider_job_id: string | null;
  progress: number | null;
  message: string | null;
  batch_id: string | null;
  group_id: string | null;
  iteration_index: number | null;
  iteration_count: number | null;
  render_ids: unknown;
  hero_render_id: string | null;
};

type ExistingVideoChargeRow = {
  id: number;
  user_id: string;
  amount_cents: number;
  currency: string | null;
  surface: string | null;
  billing_product_key: string | null;
};

type ProvisionalVideoJobInsert = {
  jobId: string;
  userId: string;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl: string;
  aspectRatio: string | null;
  hasAudio: boolean;
  canUpscale: boolean;
  previewFrame: string;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIdsJson: string | null;
  heroRenderId: string | null;
  localKey: string | null;
  message: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
  provider: string;
  finalPriceCents: number;
  pricingSnapshotJson: string;
  costBreakdownJson: string | null;
  settingsSnapshotJson: string;
  currency: string;
  vendorAccountId: string | null;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  visibility: 'public' | 'private';
  indexable: boolean;
};

type CreateVideoInitialJobParams = {
  jobId: string;
  userId: string;
  paymentMode: PaymentMode;
  pendingReceipt: PendingReceipt | null;
  preferredCurrency: Currency | null;
  resolvedCurrencyLower: string;
  jobInsert: ProvisionalVideoJobInsert;
};

type VideoInitialJobResult =
  | {
      kind: 'existing_job';
      job: ExistingVideoJobRow;
    }
  | {
      kind: 'created';
      walletChargeReserved: boolean;
    };

export function buildResponseFromExistingVideoJob(
  existing: ExistingVideoJobRow,
  localKey: string | null
) {
  return {
    ok: true,
    jobId: existing.job_id,
    status: existing.status ?? 'pending',
    videoUrl: existing.video_url,
    thumbUrl: existing.thumb_url,
    providerJobId: existing.provider_job_id,
    progress: existing.progress ?? 0,
    message: existing.message,
    batchId: existing.batch_id,
    groupId: existing.group_id,
    iterationIndex: existing.iteration_index,
    iterationCount: existing.iteration_count,
    renderIds: existing.render_ids,
    heroRenderId: existing.hero_render_id,
    localKey,
  };
}

async function insertProvisionalVideoJob(executor: QueryExecutor, params: ProvisionalVideoJobInsert) {
  await executor.query(
    `INSERT INTO app_jobs (
       job_id,
       user_id,
       surface,
       billing_product_key,
       engine_id,
       engine_label,
       duration_sec,
       prompt,
       thumb_url,
       aspect_ratio,
       has_audio,
       can_upscale,
       preview_frame,
       batch_id,
       group_id,
       iteration_index,
       iteration_count,
       render_ids,
       hero_render_id,
       local_key,
       message,
       eta_seconds,
       eta_label,
       provider,
       video_url,
       status,
       progress,
       provider_job_id,
       final_price_cents,
       pricing_snapshot,
       cost_breakdown_usd,
       settings_snapshot,
       currency,
       vendor_account_id,
       payment_status,
       stripe_payment_intent_id,
       stripe_charge_id,
       visibility,
       indexable,
       provisional
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30::jsonb,$31::jsonb,$32::jsonb,$33,$34,$35,$36,$37,$38,$39,$40
     )`,
    [
      params.jobId,
      params.userId,
      'video',
      null,
      params.engineId,
      params.engineLabel,
      params.durationSec,
      params.prompt,
      params.thumbUrl,
      params.aspectRatio,
      params.hasAudio,
      params.canUpscale,
      params.previewFrame,
      params.batchId,
      params.groupId,
      params.iterationIndex,
      params.iterationCount,
      params.renderIdsJson,
      params.heroRenderId,
      params.localKey,
      params.message,
      params.etaSeconds,
      params.etaLabel,
      params.provider,
      null,
      'pending',
      0,
      null,
      params.finalPriceCents,
      params.pricingSnapshotJson,
      params.costBreakdownJson,
      params.settingsSnapshotJson,
      params.currency,
      params.vendorAccountId,
      params.paymentStatus,
      params.stripePaymentIntentId,
      params.stripeChargeId,
      params.visibility,
      params.indexable,
      true,
    ]
  );
}

async function createVideoInitialJobInExecutor(
  executor: QueryExecutor,
  params: CreateVideoInitialJobParams
): Promise<VideoInitialJobResult> {
  const existingJobs = await executor.query<ExistingVideoJobRow>(
    `SELECT
       job_id,
       user_id,
       status,
       video_url,
       thumb_url,
       provider_job_id,
       progress,
       message,
       batch_id,
       group_id,
       iteration_index,
       iteration_count,
       render_ids,
       hero_render_id
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [params.jobId]
  );

  const existingJob = existingJobs[0];
  if (existingJob) {
    if (existingJob.user_id && existingJob.user_id !== params.userId) {
      throw new VideoInitialJobError('This job id is already in use.', {
        status: 409,
        body: { ok: false, error: 'JOB_ID_CONFLICT', message: 'This job id is already in use.' },
        metricKind: 'rejected',
        metricCode: 'JOB_ID_CONFLICT',
      });
    }
    return { kind: 'existing_job', job: existingJob };
  }

  let walletChargeReserved = false;

  if (params.paymentMode === 'wallet') {
    const existingRefunds = await executor.query<{ id: number }>(
      `SELECT id
       FROM app_receipts
       WHERE job_id = $1
         AND type = 'refund'
       LIMIT 1`,
      [params.jobId]
    );

    if (existingRefunds.length) {
      throw new VideoInitialJobError('This request was already refunded.', {
        status: 409,
        body: { ok: false, error: 'JOB_ALREADY_REFUNDED', message: 'This request was already refunded.' },
        metricKind: 'rejected',
        metricCode: 'JOB_ALREADY_REFUNDED',
      });
    }

    const existingCharges = await executor.query<ExistingVideoChargeRow>(
      `SELECT
         id,
         user_id,
         amount_cents,
         currency,
         surface,
         billing_product_key
       FROM app_receipts
       WHERE job_id = $1
         AND type = 'charge'
       ORDER BY created_at DESC
       LIMIT 1`,
      [params.jobId]
    );

    const existingCharge = existingCharges[0] ?? null;
    if (existingCharge) {
      if (existingCharge.user_id !== params.userId) {
        throw new VideoInitialJobError('This job id is already in use.', {
          status: 409,
          body: { ok: false, error: 'JOB_ID_CONFLICT', message: 'This job id is already in use.' },
          metricKind: 'rejected',
          metricCode: 'JOB_ID_CONFLICT',
        });
      }

      const existingCurrency = (existingCharge.currency ?? DISPLAY_CURRENCY).toUpperCase();
      if (
        existingCharge.amount_cents !== params.pendingReceipt?.amountCents ||
        existingCurrency !== DISPLAY_CURRENCY ||
        (existingCharge.surface ?? null) !== 'video' ||
        (existingCharge.billing_product_key ?? null) !== null
      ) {
        throw new VideoInitialJobError('This job id conflicts with an existing charge.', {
          status: 409,
          body: { ok: false, error: 'JOB_CHARGE_CONFLICT', message: 'This job id conflicts with an existing charge.' },
          metricKind: 'rejected',
          metricCode: 'JOB_CHARGE_CONFLICT',
        });
      }
      walletChargeReserved = true;
    } else {
      if (!params.pendingReceipt) {
        throw new VideoInitialJobError('Missing pending receipt for wallet payment.', {
          status: 500,
          body: { ok: false, error: 'Failed to persist job record' },
          metricKind: 'failed',
          metricCode: 'JOB_PERSIST_FAILED',
          metricMeta: { stage: 'persist_provisional' },
        });
      }

      const reserveResult = await reserveWalletChargeInExecutor(
        executor,
        {
          userId: params.userId,
          amountCents: params.pendingReceipt.amountCents,
          currency: params.pendingReceipt.currency,
          description: params.pendingReceipt.description,
          jobId: params.jobId,
          surface: 'video',
          billingProductKey: null,
          pricingSnapshotJson: params.jobInsert.pricingSnapshotJson,
          applicationFeeCents: params.pendingReceipt.applicationFeeCents,
          vendorAccountId: params.pendingReceipt.vendorAccountId,
          stripePaymentIntentId: null,
          stripeChargeId: null,
        },
        { preferredCurrency: params.preferredCurrency }
      );

      if (!reserveResult.ok) {
        if (reserveResult.errorCode === 'currency_mismatch') {
          const lockedCurrency = (reserveResult.preferredCurrency ?? params.resolvedCurrencyLower).toUpperCase();
          throw new VideoInitialJobError(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`, {
            status: 409,
            body: { ok: false, error: `Wallet currency locked to ${lockedCurrency}. Contact support to request a change.` },
            metricKind: 'rejected',
            metricCode: 'WALLET_CURRENCY_MISMATCH',
            metricMeta: { lockedCurrency },
          });
        }

        throw new VideoInitialJobError('Insufficient wallet balance for this run.', {
          status: 402,
          body: {
            ok: false,
            error: 'INSUFFICIENT_WALLET_FUNDS',
            requiredCents: Math.max(0, params.pendingReceipt.amountCents - reserveResult.balanceCents),
            balanceCents: reserveResult.balanceCents,
          },
          metricKind: 'rejected',
          metricCode: 'INSUFFICIENT_WALLET_FUNDS',
          metricMeta: { balanceCents: reserveResult.balanceCents },
        });
      }

      walletChargeReserved = true;
    }
  }

  await insertProvisionalVideoJob(executor, params.jobInsert);

  return {
    kind: 'created',
    walletChargeReserved,
  };
}

export async function createAtomicInitialVideoJob(params: CreateVideoInitialJobParams): Promise<VideoInitialJobResult> {
  try {
    return await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);
      return createVideoInitialJobInExecutor(executor, params);
    });
  } catch (error) {
    if (error instanceof VideoInitialJobError) {
      throw error;
    }

    throw new VideoInitialJobError('Failed to persist job record.', {
      status: 500,
      body: { ok: false, error: 'Failed to persist job record' },
      metricKind: 'failed',
      metricCode: 'JOB_PERSIST_FAILED',
      metricMeta: { stage: 'persist_provisional' },
    });
  }
}
