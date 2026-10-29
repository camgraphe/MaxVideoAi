import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import { buildResponseFromExistingVideoJob, type ExistingVideoJobRow } from './initial-video-job';

export type VideoJobQuery = (sql: string, params?: unknown[]) => Promise<unknown>;
export type PersistedVideoJob = ExistingVideoJobRow & {
  payment_status: string | null;
  pricing_snapshot: PricingSnapshot | null;
  provider: string | null;
  eta_seconds: number | null;
  eta_label: string | null;
};

export function persistedVideoJobRows(result: unknown): PersistedVideoJob[] {
  if (Array.isArray(result)) return result as PersistedVideoJob[];
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) {
    return result.rows as PersistedVideoJob[];
  }
  throw new Error('Video job persistence did not return database rows.');
}

export async function readPersistedVideoJob(jobId: string, queryFn: VideoJobQuery = query): Promise<PersistedVideoJob> {
  const rows = persistedVideoJobRows(await queryFn('SELECT * FROM app_jobs WHERE job_id = $1', [jobId]));
  if (rows.length !== 1 || rows[0].job_id !== jobId) throw new Error('The persisted video job is unavailable.');
  return rows[0];
}

export function buildPersistedVideoJobResponse(job: PersistedVideoJob, localKey: string | null = null) {
  return {
    ...buildResponseFromExistingVideoJob(job, localKey),
    paymentStatus: job.payment_status,
    pricing: job.pricing_snapshot,
    provider: job.provider,
    etaSeconds: job.eta_seconds,
    etaLabel: job.eta_label,
  };
}
