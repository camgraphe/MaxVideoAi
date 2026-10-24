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
  const signedOutput = 'https://provider.example/temporary-output.mp4?X-Amz-Signature=output-private-signature&X-Amz-Credential=output-private-access&X-Amz-Expires=3600';
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
            video_url: signedOutput,
            diagnostic: `Result ready at ${signedOutput}`,
          },
          usage: { duration: 15, input_video_duration: 5, output_video_duration: 10 },
        }),
      }),
      ensureFastStartVideoFn: async (payload) => {
        actions.push('copy');
        assert.equal(payload.videoUrl, signedOutput, 'output signing credentials are required until the durable copy succeeds');
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
  assert.equal(cost.provider_cost_status, 'list_estimate_from_provider_usage');
  assert.equal(cost.input_video_duration_sec, 5);
  assert.equal(cost.output_video_duration_sec, 10);
  assert.equal(cost.provider_cost_usd_effective, null, 'LIST is not account or invoice evidence');
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);
  const attempt = queries.find((entry) => /provider_cost_usd/.test(entry.sql));
  assert.equal(attempt?.params?.[0], 31);
  assert.equal(attempt?.params?.[4], 3);
  assert.doesNotMatch(JSON.stringify({ queries, outputs }), /X-Amz-|output-private-signature|output-private-access/,
    'persisted output diagnostics must not retain the temporary provider grant');
});

for (const engineId of ['wan-3', 'wan-3-prime']) {
  test(`${engineId} input download failure explains the reference problem and strips inline and encoded grants`, async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const job = { ...baseJob, engine_id: engineId, engine_label: engineId === 'wan-3' ? 'Wan 3' : 'Wan 3 Prime' };
    const source = 'https://source.example/video-excerpts-private-v3-source.mp4?X-Amz-Signature=source-private-signature&X-Amz-Credential=source-private-access&X-Amz-Expires=3600';
    let copies = 0;
    const response = await runAlibabaModelStudioPoll({ deps: {
      claimPollFn: allowGenerationPoll,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) return [job] as never;
        if (/FROM provider_attempts/.test(sql)) return [{ id: 33, attempt_index: 1 }] as never;
        if (/SET status = 'failed'/.test(sql)) return [{ job_id: job.job_id }] as never;
        if (/INSERT INTO app_receipts/.test(sql)) return [{ id: 'reference_refund' }] as never;
        return [] as never;
      },
      getAlibabaModelStudioClientFn: () => ({ getTask: async () => ({ output: {
        task_id: job.provider_job_id, task_status: 'FAILED', code: 'InvalidParameter',
        message: `Failed to download ${source}`,
        diagnostic: JSON.stringify({ source, encoded: encodeURIComponent(source), doubleEncoded: encodeURIComponent(encodeURIComponent(source)) }),
      } }) }),
      ensureFastStartVideoFn: async () => { copies++; throw new Error('There is no output to copy'); },
      detectVideoDimensionsFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => { throw new Error('A rejected input cannot publish an output'); },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    } });
    assert.equal((await response.json()).updates, 1);
    assert.equal(copies, 0);
    const failed = queries.find(entry => /SET status = 'failed'/.test(entry.sql));
    assert.match(String(failed?.params?.[1]), /could not read the reference media/i);
    assert.doesNotMatch(String(failed?.params?.[1]), /render finished|output for download/i);
    assert.equal(queries.filter(entry => /INSERT INTO app_receipts/.test(entry.sql)).length, 1);
    assert.match(JSON.stringify(queries), /InvalidParameter/);
    assert.doesNotMatch(JSON.stringify(queries), /X-Amz-|source-private-signature|source-private-access/,
      'all persisted attempts, refunds and user messages must exclude temporary input credentials');
  });

  test(`${engineId} also removes encoded input grants from generic terminal error messages`, async () => {
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const job = { ...baseJob, engine_id: engineId };
    const signedSource = 'https://s.example/input.mp4?X-Amz-Signature=secret&X-Amz-Expires=3600';
    const response = await runAlibabaModelStudioPoll({ deps: {
      claimPollFn: allowGenerationPoll,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) return [job] as never;
        if (/FROM provider_attempts/.test(sql)) return [{ id: 35, attempt_index: 1 }] as never;
        if (/SET status = 'failed'/.test(sql)) return [{ job_id: job.job_id }] as never;
        if (/INSERT INTO app_receipts/.test(sql)) return [{ id: 'bad_media_refund' }] as never;
        return [] as never;
      },
      getAlibabaModelStudioClientFn: () => ({ getTask: async () => ({ output: {
        task_id: job.provider_job_id, task_status: 'FAILED', code: 'BadMedia',
        message: `Bad media ${encodeURIComponent(signedSource)}`,
      } }) }),
      ensureFastStartVideoFn: async () => { throw new Error('There is no output to copy'); },
      detectVideoDimensionsFn: async () => null,
      ensureJobThumbnailFn: async () => null,
      upsertLegacyJobOutputsFn: async () => { throw new Error('No output may be published'); },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    } });
    assert.equal((await response.json()).updates, 1);
    assert.ok(queries.some(entry => /SET status = 'failed'/.test(entry.sql)));
    assert.equal(queries.filter(entry => /INSERT INTO app_receipts/.test(entry.sql)).length, 1);
    assert.match(JSON.stringify(queries), /BadMedia/);
    assert.doesNotMatch(JSON.stringify(queries), /X-Amz-|secret/,
      'generic failures must sanitize the user message and refund description as well as attempt diagnostics');
  });
}

