import assert from 'node:assert/strict';
import test from 'node:test';
import { runFalPoll } from '../frontend/server/fal-poll';

test('real Fal poll keeps old jobs active through transient errors and only fails confirmed provider failures', async () => {
  for (const scenario of ['running', 'offline', 'result-unavailable', 'completed', 'failed']) {
    const updates: Array<Record<string, unknown>> = [];
    const events: string[] = [];
    let submissions = 0;
    const dependencies = {
      query: async <T>(sql: string, values?: readonly unknown[]): Promise<T[]> => {
        if (sql.includes('SELECT job_id, surface, engine_id')) return [{ job_id: 'one', engine_id: 'seedvr-video', surface: 'upscale', provider_job_id: 'fal-one', status: 'running', created_at: new Date(Date.now() - 4 * 3600_000).toISOString(), updated_at: new Date(Date.now() - 10 * 60_000).toISOString() }] as T[];
        if (sql.includes('COUNT(*)::int')) return [{ attempts: 0, last_attempt_at: null }] as T[];
        if (sql.includes('INSERT INTO fal_queue_log')) events.push(String(values?.[4]));
        assert.doesNotMatch(sql, /SET status = 'failed'/, 'transient problems must never use the DB failure fallback');
        return [];
      },
      getFalClient: () => ({ queue: {
        submit: async () => { submissions++; throw new Error('No resubmission allowed'); },
        status: async () => {
          if (scenario === 'offline') throw new Error('connection lost');
          return { status: scenario === 'running' ? 'IN_PROGRESS' : scenario === 'failed' ? 'FAILED' : 'COMPLETED' };
        },
        result: async () => {
          if (scenario === 'result-unavailable') throw new Error('temporary read failure');
          return { data: { video: { url: 'https://example.test/full.mp4' } } };
        },
      } }),
      updateJobFromFalWebhook: async (value: unknown) => { updates.push(value as Record<string, unknown>); },
      reconcileStaleFalProvisionals: async () => ({ failed: 0 }),
      reconcileFinishingJobs: async () => ({ checked: 0, reconciled: 0, failures: 0 }),
      backfillCompletedMcpJobOutputs: async () => ({ promoted: 0, failed: 0 }),
    } as unknown as Parameters<typeof runFalPoll>[0];
    await runFalPoll(dependencies);
    assert.equal(submissions, 0);
    if (scenario === 'failed') assert.equal(updates[0]?.auto_refund_eligible, true);
    else if (scenario === 'completed') assert.equal(updates[0]?.status, 'completed');
    else { assert.equal(updates.length, 0); assert.ok(events.includes('poll:deferred')); }
  }
});
