import { query, type QueryExecutor } from '@/lib/db';
import {
  applyTrialJobOutcome,
  type NormalizedTrialJobOutcome,
  type TrialJobOutcomeResult,
} from './trial-outcomes';

export const MCP_TRIAL_RECONCILIATION_DEFAULT_STALE_MINUTES = 30;
export const MCP_TRIAL_RECONCILIATION_DEFAULT_BATCH_LIMIT = 50;
export const MCP_TRIAL_RECONCILIATION_MIN_STALE_MINUTES = 15;
export const MCP_TRIAL_RECONCILIATION_MAX_STALE_MINUTES = 24 * 60;
export const MCP_TRIAL_RECONCILIATION_MAX_BATCH_LIMIT = 100;

export type TrialReconciliationConfig = {
  staleMinutes: number;
  batchLimit: number;
};

export type TrialReconciliationCounts = {
  scanned: number;
  consumed: number;
  released: number;
  retainedActive: number;
  quarantinedMissingJob: number;
  quarantinedAmbiguous: number;
  transitionDeferred: number;
};

export type TrialReconciliationResult = {
  availability: 'available' | 'unavailable';
  reasonCode: 'batch_processed' | 'schema_unavailable';
  counts: TrialReconciliationCounts | null;
  batch: TrialReconciliationConfig;
  durationMs: number;
};

type CandidateClassification =
  | 'completed'
  | 'definitive_failure'
  | 'canceled'
  | 'active'
  | 'missing_job'
  | 'ambiguous';

type CandidateRow = {
  job_id: unknown;
  classification: unknown;
};

type RelationsRow = {
  mcp_trial_entitlements: unknown;
  app_jobs: unknown;
  mcp_generation_quotes: unknown;
};

type TrialReconciliationDependencies = {
  executor: QueryExecutor;
  now(): number;
  applyOutcome(
    jobId: string,
    outcome: NormalizedTrialJobOutcome,
  ): Promise<TrialJobOutcomeResult>;
};

const defaultDependencies: TrialReconciliationDependencies = {
  executor: { query },
  now: Date.now,
  applyOutcome: applyTrialJobOutcome,
};

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@|+-]*$/u;
const CLASSIFICATIONS = new Set<CandidateClassification>([
  'completed',
  'definitive_failure',
  'canceled',
  'active',
  'missing_job',
  'ambiguous',
]);

function configuredInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined || raw === '') return fallback;
  if (!/^[1-9][0-9]*$/u.test(raw)) {
    throw new Error('Invalid trial reconciliation configuration.');
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error('Invalid trial reconciliation configuration.');
  }
  return value;
}

export function resolveTrialReconciliationConfig(
  env: Record<string, string | undefined>,
): TrialReconciliationConfig {
  return {
    staleMinutes: configuredInteger(
      env.MCP_TRIAL_RECONCILE_STALE_MINUTES,
      MCP_TRIAL_RECONCILIATION_DEFAULT_STALE_MINUTES,
      MCP_TRIAL_RECONCILIATION_MIN_STALE_MINUTES,
      MCP_TRIAL_RECONCILIATION_MAX_STALE_MINUTES,
    ),
    batchLimit: configuredInteger(
      env.MCP_TRIAL_RECONCILE_BATCH_LIMIT,
      MCP_TRIAL_RECONCILIATION_DEFAULT_BATCH_LIMIT,
      1,
      MCP_TRIAL_RECONCILIATION_MAX_BATCH_LIMIT,
    ),
  };
}

function validateConfig(config: TrialReconciliationConfig): void {
  if (!Number.isSafeInteger(config.staleMinutes)
    || config.staleMinutes < MCP_TRIAL_RECONCILIATION_MIN_STALE_MINUTES
    || config.staleMinutes > MCP_TRIAL_RECONCILIATION_MAX_STALE_MINUTES
    || !Number.isSafeInteger(config.batchLimit)
    || config.batchLimit < 1
    || config.batchLimit > MCP_TRIAL_RECONCILIATION_MAX_BATCH_LIMIT) {
    throw new Error('Invalid trial reconciliation configuration.');
  }
}

function duration(startedAt: number, now: () => number): number {
  const elapsed = now() - startedAt;
  return Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0;
}

function emptyCounts(scanned: number): TrialReconciliationCounts {
  return {
    scanned,
    consumed: 0,
    released: 0,
    retainedActive: 0,
    quarantinedMissingJob: 0,
    quarantinedAmbiguous: 0,
    transitionDeferred: 0,
  };
}

function readRelations(rows: RelationsRow[]): boolean {
  const row = rows[0];
  if (rows.length !== 1 || !row
    || typeof row.mcp_trial_entitlements !== 'boolean'
    || typeof row.app_jobs !== 'boolean'
    || typeof row.mcp_generation_quotes !== 'boolean') {
    throw new Error('Invalid trial reconciliation prerequisite result.');
  }
  return row.mcp_trial_entitlements && row.app_jobs && row.mcp_generation_quotes;
}

