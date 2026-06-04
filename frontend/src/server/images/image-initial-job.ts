import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import type { Currency } from '@/lib/currency';
import type { ImageGenerationMode } from '@/types/image-generation';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type { ExistingImageJobRow } from './existing-image-job-response';
import { ImageGenerationExecutionError } from './image-generation-error';

export const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';

export type ImageWalletChargeMode = 'charge' | 'included';

type ExistingImageChargeRow = {
  id: number;
  user_id: string;
  amount_cents: number;
  currency: string | null;
  surface: string | null;
  billing_product_key: string | null;
};

type ProvisionalImageJobInsert = {
  userId: string;
  jobId: string;
  surface: JobSurface;
  billingProductKey: BillingProductKey | null;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  aspectRatio: string | null;
  canUpscale: boolean;
  finalPriceCents: number;
  pricingSnapshotJson: string;
  costBreakdownJson: string | null;
  settingsSnapshotJson: string;
  currency: string;
  vendorAccountId: string | null;
  paymentStatus: string;
  visibility: 'public' | 'private';
  indexable: boolean;
};

export type AtomicImageJobResult =
  | {
      kind: 'existing_job';
      job: ExistingImageJobRow;
    }
  | {
      kind: 'created';
      recoveredCharge: boolean;
    };

async function insertProvisionalImageJob(executor: QueryExecutor, params: ProvisionalImageJobInsert) {
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
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29::jsonb,$30::jsonb,$31::jsonb,$32,$33,$34,$35,$36,$37,$38,$39
     )`,
    [
      params.jobId,
      params.userId,
      params.surface,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      params.durationSec,
      params.prompt,
      PLACEHOLDER_THUMB,
      params.aspectRatio,
      false,
      params.canUpscale,
      PLACEHOLDER_THUMB,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
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
      null,
      null,
      params.visibility,
      params.indexable,
      true,
    ]
  );
}

export async function createAtomicInitialImageJob(params: {
  userId: string;
  mode: ImageGenerationMode;
  jobId: string;
  surface: JobSurface;
  billingProductKey: BillingProductKey | null;
  description: string;
  amountCents: number;
  currency: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  aspectRatio: string | null;
  canUpscale: boolean;
  finalPriceCents: number;
  costBreakdownJson: string | null;
  settingsSnapshotJson: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  preferredCurrency: Currency | null;
  walletChargeMode?: ImageWalletChargeMode;
  includedPaymentStatus?: string;
}): Promise<AtomicImageJobResult> {
  return withDbTransaction(async (executor) => {
    const walletChargeMode = params.walletChargeMode ?? 'charge';
    await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);

    const existingJobs = await executor.query<ExistingImageJobRow>(
      `SELECT
         job_id,
         user_id,
         status,
         progress,
         provider_job_id,
         thumb_url,
         aspect_ratio,
         pricing_snapshot,
         currency,
         payment_status,
         engine_id,
         engine_label,
         render_ids,
         hero_render_id,
         message,
         settings_snapshot
       FROM app_jobs
       WHERE job_id = $1
       LIMIT 1`,
      [params.jobId]
    );

    const existingJob = existingJobs[0];
    if (existingJob) {
      if (existingJob.user_id && existingJob.user_id !== params.userId) {
        throw new ImageGenerationExecutionError('This job id is already in use.', {
          mode: params.mode,
          status: 409,
          code: 'job_id_conflict',
          extras: { jobId: params.jobId },
        });
      }
      return { kind: 'existing_job', job: existingJob };
    }

    const existingRefunds = await executor.query<{ id: number }>(
      `SELECT id
       FROM app_receipts
       WHERE job_id = $1
         AND type = 'refund'
       LIMIT 1`,
      [params.jobId]
    );

    if (existingRefunds.length) {
      throw new ImageGenerationExecutionError('This image request was already refunded.', {
        mode: params.mode,
        status: 409,
        code: 'job_already_refunded',
        extras: {
          jobId: params.jobId,
          paymentStatus: 'refunded_wallet',
        },
      });
    }

    const existingCharges = await executor.query<ExistingImageChargeRow>(
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
        throw new ImageGenerationExecutionError('This job id is already in use.', {
          mode: params.mode,
          status: 409,
          code: 'job_id_conflict',
          extras: { jobId: params.jobId },
        });
      }

      if (walletChargeMode === 'included') {
        throw new ImageGenerationExecutionError('This included image job conflicts with an existing charge.', {
          mode: params.mode,
          status: 409,
          code: 'job_charge_conflict',
          extras: { jobId: params.jobId },
        });
      }

      const existingCurrency = (existingCharge.currency ?? 'USD').toUpperCase();
      if (
        existingCharge.amount_cents !== params.amountCents ||
        existingCurrency !== params.currency.toUpperCase() ||
        (existingCharge.surface ?? null) !== params.surface ||
        (existingCharge.billing_product_key ?? null) !== params.billingProductKey
      ) {
        throw new ImageGenerationExecutionError('This job id conflicts with an existing charge.', {
          mode: params.mode,
          status: 409,
          code: 'job_charge_conflict',
          extras: { jobId: params.jobId },
        });
      }
    } else if (walletChargeMode === 'charge') {
      const reserveResult = await reserveWalletChargeInExecutor(
        executor,
        {
          userId: params.userId,
          amountCents: params.amountCents,
          currency: params.currency,
          description: params.description,
          jobId: params.jobId,
          surface: params.surface,
          billingProductKey: params.billingProductKey,
          pricingSnapshotJson: params.pricingSnapshotJson,
          applicationFeeCents: params.applicationFeeCents,
          vendorAccountId: params.vendorAccountId,
          stripePaymentIntentId: null,
          stripeChargeId: null,
        },
        { preferredCurrency: params.preferredCurrency }
      );

      if (!reserveResult.ok) {
        if (reserveResult.errorCode === 'currency_mismatch') {
          throw new ImageGenerationExecutionError(
            `Wallet currency locked to ${(reserveResult.preferredCurrency ?? 'USD').toUpperCase()}.`,
            {
              mode: params.mode,
              status: 409,
              code: 'currency_mismatch',
            }
          );
        }

        throw new ImageGenerationExecutionError('Insufficient wallet balance.', {
          mode: params.mode,
          status: 402,
          code: 'insufficient_funds',
          detail: {
            requiredCents: Math.max(0, params.amountCents - reserveResult.balanceCents),
            balanceCents: reserveResult.balanceCents,
          },
        });
      }
    }

    const paymentStatus = walletChargeMode === 'included' ? (params.includedPaymentStatus ?? 'included') : 'paid_wallet';
    await insertProvisionalImageJob(executor, {
      userId: params.userId,
      jobId: params.jobId,
      surface: params.surface,
      billingProductKey: params.billingProductKey,
      engineId: params.engineId,
      engineLabel: params.engineLabel,
      durationSec: params.durationSec,
      prompt: params.prompt,
      aspectRatio: params.aspectRatio,
      canUpscale: params.canUpscale,
      finalPriceCents: params.finalPriceCents,
      pricingSnapshotJson: params.pricingSnapshotJson,
      costBreakdownJson: params.costBreakdownJson,
      settingsSnapshotJson: params.settingsSnapshotJson,
      currency: params.currency,
      vendorAccountId: params.vendorAccountId,
      paymentStatus,
      visibility: params.visibility,
      indexable: params.indexable,
    });

    return {
      kind: 'created',
      recoveredCharge: Boolean(existingCharge),
    };
  });
}
