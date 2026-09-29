import { query } from '@/lib/db';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

const validityStartBrand: unique symbol = Symbol('seedance-draft-validity-start');

export type SeedanceDraftValidityStart = {
  readonly at: string;
  readonly source: 'server_request_started';
  readonly [validityStartBrand]: true;
};

// Capture immediately before submitting the provider request. This conservative
// boundary cannot extend the provider's seven-day validity window.
export function captureSeedanceDraftValidityStart(
  now: () => Date = () => new Date(),
): SeedanceDraftValidityStart {
  const at = now();
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid Draft validity start time.');
  return { at: at.toISOString(), source: 'server_request_started', [validityStartBrand]: true };
}

export type ReservedSeedanceDraftFinal = {
  providerTaskId: string;
  providerModelId: string;
  finalJobId: string;
};

function required(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 255 || /\s|\0/u.test(trimmed)) {
    throw new Error(`Invalid ${name}.`);
  }
  return trimmed;
}

export async function registerSeedanceDraftLink(input: {
  userId: string;
  draftJobId: string;
  providerTaskId: string;
  providerModelId: string;
  validityStart: SeedanceDraftValidityStart;
}, queryFn: QueryFn = query): Promise<boolean> {
  const userId = required(input.userId, 'Draft owner');
  const draftJobId = required(input.draftJobId, 'Draft job ID');
  const providerTaskId = required(input.providerTaskId, 'Draft provider task ID');
  const providerModelId = required(input.providerModelId, 'Draft provider model ID');
  if (input.validityStart?.[validityStartBrand] !== true ||
      input.validityStart.source !== 'server_request_started') {
    throw new Error('Draft validity start must be server-captured.');
  }
  const validityStart = new Date(input.validityStart.at);
  if (!Number.isFinite(validityStart.getTime())) throw new Error('Invalid Draft validity start time.');
  const params = [draftJobId, userId, providerTaskId, providerModelId, validityStart.toISOString()];
  const inserted = await queryFn<{ draft_job_id: string }>(`
    INSERT INTO seedance_draft_links (
      draft_job_id, user_id, provider_task_id, provider_model_id,
      validity_started_at, validity_start_source, expires_at
    )
    SELECT j.job_id, j.user_id, $3, $4, $5::timestamptz, 'server_request_started',
           $5::timestamptz + INTERVAL '7 days'
    FROM app_jobs j
    WHERE j.job_id = $1 AND j.user_id = $2
      AND j.engine_id = 'seedance-2-5'
      AND j.provider = 'byteplus_modelark'
      AND j.provider_job_id = $3
      AND j.status IN ('queued', 'running', 'completed')
    ON CONFLICT DO NOTHING
    RETURNING draft_job_id
  `, params);
  if (inserted.length > 0) return true;
  const existing = await queryFn<{ draft_job_id: string }>(`
    SELECT draft_job_id FROM seedance_draft_links
    WHERE draft_job_id = $1 AND user_id = $2
      AND provider_task_id = $3 AND provider_model_id = $4
      AND validity_started_at = $5::timestamptz
      AND validity_start_source = 'server_request_started'
  `, params);
  return existing.length === 1;
}

export async function markSeedanceDraftFailed(
  userId: string,
  draftJobId: string,
  queryFn: QueryFn = query,
): Promise<boolean> {
  const rows = await queryFn<{ draft_job_id: string }>(`
    UPDATE seedance_draft_links d
    SET draft_state = 'failed', updated_at = now()
    WHERE d.user_id = $1 AND d.draft_job_id = $2
      AND d.draft_state IN ('pending', 'ready', 'failed')
      AND d.final_job_id IS NULL
      AND EXISTS (
        SELECT 1 FROM app_jobs j
        WHERE j.job_id = d.draft_job_id AND j.user_id = d.user_id
          AND j.engine_id = 'seedance-2-5'
          AND j.provider = 'byteplus_modelark'
          AND j.status = 'failed' AND j.provider_job_id = d.provider_task_id
      )
    RETURNING draft_job_id
  `, [required(userId, 'Draft owner'), required(draftJobId, 'Draft job ID')]);
  return rows.length === 1;
}

export async function markSeedanceDraftReady(
  userId: string,
  draftJobId: string,
  queryFn: QueryFn = query,
): Promise<boolean> {
  const rows = await queryFn<{ draft_job_id: string }>(`
    UPDATE seedance_draft_links d
    SET draft_state = 'ready', updated_at = now()
    WHERE d.user_id = $1 AND d.draft_job_id = $2
      AND d.draft_state IN ('pending', 'ready')
      AND EXISTS (
        SELECT 1 FROM app_jobs j
        WHERE j.job_id = d.draft_job_id AND j.user_id = d.user_id
          AND j.engine_id = 'seedance-2-5'
          AND j.provider = 'byteplus_modelark'
          AND j.status = 'completed' AND j.provider_job_id = d.provider_task_id
      )
    RETURNING draft_job_id
  `, [required(userId, 'Draft owner'), required(draftJobId, 'Draft job ID')]);
  return rows.length === 1;
}

export async function reserveSeedanceDraftFinal(input: {
  userId: string;
  draftJobId: string;
  finalJobId: string;
}, queryFn: QueryFn = query, now: () => Date = () => new Date()): Promise<ReservedSeedanceDraftFinal | null> {
  const at = now();
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid Draft finalization time.');
  const params = [
    required(input.userId, 'Draft owner'),
    required(input.draftJobId, 'Draft job ID'),
    required(input.finalJobId, 'final job ID'),
    at.toISOString(),
  ];
  const updated = await queryFn<ReservedSeedanceDraftFinal>(`
    UPDATE seedance_draft_links d
    SET final_job_id = $3, final_state = 'reserved', updated_at = now()
    WHERE d.user_id = $1 AND d.draft_job_id = $2
      AND d.draft_state = 'ready' AND d.final_job_id IS NULL
      AND d.expires_at > $4::timestamptz
      AND EXISTS (
        SELECT 1 FROM app_jobs j
        WHERE j.job_id = d.draft_job_id AND j.user_id = d.user_id
          AND j.engine_id = 'seedance-2-5'
          AND j.provider = 'byteplus_modelark'
          AND j.status = 'completed' AND j.provider_job_id = d.provider_task_id
      )
    RETURNING provider_task_id AS "providerTaskId",
              provider_model_id AS "providerModelId",
              final_job_id AS "finalJobId"
  `, params);
  if (updated.length > 0) return updated[0];
  const existing = await queryFn<ReservedSeedanceDraftFinal>(`
    SELECT provider_task_id AS "providerTaskId",
           provider_model_id AS "providerModelId",
           final_job_id AS "finalJobId"
    FROM seedance_draft_links
    WHERE user_id = $1 AND draft_job_id = $2 AND final_job_id = $3
      AND draft_state = 'ready' AND expires_at > $4::timestamptz
      AND final_state IN ('reserved', 'submitted')
  `, params);
  return existing[0] ?? null;
}
