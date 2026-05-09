import { type QueryExecutor, withDbTransaction } from '@/lib/db';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import type { Currency } from '@/lib/currency';
import type { AngleToolEngineId } from '@/types/tools-angle';
import { ANGLE_SURFACE } from './angle-request-utils';
import { AngleToolError } from './angle-error';

export const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';

type ProvisionalAngleJobInsert = {
  jobId: string;
  userId: string;
  billingProductKey: string;
  engineId: AngleToolEngineId;
  engineLabel: string;
  durationSec: number;
  promptSummary: string;
  finalPriceCents: number;
  pricingSnapshotJson: string;
  settingsSnapshotJson: string;
  currency: string;
  vendorAccountId: string | null;
};

export type CreateAngleInitialJobParams = {
  userId: string;
  jobId: string;
  description: string;
  amountCents: number;
  currency: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
  requestedOutputCount: number;
  promptSummary: string;
  settingsSnapshotJson: string;
  preferredCurrency: Currency | null;
};

async function insertProvisionalAngleJob(executor: QueryExecutor, params: ProvisionalAngleJobInsert) {
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
       preview_frame,
       status,
       progress,
       final_price_cents,
       pricing_snapshot,
       settings_snapshot,
       currency,
       vendor_account_id,
       payment_status,
       visibility,
       indexable,
       provisional
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',0,$11,$12::jsonb,$13::jsonb,$14,$15,'paid_wallet','private',FALSE,TRUE
     )`,
    [
      params.jobId,
      params.userId,
      ANGLE_SURFACE,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      params.durationSec,
      params.promptSummary,
      PLACEHOLDER_THUMB,
      PLACEHOLDER_THUMB,
      params.finalPriceCents,
      params.pricingSnapshotJson,
      params.settingsSnapshotJson,
      params.currency,
      params.vendorAccountId,
    ]
  );
}

export async function createAngleInitialJobInExecutor(
  executor: QueryExecutor,
  params: CreateAngleInitialJobParams
): Promise<void> {
  const reserveResult = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: params.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      jobId: params.jobId,
      surface: ANGLE_SURFACE,
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
      const lockedCurrency = (reserveResult.preferredCurrency ?? 'usd').toUpperCase();
      throw new AngleToolError(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`, {
        status: 409,
        code: 'wallet_currency_mismatch',
        detail: { lockedCurrency },
      });
    }

    throw new AngleToolError('Insufficient wallet balance for this angle run.', {
      status: 402,
      code: 'insufficient_wallet_funds',
      detail: {
        balanceCents: reserveResult.balanceCents,
        requiredCents: Math.max(0, params.amountCents - reserveResult.balanceCents),
      },
    });
  }

  await insertProvisionalAngleJob(executor, {
    jobId: params.jobId,
    userId: params.userId,
    billingProductKey: params.billingProductKey,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    durationSec: params.requestedOutputCount,
    promptSummary: params.promptSummary,
    finalPriceCents: params.amountCents,
    pricingSnapshotJson: params.pricingSnapshotJson,
    settingsSnapshotJson: params.settingsSnapshotJson,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
  });
}

export async function createAtomicInitialAngleJob(params: CreateAngleInitialJobParams): Promise<void> {
  try {
    await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);
      await createAngleInitialJobInExecutor(executor, params);
    });
  } catch (error) {
    if (error instanceof AngleToolError) {
      throw error;
    }

    throw new AngleToolError('Failed to save angle job.', {
      status: 500,
      code: 'job_persist_failed',
      detail: error instanceof Error ? error.message : error,
    });
  }
}
