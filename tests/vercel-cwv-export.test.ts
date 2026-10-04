import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeVercelMetric } from '../scripts/performance/vercel-metrics.mjs';

const query = { metric: 'vercel.speed_insights.inp_ms', groupBy: ['route','deviceType'], startTime: '2026-09-19T20:00:00.000Z', endTime: '2026-09-26T20:00:00.000Z', filter: 'environment:production' };
const values = { query: { ...query, aggregation: 'p75' }, summary: [{ route: '/', deviceType: 'mobile', vercel_speed_insights_inp_ms_p75: 0 }, { route: '/app', deviceType: 'mobile', vercel_speed_insights_inp_ms_p75: null }] };
const counts = { query: { ...query, aggregation: 'count' }, summary: [{ route: '/', deviceType: 'mobile', vercel_speed_insights_inp_ms_count: 3 }, { route: '/app', deviceType: 'mobile', vercel_speed_insights_inp_ms_count: 0 }] };

test('Vercel exporter preserves zero, missing values, metric counts and actual windows', () => {
  const rows = summarizeVercelMetric('inp_ms', values, counts);
  assert.equal(rows[0].p75, 0);
  assert.equal(rows[0].count, 3);
  assert.equal(rows[1].p75, null);
  assert.equal(rows[1].count, 0);
  assert.equal(rows[0].startTime, query.startTime);
});
test('Vercel exporter refuses to join different metric populations or windows', () => {
  for (const change of [{ startTime: '2026-09-20T20:00:00.000Z' }, { filter: 'environment:preview' }, { groupBy: ['requestPath'] }, { metric: 'vercel.speed_insights.lcp_ms' }]) {
    assert.throws(() => summarizeVercelMetric('inp_ms', values, { ...counts, query: { ...counts.query, ...change } }), /scope|window/i);
  }
});
test('Vercel exporter keeps an absent count empty instead of inventing a sample size', () => {
  assert.equal(summarizeVercelMetric('inp_ms', values, { ...counts, summary: [] })[0].count, null);
});
