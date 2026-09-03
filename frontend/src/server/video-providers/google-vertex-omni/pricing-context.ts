import { query } from '@/lib/db';
import type { Mode } from '@/types/engines';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

function inheritedDuration(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 3 && value <= 10
    ? value
    : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export async function resolveGoogleOmniInheritedDurationSec(params: {
  engineId: string;
  mode: Mode;
  userId: string;
  trustedSourceVideoDurationSec?: number;
  previousInteractionId?: unknown;
  queryFn?: QueryFn;
}): Promise<number | undefined> {
  if (params.engineId !== 'gemini-omni-flash') return undefined;
  if (params.mode === 'v2v') {
    return inheritedDuration(params.trustedSourceVideoDurationSec);
  }
  if (params.mode !== 'retake') return undefined;

  const previousInteractionId =
    typeof params.previousInteractionId === 'string' ? params.previousInteractionId.trim() : '';
  if (!previousInteractionId) return undefined;
  const queryFn = params.queryFn ?? query;
  const rows = await queryFn<{ request_snapshot: unknown }>(
    `SELECT pa.request_snapshot
       FROM provider_attempts pa
       JOIN app_jobs aj ON aj.id = pa.job_id
      WHERE aj.user_id = $1
        AND aj.provider_job_id = $2
        AND aj.engine_id = 'gemini-omni-flash'
        AND aj.provider = 'google_vertex_omni_direct'
        AND aj.status = 'completed'
        AND pa.provider = 'google_vertex_omni_direct'
        AND pa.provider_job_id = $2
        AND pa.status = 'completed'
      ORDER BY pa.attempt_index DESC
      LIMIT 1`,
    [params.userId, previousInteractionId]
  );
  const snapshot = recordValue(rows[0]?.request_snapshot);
  const providerPricing = recordValue(snapshot?.providerPricing);
  return inheritedDuration(providerPricing?.outputDurationSec);
}
