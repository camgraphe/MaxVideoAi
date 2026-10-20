import { withDbTransaction } from '@/lib/db';
import { deriveJobSurface } from '@/lib/job-surface';
import { refundAudioChargeInExecutor } from '@/server/audio/audio-generate-receipts';
import type { JobRow } from './jobs-route-types';

const STALE_AUDIO_JOB_TIMEOUT_MS = 10 * 60 * 1000;

type StaleAudioCandidate = Pick<JobRow,
  'job_id' | 'surface' | 'settings_snapshot' | 'engine_id' | 'video_url' | 'audio_url' | 'render_ids' | 'status' | 'updated_at'
>;

export function isStaleAudioJob(row: StaleAudioCandidate): boolean {
  const surface = deriveJobSurface({
    surface: row.surface,
    settingsSnapshot: row.settings_snapshot,
    jobId: row.job_id,
    engineId: row.engine_id,
    videoUrl: row.video_url,
    renderIds: row.render_ids,
  });
  if (surface !== 'audio') return false;
  if (row.video_url || row.audio_url) return false;
  const status = (row.status ?? '').trim().toLowerCase();
  if (!status || !['pending', 'running', 'queued'].includes(status)) return false;
  const updatedAt = new Date(row.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return false;
  return Date.now() - updatedAt.getTime() > STALE_AUDIO_JOB_TIMEOUT_MS;
}

export async function expireStaleAudioJob(row: Pick<JobRow, 'job_id'>, userId: string): Promise<boolean> {
  return withDbTransaction(async executor => {
    // Feed rows are only candidates: completion or progress may win before this lock.
    const currentRows = await executor.query<StaleAudioCandidate & Pick<JobRow, 'payment_status'>>(
      `SELECT job_id, surface, settings_snapshot, engine_id, video_url,
              audio_url, render_ids, status, payment_status, updated_at
         FROM app_jobs
        WHERE job_id = $1 AND user_id = $2
        FOR UPDATE`,
      [row.job_id, userId]
    );
    const current = currentRows[0];
    if (!current || !isStaleAudioJob(current)) return false;

    await executor.query(
      `UPDATE app_jobs
          SET status = 'failed', progress = 0, message = $2, updated_at = NOW()
        WHERE job_id = $1`,
      [current.job_id, 'Audio render timed out before completion.']
    );
    if (current.payment_status === 'paid_wallet' || current.payment_status === 'refunded_wallet') {
      // A missing/inconsistent debit or failed ledger write rolls back expiration too.
      await refundAudioChargeInExecutor(executor, { userId, jobId: current.job_id });
    }
    return true;
  });
}
