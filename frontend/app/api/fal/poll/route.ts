import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';

export const dynamic = 'force-dynamic';

type FalPendingJob = {
  job_id: string;
  engine_id: string;
  provider_job_id: string;
  status: string;
  updated_at: string;
  created_at: string;
};

const POLL_BASE_DELAYS_MS = [5_000, 15_000, 30_000, 60_000];
const POLL_INITIAL_DELAY_MS = 5_000;
const POLL_MAX_DURATION_MS = 3 * 60_000;

export async function POST() {
  return pollFalJobs();
}

export async function GET() {
  return pollFalJobs();
}

async function pollFalJobs() {
  const rows = await query<FalPendingJob>(
    `SELECT job_id, engine_id, provider_job_id, status, updated_at, created_at
     FROM app_jobs
     WHERE provider_job_id IS NOT NULL
       AND status IN ('queued', 'running')
     ORDER BY updated_at ASC
     LIMIT 10`
  );

  if (!rows.length) {
    return NextResponse.json({ ok: true, checked: 0, updates: 0 });
  }

  const falClient = getFalClient();
  let updates = 0;

  const FAILURE_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'NOT_FOUND', 'MISSING', 'UNKNOWN']);
  const COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);

  for (const job of rows) {
    const markJobFailed = async (reason: string) => {
      console.warn('[fal-poll] marking job as failed', {
        at: new Date().toISOString(),
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        reason,
      });
      if (job.provider_job_id) {
        try {
          await query(
            `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
            [
              job.job_id,
              'fal',
              job.provider_job_id,
              job.engine_id ?? 'fal-unknown',
              'poll:failed',
              JSON.stringify({
                at: new Date().toISOString(),
                reason,
              }),
            ]
          );
        } catch (logError) {
          console.warn('[fal-poll] failed to record failure log', job.job_id, logError);
        }
      }
      try {
        await updateJobFromFalWebhook({
          request_id: job.provider_job_id,
          status: 'failed',
          response: { error: reason, status: 'failed' } as unknown,
          result: { error: reason, status: 'failed' } as unknown,
        });
      } catch (updateError) {
        console.warn('[fal-poll] webhook update failed, falling back to DB update', job.job_id, updateError);
        try {
          await query(
            `UPDATE app_jobs SET status = 'failed', progress = LEAST(progress, 1), message = $1 WHERE job_id = $2`,
            [reason, job.job_id]
          );
        } catch (writeError) {
          console.warn('[fal-poll] db update failed', job.job_id, writeError);
        }
      }
      updates += 1;
    };

    try {
      const now = Date.now();
      const updatedAtMs = Date.parse(job.updated_at);
      if (Number.isFinite(updatedAtMs) && now - updatedAtMs < POLL_INITIAL_DELAY_MS) {
        continue;
      }

      const createdAtMs = Date.parse(job.created_at);
      if (Number.isFinite(createdAtMs) && now - createdAtMs > POLL_MAX_DURATION_MS) {
        await markJobFailed('Fal polling exceeded expected window.');
        continue;
      }

      const pollHistory = await query<{ attempts: number; last_attempt_at: string | null }>(
        `SELECT COUNT(*)::int AS attempts, MAX(created_at) AS last_attempt_at
         FROM fal_queue_log
         WHERE provider_job_id = $1
           AND status LIKE 'poll:%'`,
        [job.provider_job_id]
      );
      const previousAttempts = pollHistory[0]?.attempts ?? 0;
      const pollAttempt = previousAttempts + 1;
      const lastAttemptAtMs = pollHistory[0]?.last_attempt_at ? Date.parse(pollHistory[0].last_attempt_at) : null;
      const backoffMs =
        POLL_BASE_DELAYS_MS[Math.min(previousAttempts, POLL_BASE_DELAYS_MS.length - 1)] ??
        POLL_BASE_DELAYS_MS[POLL_BASE_DELAYS_MS.length - 1];

      if (lastAttemptAtMs && now - lastAttemptAtMs < backoffMs) {
        continue;
      }

      let engineIdForLookup = job.engine_id;
      if (!engineIdForLookup || engineIdForLookup === 'fal-unknown') {
        const logRows = await query<{ engine_id: string | null }>(
          `SELECT engine_id
             FROM fal_queue_log
            WHERE provider_job_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
          [job.provider_job_id]
        );
        if (logRows[0]?.engine_id) {
          engineIdForLookup = logRows[0].engine_id;
        } else {
          const altRows = await query<{ engine_id: string | null }>(
            `SELECT engine_id
               FROM app_jobs
              WHERE provider_job_id = $1
                AND engine_id IS NOT NULL
                AND engine_id <> 'fal-unknown'
              ORDER BY updated_at DESC
              LIMIT 1`,
            [job.provider_job_id]
          );
          if (altRows[0]?.engine_id) {
            engineIdForLookup = altRows[0].engine_id;
          }
        }
      }

      if (!engineIdForLookup || engineIdForLookup === 'fal-unknown') {
        await markJobFailed('Unable to determine Fal engine for this job.');
        continue;
      }

      const falModel = (await resolveFalModelId(engineIdForLookup)) ?? engineIdForLookup;
      const statusInfo = (await falClient.queue
        .status(falModel, { requestId: job.provider_job_id })
        .catch((error: unknown) => {
          console.warn('[fal-poll] fal status fetch failed', job.job_id, error);
          return null;
        })) as Record<string, unknown> | null;
      try {
        await query(
          `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
          [
            job.job_id,
            'fal',
            job.provider_job_id,
            engineIdForLookup,
            'poll:status',
            JSON.stringify({
              attempt: pollAttempt,
              at: new Date().toISOString(),
              status: statusInfo?.status ?? null,
            }),
          ]
        );
      } catch (logError) {
        console.warn('[fal-poll] failed to record status poll log', job.job_id, logError);
      }

      if (!statusInfo) {
        await markJobFailed('Fal job status unavailable (possibly expired).');
        continue;
      }

      const rawState =
        (typeof statusInfo.status === 'string' && (statusInfo.status as string)) ||
        (typeof (statusInfo as Record<string, unknown>).state === 'string' &&
          ((statusInfo as Record<string, unknown>).state as string)) ||
        undefined;
      const state = rawState ? rawState.toUpperCase() : undefined;
      const statusRecord = statusInfo as Record<string, unknown>;
      const providerError =
        (typeof statusRecord.error === 'string' && (statusRecord.error as string)) ||
        (typeof statusRecord.error_message === 'string' && (statusRecord.error_message as string)) ||
        undefined;

      if (state && FAILURE_STATES.has(state)) {
        await markJobFailed(providerError ?? 'Fal reported this job as failed.');
        continue;
      }

      if (state && !COMPLETED_STATES.has(state)) {
        // still running/queued
        await updateJobFromFalWebhook({
          request_id: job.provider_job_id,
          status: state,
          data: statusInfo as unknown,
        });
        updates += 1;
        continue;
      }

      const result = await falClient.queue.result(falModel, { requestId: job.provider_job_id });
      if (!result) {
        await markJobFailed(providerError ?? 'Fal returned no result for this job.');
        continue;
      }
      try {
        await query(
          `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
          [
            job.job_id,
            'fal',
            job.provider_job_id,
            engineIdForLookup,
            'poll:result',
            JSON.stringify({
              attempt: pollAttempt,
              at: new Date().toISOString(),
              status: result && typeof result === 'object' && 'status' in result ? (result as { status?: string }).status ?? null : null,
              hasResult: true,
            }),
          ]
        );
      } catch (logError) {
        console.warn('[fal-poll] failed to record result log', job.job_id, logError);
      }
      const queueStatus =
        result && typeof result === 'object' && 'status' in result
          ? ((result as { status?: string | null }).status ?? null)
          : state ?? null;
      await updateJobFromFalWebhook({
        request_id: job.provider_job_id,
        status: 'completed',
        result: result as unknown,
      });
      console.info('[fal-poll] job completed', {
        at: new Date().toISOString(),
        jobId: job.job_id,
        providerJobId: job.provider_job_id,
        status: queueStatus ?? null,
      });
      updates += 1;
    } catch (error) {
      console.warn('[fal-poll] failed to sync job', job.job_id, error);
      await markJobFailed('Fal sync failed.');
    }
  }

  return NextResponse.json({ ok: true, checked: rows.length, updates });
}

export async function GET() {
  return POST();
}
