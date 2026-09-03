import { query } from '@/lib/db';
import type { Mode } from '@/types/engines';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

function positiveFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
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
    return positiveFiniteNumber(params.trustedSourceVideoDurationSec);
  }
  if (params.mode !== 'retake') return undefined;

  const previousInteractionId =
    typeof params.previousInteractionId === 'string' ? params.previousInteractionId.trim() : '';
  if (!previousInteractionId) return undefined;
  const queryFn = params.queryFn ?? query;
  const rows = await queryFn<{ duration_sec: number }>(
    `SELECT duration_sec
       FROM app_jobs
      WHERE user_id = $1
        AND provider_job_id = $2
        AND engine_id = 'gemini-omni-flash'
        AND provider = 'google_vertex_omni_direct'
        AND status = 'completed'
      ORDER BY created_at DESC
      LIMIT 1`,
    [params.userId, previousInteractionId]
  );
  return positiveFiniteNumber(rows[0]?.duration_sec);
}
