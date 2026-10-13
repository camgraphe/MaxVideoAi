import { BytePlusModelArkError } from '@/server/video-providers/byteplus-modelark-error';
import type { BytePlusPendingJob } from './byteplus-poll-types';
import { isRecord } from './byteplus-record-utils';
import { query } from '@/lib/db';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

/** A trusted paid continuation adds measured execution facts without replacing its reserved quote or price. */
export async function persistReservedBytePlusLasExecutionSettings(input: {
  jobId: string; userId: string; settings: Record<string, unknown>; priceCents: number;
}) {
  const rows = await query<{ job_id: string }>(`UPDATE app_jobs SET
      settings_snapshot = COALESCE(settings_snapshot, '{}'::jsonb) || $3::jsonb,
      updated_at = now()
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'
      AND payment_status = 'paid_wallet' AND final_price_cents = $4 AND status = 'pending'
      AND provider_job_id IS NULL AND settings_snapshot->'byteplusSubmission' IS NULL
    RETURNING job_id`,
  [input.jobId, input.userId, JSON.stringify(input.settings), input.priceCents]);
  if (rows.length !== 1) throw new Error('The trusted LAS execution snapshot could not be committed.');
}

/** A committed attempt marker is conservative evidence: it never authorizes another POST. */
export function getBytePlusSubmissionState(settings: unknown) {
  const state = isRecord(settings) && isRecord(settings.byteplusSubmission) ? settings.byteplusSubmission : null;
  return state && typeof state.phase === 'string' ? state : null;
}

export async function readOwnedBytePlusLasSubmission(jobId: string, userId: string, queryFn: QueryFn) {
  const rows = await queryFn(`SELECT * FROM app_jobs WHERE job_id = $1 AND user_id = $2
    AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'`, [jobId, userId]);
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new BytePlusModelArkError('The owned generation reservation is unavailable.', { status: 400, code: 'BYTEPLUS_JOB_UNAVAILABLE' });
  }
  return rows[0] as BytePlusPendingJob;
}

export async function claimBytePlusLasSubmission(jobId: string, userId: string, queryFn: QueryFn) {
  const rows = await queryFn(`UPDATE app_jobs SET settings_snapshot =
      jsonb_set(jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{byteplusTransport}', '"las"'::jsonb, true),
        '{byteplusSubmission}', jsonb_build_object('phase', 'submit_started', 'startedAt', now()), true),
      provisional = FALSE, updated_at = now()
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'
      AND status = 'pending' AND provider_job_id IS NULL
      AND settings_snapshot->'byteplusSubmission' IS NULL
    RETURNING *`, [jobId, userId]);
  return Array.isArray(rows) && rows.length === 1;
}

export async function preserveBytePlusLasSubmission(input: {
  jobId: string; userId: string; providerJobId: string | null; queryFn: QueryFn;
}) {
  await input.queryFn(`UPDATE app_jobs SET
      status = CASE WHEN COALESCE(provider_job_id, $3) IS NULL THEN 'provider_polling_stalled' ELSE 'queued' END,
      provider_job_id = COALESCE(provider_job_id, $3),
      settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{byteplusSubmission}',
        COALESCE(settings_snapshot->'byteplusSubmission', '{}'::jsonb) || jsonb_build_object('phase', 'uncertain', 'updatedAt', now()), true),
      message = 'Submission is being checked. Do not submit again.', provisional = FALSE, updated_at = now()
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'
      AND status IN ('pending','queued','running','processing','in_progress','provider_polling_stalled')`,
  [input.jobId, input.userId, input.providerJobId]);
}

export async function recordBytePlusLasSubmissionAccepted(input: {
  jobId: string; userId: string; providerJobId: string; queryFn: QueryFn;
}) {
  const rows = await input.queryFn(`UPDATE app_jobs SET provider_job_id = $3, status = 'queued',
      settings_snapshot = jsonb_set(settings_snapshot, '{byteplusSubmission}',
        settings_snapshot->'byteplusSubmission' || jsonb_build_object('phase','accepted','acceptedAt',now()), true),
      updated_at = now()
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'
      AND status IN ('pending','queued','running','processing','in_progress','provider_polling_stalled')
      AND (provider_job_id IS NULL OR provider_job_id = $3)
    RETURNING *`, [input.jobId, input.userId, input.providerJobId]);
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Accepted LAS task persistence deferred.');
}

/** Persist rejection before refunding; a refund outage can replay this evidence without provider work. */
export async function recordBytePlusLasSubmissionRejection(input: {
  jobId: string; userId: string; message: string; errorCode: string; attempted: boolean; queryFn: QueryFn;
}) {
  const rows = await input.queryFn(`UPDATE app_jobs SET settings_snapshot =
      jsonb_set(jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{byteplusTransport}', '"las"'::jsonb, true),
        '{byteplusSubmission}', COALESCE(settings_snapshot->'byteplusSubmission', '{}'::jsonb) ||
          jsonb_build_object('phase','rejected','message',$3::text,'errorCode',$4::text,'updatedAt',now()), true),
      updated_at = now()
    WHERE job_id = $1 AND user_id = $2 AND engine_id = 'seedance-2-5' AND provider = 'byteplus_modelark'
      AND provider_job_id IS NULL AND status = 'pending'
      AND CASE WHEN $5::boolean THEN settings_snapshot->'byteplusSubmission'->>'phase' = 'submit_started'
        ELSE settings_snapshot->'byteplusSubmission' IS NULL END
    RETURNING *`, [input.jobId, input.userId, input.message, input.errorCode, input.attempted]);
  return Array.isArray(rows) && rows.length === 1;
}
