import { withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { WALLET_FUNDED_RECEIPT_SQL } from '@/lib/wallet-funding';
import {
  buildUserFacingRefundDescription,
  isGenericFailureDescription,
  toUserFacingFailureMessage,
} from '@/server/user-facing-failure-messages';

export type WalletFailureContext = {
  engineLabel?: string | null;
  providerJobId?: string | null;
  failureMessage?: string | null;
  failureOrigin?: string | null;
};

export type WalletFailureSettlementDependencies = {
  withTransaction<T>(callback: (executor: TransactionQueryExecutor) => Promise<T>): Promise<T>;
};

const defaults: WalletFailureSettlementDependencies = { withTransaction: withDbTransaction };

function coerceNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

type WalletJob = {
  status: string | null;
  payment_status: string | null;
  user_id: string | null;
  engine_id: string | null;
  engine_label: string | null;
  duration_sec: number | string | null;
};

type WalletReceipt = {
  id: number;
  user_id: string | null;
  amount_cents: number | string;
  currency: string | null;
  wallet_funded: boolean;
  surface: string | null;
  billing_product_key: string | null;
  pricing_snapshot: unknown;
  application_fee_cents: number | null;
  vendor_account_id: string | null;
  destination_acct: string | null;
  description: string | null;
};

async function lockWalletJob(executor: TransactionQueryExecutor, jobId: string) {
  // Shared with stale submission settlement and admin refunds: advisory -> job -> charge.
  await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [jobId]);
  await executor.query('SELECT job_id FROM app_jobs WHERE job_id = $1 FOR UPDATE', [jobId]);
}

async function reconcileLockedWalletRefund(
  executor: TransactionQueryExecutor,
  jobId: string,
  context: WalletFailureContext,
  allowInsert = true,
): Promise<boolean> {
  const [job] = await executor.query<WalletJob>(
    `SELECT status, payment_status, user_id, engine_id, engine_label, duration_sec
     FROM app_jobs WHERE job_id = $1`, [jobId],
  );
  if (!job || !['paid_wallet', 'refunded_wallet'].includes(job.payment_status ?? '')) return false;

  const refunds = await executor.query<WalletReceipt>(
    `SELECT *, ${WALLET_FUNDED_RECEIPT_SQL} AS wallet_funded
     FROM app_receipts WHERE job_id = $1 AND type = 'refund' LIMIT 2`, [jobId],
  );
  // An already committed refund may need its status repaired after a late completion.
  // A completed job with no refund must never receive a new automatic credit.
  if (job.status !== 'failed' && refunds.length === 0) return false;

  const charges = await executor.query<WalletReceipt>(
    `SELECT *, ${WALLET_FUNDED_RECEIPT_SQL} AS wallet_funded
     FROM app_receipts WHERE job_id = $1 AND type = 'charge' LIMIT 2 FOR UPDATE`, [jobId],
  );
  const charge = charges[0];
  if (charges.length !== 1 || !charge.wallet_funded || !job.user_id || charge.user_id !== job.user_id
    || ['studio_assistance', 'studio_assistance_pack'].includes(charge.billing_product_key ?? '')
    || jobId.startsWith('studio-assistance:') || jobId.startsWith('studio-sol-pack:')
    || !Number.isSafeInteger(coerceNumber(charge.amount_cents)) || coerceNumber(charge.amount_cents) <= 0) {
    throw new Error('Cannot reconcile wallet refund: invalid or ambiguous wallet charge.');
  }
  if (refunds.length > 1 || refunds.some((refund) => !refund.wallet_funded
    || refund.user_id !== charge.user_id
    || coerceNumber(refund.amount_cents) !== coerceNumber(charge.amount_cents)
    || normalizeCurrency(refund.currency) !== normalizeCurrency(charge.currency))) {
    throw new Error('Cannot reconcile wallet refund: refund does not match the wallet charge.');
  }

  const userMessage = toUserFacingFailureMessage(context.failureMessage);
  const description = buildUserFacingRefundDescription({
    engineLabel: context.engineLabel ?? job.engine_label ?? job.engine_id,
    durationSec: job.duration_sec, reason: context.failureMessage,
  });
  if (!refunds.length) {
    if (!allowInsert) throw new Error('Wallet refund insert did not produce a matching receipt.');
    const inserted = await executor.query<{ id: number }>(
      `INSERT INTO app_receipts (
         user_id, type, amount_cents, currency, description, job_id, surface, billing_product_key,
         pricing_snapshot, application_fee_cents, vendor_account_id, stripe_payment_intent_id,
         stripe_charge_id, platform_revenue_cents, destination_acct, metadata
       ) VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,NULL,NULL,$9,$11,$12::jsonb)
       ON CONFLICT DO NOTHING RETURNING id`,
      [charge.user_id, charge.amount_cents, normalizeCurrency(charge.currency),
        description,
        jobId, charge.surface, charge.billing_product_key, JSON.stringify(charge.pricing_snapshot),
        charge.application_fee_cents === null ? null : 0, charge.vendor_account_id, charge.destination_acct,
        JSON.stringify({ reason: 'auto_render_failure_refund', original_receipt_id: charge.id,
          provider_job_id: context.providerJobId ?? null, failure_origin: context.failureOrigin ?? null, note: userMessage })],
    );
    // A legacy writer may not hold our advisory lock. Re-read and validate its winning
    // receipt before acknowledging a conflict; never mark refunded on an unknown conflict.
    if (!inserted.length) return reconcileLockedWalletRefund(executor, jobId, context, false);
  }
  const existing = refunds[0];
  if (existing && context.failureMessage && isGenericFailureDescription(existing.description)
    && !isGenericFailureDescription(description)) {
    await executor.query(`UPDATE app_receipts SET description = $2
      WHERE id = $1 AND description IS NOT DISTINCT FROM $3`, [existing.id, description, existing.description]);
  }
  if (job.payment_status === 'paid_wallet') {
    const updated = await executor.query<{ payment_status: string }>(
      `UPDATE app_jobs SET payment_status = 'refunded_wallet',
         message = CASE WHEN status = 'failed' THEN COALESCE(message, $2) ELSE message END, updated_at = NOW()
       WHERE job_id = $1 AND payment_status = 'paid_wallet' RETURNING payment_status`, [jobId, userMessage],
    );
    if (updated[0]?.payment_status !== 'refunded_wallet') {
      throw new Error('Wallet refund payment status was not persisted.');
    }
  }
  return true;
}

/** The failure transition and its wallet credit commit together, or both stay retryable. */
export async function withWalletFailureSettlement<T>(
  jobId: string,
  context: WalletFailureContext,
  persistFailure: (executor: TransactionQueryExecutor) => Promise<T>,
  dependencies: WalletFailureSettlementDependencies = defaults,
): Promise<T> {
  return dependencies.withTransaction(async (executor) => {
    await lockWalletJob(executor, jobId);
    const result = await persistFailure(executor);
    await reconcileLockedWalletRefund(executor, jobId, context);
    return result;
  });
}

/** Reconcile an already failed job or a historical receipt/status split. Errors are retryable. */
export async function maybeAutoRefundWalletCharge(
  jobId: string,
  context: WalletFailureContext,
  dependencies: WalletFailureSettlementDependencies = defaults,
): Promise<boolean> {
  return dependencies.withTransaction(async (executor) => {
    await lockWalletJob(executor, jobId);
    return reconcileLockedWalletRefund(executor, jobId, context);
  });
}
