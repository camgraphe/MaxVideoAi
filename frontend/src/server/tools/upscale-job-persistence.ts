import { isDatabaseConfigured, query, type QueryExecutor, withDbTransaction } from '@/lib/db';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import type { Currency } from '@/lib/currency';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import type { PricingSnapshot } from '@/types/engines';
import type { UpscaleToolEngineId } from '@/types/tools-upscale';
import { UPSCALE_PLACEHOLDER_THUMB, UPSCALE_TOOL_EVENT_NAME } from './upscale-constants';
import { UpscaleToolError } from './upscale-errors';
import { UPSCALE_SURFACE } from './upscale-request-utils';

export type PendingUpscaleReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  surface: typeof UPSCALE_SURFACE;
  billingProductKey: string;
  snapshot: PricingSnapshot;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
};

export type CreateUpscaleInitialJobParams = {
  userId: string;
  jobId: string;
  description: string;
  amountCents: number;
  currency: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: UpscaleToolEngineId;
  engineLabel: string;
  durationSec: number;
  promptSummary: string;
  settingsSnapshotJson: string;
  preferredCurrency: Currency | null;
};

export async function recordUpscaleRefundReceipt(receipt: PendingUpscaleReceipt, label: string, priceOnly: boolean) {
  try {
    await query(
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
         platform_revenue_cents,
         destination_acct
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        label,
        receipt.jobId,
        receipt.surface,
        receipt.billingProductKey,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[tools/upscale] failed to record refund receipt', error);
  }
}

async function insertProvisionalUpscaleJob(
  executor: QueryExecutor,
  params: Omit<CreateUpscaleInitialJobParams, 'description' | 'preferredCurrency' | 'applicationFeeCents'>
) {
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
      UPSCALE_SURFACE,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      Math.max(1, Math.ceil(params.durationSec)),
      params.promptSummary,
      UPSCALE_PLACEHOLDER_THUMB,
      UPSCALE_PLACEHOLDER_THUMB,
      params.amountCents,
      params.pricingSnapshotJson,
      params.settingsSnapshotJson,
      params.currency,
      params.vendorAccountId,
    ]
  );
}

async function createUpscaleInitialJobInExecutor(
  executor: QueryExecutor,
  params: CreateUpscaleInitialJobParams
): Promise<void> {
  const reserveResult = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: params.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      jobId: params.jobId,
      surface: UPSCALE_SURFACE,
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
      throw new UpscaleToolError(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`, {
        status: 409,
        code: 'wallet_currency_mismatch',
        detail: { lockedCurrency },
      });
    }

    throw new UpscaleToolError('Insufficient wallet balance for this upscale run.', {
      status: 402,
      code: 'insufficient_wallet_funds',
      detail: {
        balanceCents: reserveResult.balanceCents,
        requiredCents: Math.max(0, params.amountCents - reserveResult.balanceCents),
      },
    });
  }

  await insertProvisionalUpscaleJob(executor, {
    userId: params.userId,
    jobId: params.jobId,
    amountCents: params.amountCents,
    currency: params.currency,
    billingProductKey: params.billingProductKey,
    pricingSnapshotJson: params.pricingSnapshotJson,
    vendorAccountId: params.vendorAccountId,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    durationSec: params.durationSec,
    promptSummary: params.promptSummary,
    settingsSnapshotJson: params.settingsSnapshotJson,
  });
}

export async function createAtomicInitialUpscaleJob(params: CreateUpscaleInitialJobParams): Promise<void> {
  try {
    await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);
      await createUpscaleInitialJobInExecutor(executor, params);
    });
  } catch (error) {
    if (error instanceof UpscaleToolError) throw error;
    throw new UpscaleToolError('Failed to save upscale job.', {
      status: 500,
      code: 'job_persist_failed',
      detail: error instanceof Error ? error.message : error,
    });
  }
}

export async function insertUpscaleToolEvent(params: {
  jobId: string;
  engineId: UpscaleToolEngineId;
  providerJobId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;
  try {
    await ensureBillingSchema();
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        getResultProviderMode(),
        params.providerJobId ?? null,
        params.engineId,
        UPSCALE_TOOL_EVENT_NAME,
        JSON.stringify(params.payload),
      ]
    );
  } catch (error) {
    console.warn('[tools/upscale] failed to persist event log', error);
  }
}
