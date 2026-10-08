import path from 'node:path';
import { applyCompletedFalAttemptRepair, inspectCompletedFalAttemptRepair, parseCompletedFalAttemptRepairOptions } from './_lib/completed-fal-attempt-repair';

async function main(): Promise<void> {
  const options = parseCompletedFalAttemptRepairOptions(process.argv.slice(2));
  const { config } = await import('dotenv');
  config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
  config({ path: path.resolve(process.cwd(), '.env'), override: false });
  const { query, getDb, withDbTransaction } = await import('../src/lib/db');
  try {
    const candidates = await inspectCompletedFalAttemptRepair(options.jobRowIds, { query });
    console.log(JSON.stringify({ mode: options.mode, candidates: candidates.map(({ jobRowId, attemptId }) => ({ jobRowId, attemptId })) }));
    if (options.expected !== null && candidates.length !== options.expected) throw new Error('Candidate count differs from --expect; no repair applied.');
    const updated = options.mode === 'apply' ? await applyCompletedFalAttemptRepair(candidates, { query, transaction: withDbTransaction }) : 0;
    console.log(JSON.stringify({ mode: options.mode, inspected: candidates.length, updated }));
  } finally {
    await getDb().end();
  }
}

void main().catch(error => {
  // Never print database snapshots, connection strings or raw provider diagnostics.
  console.error('Completed Fal attempt repair failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
