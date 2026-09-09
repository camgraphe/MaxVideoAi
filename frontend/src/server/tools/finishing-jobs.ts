import { isDatabaseConfigured, query, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { getUserPreferredCurrency } from '@/lib/currency';
import type { ToolResult } from '@/lib/toolbox/contract';
import type { PreparedFinishingTool } from './finishing-prepare';

const defaultDependencies = { query, withDbTransaction, ensureBillingSchema, isDatabaseConfigured, getUserPreferredCurrency };
export function createFinishingJobStore(dependencies: Partial<typeof defaultDependencies> = {}) {
  const { query, withDbTransaction, ensureBillingSchema, isDatabaseConfigured, getUserPreferredCurrency } = { ...defaultDependencies, ...dependencies };
async function reserveFinishingJob(userId: string, jobId: string, fingerprint: string, prepared: PreparedFinishingTool) {
  if (!isDatabaseConfigured()) throw new Error('TOOL_STORAGE_UNAVAILABLE');
  await ensureBillingSchema();
  const preferredCurrency = await getUserPreferredCurrency(userId);
  return withDbTransaction(async executor => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [jobId]);
    const previous = await executor.query<{ settings_snapshot: { requestFingerprint?: string; toolResult?: ToolResult }; status: string }>('SELECT settings_snapshot, status FROM app_jobs WHERE job_id = $1 AND user_id = $2', [jobId, userId]);
    if (previous[0]) {
      if (previous[0].settings_snapshot?.requestFingerprint !== fingerprint) throw new Error('REQUEST_CONFLICT');
      return { created: false, result: previous[0].settings_snapshot.toolResult ?? null, status: previous[0].status };
    }
    const billingProductKey = `tool:${prepared.block.toolId}:${prepared.settings.quality}`;
    const pricingSnapshotJson = JSON.stringify(prepared.pricing);
    const charge = await reserveWalletChargeInExecutor(executor, {
      userId, jobId, surface: 'tool', billingProductKey, amountCents: prepared.pricing.totalCents, currency: prepared.pricing.currency,
      description: `${prepared.block.toolId} — ${prepared.settings.quality}`, pricingSnapshotJson, applicationFeeCents: null, vendorAccountId: prepared.pricing.vendorAccountId ?? null,
      stripePaymentIntentId: null, stripeChargeId: null,
    }, { preferredCurrency });
    if (!charge.ok) throw new Error(charge.errorCode === 'currency_mismatch' ? 'CURRENCY_MISMATCH' : 'INSUFFICIENT_FUNDS');
    await executor.query(`INSERT INTO app_jobs
      (job_id,user_id,surface,billing_product_key,engine_id,engine_label,duration_sec,prompt,thumb_url,status,progress,
       final_price_cents,pricing_snapshot,settings_snapshot,currency,payment_status,visibility,indexable,provisional)
      VALUES ($1,$2,'tool',$3,'toolbox-finishing',$4,$5,$4,'/assets/frames/thumb-1x1.svg','pending',0,$6,$7::jsonb,$8::jsonb,$9,'paid_wallet','private',FALSE,TRUE)`,
    [jobId, userId, billingProductKey, prepared.block.toolId, Math.ceil(prepared.facts.durationSec), prepared.pricing.totalCents, pricingSnapshotJson,
      JSON.stringify({ surface: 'tool', toolId: prepared.block.toolId, toolBlock: prepared.block, profileId: prepared.profile.id, requestFingerprint: fingerprint, sourceFacts: prepared.facts, preparedTool: prepared }), prepared.pricing.currency]);
    return { created: true, result: null, status: 'pending' };
  });
}

