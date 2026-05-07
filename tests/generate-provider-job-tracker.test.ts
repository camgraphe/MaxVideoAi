import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { createProviderJobTracker } from '../frontend/app/api/generate/_lib/provider-job-tracker';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/provider-job-tracker.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

test('generate route delegates provider job id tracking', () => {
  assert.ok(existsSync(helperPath), 'provider job id tracking should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/provider-job-tracker'/);
  assert.doesNotMatch(routeSource, /let lastProviderJobId/, 'provider job id state belongs in provider-job-tracker.ts');
  assert.doesNotMatch(routeSource, /INSERT INTO fal_queue_log \(job_id, provider, provider_job_id, engine_id, status, payload\)\n\s+VALUES \(\$1,\$2,\$3,\$4,\$5,\$6::jsonb\)[\s\S]*'enqueue'/, 'enqueue queue log SQL belongs in provider-job-tracker.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 2020, `/api/generate route should stay below 2020 lines after provider tracker extraction, got ${lineCount}`);
});

test('provider job tracker helper exposes the route contract', () => {
  assert.match(helperSource, /export type ProviderJobTracker/, 'ProviderJobTracker type should be exported');
  assert.match(helperSource, /export function createProviderJobTracker/, 'createProviderJobTracker should be exported');
  assert.match(helperSource, /getLastProviderJobId/, 'last provider job getter should stay in the helper');
  assert.match(helperSource, /persistProviderJobId/, 'provider job persistence should stay in the helper');
});

test('provider job tracker persists new provider ids and queue log payloads', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const tracker = createProviderJobTracker({
    jobId: 'job_123',
    providerKey: 'fal',
    engineId: 'seedance-2-0',
    prompt: 'Create a shot',
    inputSummary: {
      primaryImageUrl: 'https://cdn.maxvideoai.com/image.png',
      primaryAudioUrl: null,
      referenceImageCount: 1,
      referenceVideoCount: 0,
      referenceAudioCount: 0,
      hasFirstFrame: false,
      hasLastFrame: false,
      inputSlots: [{ slotId: 'image_url', kind: 'image', hasUrl: true }],
    },
    now: () => new Date('2026-05-07T20:00:00.000Z'),
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  await tracker.persistProviderJobId('fal_request_123');

  assert.equal(tracker.getLastProviderJobId(), 'fal_request_123');
  assert.equal(queries.length, 2);
  assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
  assert.deepEqual(queries[0]?.params, ['job_123', 'fal_request_123']);
  assert.match(queries[1]?.sql ?? '', /INSERT INTO fal_queue_log/);
  assert.deepEqual(queries[1]?.params?.slice(0, 5), ['job_123', 'fal', 'fal_request_123', 'seedance-2-0', 'enqueue']);
  const payload = JSON.parse(String(queries[1]?.params?.[5]));
  assert.deepEqual(payload, {
    at: '2026-05-07T20:00:00.000Z',
    engineId: 'seedance-2-0',
    promptLength: 13,
    inputSummary: {
      primaryImageUrl: 'https://cdn.maxvideoai.com/image.png',
      primaryAudioUrl: null,
      referenceImageCount: 1,
      referenceVideoCount: 0,
      referenceAudioCount: 0,
      hasFirstFrame: false,
      hasLastFrame: false,
      inputSlots: [{ slotId: 'image_url', kind: 'image', hasUrl: true }],
    },
  });
});

test('provider job tracker deduplicates repeated provider ids and accepts queue status ids', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const tracker = createProviderJobTracker({
    jobId: 'job_123',
    providerKey: 'fal',
    engineId: 'veo-3-1',
    prompt: 'Prompt',
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
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  tracker.setLastProviderJobId('from_queue');
  assert.equal(tracker.getLastProviderJobId(), 'from_queue');

  await tracker.persistProviderJobId('from_queue');
  await tracker.persistProviderJobId('from_queue');

  assert.equal(queries.length, 0);
});
