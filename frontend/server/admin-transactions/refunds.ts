import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, isRefundablePaymentStatus, normalizeCurrency } from './normalizers';
import type {
  ManualRefundResult,
  ManualWalletRefundByReceiptParams,
  ManualWalletRefundParams,
} from './types';

export type AdminRefundDependencies = {
  databaseConfigured(): boolean;
  ensureSchema(): Promise<void>;
  withTransaction<TResult>(callback: (executor: QueryExecutor) => Promise<TResult>): Promise<TResult>;
  now(): string;
};

const DEFAULT_DEPENDENCIES: AdminRefundDependencies = {
  databaseConfigured: () => Boolean(process.env.DATABASE_URL),
  ensureSchema: ensureBillingSchema,
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
  now: () => new Date().toISOString(),
};

type RefundContext = {
  chargeId: number;
  userId: string;
  jobId: string | null;
  amountCents: number;
  currency: string;
  description: string;
  pricingSnapshotJson: string | null;
  vendorAccountId: string | null;
  updateLinkedJob: boolean;
};

type JobRow = {
  job_id: string;
  user_id: string | null;
  payment_status: string | null;
  pricing_snapshot: unknown;
  vendor_account_id: string | null;
  message: string | null;
  engine_label: string | null;
  duration_sec: number | null;
  currency: string | null;
};

type JobChargeRow = {
  id: number;
  amount_cents: number | string | null;
  currency: string | null;
  description: string | null;
};

type ReceiptChargeRow = JobChargeRow & {
  user_id: string | null;
  job_id: string | null;
  vendor_account_id: string | null;
  pricing_snapshot: unknown;
};

type RefundAuditParams = {
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
};

async function resolveJobRefundContext(
  executor: QueryExecutor,
  jobId: string
): Promise<RefundContext> {
  const jobRows = await executor.query<JobRow>(
    `SELECT job_id, user_id, payment_status, pricing_snapshot, vendor_account_id,
            message, engine_label, duration_sec, currency
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [jobId]
  );
  const job = jobRows.at(0);
  if (!job || !job.user_id) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }

  const chargeRows = await executor.query<JobChargeRow>(
    `SELECT id, amount_cents, currency, description
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'charge'
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [jobId]
  );
  const charge = chargeRows.at(0);
  if (!charge) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }

  const refundRows = await executor.query<{ id: number }>(
    `SELECT id
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'refund'
     LIMIT 1`,
    [jobId]
  );
  if (refundRows.length) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }
  if (!isRefundablePaymentStatus(job.payment_status)) {
    throw new Error('This job was not charged via wallet or has already been refunded.');
  }

  return {
    chargeId: charge.id,
    userId: job.user_id,
    jobId: job.job_id,
    amountCents: coerceNumber(charge.amount_cents),
    currency: normalizeCurrency(charge.currency ?? job.currency ?? 'USD'),
    description: charge.description
      ? `${charge.description} (manual refund)`
      : `Manual refund for job ${job.job_id}`,
    pricingSnapshotJson:
      job.pricing_snapshot == null ? null : JSON.stringify(job.pricing_snapshot),
    vendorAccountId: job.vendor_account_id,
    updateLinkedJob: true,
  };
}

async function resolveReceiptRefundContext(
  executor: QueryExecutor,
  receiptId: number
): Promise<RefundContext> {
  const chargeRows = await executor.query<ReceiptChargeRow>(
    `SELECT id, user_id, job_id, amount_cents, currency, description,
            vendor_account_id, pricing_snapshot
     FROM app_receipts
     WHERE id = $1 AND type = 'charge'
     LIMIT 1
     FOR UPDATE`,
    [receiptId]
  );
  const charge = chargeRows.at(0);
  if (!charge) throw new Error('Charge receipt not found.');
  if (!charge.user_id) throw new Error('Charge does not belong to a wallet user.');

  const existingRefund = await executor.query<{ id: number }>(
    `SELECT id
     FROM app_receipts
     WHERE type = 'refund'
       AND (
         (($1::text IS NOT NULL) AND job_id = $1)
         OR ((metadata ->> 'original_receipt_id')::bigint = $2)
       )
     LIMIT 1`,
    [charge.job_id, receiptId]
  );
  if (existingRefund.length) throw new Error('This charge already has a refund.');

  const jobRows = charge.job_id
    ? await executor.query<{ payment_status: string | null }>(
        `SELECT payment_status
         FROM app_jobs
         WHERE job_id = $1
         LIMIT 1`,
        [charge.job_id]
      )
    : [];
  const jobInfo = jobRows.at(0) ?? null;
  if (
    jobInfo &&
    jobInfo.payment_status &&
    !isRefundablePaymentStatus(jobInfo.payment_status)
  ) {
    throw new Error('This charge is not a wallet payment or has already been refunded.');
  }

  return {
    chargeId: charge.id,
    userId: charge.user_id,
    jobId: charge.job_id,
    amountCents: coerceNumber(charge.amount_cents),
    currency: normalizeCurrency(charge.currency),
    description: charge.description
      ? `${charge.description} (manual refund)`
      : `Manual refund for receipt ${charge.id}`,
    pricingSnapshotJson:
      charge.pricing_snapshot == null
        ? null
        : typeof charge.pricing_snapshot === 'string'
          ? charge.pricing_snapshot
          : JSON.stringify(charge.pricing_snapshot),
    vendorAccountId: charge.vendor_account_id,
    updateLinkedJob: Boolean(charge.job_id && jobInfo),
  };
}

