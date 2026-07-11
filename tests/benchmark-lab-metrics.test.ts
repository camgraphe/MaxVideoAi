import assert from 'node:assert/strict';
import test from 'node:test';
import type { FalEngineEntry } from '../frontend/src/config/falEngines';
import {
  fetchPublicBenchmarkLatency,
  mapBenchmarkLatencyRows,
  type BenchmarkLatencyAggregateRow,
  type BenchmarkQuery,
} from '../frontend/server/benchmark-lab-metrics';

const engines = [
  {
    id: 'kling-3-pro',
    modelSlug: 'kling-3-pro',
    engine: { id: 'kling-3-pro', modes: ['t2v'] },
    modes: [],
    surfaces: { modelPage: { indexable: true, includeInSitemap: true } },
  },
] as unknown as FalEngineEntry[];

test('latency mapper emits only public-safe fields for mapped models', () => {
  const rows: BenchmarkLatencyAggregateRow[] = [
    {
      engine_id: 'kling-3-pro',
      completed_count: 104,
      distinct_users: 28,
      median_duration_ms: 230800,
      p90_duration_ms: 451600,
      as_of: '2026-07-11T14:00:00.000Z',
    },
    {
      engine_id: 'unknown-engine',
      completed_count: 80,
      distinct_users: 20,
      median_duration_ms: 100000,
      p90_duration_ms: 200000,
      as_of: '2026-07-11T14:00:00.000Z',
    },
  ];

  const mapped = mapBenchmarkLatencyRows(rows, engines);
  assert.deepEqual(mapped, [
    {
      engineId: 'kling-3-pro',
      modelSlug: 'kling-3-pro',
      medianDurationMs: 230800,
      p90DurationMs: 451600,
      asOf: '2026-07-11T14:00:00.000Z',
    },
  ]);
  assert.equal('completedCount' in mapped[0]!, false);
  assert.equal('distinctUsers' in mapped[0]!, false);
  assert.equal('successRate' in mapped[0]!, false);
});

test('latency query applies internal thresholds and admin exclusions', async () => {
  let capturedSql = '';
  let capturedParams: readonly unknown[] = [];
  const queryFn: BenchmarkQuery = async <T>(sql: string, params?: readonly unknown[]) => {
    capturedSql = sql;
    capturedParams = params ?? [];
    return [] as T[];
  };

  const snapshot = await fetchPublicBenchmarkLatency({
    queryFn,
    databaseConfigured: true,
    engines,
  });

  assert.equal(snapshot.status, 'available');
  assert.deepEqual(snapshot.rows, []);
  assert.match(capturedSql, /COUNT\(\*\) >= \$4/);
  assert.match(capturedSql, /COUNT\(DISTINCT user_id\) >= \$5/);
  assert.match(capturedSql, /user_id <> ALL\(\$1::text\[\]\)/);
  assert.equal(capturedParams[1], 30);
  assert.equal(capturedParams[3], 30);
  assert.equal(capturedParams[4], 5);
});

test('missing database returns unavailable rather than zero metrics', async () => {
  const snapshot = await fetchPublicBenchmarkLatency({
    databaseConfigured: false,
    engines,
  });
  assert.deepEqual(snapshot, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
});
