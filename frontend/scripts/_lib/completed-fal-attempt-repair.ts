import type { QueryExecutor } from '../../src/lib/db';

type Dependencies = QueryExecutor & {
  transaction<T>(work: (executor: QueryExecutor) => Promise<T>): Promise<T>;
};

export type CompletedFalAttemptRepairCandidate = {
  jobRowId: number;
  attemptId: number;
  jobSnapshot: string;
  attemptSnapshot: string;
};

function validateIds(ids: number[]): void {
  if (!ids.length || ids.length > 50 || ids.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new Error('Select between 1 and 50 distinct positive safe job row IDs.');
  }
}

export function parseCompletedFalAttemptRepairOptions(args: string[]): {
  mode: 'dry-run' | 'apply'; jobRowIds: number[]; expected: number | null;
} {
  const jobRowIds: number[] = [];
  let mode: 'dry-run' | 'apply' = 'dry-run';
  let explicitMode = false;
  let expected: number | null = null;
  for (const arg of args) {
    if (arg === '--apply' || arg === '--dry-run') {
      if (explicitMode) throw new Error('Select exactly one repair mode.');
      mode = arg === '--apply' ? 'apply' : 'dry-run'; explicitMode = true;
    } else if (/^--job-row-id=\d+$/.test(arg)) {
      jobRowIds.push(Number(arg.slice('--job-row-id='.length)));
    } else if (/^--expect=\d+$/.test(arg) && expected === null) {
      expected = Number(arg.slice('--expect='.length));
    } else {
      throw new Error(`Unsupported repair argument: ${arg}`);
    }
  }
  validateIds(jobRowIds);
  if (expected !== null && (!Number.isSafeInteger(expected) || expected < 1 || expected > 50)) {
    throw new Error('Expected repair count must be between 1 and 50.');
  }
  if (mode === 'apply' && expected === null) throw new Error('--apply requires --expect.');
  return { mode, jobRowIds, expected };
}

export async function inspectCompletedFalAttemptRepair(jobRowIds: number[], executor: QueryExecutor): Promise<CompletedFalAttemptRepairCandidate[]> {
  validateIds(jobRowIds);
  return executor.query<CompletedFalAttemptRepairCandidate>(
    `SELECT j.id::float8 AS "jobRowId", pa.id::float8 AS "attemptId",
            to_jsonb(j)::text AS "jobSnapshot", to_jsonb(pa)::text AS "attemptSnapshot"
       FROM app_jobs j JOIN provider_attempts pa ON pa.job_id = j.id
      WHERE j.id = ANY($1::bigint[]) AND j.status = 'completed' AND j.provider = 'fal'
        AND j.video_url IS NOT NULL AND j.video_url <> ''
        AND pa.provider = 'fal' AND pa.provider_job_id = j.provider_job_id
        AND pa.status = 'completed' AND pa.error_class = 'fal_fallback_failed'
        AND pa.response_snapshot @> '{"ok":true,"deferred":true,"status":"running"}'::jsonb
      ORDER BY j.id, pa.id`, [jobRowIds]
  );
}

export async function applyCompletedFalAttemptRepair(candidates: CompletedFalAttemptRepairCandidate[], dependencies: Dependencies): Promise<number> {
  validateIds(candidates.map(row => row.jobRowId));
  if (new Set(candidates.map(row => row.attemptId)).size !== candidates.length) throw new Error('Duplicate repair attempt.');
  return dependencies.transaction(async executor => {
    await executor.query(`SET LOCAL statement_timeout = '15s'`);
    await executor.query(`SET LOCAL lock_timeout = '5s'`);
    for (const candidate of candidates) {
      const locked = await executor.query<{ jobSnapshot: string; attemptSnapshot: string }>(
        `SELECT to_jsonb(j)::text AS "jobSnapshot", to_jsonb(pa)::text AS "attemptSnapshot"
           FROM provider_attempts pa JOIN app_jobs j ON j.id = pa.job_id
          WHERE pa.id = $1 AND j.id = $2 FOR UPDATE OF pa, j`, [candidate.attemptId, candidate.jobRowId]
      );
      if (locked.length !== 1 || locked[0].jobSnapshot !== candidate.jobSnapshot || locked[0].attemptSnapshot !== candidate.attemptSnapshot) {
        throw new Error(`Repair snapshot changed for job ${candidate.jobRowId}; inspect again.`);
      }
      // Check eligibility under the same locks rather than trusting caller-supplied snapshots.
      const eligible = await inspectCompletedFalAttemptRepair([candidate.jobRowId], executor);
      if (eligible.length !== 1 || eligible[0].attemptId !== candidate.attemptId) throw new Error('Repair eligibility changed.');
      await executor.query(
        `UPDATE provider_attempts SET error_code = NULL, error_class = NULL, fallback_eligible = FALSE WHERE id = $1`,
        [candidate.attemptId]
      );
    }
    return candidates.length;
  });
}
