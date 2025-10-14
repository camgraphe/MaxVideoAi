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
};

export async function POST() {
  const rows = await query<FalPendingJob>(
    `SELECT job_id, engine_id, provider_job_id, status
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

  for (const job of rows) {
    try {
      const falModel = (await resolveFalModelId(job.engine_id)) ?? job.engine_id;
      const status = await falClient.queue.status(falModel, { requestId: job.provider_job_id });
      if (!status) continue;
      await updateJobFromFalWebhook({
        request_id: job.provider_job_id,
        status: status.status,
        data: status as unknown,
      });
      updates += 1;
    } catch (error) {
      console.warn('[fal-poll] failed to sync job', job.job_id, error);
    }
  }

  return NextResponse.json({ ok: true, checked: rows.length, updates });
}

export async function GET() {
  return POST();
}
