import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProviderAttempt,
  linkProviderFallbackAttempt,
  markProviderAttemptAccepted,
  markProviderAttemptFinished,
} from '../frontend/src/server/video-providers/provider-attempts';

test('provider attempt helper inserts attempts by public app job id and updates lifecycle fields', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const queryFn = async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
    queries.push({ sql, params });
    if (/RETURNING id, attempt_index/.test(sql)) {
      return [{ id: 42, attempt_index: 1 }] as T[];
    }
    return [] as T[];
  };

  const attempt = await createProviderAttempt({
    publicJobId: 'job_123',
    attemptIndex: 1,
    provider: 'kling_direct',
    providerModel: 'kling-v3',
    status: 'submit_started',
    requestSnapshot: { promptLength: 12 },
    queryFn,
  });
  await markProviderAttemptAccepted({
    attemptId: attempt.id,
    providerJobId: 'task_123',
    responseSnapshot: { task_id: 'task_123' },
    queryFn,
  });
  await markProviderAttemptFinished({
    attemptId: attempt.id,
    status: 'completed',
    responseSnapshot: { final_unit_deduction: 8 },
    providerCostUnits: 8,
    providerCostUsd: 1.12,
    queryFn,
  });

  assert.equal(attempt.id, 42);
  assert.equal(attempt.attemptIndex, 1);
  assert.match(queries[0]?.sql ?? '', /INSERT INTO provider_attempts/);
  assert.match(queries[0]?.sql ?? '', /SELECT id, \$2::integer/);
  assert.deepEqual(queries[0]?.params, [
    'job_123',
    1,
    'kling_direct',
    'kling-v3',
    'submit_started',
    JSON.stringify({ promptLength: 12 }),
  ]);
  assert.match(queries[1]?.sql ?? '', /accepted_at = NOW\(\)/);
  assert.deepEqual(queries[1]?.params, [42, 'task_123', JSON.stringify({ task_id: 'task_123' })]);
  assert.match(queries[2]?.sql ?? '', /provider_cost_units = \$4/);
  assert.deepEqual(queries[2]?.params, [42, 'completed', JSON.stringify({ final_unit_deduction: 8 }), 8, 1.12]);
});

test('provider attempt helper links fallback attempts explicitly', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  await linkProviderFallbackAttempt({
    fromAttemptId: 10,
    toAttemptId: 11,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
      return [];
    },
  });

  assert.match(queries[0]?.sql ?? '', /fallback_to_attempt_id = \$2/);
  assert.deepEqual(queries[0]?.params, [10, 11]);
});