function readCandidates(rows: CandidateRow[], batchLimit: number): Array<{
  jobId: string;
  classification: CandidateClassification;
}> {
  if (rows.length > batchLimit) throw new Error('Trial reconciliation exceeded its batch limit.');
  return rows.map((row) => {
    if (typeof row.job_id !== 'string'
      || row.job_id.length < 1
      || row.job_id.length > 256
      || row.job_id !== row.job_id.trim()
      || !IDENTIFIER_PATTERN.test(row.job_id)
      || typeof row.classification !== 'string'
      || !CLASSIFICATIONS.has(row.classification as CandidateClassification)) {
      throw new Error('Invalid trial reconciliation candidate.');
    }
    return {
      jobId: row.job_id,
      classification: row.classification as CandidateClassification,
    };
  });
}

async function applyTerminalCandidate(
  candidate: { jobId: string; classification: CandidateClassification },
  dependencies: TrialReconciliationDependencies,
): Promise<'consumed' | 'released' | 'deferred'> {
  const outcome: NormalizedTrialJobOutcome = candidate.classification === 'completed'
    ? { kind: 'completed' }
    : candidate.classification === 'canceled'
      ? { kind: 'canceled' }
      : { kind: 'failed' };
  try {
    const result = await dependencies.applyOutcome(candidate.jobId, outcome);
    if (result.funding !== 'included_trial') return 'deferred';
    if (candidate.classification === 'completed' && result.entitlementState === 'consumed') {
      return 'consumed';
    }
    if (candidate.classification !== 'completed' && result.entitlementState === 'released') {
      return 'released';
    }
    return 'deferred';
  } catch {
    return 'deferred';
  }
}

export function createTrialEntitlementReconciler(
  dependencies: TrialReconciliationDependencies,
): (config: TrialReconciliationConfig) => Promise<TrialReconciliationResult> {
  return async (config) => {
    validateConfig(config);
    const startedAt = dependencies.now();
    const relations = await dependencies.executor.query<RelationsRow>(`
      SELECT
        to_regclass('public.mcp_trial_entitlements') IS NOT NULL AS mcp_trial_entitlements,
        to_regclass('public.app_jobs') IS NOT NULL AS app_jobs,
        to_regclass('public.mcp_generation_quotes') IS NOT NULL AS mcp_generation_quotes`);
    if (!readRelations(relations)) {
      return {
        availability: 'unavailable',
        reasonCode: 'schema_unavailable',
        counts: null,
        batch: { ...config },
        durationMs: duration(startedAt, dependencies.now),
      };
    }

    const rows = await dependencies.executor.query<CandidateRow>(`
      SELECT entitlement.job_id,
        CASE
          WHEN job.job_id IS NULL THEN 'missing_job'
          WHEN job.user_id IS DISTINCT FROM entitlement.user_id
            OR job.payment_status IS DISTINCT FROM 'included_mcp_trial'
            OR quote.quote_id IS NULL
            OR quote.quote_id::text IS DISTINCT FROM entitlement.job_id
            OR quote.job_id IS DISTINCT FROM entitlement.job_id
            OR quote.user_id IS DISTINCT FROM entitlement.user_id
            OR quote.funding_mode IS DISTINCT FROM 'trial'
            OR quote.state NOT IN ('claimed', 'accepted')
            THEN 'ambiguous'
          WHEN job.status = 'completed'
            AND NULLIF(btrim(job.video_url), '') IS NOT NULL THEN 'completed'
          WHEN NULLIF(btrim(job.video_url), '') IS NOT NULL
            OR job.status = 'completed' THEN 'ambiguous'
          WHEN lower(btrim(job.status)) IN ('cancelled', 'canceled', 'aborted') THEN 'canceled'
          WHEN lower(btrim(job.status)) IN ('error', 'failed', 'rejected') THEN 'definitive_failure'
          WHEN lower(btrim(job.status)) IN (
            'pending', 'queued', 'running', 'processing', 'in_progress', 'accepted'
          ) THEN 'active'
          ELSE 'ambiguous'
        END AS classification
      FROM mcp_trial_entitlements AS entitlement
      LEFT JOIN app_jobs AS job
        ON job.job_id = entitlement.job_id
      LEFT JOIN mcp_generation_quotes AS quote
        ON quote.quote_id = entitlement.reserved_quote_id
      WHERE entitlement.status = 'reserved'
        AND entitlement.reserved_at < clock_timestamp() - ($1 * INTERVAL '1 minute')
      ORDER BY entitlement.reserved_at ASC, entitlement.job_id ASC
      LIMIT $2`, [config.staleMinutes, config.batchLimit]);
    const candidates = readCandidates(rows, config.batchLimit);
    const counts = emptyCounts(candidates.length);

    for (const candidate of candidates) {
      if (candidate.classification === 'active') {
        counts.retainedActive += 1;
      } else if (candidate.classification === 'missing_job') {
        counts.quarantinedMissingJob += 1;
      } else if (candidate.classification === 'ambiguous') {
        counts.quarantinedAmbiguous += 1;
      } else {
        const result = await applyTerminalCandidate(candidate, dependencies);
        if (result === 'consumed') counts.consumed += 1;
        else if (result === 'released') counts.released += 1;
        else counts.transitionDeferred += 1;
      }
    }

    return {
      availability: 'available',
      reasonCode: 'batch_processed',
      counts,
      batch: { ...config },
      durationMs: duration(startedAt, dependencies.now),
    };
  };
}

export async function reconcileTrialEntitlements(): Promise<TrialReconciliationResult> {
  const config = resolveTrialReconciliationConfig(process.env);
  return createTrialEntitlementReconciler(defaultDependencies)(config);
}
