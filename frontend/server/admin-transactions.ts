import { query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { normalizeMediaUrl } from '@/lib/media';
import { getUserIdentity } from '@/server/supabase-admin';

type RawTransactionRow = {
  receipt_id: number;
  user_id: string | null;
  type: string;
  amount_cents: number | string | null;
  currency: string | null;
  description: string | null;
  job_id: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_refund_id: string | null;
  application_fee_cents: number | string | null;
  vendor_account_id: string | null;
  job_status: string | null;
  job_payment_status: string | null;
  job_engine_label: string | null;
  job_video_url: string | null;
  job_thumb_url: string | null;
  job_message: string | null;
  job_progress: number | null;
  job_created_at: string | null;
  job_final_price_cents: number | string | null;
  job_currency: string | null;
  job_duration_sec: number | null;
  has_refund: boolean;
  latest_charge_id: number | null;
};

export type AdminTransactionRecord = {
  receiptId: number;
  userId: string | null;
  userEmail: string | null;
  type: 'topup' | 'charge' | 'refund' | 'discount' | 'tax';
  amountCents: number;
  currency: string;
  description: string | null;
  jobId: string | null;
  jobStatus: string | null;
  jobPaymentStatus: string | null;
  jobEngineLabel: string | null;
  jobVideoUrl: string | null;
  jobDurationSec: number | null;
  jobCreatedAt: string | null;
  jobProgress: number | null;
  jobMessage: string | null;
  createdAt: string;
  hasRefund: boolean;
  latestChargeId: number | null;
  isLatestCharge: boolean;
  canRefund: boolean;
};

const REFUNDABLE_PAYMENT_STATUSES = new Set(['paid_wallet']);

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

export async function fetchAdminTransactions(limit = 100): Promise<AdminTransactionRecord[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  await ensureBillingSchema();

  const normalizedLimit = Math.min(500, Math.max(1, limit));

  const rows = await query<RawTransactionRow>(
    `
      SELECT
        r.id AS receipt_id,
        r.user_id,
        r.type,
        r.amount_cents,
        r.currency,
        r.description,
        r.job_id,
        r.created_at,
        r.stripe_payment_intent_id,
        r.stripe_charge_id,
        r.stripe_refund_id,
        r.application_fee_cents,
        r.vendor_account_id,
        j.status AS job_status,
        j.payment_status AS job_payment_status,
        j.engine_label AS job_engine_label,
        j.video_url AS job_video_url,
        j.thumb_url AS job_thumb_url,
        j.message AS job_message,
        j.progress AS job_progress,
        j.created_at AS job_created_at,
        j.final_price_cents AS job_final_price_cents,
        j.currency AS job_currency,
        j.duration_sec AS job_duration_sec,
        EXISTS (
          SELECT 1
          FROM app_receipts r2
          WHERE r2.type = 'refund'
            AND (
              (r.job_id IS NOT NULL AND r2.job_id = r.job_id)
              OR ((r2.metadata ->> 'original_receipt_id')::bigint = r.id)
            )
        ) AS has_refund,
        (
          SELECT id
          FROM app_receipts r3
          WHERE r3.job_id = r.job_id
            AND r3.type = 'charge'
          ORDER BY r3.created_at DESC
          LIMIT 1
        ) AS latest_charge_id
      FROM app_receipts r
      LEFT JOIN app_jobs j ON j.job_id = r.job_id
      ORDER BY r.created_at DESC
      LIMIT $1
    `,
    [normalizedLimit]
  );

  const uniqueUserIds = Array.from(
    new Set(rows.map((row) => row.user_id).filter((value): value is string => Boolean(value)))
  );

  const userEmailMap = new Map<string, string | null>();
  if (uniqueUserIds.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const identity = await getUserIdentity(userId);
        userEmailMap.set(userId, identity?.email ?? null);
      })
    );
  }

  return rows.map((row) => {
    const amountCents = coerceNumber(row.amount_cents);
    const currency = normalizeCurrency(row.currency);
    const type = row.type as AdminTransactionRecord['type'];
    const jobExists = Boolean(
      row.job_status || row.job_payment_status || row.job_engine_label || row.job_video_url || row.job_thumb_url
    );
    const isLatestCharge =
      type === 'charge' && (row.job_id ? (jobExists ? row.latest_charge_id === row.receipt_id : true) : true);
    const refundableStatus = row.job_id
      ? jobExists
        ? typeof row.job_payment_status === 'string' && REFUNDABLE_PAYMENT_STATUSES.has(row.job_payment_status)
        : true
      : true;
    const canRefund =
      type === 'charge' &&
      !row.has_refund &&
      Boolean(row.user_id) &&
      isLatestCharge &&
      refundableStatus;

    return {
      receiptId: row.receipt_id,
      userId: row.user_id,
      userEmail: row.user_id ? userEmailMap.get(row.user_id) ?? null : null,
      type,
      amountCents,
      currency,
      description: row.description,
      jobId: row.job_id,
      jobStatus: row.job_status,
      jobPaymentStatus: row.job_payment_status,
      jobEngineLabel: row.job_engine_label,
      jobVideoUrl: row.job_video_url ? normalizeMediaUrl(row.job_video_url) ?? row.job_video_url : null,
      jobDurationSec: row.job_duration_sec ?? null,
      jobCreatedAt: row.job_created_at,
      jobProgress: row.job_progress ?? null,
      jobMessage: row.job_message,
      createdAt: row.created_at,
      hasRefund: row.has_refund,
      latestChargeId: row.latest_charge_id,
      isLatestCharge,
      canRefund,
    };
  });
}

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
