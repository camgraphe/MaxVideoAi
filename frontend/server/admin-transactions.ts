import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { coerceNumber, normalizeCurrency } from './admin-transactions/normalizers';

export { fetchAdminTransactions, fetchTransactionAnomalies } from './admin-transactions/read-model';
export type { AdminTransactionRecord, TransactionAnomalies } from './admin-transactions/types';

const REFUNDABLE_PAYMENT_STATUSES = new Set(['paid_wallet']);

type JobChargeContext = {
  jobId: string;
  userId: string;
  paymentStatus: string | null;
  pricingSnapshot: unknown;
  vendorAccountId: string | null;
  message: string | null;
  engineLabel: string | null;
  durationSec: number | null;
  currency: string | null;
  chargeId: number;
  chargeAmountCents: number;
  chargeCurrency: string;
  chargeDescription: string | null;
};

async function getLatestWalletCharge(jobId: string): Promise<JobChargeContext | null> {
  const jobRows = await query<{
    job_id: string;
    user_id: string | null;
    payment_status: string | null;
    pricing_snapshot: unknown;
    vendor_account_id: string | null;
    message: string | null;
    engine_label: string | null;
    duration_sec: number | null;
    currency: string | null;
  }>(
    `SELECT job_id, user_id, payment_status, pricing_snapshot, vendor_account_id, message, engine_label, duration_sec, currency
     FROM app_jobs
     WHERE job_id = $1
     LIMIT 1`,
    [jobId]
  );

  const job = jobRows.at(0);
  if (!job || !job.user_id) {
    return null;
  }

  const chargeRows = await query<{
    id: number;
    amount_cents: number | string;
    currency: string | null;
    description: string | null;
  }>(
    `SELECT id, amount_cents, currency, description
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'charge'
     ORDER BY created_at DESC
     LIMIT 1`,
    [jobId]
  );

  const charge = chargeRows.at(0);
  if (!charge) {
    return null;
  }

  const refundRows = await query<{ id: number }>(
    `SELECT id
     FROM app_receipts
     WHERE job_id = $1
       AND type = 'refund'
     LIMIT 1`,
    [jobId]
  );

  if (refundRows.length) {
    return null;
  }

  return {
    jobId,
    userId: job.user_id,
    paymentStatus: job.payment_status,
    pricingSnapshot: job.pricing_snapshot,
    vendorAccountId: job.vendor_account_id,
    message: job.message,
    engineLabel: job.engine_label,
    durationSec: job.duration_sec,
    currency: job.currency,
    chargeId: charge.id,
    chargeAmountCents: coerceNumber(charge.amount_cents),
    chargeCurrency: normalizeCurrency(charge.currency ?? job.currency ?? 'USD'),
    chargeDescription: charge.description,
  };
}

