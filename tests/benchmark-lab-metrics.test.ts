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

const aliasedEngines = [
  {
    id: 'kling-3-pro',
    modelSlug: 'kling-3-pro',
    defaultFalModelId: 'fal-ai/kling-video/v3/pro/text-to-video',
    engine: { id: 'kling-3-pro', modes: ['t2v'] },
    modes: [{ falModelId: 'provider/kling-v3-pro' }],
    surfaces: { modelPage: { indexable: true, includeInSitemap: true } },
  },
] as unknown as FalEngineEntry[];

test('latency mapper emits only public-safe fields for mapped models', () => {
  const rows: BenchmarkLatencyAggregateRow[] = [
    {
      engine_id: 'kling-3-pro',
      median_duration_ms: 230800,
      p90_duration_ms: 451600,
      as_of: '2026-07-11T14:00:00.000Z',
    },
    {
      engine_id: 'unknown-engine',
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

test('multiple aliases jointly cross eligibility and publish one canonical model row', async () => {
  const completedJobs = [
    ...Array.from({ length: 18 }, (_, index) => ({
      engineId: 'fal-ai/kling-video/v3/pro/text-to-video',
      userId: `user-${index % 5}`,
    })),
    ...Array.from({ length: 17 }, (_, index) => ({
      engineId: 'provider/kling-v3-pro',
      userId: `user-${index % 5}`,
    })),
  ];

  const queryFn: BenchmarkQuery = async <T>(_sql: string, params?: readonly unknown[]) => {
    const aliases = params?.[5];
    const canonicalEngineIds = params?.[6];
    assert.ok(Array.isArray(aliases), 'known aliases must be supplied to the aggregate query');
    assert.ok(Array.isArray(canonicalEngineIds), 'canonical engine IDs must be supplied to the aggregate query');

    const canonicalByAlias = new Map(
      aliases.map((alias, index) => [String(alias), String(canonicalEngineIds[index])])
    );
    const canonicalJobs = completedJobs.flatMap((job) => {
      const engineId = canonicalByAlias.get(job.engineId);
      return engineId ? [{ ...job, engineId }] : [];
    });
    assert.equal(canonicalJobs.length, 35);
    assert.equal(new Set(canonicalJobs.map((job) => job.engineId)).size, 1);
    assert.equal(new Set(canonicalJobs.map((job) => job.userId)).size, 5);

    return [{
      engine_id: canonicalJobs[0]!.engineId,
      median_duration_ms: 210000,
      p90_duration_ms: 420000,
      as_of: '2026-07-11T14:00:00.000Z',
    }] as T[];
  };

  const snapshot = await fetchPublicBenchmarkLatency({
    queryFn,
    databaseConfigured: true,
    engines: aliasedEngines,
  });

  assert.deepEqual(snapshot.rows, [{
    engineId: 'kling-3-pro',
    modelSlug: 'kling-3-pro',
    medianDurationMs: 210000,
    p90DurationMs: 420000,
    asOf: '2026-07-11T14:00:00.000Z',
  }]);
});

test('eligibility uses the full completed cohort while percentiles use only valid durations', async () => {
  let capturedSql = '';
  const queryFn: BenchmarkQuery = async <T>(sql: string) => {
    capturedSql = sql;
    return [] as T[];
  };

  await fetchPublicBenchmarkLatency({ queryFn, databaseConfigured: true, engines: aliasedEngines });

  assert.match(capturedSql, /completed_cohort AS/);
  assert.match(capturedSql, /eligible_engines AS[\s\S]*FROM completed_cohort[\s\S]*HAVING COUNT\(\*\) >= \$4/);
  assert.match(capturedSql, /duration_samples AS[\s\S]*FROM completed_cohort[\s\S]*updated_at IS NOT NULL[\s\S]*updated_at > created_at/);
  const completedCohortSql = capturedSql.match(/completed_cohort AS \(([\s\S]*?)\),\s*eligible_engines AS/)?.[1] ?? '';
  assert.doesNotMatch(completedCohortSql, /updated_at IS NOT NULL|updated_at > created_at/);
  assert.match(capturedSql, /JOIN eligible_engines USING \(engine_id\)/);
});

test('missing database returns unavailable rather than zero metrics', async () => {
  const snapshot = await fetchPublicBenchmarkLatency({
    databaseConfigured: false,
    engines,
  });
  assert.deepEqual(snapshot, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
});

test('query failures return unavailable without leaking errors or zero metrics', async () => {
  const queryFn: BenchmarkQuery = async () => {
    throw new Error('private database failure details');
  };
  const originalWarn = console.warn;
  console.warn = () => {};
  const snapshot = await (async () => {
    try {
      return await fetchPublicBenchmarkLatency({
        queryFn,
        databaseConfigured: true,
        engines,
      });
    } finally {
      console.warn = originalWarn;
    }
  })();

  assert.deepEqual(snapshot, { status: 'unavailable', windowDays: 30, asOf: null, rows: [] });
});
