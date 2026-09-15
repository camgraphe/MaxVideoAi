import { allowGenerationPoll } from './helpers/generation-poll-claim';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { runAlibabaModelStudioPoll } from '../frontend/server/alibaba-model-studio-poll';

const root = process.cwd();
const pollPath = join(root, 'frontend/server/alibaba-model-studio-poll.ts');
const routePath = join(root, 'frontend/app/api/cron/alibaba-model-studio-poll/route.ts');
const vercelConfigPath = join(root, 'frontend/vercel.json');

const baseJob = {
  job_id: 'job_alibaba_123',
  user_id: 'user_123',
  engine_id: 'wan-3',
  engine_label: 'Wan 3',
  provider_job_id: 'task_alibaba_123',
  status: 'running',
  duration_sec: 10,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 1200,
  pricing_snapshot: { provider: 'fal', totalCents: 1200, currency: 'USD' },
  settings_snapshot: { inputMode: 'ref2v', core: { durationSec: 10, resolution: '1080p' } },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: new Date(Date.now() - 20_000).toISOString(),
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

test('Alibaba poll copies the expiring provider output before completing the existing job', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const actions: string[] = [];
  const outputs: unknown[] = [];
  const response = await runAlibabaModelStudioPoll({
    deps: {
      claimPollFn: allowGenerationPoll,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) return [baseJob] as never;
        if (/FROM provider_attempts/.test(sql)) return [{ id: 31, attempt_index: 1 }] as never;
        if (/SET status = 'completed'/.test(sql)) {
          actions.push('completed');
          return [{ job_id: baseJob.job_id }] as never;
        }
        return [] as never;
      },
      getAlibabaModelStudioClientFn: () => ({
        getTask: async () => ({
          request_id: 'request-123',
          output: {
            task_id: baseJob.provider_job_id,
            task_status: 'SUCCEEDED',
            video_url: 'https://provider.example/temporary-output.mp4?token=temporary',
          },
          usage: { duration: 15, input_video_duration: 5, output_video_duration: 10 },
        }),
      }),
      ensureFastStartVideoFn: async (payload) => {
        actions.push('copy');
        assert.match(payload.videoUrl, /temporary-output/);
        return 'https://cdn.maxvideoai.com/renders/job_alibaba_123-faststart.mp4';
      },
      detectVideoDimensionsFn: async () => ({ width: 1920, height: 1080 }),
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_alibaba_123-thumb.jpg',
      upsertLegacyJobOutputsFn: async (payload) => { outputs.push(payload); },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  assert.deepEqual(actions, ['copy', 'completed']);
  assert.equal((await response.json()).updates, 1);
  const completed = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.equal(completed?.params?.[1], 'https://cdn.maxvideoai.com/renders/job_alibaba_123-faststart.mp4');
  const cost = JSON.parse(String(completed?.params?.[3]));
  assert.equal(cost.provider, 'alibaba_model_studio');
  assert.equal(cost.provider_cost_units, 15);
  assert.equal(cost.provider_cost_usd, 3);
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);
  const attempt = queries.find((entry) => /provider_cost_usd/.test(entry.sql));
  assert.equal(attempt?.params?.[0], 31);
  assert.equal(attempt?.params?.[4], 3);
});

test('Alibaba poll refunds a terminally failed paid-wallet job once', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const response = await runAlibabaModelStudioPoll({
    deps: {
      claimPollFn: allowGenerationPoll,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) return [baseJob] as never;
        if (/FROM provider_attempts/.test(sql)) return [{ id: 32, attempt_index: 1 }] as never;
        if (/SET status = 'failed'/.test(sql)) return [{ job_id: baseJob.job_id }] as never;
        if (/INSERT INTO app_receipts/.test(sql)) return [{ id: 'refund_1' }] as never;
        return [] as never;
      },
      getAlibabaModelStudioClientFn: () => ({
        getTask: async () => ({
          output: {
            task_id: baseJob.provider_job_id,
            task_status: 'FAILED',
            code: 'DataInspectionFailed',
            message: 'Content policy violation.',
          },
        }),
      }),
      ensureFastStartVideoFn: async () => { throw new Error('not used'); },
      detectVideoDimensionsFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => undefined,
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  assert.equal((await response.json()).updates, 1);
  assert.equal(queries.filter((entry) => /INSERT INTO app_receipts/.test(entry.sql)).length, 1);
  assert.equal(queries.some((entry) => /ON CONFLICT DO NOTHING/.test(entry.sql)), true);
  assert.equal(
    queries.some((entry) => /error_class/.test(entry.sql) && entry.params?.includes('provider_terminal_failure')),
    true
  );
});

test('Alibaba poll is disabled by default unless test dependencies are injected', async () => {
  const previous = process.env.ALIBABA_MODEL_STUDIO_ENABLED;
  process.env.ALIBABA_MODEL_STUDIO_ENABLED = 'false';
  try {
    const response = await runAlibabaModelStudioPoll();
    assert.deepEqual(await response.json(), { ok: true, enabled: false, checked: 0, updates: 0 });
  } finally {
    if (previous === undefined) delete process.env.ALIBABA_MODEL_STUDIO_ENABLED;
    else process.env.ALIBABA_MODEL_STUDIO_ENABLED = previous;
  }
});

test('Alibaba polling is isolated from Fal and protected by its own cron route', () => {
  assert.equal(existsSync(pollPath), true);
  assert.equal(existsSync(routePath), true);
  const source = readFileSync(pollPath, 'utf8');
  assert.match(source, /getAlibabaModelStudioClient/);
  assert.match(source, /normalizeAlibabaTask/);
  assert.match(source, /ensureFastStartVideo/);
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  const route = readFileSync(routePath, 'utf8');
  assert.match(route, /x-alibaba-model-studio-poll-token/);
  assert.match(route, /runAlibabaModelStudioPoll/);
  assert.match(readFileSync(vercelConfigPath, 'utf8'), /alibaba-model-studio-poll/);
});