export async function issueManualWalletRefund(params: {
  jobId: string;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
}): Promise<{ refundReceiptId: number; createdAt: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database unavailable');
  }

  const trimmedJobId = params.jobId.trim();
  if (!trimmedJobId) {
    throw new Error('Missing jobId');
  }

  await ensureBillingSchema();

  const context = await getLatestWalletCharge(trimmedJobId);
  if (!context) {
    throw new Error('Job or wallet charge not found, or refund already issued.');
  }

  if (!REFUNDABLE_PAYMENT_STATUSES.has(context.paymentStatus ?? '')) {
    throw new Error('This job was not charged via wallet or has already been refunded.');
  }

  const refundDescription = context.chargeDescription
    ? `${context.chargeDescription} (manual refund)`
    : `Manual refund for job ${context.jobId}`;

  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_refund',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    original_receipt_id: context.chargeId,
  };
  if (params.note && params.note.trim().length) {
    metadata.note = params.note.trim();
  }

  const pricingSnapshotJson =
    context.pricingSnapshot != null ? JSON.stringify(context.pricingSnapshot) : null;

  const adminNoteParts = [
    `Manual refund issued by ${params.adminEmail ?? params.adminUserId}`,
    params.note && params.note.trim().length ? `Note: ${params.note.trim()}` : null,
  ].filter(Boolean);
  const adminNote = adminNoteParts.join(' — ');

  await query('BEGIN');

  try {
    const inserted = await query<{ id: number; created_at: string }>(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         stripe_payment_intent_id,
         stripe_charge_id,
         metadata
       )
       VALUES (
         $1,
         'refund',
         $2,
         $3,
         $4,
         $5,
         $6::jsonb,
         0,
         $7,
         NULL,
         NULL,
         $8::jsonb
       )
       RETURNING id, created_at`,
      [
        context.userId,
        context.chargeAmountCents,
        context.chargeCurrency,
        refundDescription,
        context.jobId,
        pricingSnapshotJson,
        context.vendorAccountId,
        JSON.stringify(metadata),
      ]
    );

    await query(
      `UPDATE app_jobs
       SET payment_status = CASE
             WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
             ELSE payment_status
           END,
           status = CASE
             WHEN status = 'completed' THEN status
             ELSE 'failed'
           END,
           progress = CASE
             WHEN status = 'completed' THEN progress
             ELSE 0
           END,
           message = CASE
             WHEN $2::text IS NULL OR $2 = '' THEN message
             WHEN message IS NULL OR message = '' THEN $2
             ELSE message || '\n' || $2
           END,
           updated_at = NOW()
       WHERE job_id = $1`,
      [context.jobId, adminNote]
    );

    await query('COMMIT');
    const refund = inserted.at(0);
    return {
      refundReceiptId: refund?.id ?? 0,
      createdAt: refund?.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    await query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}


export async function issueManualWalletRefundByReceipt(params: {
  receiptId: number;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
}): Promise<{ refundReceiptId: number; createdAt: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database unavailable');
  }

  const receiptId = Number(params.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0) {
    throw new Error('Invalid receiptId');
  }

  await ensureBillingSchema();

  const chargeRows = await query<{
    id: number;
    user_id: string | null;
    job_id: string | null;
    amount_cents: number | string | null;
    currency: string | null;
    description: string | null;
    vendor_account_id: string | null;
    pricing_snapshot: unknown;
  }>(
    `SELECT id, user_id, job_id, amount_cents, currency, description, vendor_account_id, pricing_snapshot
     FROM app_receipts
     WHERE id = $1 AND type = 'charge'
     LIMIT 1`,
    [receiptId]
  );

  const charge = chargeRows.at(0);
  if (!charge) {
    throw new Error('Charge receipt not found.');
  }
  if (!charge.user_id) {
    throw new Error('Charge does not belong to a wallet user.');
  }

  const existingRefund = await query<{ id: number }>(
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
  if (existingRefund.length) {
    throw new Error('This charge already has a refund.');
  }

  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_refund',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
    original_receipt_id: receiptId,
  };
  if (params.note && params.note.trim().length) {
    metadata.note = params.note.trim();
  }

  const amountCents = coerceNumber(charge.amount_cents);
  const currency = normalizeCurrency(charge.currency);
  const description = charge.description
    ? `${charge.description} (manual refund)`
    : `Manual refund for receipt ${receiptId}`;
  const pricingSnapshotJson =
    charge.pricing_snapshot != null
      ? typeof charge.pricing_snapshot === 'string'
        ? charge.pricing_snapshot
        : JSON.stringify(charge.pricing_snapshot)
      : null;

  const jobRows = charge.job_id
    ? await query<{ payment_status: string | null }>(
        `SELECT payment_status
         FROM app_jobs
         WHERE job_id = $1
         LIMIT 1`,
        [charge.job_id]
      )
    : [];
  const jobInfo = jobRows.at(0) ?? null;
  if (jobInfo && jobInfo.payment_status && !REFUNDABLE_PAYMENT_STATUSES.has(jobInfo.payment_status)) {
    throw new Error('This charge is not a wallet payment or has already been refunded.');
  }

  await query('BEGIN');

  try {
    const inserted = await query<{ id: number; created_at: string }>(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         stripe_payment_intent_id,
         stripe_charge_id,
         metadata
       )
       VALUES (
         $1,
         'refund',
         $2,
         $3,
         $4,
         $5,
         $6::jsonb,
         0,
         $7,
         NULL,
         NULL,
         $8::jsonb
       )
       RETURNING id, created_at`,
      [
        charge.user_id,
        amountCents,
        currency,
        description,
        charge.job_id,
        pricingSnapshotJson,
        charge.vendor_account_id,
        JSON.stringify(metadata),
      ]
    );

    if (charge.job_id && jobInfo) {
      const adminNoteParts = [
        `Manual refund issued by ${params.adminEmail ?? params.adminUserId}`,
        params.note && params.note.trim().length ? `Note: ${params.note.trim()}` : null,
      ].filter(Boolean);
      const adminNote = adminNoteParts.join(' — ');

      await query(
        `UPDATE app_jobs
         SET payment_status = CASE
               WHEN payment_status = 'paid_wallet' THEN 'refunded_wallet'
               ELSE payment_status
             END,
             status = CASE
               WHEN status = 'completed' THEN status
               ELSE 'failed'
             END,
             progress = CASE
               WHEN status = 'completed' THEN progress
               ELSE 0
             END,
             message = CASE
               WHEN $2::text IS NULL OR $2 = '' THEN message
               WHEN message IS NULL OR message = '' THEN $2
               ELSE message || '
' || $2
             END,
             updated_at = NOW()
         WHERE job_id = $1`,
        [charge.job_id, adminNote]
      );
    }

    await query('COMMIT');
    const refund = inserted.at(0);
    return {
      refundReceiptId: refund?.id ?? 0,
      createdAt: refund?.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    await query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}


