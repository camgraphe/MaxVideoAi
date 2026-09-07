import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchEngineAverageDurations, type DurationQuery } from '../frontend/server/generate-metrics';

// Injected read-only fixture, never a connection to the application database.
test('engine timing query uses first exact completion events, milliseconds and canonical aliases', async () => {
  let calls = 0;
  const queryFn: DurationQuery = async <T>(sql: string, params?: readonly unknown[]) => {
    calls++;
    assert.match(sql, /EXTRACT\(EPOCH FROM \(completion.created_at - j.created_at\)\) \* 1000/);
    assert.match(sql, /LOWER\(l.status\) IN \('completed', 'poll:completed'\)/);
    assert.match(sql, /ORDER BY l.created_at ASC LIMIT 1/);
    assert.match(sql, /j.status = 'completed'/);
    assert.doesNotMatch(sql, /updated_at|app_generate_metrics|\b(?:INSERT|CREATE|UPDATE|DELETE)\b/i);
    const aliases = params?.[1] as string[];
    const canonical = params?.[2] as string[];
    assert.equal(aliases.length, canonical.length);
    assert.ok(aliases.includes('veo-3-1'));
    assert.equal(canonical[aliases.indexOf('veo-3-1')], 'veo-3-1');
    return [{ engine_id: 'veo-3-1', completed_count: '4', avg_duration_ms: '81000', p95_duration_ms: '120000' }] as T[];
  };
  const result = await fetchEngineAverageDurations(30, { queryFn, databaseConfigured: true });
  assert.equal(calls, 1);
  assert.deepEqual(result, [{ engineId: 'veo-3-1', averageDurationMs: 81000, completedCount: 4, source: 'completion_event' }]);
});

test('unconfigured and invalid or empty timing samples produce no measured fallback', async () => {
  assert.deepEqual(await fetchEngineAverageDurations(30, { databaseConfigured: false, queryFn: async () => { throw new Error('Must not query'); } }), []);
  const rows = [NaN, Infinity, null, -5, 0].map((avg_duration_ms) => ({ engine_id: 'invalid', completed_count: 1, avg_duration_ms }));
  rows.push({ engine_id: 'empty', completed_count: 0, avg_duration_ms: 8000 });
  assert.deepEqual(await fetchEngineAverageDurations(30, { databaseConfigured: true, queryFn: async <T>() => rows as T[] }), []);
});
