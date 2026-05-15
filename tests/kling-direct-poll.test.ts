import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runKlingDirectPoll } from '../frontend/server/kling-direct-poll';

const root = process.cwd();
const pollPath = join(root, 'frontend/server/kling-direct-poll.ts');
const routePath = join(root, 'frontend/app/api/cron/kling-direct-poll/route.ts');

const baseJob = {
  job_id: 'job_123',
  user_id: 'user_123',
  engine_id: 'kling-3-pro',
  engine_label: 'Kling 3 Pro',
  provider_job_id: 'task_123',
  status: 'running',
  duration_sec: 8,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 1200,
  pricing_snapshot: { totalCents: 1200, currency: 'USD' },
  settings_snapshot: { core: { durationSec: 8, aspectRatio: '16:9' } },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: new Date(Date.now() - 20_000).toISOString(),
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

test('Kling direct poll copies provider output before marking the job completed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const outputs: unknown[] = [];

  const response = await runKlingDirectPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 7, attempt_index: 1 }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: 'job_123' }] as never;
        }
        return [] as never;
      },
      getKlingDirectClientFn: () => ({
        retrieveTask: async () => ({
          providerJobId: 'task_123',
          status: 'completed',
          rawStatus: 'succeed',
          videoUrl: 'https://provider.kling/video.mp4',
          message: null,
          usage: null,
          providerCostUnits: 8,
          providerCostUsd: 1.12,
          raw: { data: { task_id: 'task_123', final_unit_deduction: 8 } },
        }),
      }),
      ensureFastStartVideoFn: async () => 'https://cdn.maxvideoai.com/jobs/job_123/video.mp4',
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/jobs/job_123/thumb.jpg',
      upsertLegacyJobOutputsFn: async (payload) => {
        outputs.push(payload);
      },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  const completedUpdate = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate, 'completed app_jobs update should run');
  assert.equal(completedUpdate.params?.[1], 'https://cdn.maxvideoai.com/jobs/job_123/video.mp4');
  assert.notEqual(completedUpdate.params?.[1], 'https://provider.kling/video.mp4');
  assert.match(JSON.stringify(completedUpdate.params?.[3]), /provider_cost_units/);
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);

  const attemptUpdate = queries.find((entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_units/.test(entry.sql));
  assert.ok(attemptUpdate, 'provider_attempts should store final Kling cost');
  assert.deepEqual(attemptUpdate.params?.slice(0, 5), [
    7,
    'completed',
    JSON.stringify({ data: { task_id: 'task_123', final_unit_deduction: 8 } }),
    8,
    1.12,
  ]);
});

test('Kling direct poll defers completion when provider output cannot be copied', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await runKlingDirectPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 7, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getKlingDirectClientFn: () => ({
        retrieveTask: async () => ({
          providerJobId: 'task_123',
          status: 'completed',
          rawStatus: 'succeed',
          videoUrl: 'https://provider.kling/video.mp4',
          message: null,
          usage: null,
          providerCostUnits: 8,
          providerCostUsd: 1.12,
          raw: { data: { task_id: 'task_123', final_unit_deduction: 8 } },
        }),
      }),
      ensureFastStartVideoFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  assert.equal(queries.some((entry) => /SET status = 'completed'/.test(entry.sql)), false);
  const retryUpdate = queries.find((entry) => /Generated video is ready\. Copying it to MaxVideoAI storage/.test(JSON.stringify(entry.params)));
  assert.ok(retryUpdate, 'copy failure should leave the job in a retry/admin-review state');
});

test('Kling direct poll uses the endpoint family stored on the accepted provider attempt', async () => {
  let pollPathPrefix: string | undefined;

  await runKlingDirectPoll({
    deps: {
      queryFn: async (sql) => {
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [{ ...baseJob, status: 'queued', provider_job_id: 'task_i2v' }] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [
            {
              id: 7,
              attempt_index: 1,
              request_snapshot: { pollPathPrefix: '/v1/videos/image2video' },
            },
          ] as never;
        }
        return [] as never;
      },
      getKlingDirectClientFn: () => ({
        retrieveTask: async (params) => {
          pollPathPrefix = params.pollPathPrefix;
          return {
            providerJobId: 'task_i2v',
            status: 'queued',
            rawStatus: 'submitted',
            videoUrl: null,
            message: null,
            usage: null,
            raw: { data: { task_id: 'task_i2v', task_status: 'submitted' } },
          };
        },
      }),
      ensureFastStartVideoFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  assert.equal(pollPathPrefix, '/v1/videos/image2video');
});

test('Kling direct polling is isolated from Fal polling and exposed through a cron route', () => {
  assert.ok(existsSync(pollPath), 'Kling direct poller should exist');
  assert.ok(existsSync(routePath), 'Kling direct cron route should exist');
  const source = readFileSync(pollPath, 'utf8');
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  assert.doesNotMatch(source, /generateVideo/);
  assert.doesNotMatch(source, /getFalClient/);
});