async function completeFinishingJob(userId: string, jobId: string, result: ToolResult, requestId: string | null) {
  const output = result.outputs[0];
  await withDbTransaction(async executor => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [jobId]);
    await executor.query(`UPDATE app_jobs SET status='completed', progress=100, video_url=$3, thumb_url=$4, preview_frame=$4,
      provider_job_id=$5, settings_snapshot=settings_snapshot || jsonb_build_object('toolResult',$6::jsonb),
      provisional=FALSE, updated_at=NOW() WHERE job_id=$1 AND user_id=$2 AND surface='tool'
        AND status='processing' AND payment_status='paid_wallet'`,
    [jobId, userId, output.originalUrl, output.thumbnailUrl ?? '/assets/frames/thumb-1x1.svg', requestId, JSON.stringify(result)]);
  });
}

async function failFinishingJob(userId: string, jobId: string, message: string, requestId: string | null) {
  await withDbTransaction(async executor => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [jobId]);
    // Refund the stored charge exactly, once. A completed job can never be refunded here.
    await executor.query(`INSERT INTO app_receipts
      (user_id,type,amount_cents,currency,description,job_id,surface,billing_product_key,pricing_snapshot)
      SELECT user_id,'refund',final_price_cents,currency,'Refund tool run',job_id,surface,billing_product_key,pricing_snapshot
      FROM app_jobs WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND status <> 'completed' AND payment_status='paid_wallet'
      ON CONFLICT DO NOTHING`, [jobId, userId]);
    await executor.query(`UPDATE app_jobs SET status='failed', progress=0, payment_status='refunded_wallet',
      provider_job_id=COALESCE($3,provider_job_id), message=$4, provisional=FALSE, updated_at=NOW()
      WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND status <> 'completed' AND payment_status='paid_wallet'`, [jobId, userId, requestId, message]);
  });
}

async function readFinishingJob(userId: string, jobId: string, options: { includeHidden?: boolean } = {}) {
  const rows = await query<{ status: string; payment_status: string | null; settings_snapshot: { toolResult?: ToolResult }; message: string | null }>(
    `SELECT status,payment_status,settings_snapshot,message FROM app_jobs
      WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND (hidden IS NOT TRUE OR $3::boolean)`, [jobId, userId, options.includeHidden === true]);
  if (!rows[0]) throw new Error('JOB_UNAVAILABLE');
  return { jobId, status: rows[0].status, result: rows[0].settings_snapshot.toolResult ?? null, error: rows[0].status === 'failed'
    ? rows[0].payment_status === 'refunded_wallet' ? 'Tool processing failed. The charge was refunded.' : 'Tool processing failed. Payment reconciliation is pending.'
    : null };
}

async function markFinishingSubmitted(userId: string, jobId: string, requestId: string) {
  await query(`UPDATE app_jobs SET provider='fal', provider_job_id=$3, status='queued', updated_at=NOW()
    WHERE job_id=$1 AND user_id=$2 AND status='pending'`, [jobId, userId, requestId]);
}

async function claimFinishingCompletion(userId: string, jobId: string) {
  const rows = await query(`UPDATE app_jobs SET status='processing', updated_at=NOW()
    WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND payment_status='paid_wallet'
      AND (status IN ('pending','queued','running') OR (status='processing' AND updated_at < NOW() - INTERVAL '15 minutes'))
    RETURNING job_id`, [jobId, userId]);
  return rows.length > 0;
}

async function readFinishingExecution(userId: string, jobId: string, options: { includeHidden?: boolean } = {}) {
  const rows = await query<{status: string; payment_status: string | null; provider_job_id: string | null; updated_at: string; settings_snapshot: {preparedTool: PreparedFinishingTool}}>(
    `SELECT status,payment_status,provider_job_id,updated_at,settings_snapshot FROM app_jobs
     WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND (hidden IS NOT TRUE OR $3::boolean)`, [jobId, userId, options.includeHidden === true]);
  return rows[0] ?? null;
}

  return { reserveFinishingJob, completeFinishingJob, failFinishingJob, readFinishingJob, markFinishingSubmitted, claimFinishingCompletion, readFinishingExecution };
}
export const { reserveFinishingJob, completeFinishingJob, failFinishingJob, readFinishingJob, markFinishingSubmitted, claimFinishingCompletion, readFinishingExecution } = createFinishingJobStore();
