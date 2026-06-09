import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runLumaAgentsPoll } from '../frontend/server/luma-agents-poll';

const root = process.cwd();
const pollPath = join(root, 'frontend/server/luma-agents-poll.ts');
const routePath = join(root, 'frontend/app/api/cron/luma-agents-poll/route.ts');
const vercelConfigPath = join(root, 'frontend/vercel.json');

const baseJob = {
  job_id: 'job_luma_123',
  user_id: 'user_123',
  engine_id: 'luma-ray-3-2',
  engine_label: 'Luma Ray 3.2',
  provider_job_id: 'gen_luma_123',
  status: 'running',
  duration_sec: 10,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 1200,
  pricing_snapshot: { provider: 'fal', totalCents: 1200, currency: 'USD' },
  settings_snapshot: { core: { mode: 't2v', durationSec: 10, aspectRatio: '16:9', resolution: '1080p' } },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: new Date(Date.now() - 20_000).toISOString(),
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

test('Luma Agents poll copies provider output before marking the job completed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const outputs: unknown[] = [];
  const actions: string[] = [];

  const response = await runLumaAgentsPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 23, attempt_index: 1, request_snapshot: { resolution: '1080p' } }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /SET status = 'completed'/.test(sql)) {
          actions.push('completed');
          return [{ job_id: 'job_luma_123' }] as never;
        }
        return [] as never;
      },
      getLumaAgentsClientFn: () => ({
        getGeneration: async () => ({
          id: 'gen_luma_123',
          state: 'completed',
          output: [{ type: 'video', url: 'https://providers.lumalabs.ai/output/job_luma_123.mp4' }],
        }),
      }),
      ensureFastStartVideoFn: async (payload) => {
        actions.push('copy');
        assert.equal(payload.videoUrl, 'https://providers.lumalabs.ai/output/job_luma_123.mp4');
        return 'https://cdn.maxvideoai.com/renders/job_luma_123-faststart.mp4';
      },
      detectVideoDimensionsFn: async () => ({ width: 1920, height: 1080 }),
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_luma_123-thumb.jpg',
      upsertLegacyJobOutputsFn: async (payload) => {
        outputs.push(payload);
      },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.deepEqual(actions, ['copy', 'completed']);

  const pendingQuery = queries.find((entry) => /FROM app_jobs/.test(entry.sql) && /provider = \$1/.test(entry.sql));
  assert.equal(pendingQuery?.params?.[0], 'luma_agents_direct');
  assert.deepEqual(pendingQuery?.params?.[1], ['pending', 'queued', 'running', 'processing', 'in_progress']);

  const completedUpdate = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate, 'completed app_jobs update should run');
  assert.equal(completedUpdate.params?.[1], 'https://cdn.maxvideoai.com/renders/job_luma_123-faststart.mp4');
  assert.notEqual(completedUpdate.params?.[1], 'https://providers.lumalabs.ai/output/job_luma_123.mp4');
  assert.match(String(completedUpdate.params?.[3]), /luma_agents_public_pricing_estimate/);
  assert.match(String(completedUpdate.params?.[3]), /3\.6/);
  assert.equal(completedUpdate.params?.[4], '16:9');
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);
  assert.deepEqual(
    {
      width: (outputs[0] as { video_width?: number }).video_width,
      height: (outputs[0] as { video_height?: number }).video_height,
    },
    { width: 1920, height: 1080 }
  );

  const attemptUpdate = queries.find((entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_usd/.test(entry.sql));
  assert.ok(attemptUpdate, 'provider_attempts should store estimated Luma provider cost');
  assert.equal(attemptUpdate.params?.[0], 23);
  assert.equal(attemptUpdate.params?.[1], 'completed');
  assert.match(String(attemptUpdate.params?.[2]), /gen_luma_123/);
  assert.equal(attemptUpdate.params?.[3], null);
  assert.equal(attemptUpdate.params?.[4], 3.6);
});

