import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerateMetricLogger } from '../frontend/app/api/generate/_lib/metric-logger';
import type { GenerateMetricInput } from '../frontend/server/generate-metrics';

test('early LAS refusal records the exact mode and safe reason without caller data', async () => {
  const records: GenerateMetricInput[] = [];
  const logger = createGenerateMetricLogger({
    requestStartedAt: 1000, now: () => 1200,
    recordMetric: (input) => { records.push(input); },
  });
  await logger.logPreflightRejection({
    engineId: 'seedance-2-5', mode: 'V2V', prompt: 'private prompt',
    jobId: 'private-job', userId: 'private-user', videoUrl: 'https://private.invalid?token=secret',
    resolution: '720p', payment: { paymentIntentId: 'private-payment' },
  }, { ok: false, status: 503, body: { ok: false, error: 'BYTEPLUS_LAS_EXECUTION_DISABLED' } });
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], {
    engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', mode: 'v2v',
    jobId: null, userId: null, status: 'rejected', durationMs: 200,
    errorCode: 'BYTEPLUS_LAS_EXECUTION_DISABLED',
    meta: { stage: 'route_preflight', httpStatus: 503, provider: 'byteplus_modelark',
      transport: 'las', durationSource: 'request_elapsed' },
  });
  assert.doesNotMatch(JSON.stringify(records), /private|secret|prompt|payment|videoUrl/);
});

test('preflight traces ignore unregistered engine identifiers and unbounded error text', async () => {
  const records: GenerateMetricInput[] = [];
  const logger = createGenerateMetricLogger({ requestStartedAt: 1,
    recordMetric: (input) => { records.push(input); } });
  await logger.logPreflightRejection({ engineId: 'private-prompt', mode: 'v2v' },
    { ok: false, status: 400, body: { error: 'Unknown engine' } });
  await logger.logPreflightRejection({ engineId: 'seedance-2-5', mode: 'v2v' },
    { ok: false, status: 503, body: { error: 'secret https://private.invalid' } });
  assert.deepEqual(records, []);
});

test('preflight trace awaits persistence while retaining an immediate safe runtime trace', async (t) => {
  const traces: unknown[] = [];
  t.mock.method(console, 'warn', (...args: unknown[]) => { traces.push(args); });
  let finish!: () => void;
  const persistence = new Promise<void>((resolve) => { finish = resolve; });
  const logger = createGenerateMetricLogger({ requestStartedAt: 1, recordMetric: () => persistence });
  let recorded = false;
  const pending = logger.logPreflightRejection({ engineId: 'seedance-2-5', mode: 'v2v' },
    { ok: false, status: 503, body: { error: 'BYTEPLUS_LAS_API_KEY_MISSING' } })
    .then(() => { recorded = true; });
  await Promise.resolve();
  assert.equal(recorded, false);
  assert.equal(traces.length, 1);
  assert.deepEqual(traces[0], ['[api/generate] preflight rejected', {
    engineId: 'seedance-2-5', mode: 'v2v', status: 503,
    code: 'BYTEPLUS_LAS_API_KEY_MISSING', provider: 'byteplus_modelark', transport: 'las',
  }]);
  finish();
  await pending;
  assert.equal(recorded, true);
});
