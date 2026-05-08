import { query } from '@/lib/db';
import { resolveFalModelId } from '@/lib/fal-catalog';
import { getFalClient } from '@/lib/fal-client';
import { deriveJobSurface } from '@/lib/job-surface';
import { updateJobFromFalWebhook } from '@/server/fal-webhook-handler';
import { APP_JOBS_SELECT, type JobRow } from './jobs-route-types';

const FAILURE_STATES = new Set(['FAILED', 'FAIL', 'ERROR', 'ERRORED', 'CANCELLED', 'CANCELED', 'NOT_FOUND', 'MISSING', 'UNKNOWN']);
const COMPLETED_STATES = new Set(['COMPLETED', 'FINISHED', 'SUCCESS', 'SUCCEEDED']);

function getStaleFalJobs(rows: JobRow[]): JobRow[] {
  return rows.filter((row) => {
    const surface = deriveJobSurface({
      surface: row.surface,
      settingsSnapshot: row.settings_snapshot,
      jobId: row.job_id,
      engineId: row.engine_id,
      videoUrl: row.video_url,
      renderIds: row.render_ids,
    });
    if (surface !== 'video') {
      return false;
    }
    if (!row.provider_job_id) return false;
    if ((row.provider ?? 'fal') !== 'fal') return false;
    const status = (row.status ?? '').toLowerCase();
    if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'error') return false;
    const missingVideo = !row.video_url;
    const missingThumb = !row.thumb_url;
    if (!missingVideo && status === 'completed') return false;
    return missingVideo || missingThumb;
  });
}

