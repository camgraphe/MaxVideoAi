import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  persistFinalVideoJobUpdate,
  recordFinalGenerateQueueLog,
} from '../frontend/app/api/generate/_lib/final-job-persistence';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/final-job-persistence.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates final job persistence and final queue logging', () => {
  assert.ok(existsSync(helperPath), 'final job persistence should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/final-job-persistence'/);
  assert.doesNotMatch(routeSource, /SET thumb_url = \$2/, 'final app_jobs update SQL belongs in final-job-persistence.ts');
  assert.doesNotMatch(routeSource, /cost_breakdown_usd: costBreakdownUsd/, 'final queue log payload belongs in final-job-persistence.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1980, `/api/generate route should stay below 1980 lines after final persistence extraction, got ${lineCount}`);
});

test('final job persistence helper exposes the route contract', () => {
  assert.match(helperSource, /export async function persistFinalVideoJobUpdate/, 'persistFinalVideoJobUpdate should be exported');
  assert.match(helperSource, /export async function recordFinalGenerateQueueLog/, 'recordFinalGenerateQueueLog should be exported');
  assert.match(helperSource, /UPDATE app_jobs/, 'final app_jobs update SQL should stay with the helper');
});

test('final job persistence helper writes the expected app_jobs update params', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await persistFinalVideoJobUpdate({
    jobId: 'job_123',
    thumb: '/thumb.svg',
    aspectRatio: '16:9',
    previewFrame: '/thumb.svg',
    etaSeconds: 30,
    etaLabel: '30s',
    video: 'https://cdn.maxvideoai.com/video.mp4',
    status: 'completed',
    progress: 100,
    providerJobId: 'provider_123',
    finalPriceCents: 1200,
    pricingSnapshotJson: '{"totalCents":1200}',
    costBreakdownJson: '{"provider":100}',
    currency: 'USD',
    vendorAccountId: null,
    paymentStatus: 'paid_wallet',
    stripePaymentIntentId: null,
    stripeChargeId: null,
    visibility: 'private',
    indexable: false,
    message: 'Render complete',
    settingsSnapshotJson: '{"schemaVersion":1}',
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
  assert.deepEqual(queries[0]?.params, [
    'job_123',
    '/thumb.svg',
    '16:9',
    '/thumb.svg',
    30,
    '30s',
    'https://cdn.maxvideoai.com/video.mp4',
    'completed',
    100,
    'provider_123',
    1200,
    '{"totalCents":1200}',
    '{"provider":100}',
    'USD',
    null,
    'paid_wallet',
    null,
    null,
    'private',
    false,
    'Render complete',
    '{"schemaVersion":1}',
  ]);
});

test('final queue log helper records request, input summary, and pricing payload', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await recordFinalGenerateQueueLog({
    jobId: 'job_123',
    provider: 'fal',
    providerJobId: 'provider_123',
    engineId: 'seedance-2-0',
    status: 'completed',
    durationSec: 8,
    durationLabel: '8s',
    aspectRatio: '16:9',
    resolution: '1080p',
    loop: undefined,
    inputSummary: {
      primaryImageUrl: null,
      primaryAudioUrl: null,
      referenceImageCount: 0,
      referenceVideoCount: 0,
      referenceAudioCount: 0,
      hasFirstFrame: false,
      hasLastFrame: false,
      inputSlots: [],
    },
    totalCents: 1200,
    currency: 'USD',
    costBreakdownUsd: { provider: 100 },
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0]?.sql ?? '', /INSERT INTO fal_queue_log/);
  assert.deepEqual(queries[0]?.params?.slice(0, 5), ['job_123', 'fal', 'provider_123', 'seedance-2-0', 'completed']);
  assert.deepEqual(JSON.parse(String(queries[0]?.params?.[5])), {
    request: {
      durationSec: 8,
      durationLabel: '8s',
      aspectRatio: '16:9',
      resolution: '1080p',
    },
    inputSummary: {
      primaryImageUrl: null,
      primaryAudioUrl: null,
      referenceImageCount: 0,
      referenceVideoCount: 0,
      referenceAudioCount: 0,
      hasFirstFrame: false,
      hasLastFrame: false,
      inputSlots: [],
    },
    pricing: {
      totalCents: 1200,
      currency: 'USD',
      cost_breakdown_usd: { provider: 100 },
    },
  });
});

test('final queue log helper swallows logging failures', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    await recordFinalGenerateQueueLog({
      jobId: 'job_123',
      provider: 'fal',
      providerJobId: null,
      engineId: 'veo-3-1',
      status: 'queued',
      durationSec: 4,
      durationLabel: undefined,
      aspectRatio: null,
      resolution: '720p',
      loop: false,
      inputSummary: {
        primaryImageUrl: null,
        primaryAudioUrl: null,
        referenceImageCount: 0,
        referenceVideoCount: 0,
        referenceAudioCount: 0,
        hasFirstFrame: false,
        hasLastFrame: false,
        inputSlots: [],
      },
      totalCents: 100,
      currency: 'USD',
      costBreakdownUsd: null,
      queryFn: async () => {
        throw new Error('db down');
      },
    });
  } finally {
    console.warn = originalWarn;
  }
});
