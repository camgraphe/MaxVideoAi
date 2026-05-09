import { isDatabaseConfigured, query } from '@/lib/db';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import type { AngleToolEngineId } from '@/types/tools-angle';

export const TOOL_EVENT_NAME = 'tool_angle_generate';

export async function insertAngleToolEvent(params: {
  jobId: string;
  engineId: AngleToolEngineId;
  providerJobId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;

  try {
    await ensureBillingSchema();
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        getResultProviderMode(),
        params.providerJobId ?? null,
        params.engineId,
        TOOL_EVENT_NAME,
        JSON.stringify(params.payload),
      ]
    );
  } catch (error) {
    console.warn('[tools/angle] failed to persist event log', error);
  }
}
