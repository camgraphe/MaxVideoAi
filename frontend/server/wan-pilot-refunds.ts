import { query, withDbTransaction, type TransactionQueryExecutor } from '@/lib/db';
import { isWanPilotEnvironment } from '@/server/video-providers/router';
import { withWalletFailureSettlement } from '@/server/fal-webhook-refunds';

type Stop = {
  jobId: string;
  userId: string;
  attemptId: number | null;
  message: string;
  persistRejection?: (tx: TransactionQueryExecutor) => Promise<void>;
};
type PendingStop = { job_id: string; user_id: string; attempt_id: string | null; message: string };

const eligibleJob = `j.surface = 'video' AND j.engine_id IN ('wan-3', 'wan-3-prime')
  AND j.provider_job_id IS NULL AND j.payment_status = 'paid_wallet'`;
const marker = "j.settings_snapshot->'wanPilotWalletStop'";

// An empty route has no attempts. A terminal refusal is the last direct canary attempt,
// with no acknowledgement or open attempt anywhere in the chain.
function hasEvidence(attemptId: string) {
  return `(
    (${attemptId} IS NULL AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id))
    OR (
      EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id AND a.id::text=${attemptId}
        AND a.fallback_eligible IS FALSE AND a.fallback_to_attempt_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM provider_attempts later WHERE later.job_id=j.id AND later.attempt_index>a.attempt_index))
      AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id AND (
        a.status <> 'failed' OR a.accepted_at IS NOT NULL OR a.provider_job_id IS NOT NULL
        OR a.provider NOT IN ('videorouter','apimart','alibaba_model_studio') OR COALESCE(a.error_class,'') NOT IN ('refused','invalid')
        OR a.request_snapshot #>> '{purchaseRouting,mode}' IS DISTINCT FROM 'canary'))
    )
  )`;
}

const pending = `${eligibleJob} AND j.status='provider_polling_stalled'
  AND ${marker}->>'kind' = CASE WHEN ${marker}->>'attemptId' IS NULL THEN 'empty_route' ELSE 'terminal_refusal' END
  AND ${hasEvidence(marker + "->>'attemptId'")}`;

async function settle(row: PendingStop) {
  const stale = new Error('This pilot stop no longer qualifies.');
  try {
    await withWalletFailureSettlement(
      row.job_id,
      { failureMessage: row.message, failureOrigin: 'submission_rejected' },
      async (tx) => {
        const updated = await tx.query(
          `UPDATE app_jobs j SET status='failed', progress=0, provisional=FALSE, updated_at=NOW()
        WHERE j.job_id=$1 AND j.user_id=$2 AND ${marker}->>'attemptId' IS NOT DISTINCT FROM $3::text
          AND ${pending} RETURNING j.id`,
          [row.job_id, row.user_id, row.attempt_id],
        );
        if (!updated.length) throw stale;
      },
    );
    return true;
  } catch (error) {
    if (error === stale) return false;
    throw error;
  }
}

export async function stopWanPilotWalletJob(stop: Stop): Promise<boolean> {
  // Commit the decision before attempting the refund. Claiming an outbound canary attempt
  // takes the same job-row lock. Re-read the attempt ledger after acquiring that lock.
  const stale = new Error('An active pilot job with verified stop evidence is required.');
  const row = await withDbTransaction(async (tx) => {
    await tx.query('SELECT id FROM app_jobs WHERE job_id=$1 AND user_id=$2 FOR UPDATE', [stop.jobId, stop.userId]);
    await stop.persistRejection?.(tx);
    const [intent] = await tx.query<PendingStop>(
      `UPDATE app_jobs j SET status='provider_polling_stalled', provisional=FALSE,
      settings_snapshot=COALESCE(settings_snapshot,'{}'::jsonb) || jsonb_build_object('wanPilotWalletStop',
        jsonb_build_object('kind',CASE WHEN $3::text IS NULL THEN 'empty_route' ELSE 'terminal_refusal' END,'attemptId',$3::text,'runtime',$5::text)),
      message=$4,updated_at=NOW()
      WHERE j.job_id=$1 AND j.user_id=$2 AND ${eligibleJob}
        AND j.status IN ('pending','queued','running','processing','in_progress')
        AND ${hasEvidence('$3::text')}
      RETURNING j.job_id,j.user_id,$3::text AS attempt_id,j.message`,
      [stop.jobId, stop.userId, stop.attemptId === null ? null : String(stop.attemptId), stop.message,
        isWanPilotEnvironment() ? 'preview' : 'production'],
    );
    if (!intent) throw stale;
    return intent;
  }).catch((error) => {
    if (error === stale) return null;
    throw error;
  });
  return row ? settle(row) : false;
}

export async function reconcileWanPilotWalletStops() {
  const rows = await query<PendingStop>(`SELECT j.job_id,j.user_id,${marker}->>'attemptId' AS attempt_id,j.message
    FROM app_jobs j WHERE ${pending} AND COALESCE(${marker}->>'runtime','preview')=$1
    ORDER BY j.updated_at,j.id LIMIT 10`, [isWanPilotEnvironment() ? 'preview' : 'production']);
  let settled = 0,
    errors = 0;
  for (const row of rows) {
    try {
      if (await settle(row)) settled++;
    } catch {
      errors++;
      // Let the rest of a bounded batch progress if one receipt needs manual review.
      await query(`UPDATE app_jobs j SET updated_at=NOW() WHERE j.job_id=$1 AND ${pending}`, [row.job_id]);
    }
  }
  return { checked: rows.length, settled, errors };
}