async function resolveEngineIdForFalLookup(jobRow: JobRow): Promise<string | null> {
  let engineIdForLookup = jobRow.engine_id;
  if (!engineIdForLookup || engineIdForLookup === 'fal-unknown') {
    const logRows = await query<{ engine_id: string | null }>(
      `SELECT engine_id
         FROM fal_queue_log
        WHERE provider_job_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [jobRow.provider_job_id]
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
        [jobRow.provider_job_id]
      );
      if (altRows[0]?.engine_id) {
        engineIdForLookup = altRows[0].engine_id;
      }
    }
  }
  return !engineIdForLookup || engineIdForLookup === 'fal-unknown' ? null : engineIdForLookup;
}

async function markJobFailedFromStaleRefresh(
  jobRow: JobRow,
  reason: string,
  options: { autoRefundEligible?: boolean; failureOrigin?: 'provider_terminal' | 'stale_refresh_internal' } = {}
): Promise<void> {
  const autoRefundEligible = options.autoRefundEligible === true;
  console.warn('[api/jobs] marking job as failed after stale refresh', {
    at: new Date().toISOString(),
    jobId: jobRow.job_id,
    providerJobId: jobRow.provider_job_id,
    reason,
    autoRefundEligible,
    failureOrigin: options.failureOrigin ?? 'stale_refresh_internal',
  });
  try {
    await updateJobFromFalWebhook({
      request_id: jobRow.provider_job_id ?? undefined,
      status: 'failed',
      response: { error: reason, status: 'failed' },
      result: { error: reason, status: 'failed' },
      auto_refund_eligible: autoRefundEligible,
      failure_origin: options.failureOrigin ?? 'stale_refresh_internal',
    });
  } catch (updateError) {
    console.warn('[api/jobs] failed to mark job as failed via webhook handler', jobRow.job_id, updateError);
    try {
      await query(
        `UPDATE app_jobs SET status = 'failed', progress = LEAST(progress, 1), message = $1 WHERE job_id = $2`,
        [reason, jobRow.job_id]
      );
    } catch (writeError) {
      console.warn('[api/jobs] database update fallback for failed job also failed', jobRow.job_id, writeError);
    }
  }
}

export async function refreshStaleFalJobs({
  rows,
  shouldRefreshStaleFalJobs,
  userId,
}: {
  rows: JobRow[];
  shouldRefreshStaleFalJobs: boolean;
  userId: string;
}): Promise<JobRow[]> {
  const staleJobs = shouldRefreshStaleFalJobs ? getStaleFalJobs(rows) : [];
  if (!staleJobs.length) {
    return rows;
  }

  console.info('[api/jobs] refreshing stale Fal jobs', {
    at: new Date().toISOString(),
    userId,
    count: staleJobs.length,
    samples: staleJobs.slice(0, 5).map((job) => ({
      jobId: job.job_id,
      providerJobId: job.provider_job_id,
      status: job.status,
      createdAt: job.created_at,
      videoUrl: job.video_url,
      thumbUrl: job.thumb_url,
    })),
  });

  const falClient = getFalClient();
  const refreshedIds: string[] = [];
  for (const jobRow of staleJobs) {
    const markJobFailed = async (
      reason: string,
      options: { autoRefundEligible?: boolean; failureOrigin?: 'provider_terminal' | 'stale_refresh_internal' } = {}
    ) => {
      await markJobFailedFromStaleRefresh(jobRow, reason, options);
      refreshedIds.push(jobRow.job_id);
    };

    try {
      const engineIdForLookup = await resolveEngineIdForFalLookup(jobRow);
      if (!engineIdForLookup) {
        await markJobFailed('Unable to determine Fal engine for this job.');
        continue;
      }

      const falModel = (await resolveFalModelId(engineIdForLookup)) ?? engineIdForLookup;
      const statusInfo = (await falClient.queue
        .status(falModel, { requestId: jobRow.provider_job_id! })
        .catch((error: unknown) => {
          console.warn('[api/jobs] fal status fetch failed', jobRow.job_id, error);
          return null;
        })) as Record<string, unknown> | null;

      if (!statusInfo) {
        await markJobFailed('Fal job status unavailable (possibly expired).');
        continue;
      }

      const rawState =
        (typeof statusInfo.status === 'string' && statusInfo.status) ||
        (typeof statusInfo.state === 'string' && statusInfo.state) ||
        undefined;
      const state = rawState ? rawState.toUpperCase() : undefined;
      const providerError =
        (typeof statusInfo.error === 'string' && statusInfo.error) ||
        (typeof statusInfo.error_message === 'string' && statusInfo.error_message) ||
        undefined;

      if (state && FAILURE_STATES.has(state)) {
        await markJobFailed(providerError ?? 'Fal reported this job as failed.', {
          autoRefundEligible: true,
          failureOrigin: 'provider_terminal',
        });
        continue;
      }

      if (!state && !jobRow.video_url) {
        await markJobFailed(providerError ?? 'Fal could not locate this job.');
        continue;
      }

      if (state && !COMPLETED_STATES.has(state)) {
        continue;
      }

      const queueResult = await falClient.queue.result(falModel, { requestId: jobRow.provider_job_id! });
      if (!queueResult) {
        await markJobFailed(providerError ?? 'Fal returned no result for this job.');
        continue;
      }
      const previousStatus = (jobRow.status ?? '').toLowerCase();
      const queueStatus =
        queueResult && typeof queueResult === 'object' && 'status' in queueResult
          ? (queueResult as { status?: string | null }).status ?? undefined
          : state ?? undefined;
      const shouldPreserveStatus =
        previousStatus === 'completed' || previousStatus === 'success' || previousStatus === 'succeeded';
      const nextStatus = shouldPreserveStatus && queueStatus ? jobRow.status ?? undefined : queueStatus ?? jobRow.status ?? undefined;
      await updateJobFromFalWebhook({
        request_id: jobRow.provider_job_id ?? undefined,
        status: nextStatus,
        result: queueResult,
      });
      console.info('[api/jobs] refreshed Fal job payload', {
        at: new Date().toISOString(),
        jobId: jobRow.job_id,
        providerJobId: jobRow.provider_job_id,
        falState: state ?? queueStatus ?? null,
        previousStatus: jobRow.status,
        nextStatus,
        hasVideo: Boolean(jobRow.video_url),
        providerError,
      });
      refreshedIds.push(jobRow.job_id);
    } catch (error) {
      console.warn('[api/jobs] failed to refresh job from Fal', jobRow.job_id, error);
      await markJobFailed(
        error instanceof Error ? error.message : 'Fal job could not be refreshed and was marked as failed.'
      );
    }
  }

  if (!refreshedIds.length) {
    return rows;
  }

  const refreshedRows = await query<JobRow>(
    `SELECT ${APP_JOBS_SELECT}
       FROM app_jobs
      WHERE job_id = ANY($1::text[])`,
    [refreshedIds]
  );
  const refreshedMap = new Map(refreshedRows.map((row) => [row.job_id, row]));
  console.info('[api/jobs] applied refreshed Fal rows', {
    at: new Date().toISOString(),
    userId,
    refreshedCount: refreshedIds.length,
  });
  return rows.map((row) => refreshedMap.get(row.job_id) ?? row);
}