test('HappyHorse completion still copies the original output and accounts only for generated seconds', async () => {
  const job = { ...baseJob, engine_id: 'happy-horse-1-1', engine_label: 'HappyHorse 1.1', duration_sec: 5,
    settings_snapshot: { inputMode: 't2v', core: { durationSec: 5, resolution: '720p' } } };
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const providerUrl = 'https://provider.example/happy-horse-result.mp4?token=exact-output-token';
  const copiedUrl = 'https://cdn.maxvideoai.com/renders/happy-horse-owned.mp4';
  let copies = 0;
  const response = await runAlibabaModelStudioPoll({ deps: {
    claimPollFn: allowGenerationPoll,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
      if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) return [job] as never;
      if (/FROM provider_attempts/.test(sql)) return [{ id: 34, attempt_index: 1 }] as never;
      if (/SET status = 'completed'/.test(sql)) return [{ job_id: job.job_id }] as never;
      return [] as never;
    },
    getAlibabaModelStudioClientFn: () => ({ getTask: async () => ({
      output: { task_id: job.provider_job_id, task_status: 'SUCCEEDED', video_url: providerUrl },
      usage: { duration: 5, output_video_duration: 5 },
    }) }),
    ensureFastStartVideoFn: async payload => { copies++; assert.equal(payload.videoUrl, providerUrl); return copiedUrl; },
    detectVideoDimensionsFn: async () => ({ width: 1280, height: 720 }),
    ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/happy-horse-thumb.jpg',
    upsertLegacyJobOutputsFn: async payload => { assert.equal(payload.video_url, copiedUrl); },
    generateAndPersistJobPreviewVideoFn: async () => null,
    generateAndPersistJobKeyframesFn: async () => [],
  } });
  assert.equal((await response.json()).updates, 1);
  assert.equal(copies, 1);
  const completed = queries.find(entry => /SET status = 'completed'/.test(entry.sql));
  assert.equal(completed?.params?.[1], copiedUrl);
  const cost = JSON.parse(String(completed?.params?.[3]));
  assert.equal(cost.provider_model, 'happyhorse-1.1-t2v');
  assert.equal(cost.provider_cost_units, 5);
  assert.equal(cost.provider_cost_usd, 0.7);
  assert.equal(cost.input_video_duration_sec, 0);
  assert.equal(cost.output_video_duration_sec, 5);
  assert.equal(queries.filter(entry => /INSERT INTO app_receipts/.test(entry.sql)).length, 0);
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