test('Luma Agents poll refunds failed paid wallet jobs once and marks the attempt failed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const response = await runLumaAgentsPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 24, attempt_index: 1 }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /SET status = 'failed'/.test(sql)) {
          return [{ job_id: 'job_luma_123' }] as never;
        }
        if (/INSERT INTO app_receipts/.test(sql)) {
          return [{ id: 'refund_1' }] as never;
        }
        return [] as never;
      },
      getLumaAgentsClientFn: () => ({
        getGeneration: async () => ({
          id: 'gen_luma_123',
          state: 'failed',
          failure_reason: 'The prompt was blocked by provider safety checks.',
        }),
      }),
      ensureFastStartVideoFn: async () => {
        throw new Error('not used');
      },
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(queries.filter((entry) => /INSERT INTO app_receipts/.test(entry.sql)).length, 1);
  assert.ok(
    queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql) && /ON CONFLICT DO NOTHING/.test(entry.sql)),
    'refund insert should be idempotent'
  );
  assert.ok(
    queries.some((entry) => /UPDATE app_jobs/.test(entry.sql) && /payment_status = CASE WHEN \$2/.test(entry.sql)),
    'paid wallet job should be marked refunded after refund receipt insert'
  );

  const failedAttemptUpdate = queries.find(
    (entry) => /UPDATE provider_attempts/.test(entry.sql) && /error_class/.test(entry.sql)
  );
  assert.ok(failedAttemptUpdate, 'provider_attempts should be marked failed');
  assert.equal(failedAttemptUpdate.params?.[0], 24);
  assert.equal(failedAttemptUpdate.params?.[1], 'failed');
  assert.equal(failedAttemptUpdate.params?.[3], 'provider_terminal_failure');

  const costAttemptUpdate = queries.find(
    (entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_usd/.test(entry.sql)
  );
  assert.ok(costAttemptUpdate, 'failed provider attempt should store estimated Luma provider cost');
  assert.equal(costAttemptUpdate.params?.[1], 'failed');
  assert.equal(costAttemptUpdate.params?.[4], 3.6);
});

test('Luma Agents poll marks stalled jobs and provider attempts as polling_stalled', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  let clientCalled = false;
  const stalledJob = {
    ...baseJob,
    created_at: new Date(Date.now() - 36 * 60_000).toISOString(),
  };

  const response = await runLumaAgentsPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [stalledJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 25, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getLumaAgentsClientFn: () => ({
        getGeneration: async () => {
          clientCalled = true;
          throw new Error('not used');
        },
      }),
      ensureFastStartVideoFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(clientCalled, false);
  assert.ok(
    queries.some((entry) => /SET status = 'provider_polling_stalled'/.test(entry.sql)),
    'stalled job should be marked for manual provider polling review'
  );

  const stalledAttemptUpdate = queries.find(
    (entry) => /UPDATE provider_attempts/.test(entry.sql) && /error_class/.test(entry.sql)
  );
  assert.ok(stalledAttemptUpdate, 'provider_attempts should be marked polling_stalled');
  assert.equal(stalledAttemptUpdate.params?.[0], 25);
  assert.equal(stalledAttemptUpdate.params?.[1], 'polling_stalled');
  assert.equal(stalledAttemptUpdate.params?.[3], 'polling_stalled');

  const costAttemptUpdate = queries.find(
    (entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_usd/.test(entry.sql)
  );
  assert.ok(costAttemptUpdate, 'stalled provider attempt should store estimated Luma provider cost');
  assert.equal(costAttemptUpdate.params?.[1], 'polling_stalled');
  assert.equal(costAttemptUpdate.params?.[4], 3.6);
});

test('Luma Agents poll is disabled by env unless dependencies are injected', async () => {
  const previousEnabled = process.env.LUMA_AGENTS_ENABLED;
  const previousVideoEnabled = process.env.LUMA_AGENTS_VIDEO_DIRECT_ENABLED;
  process.env.LUMA_AGENTS_ENABLED = 'false';
  process.env.LUMA_AGENTS_VIDEO_DIRECT_ENABLED = 'false';
  try {
    const response = await runLumaAgentsPoll();
    assert.deepEqual(await response.json(), { ok: true, enabled: false, checked: 0, updates: 0 });
  } finally {
    if (previousEnabled === undefined) {
      delete process.env.LUMA_AGENTS_ENABLED;
    } else {
      process.env.LUMA_AGENTS_ENABLED = previousEnabled;
    }
    if (previousVideoEnabled === undefined) {
      delete process.env.LUMA_AGENTS_VIDEO_DIRECT_ENABLED;
    } else {
      process.env.LUMA_AGENTS_VIDEO_DIRECT_ENABLED = previousVideoEnabled;
    }
  }
});

test('Luma Agents polling is isolated from Fal APIs and exposed through a cron route', () => {
  assert.ok(existsSync(pollPath), 'Luma Agents poller should exist');
  assert.ok(existsSync(routePath), 'Luma Agents cron route should exist');
  const source = readFileSync(pollPath, 'utf8');
  assert.match(source, /getLumaAgentsClient/);
  assert.match(source, /normalizeLumaAgentsGeneration/);
  assert.match(source, /ensureFastStartVideo/);
  assert.match(source, /LUMA_AGENTS_DIRECT_PROVIDER/);
  assert.match(source, /LUMA_AGENTS_ENABLED/);
  assert.match(source, /LUMA_AGENTS_VIDEO_DIRECT_ENABLED/);
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  assert.doesNotMatch(source, /generateVideo/);
  assert.doesNotMatch(source, /getFalClient/);
  assert.match(readFileSync(routePath, 'utf8'), /x-luma-agents-poll-token/);
  assert.match(readFileSync(routePath, 'utf8'), /runLumaAgentsPoll/);
  assert.match(readFileSync(vercelConfigPath, 'utf8'), /luma-agents-poll/);
});
