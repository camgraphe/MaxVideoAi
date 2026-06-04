import { query } from '@/lib/db';
import type { VideoProviderKey } from './types';

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;

const MAX_SNAPSHOT_STRING_LENGTH = 4096;
const MAX_SNAPSHOT_DEPTH = 12;
const BINARY_SNAPSHOT_KEYS = new Set([
  'base64',
  'b64_json',
  'bytes_base64_encoded',
  'bytesbase64encoded',
  'inline_data',
  'inlinedata',
]);

export type ProviderAttemptStatus =
  | 'submit_started'
  | 'accepted'
  | 'fallback_started'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'polling_stalled';

export type ProviderAttemptRef = {
  id: number;
  attemptIndex: number;
  requestSnapshot?: unknown;
};

function isBinarySnapshotKey(key: string): boolean {
  return BINARY_SNAPSHOT_KEYS.has(key.replace(/[^a-z0-9_]/gi, '').toLowerCase());
}

function sanitizeSnapshotValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length <= MAX_SNAPSHOT_STRING_LENGTH) return value;
    return `[truncated string: ${value.length} chars]`;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_SNAPSHOT_DEPTH) return '[truncated object: max depth reached]';
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSnapshotValue(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (isBinarySnapshotKey(key) && typeof entry === 'string') {
      output[key] = `[omitted binary string: ${entry.length} chars]`;
      return;
    }
    output[key] = sanitizeSnapshotValue(entry, depth + 1);
  });
  return output;
}

function snapshotParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(sanitizeSnapshotValue(value));
}

export async function createProviderAttempt(params: {
  publicJobId: string;
  attemptIndex: number;
  provider: VideoProviderKey;
  providerModel?: string | null;
  status?: ProviderAttemptStatus;
  requestSnapshot?: unknown;
  queryFn?: QueryFn;
}): Promise<ProviderAttemptRef> {
  const queryFn = params.queryFn ?? query;
  const rows = await queryFn<{ id: number; attempt_index: number }>(
    `INSERT INTO provider_attempts (
       job_id,
       attempt_index,
       provider,
       provider_model,
       status,
       started_at,
       request_snapshot
     )
     SELECT id, $2::integer, $3::text, $4::text, $5::text, NOW(), $6::jsonb
       FROM app_jobs
      WHERE job_id = $1
     ON CONFLICT (job_id, attempt_index)
     DO UPDATE SET
       provider = EXCLUDED.provider,
       provider_model = EXCLUDED.provider_model,
       status = EXCLUDED.status,
       started_at = COALESCE(provider_attempts.started_at, EXCLUDED.started_at),
       request_snapshot = EXCLUDED.request_snapshot,
       updated_at = NOW()
     RETURNING id, attempt_index`,
    [
      params.publicJobId,
      params.attemptIndex,
      params.provider,
      params.providerModel ?? null,
      params.status ?? 'submit_started',
      snapshotParam(params.requestSnapshot),
    ]
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Unable to create provider attempt for missing job ${params.publicJobId}.`);
  }
  return { id: Number(row.id), attemptIndex: Number(row.attempt_index) };
}

export async function markProviderAttemptAccepted(params: {
  attemptId: number;
  providerJobId: string;
  responseSnapshot?: unknown;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  await queryFn(
    `UPDATE provider_attempts
        SET status = 'accepted',
            provider_job_id = $2,
            accepted_at = NOW(),
            response_snapshot = COALESCE($3::jsonb, response_snapshot),
            updated_at = NOW()
      WHERE id = $1`,
    [params.attemptId, params.providerJobId, snapshotParam(params.responseSnapshot)]
  );
}

export async function markProviderAttemptFailed(params: {
  attemptId: number;
  errorCode?: string | null;
  errorClass?: string | null;
  fallbackEligible?: boolean;
  responseSnapshot?: unknown;
  status?: Extract<ProviderAttemptStatus, 'failed' | 'polling_stalled'>;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  await queryFn(
    `UPDATE provider_attempts
        SET status = $2,
            finished_at = NOW(),
            error_code = $3,
            error_class = $4,
            fallback_eligible = $5,
            response_snapshot = COALESCE($6::jsonb, response_snapshot),
            updated_at = NOW()
      WHERE id = $1`,
    [
      params.attemptId,
      params.status ?? 'failed',
      params.errorCode ?? null,
      params.errorClass ?? null,
      params.fallbackEligible === true,
      snapshotParam(params.responseSnapshot),
    ]
  );
}

export async function markProviderAttemptFinished(params: {
  attemptId: number;
  status: Extract<ProviderAttemptStatus, 'completed' | 'failed' | 'polling' | 'polling_stalled'>;
  responseSnapshot?: unknown;
  providerCostUnits?: number | null;
  providerCostUsd?: number | null;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  await queryFn(
    `UPDATE provider_attempts
        SET status = $2,
            finished_at = CASE WHEN $2 IN ('completed','failed','polling_stalled') THEN NOW() ELSE finished_at END,
            response_snapshot = COALESCE($3::jsonb, response_snapshot),
            provider_cost_units = $4,
            provider_cost_usd = $5,
            updated_at = NOW()
      WHERE id = $1`,
    [
      params.attemptId,
      params.status,
      snapshotParam(params.responseSnapshot),
      params.providerCostUnits ?? null,
      params.providerCostUsd ?? null,
    ]
  );
}

export async function linkProviderFallbackAttempt(params: {
  fromAttemptId: number;
  toAttemptId: number;
  queryFn?: QueryFn;
}): Promise<void> {
  const queryFn = params.queryFn ?? query;
  await queryFn(
    `UPDATE provider_attempts
        SET fallback_to_attempt_id = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [params.fromAttemptId, params.toAttemptId]
  );
}

export async function findProviderAttemptForJob(params: {
  publicJobId: string;
  provider: VideoProviderKey;
  providerJobId: string;
  queryFn?: QueryFn;
}): Promise<ProviderAttemptRef | null> {
  const queryFn = params.queryFn ?? query;
  const rows = await queryFn<{ id: number; attempt_index: number; request_snapshot?: unknown }>(
    `SELECT pa.id, pa.attempt_index, pa.request_snapshot
       FROM provider_attempts pa
       JOIN app_jobs aj ON aj.id = pa.job_id
      WHERE aj.job_id = $1
        AND pa.provider = $2
        AND pa.provider_job_id = $3
      ORDER BY pa.attempt_index DESC
      LIMIT 1`,
    [params.publicJobId, params.provider, params.providerJobId]
  );
  const row = rows[0];
  return row
    ? { id: Number(row.id), attemptIndex: Number(row.attempt_index), requestSnapshot: row.request_snapshot }
    : null;
}