export async function issueManualWalletTopUp(params: {
  userId: string;
  amountCents: number;
  currency?: string | null;
  description?: string | null;
  adminUserId: string;
  adminEmail?: string | null;
  note?: string | null;
}): Promise<{ receiptId: number; createdAt: string; amountCents: number; currency: string }> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Database unavailable');
  }

  const targetUserId = params.userId.trim();
  if (!targetUserId) {
    throw new Error('Missing userId');
  }

  const normalizedAmount = Math.round(Number(params.amountCents ?? 0));
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('Invalid amountCents');
  }

  await ensureBillingSchema();

  const currency = normalizeCurrency(params.currency ?? 'USD');
  const metadata: Record<string, unknown> = {
    reason: 'manual_admin_topup',
    admin_user_id: params.adminUserId,
    admin_email: params.adminEmail ?? null,
  };
  if (params.note && params.note.trim().length) {
    metadata.note = params.note.trim();
  }

  const description = params.description && params.description.trim().length
    ? params.description.trim()
    : `Manual wallet credit issued by ${params.adminEmail ?? params.adminUserId}`;

  const inserted = await query<{ id: number; created_at: string; amount_cents: number | string | null; currency: string | null }>(
    `INSERT INTO app_receipts (
       user_id,
       type,
       amount_cents,
       currency,
       description,
       metadata
     )
     VALUES (
       $1,
       'topup',
       $2,
       $3,
       $4,
       $5::jsonb
     )
     RETURNING id, created_at, amount_cents, currency`,
    [targetUserId, normalizedAmount, currency, description, JSON.stringify(metadata)]
  );

  const row = inserted.at(0);
  return {
    receiptId: row?.id ?? 0,
    createdAt: row?.created_at ?? new Date().toISOString(),
    amountCents: coerceNumber(row?.amount_cents ?? normalizedAmount),
    currency: normalizeCurrency(row?.currency ?? currency),
  };
}
