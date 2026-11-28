import { query, withDbTransaction } from '@/lib/db';
import { withWalletFailureSettlement } from '@/server/fal-webhook-refunds';
import { markProviderAttemptFailed } from '../provider-attempts';

type Stop = { jobId: string; userId: string; message: string; attemptId: number | null; errorCode: string; errorClass: 'invalid' | 'refused' };
type Intent = { job_id: string; user_id: string; message: string; attempt_id: string | null };
const eligible = `j.surface='video' AND j.engine_id IN ('kling-v4','minimax-h3') AND j.provider_job_id IS NULL AND j.payment_status='paid_wallet'`;
// Keep the persisted Kling marker readable across deployments.
const markerKey = "CASE j.engine_id WHEN 'kling-v4' THEN 'klingV4WalletStop' ELSE 'videoRouterWalletStop' END";
const marker = `(j.settings_snapshot->(${markerKey}))`;
const environment = () => process.env.VERCEL_ENV || 'local';

function evidence(attempt: string) {
  return `((${attempt} IS NULL AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id))
    OR (EXISTS (SELECT 1 FROM provider_attempts a WHERE a.id::text=${attempt} AND a.job_id=j.id AND a.attempt_index=1
        AND a.provider='videorouter' AND a.status='failed' AND a.error_class IN ('invalid','refused')
        AND a.provider_job_id IS NULL AND a.accepted_at IS NULL AND a.fallback_eligible IS FALSE AND a.fallback_to_attempt_id IS NULL
        AND a.request_snapshot #>> '{purchaseRouting,mode}'='canary')
      AND NOT EXISTS (SELECT 1 FROM provider_attempts a WHERE a.job_id=j.id AND a.id::text<>${attempt})))`;
}
const pending = `${eligible} AND j.status='provider_polling_stalled' AND ${marker}->>'environment'=$1
  AND ${marker}->>'reason' IN ('invalid','refused') AND ${evidence(marker + "->>'attemptId'")}`;

async function settle(row: Intent, settleWallet = withWalletFailureSettlement) {
  const stale = new Error('Video wallet settlement already handled.');
  try {
    await settleWallet(row.job_id, { failureOrigin: 'submission_rejected', failureMessage: row.message }, async tx => {
      const rows = await tx.query(`UPDATE app_jobs j SET status='failed', progress=0, provisional=FALSE,updated_at=NOW()
        WHERE ${pending} AND j.job_id=$2 AND j.user_id=$3 AND ${marker}->>'attemptId' IS NOT DISTINCT FROM $4::text
        RETURNING j.id`, [environment(), row.job_id, row.user_id, row.attempt_id]);
      if (!rows.length) throw stale;
    });
    return true;
  } catch (error) {
    if (error === stale) return false;
    throw error;
  }
}

export async function stopFalBackedWalletPurchase(stop: Stop, settleWallet = withWalletFailureSettlement) {
  // Job-row locking serializes the empty-plan decision with every native or broker attempt.
  // Persist the refusal and its financial intent before the separate wallet transaction.
  const stale = new Error('Video purchase state changed.');
  let intent: Intent | undefined;
  try {
    intent = await withDbTransaction(async tx => {
      await tx.query('SELECT id FROM app_jobs WHERE job_id=$1 AND user_id=$2 FOR UPDATE', [stop.jobId, stop.userId]);
      if (stop.attemptId !== null) await markProviderAttemptFailed({ attemptId: stop.attemptId,
        errorClass: stop.errorClass, errorCode: stop.errorCode, fallbackEligible: false, queryFn: (sql, values) => tx.query(sql, values) });
      const [row] = await tx.query<Intent>(`UPDATE app_jobs j SET status='provider_polling_stalled',provisional=FALSE,
        settings_snapshot=COALESCE(j.settings_snapshot,'{}'::jsonb) || jsonb_build_object(${markerKey},
          jsonb_build_object('attemptId',$3::text,'reason',$5::text,'environment',$6::text)),
        message=$4,updated_at=NOW() WHERE j.job_id=$1 AND j.user_id=$2 AND ${eligible}
          AND j.status IN ('pending','queued','running','processing','in_progress') AND ${evidence('$3::text')}
        RETURNING j.job_id,j.user_id,j.message,$3::text AS attempt_id`,
      [stop.jobId, stop.userId, stop.attemptId?.toString() ?? null, stop.message, stop.errorClass, environment()]);
      if (!row) throw stale;
      return row;
    });
  } catch (error) {
    if (error === stale) return false;
    throw error;
  }
  return settle(intent, settleWallet);
}

export async function reconcileFalBackedWalletStops() {
  const rows = await query<Intent>(`SELECT j.job_id,j.user_id,j.message,${marker}->>'attemptId' AS attempt_id
    FROM app_jobs j WHERE ${pending} ORDER BY j.updated_at,j.id LIMIT 10`, [environment()]);
  let settled = 0, errors = 0;
  for (const row of rows) {
    try {
      if (await settle(row)) settled++;
    } catch {
      errors++;
      await query(`UPDATE app_jobs j SET updated_at=NOW() WHERE ${pending} AND j.job_id=$2`, [environment(), row.job_id]);
    }
  }
  return { checked: rows.length, settled, errors };
}