function buildRefundMetadata(params: RefundAuditParams, chargeId: number) {
  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_refund',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    original_receipt_id: chargeId,
  };
  if (params.note && params.note.trim().length) metadata.note = params.note.trim();
  return metadata;
}

function buildAdminNote(params: RefundAuditParams) {
  return [
    `Manual refund issued by ${params.adminEmail ?? params.adminUserId}`,
    params.note && params.note.trim().length ? `Note: ${params.note.trim()}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
}

async function insertRefund(
  executor: QueryExecutor,
  context: RefundContext,
  metadata: Record<string, unknown>
) {
  return executor.query<{ id: number; created_at: string }>(
    `INSERT INTO app_receipts (
       user_id, type, amount_cents, currency, description, job_id,
       pricing_snapshot, application_fee_cents, vendor_account_id,
       stripe_payment_intent_id, stripe_charge_id, metadata
     )
     VALUES ($1, 'refund', $2, $3, $4, $5, $6::jsonb, 0, $7, NULL, NULL, $8::jsonb)
     RETURNING id, created_at`,
    [
      context.userId,
      context.amountCents,
      context.currency,
      context.description,
      context.jobId,
      context.pricingSnapshotJson,
      context.vendorAccountId,
      JSON.stringify(metadata),
    ]
  );
}

async function updateLinkedJob(
  executor: QueryExecutor,
  jobId: string,
  adminNote: string
) {
  await executor.query(
    `UPDATE app_jobs
     SET payment_status = CASE
           WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
           ELSE payment_status
         END,
         status = CASE WHEN status = 'completed' THEN status ELSE 'failed' END,
         progress = CASE WHEN status = 'completed' THEN progress ELSE 0 END,
         message = CASE
           WHEN $2::text IS NULL OR $2 = '' THEN message
           WHEN message IS NULL OR message = '' THEN $2
           ELSE message || E'\\n' || $2
         END,
         updated_at = NOW()
     WHERE job_id = $1`,
    [jobId, adminNote]
  );
}

async function persistManualRefund(
  executor: QueryExecutor,
  context: RefundContext,
  params: RefundAuditParams,
  now: () => string
): Promise<ManualRefundResult> {
  const inserted = await insertRefund(
    executor,
    context,
    buildRefundMetadata(params, context.chargeId)
  );
  if (context.updateLinkedJob && context.jobId) {
    await updateLinkedJob(executor, context.jobId, buildAdminNote(params));
  }
  const refund = inserted.at(0);
  return {
    refundReceiptId: refund?.id ?? 0,
    createdAt: refund?.created_at ?? now(),
  };
}

export async function issueManualWalletRefund(
  params: ManualWalletRefundParams,
  dependencies: AdminRefundDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualRefundResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');
  const jobId = params.jobId.trim();
  if (!jobId) throw new Error('Missing jobId');

  await dependencies.ensureSchema();
  return dependencies.withTransaction(async (executor) => {
    const context = await resolveJobRefundContext(executor, jobId);
    return persistManualRefund(executor, context, params, dependencies.now);
  });
}

export async function issueManualWalletRefundByReceipt(
  params: ManualWalletRefundByReceiptParams,
  dependencies: AdminRefundDependencies = DEFAULT_DEPENDENCIES
): Promise<ManualRefundResult> {
  if (!dependencies.databaseConfigured()) throw new Error('Database unavailable');
  const receiptId = Number(params.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) throw new Error('Invalid receiptId');

  await dependencies.ensureSchema();
  return dependencies.withTransaction(async (executor) => {
    const context = await resolveReceiptRefundContext(executor, receiptId);
    return persistManualRefund(executor, context, params, dependencies.now);
  });
}
