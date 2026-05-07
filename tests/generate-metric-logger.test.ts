import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { createGenerateMetricLogger } from '../frontend/app/api/generate/_lib/metric-logger';
import type { GenerateMetricInput } from '../frontend/server/generate-metrics';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/metric-logger.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates metric logging state', () => {
  assert.ok(existsSync(helperPath), 'metric logging should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/metric-logger'/);
  assert.doesNotMatch(routeSource, /recordGenerateMetric/, 'metric recording belongs in metric-logger.ts');
  assert.doesNotMatch(routeSource, /const metricState:\s*\{/, 'metric state shape belongs in metric-logger.ts');
  assert.doesNotMatch(routeSource, /void recordMetric/, 'recording dispatch belongs in metric-logger.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2100, `/api/generate route should stay below 2100 lines after metric logger extraction, got ${lineCount}`);
});

test('metric logger helper exposes the route contract', () => {
  assert.match(helperSource, /export type GenerateRouteMetricState/, 'metric state type should be exported');
  assert.match(helperSource, /export function createGenerateMetricLogger/, 'createGenerateMetricLogger should be exported');
  assert.match(helperSource, /recordGenerateMetric/, 'default metric sink should remain in the helper');
});

test('metric logger skips records before an engine is known', () => {
  const recorded: GenerateMetricInput[] = [];
  const { log } = createGenerateMetricLogger({
    requestStartedAt: 1000,
    now: () => 1200,
    recordMetric: (input) => {
      recorded.push(input);
    },
  });

  log('rejected', { errorCode: 'UNKNOWN_ENGINE' });

  assert.deepEqual(recorded, []);
});

test('metric logger records state, duration, and merged metadata', () => {
  const recorded: GenerateMetricInput[] = [];
  const { state, log } = createGenerateMetricLogger({
    requestStartedAt: 1000,
    now: () => 1450,
    recordMetric: (input) => {
      recorded.push(input);
    },
  });

  state.engineId = 'seedance-2-0';
  state.engineLabel = 'Seedance 2.0';
  state.mode = 'i2v';
  state.userId = 'user_123';
  state.jobId = 'job_123';
  state.durationSec = 8;
  state.resolution = '1080p';

  log('accepted', {
    jobId: 'job_override',
    meta: {
      paymentMode: 'wallet',
    },
  });

  assert.deepEqual(recorded, [
    {
      jobId: 'job_override',
      userId: 'user_123',
      engineId: 'seedance-2-0',
      engineLabel: 'Seedance 2.0',
      mode: 'i2v',
      status: 'accepted',
      durationMs: 450,
      errorCode: undefined,
      meta: {
        durationSec: 8,
        resolution: '1080p',
        paymentMode: 'wallet',
      },
    },
  ]);
});

test('metric logger honors explicit duration and error code', () => {
  const recorded: GenerateMetricInput[] = [];
  const { state, log } = createGenerateMetricLogger({
    requestStartedAt: 1000,
    now: () => 1450,
    recordMetric: (input) => {
      recorded.push(input);
    },
  });

  state.engineId = 'veo-3-1';
  state.jobId = 'job_456';

  log('failed', {
    durationMs: 12,
    errorCode: 'PROVIDER_ERROR',
  });

  assert.equal(recorded.length, 1);
  assert.equal(recorded[0]?.durationMs, 12);
  assert.equal(recorded[0]?.errorCode, 'PROVIDER_ERROR');
  assert.equal(recorded[0]?.jobId, 'job_456');
});
