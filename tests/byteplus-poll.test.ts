import assert from 'node:assert/strict';
import test from 'node:test';

import { runBytePlusPoll } from '../frontend/server/byteplus-poll';

type QueryEntry = { sql: string; params?: unknown[] };

const nowMs = Date.parse('2026-08-27T04:00:00.000Z');
const oldJob = {
  job_id: 'job_old_seedance',
  user_id: 'user_123',
  engine_id: 'seedance-2-0',
  engine_label: 'Seedance 2.0',
  provider_job_id: 'cgt_task_123',
  status: 'running',
  duration_sec: 5,
  thumb_url: 'https://cdn.maxvideoai.com/jobs/job_old_seedance/thumb.jpg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 253,
  pricing_snapshot: { totalCents: 253, currency: 'USD' },
  settings_snapshot: {
    byteplusTransport: 'modelark',
    core: { resolution: '720p', aspectRatio: '16:9' },
  },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: '2026-08-27T03:59:40.000Z',
  created_at: '2026-08-27T03:20:00.000Z',
};

function createQueryFn(queries: QueryEntry[]) {
  return async <T = unknown>(sql: string, params?: unknown[]): Promise<T[]> => {
    queries.push({ sql, params });
    if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
      return [oldJob] as T[];
    }
    if (/SET status = 'completed'/.test(sql) && /RETURNING job_id/.test(sql)) {
      return [{ job_id: oldJob.job_id }] as T[];
    }
    return [];
  };
}

function runWithDeps(params: {
  queries: QueryEntry[];
  providerStatus: 'completed' | 'running' | 'error';
}) {
  const outputs: unknown[] = [];
  const run = runBytePlusPoll as unknown as (options: {
    deps: Record<string, unknown>;
  }) => Promise<Response>;

  return {
    outputs,
    response: run({
      deps: {
        nowFn: () => nowMs,
        queryFn: createQueryFn(params.queries),
        getBytePlusModelArkClientFn: () => ({
          retrieveTask: async () => {
            if (params.providerStatus === 'error') {
              throw new Error('temporary provider lookup failure');
            }
            return {
              providerJobId: oldJob.provider_job_id,
              status: params.providerStatus,
              rawStatus: params.providerStatus === 'completed' ? 'succeeded' : 'running',
              videoUrl: params.providerStatus === 'completed'
                ? 'https://provider.byteplus/video.mp4'
                : null,
              message: null,
              errorCode: null,
              usage: params.providerStatus === 'completed'
                ? { totalTokens: 151_078, completionTokens: 151_078 }
                : null,
              raw: { id: oldJob.provider_job_id, status: params.providerStatus },
            };
          },
        }),
        ensureFastStartVideoFn: async () =>
          'https://cdn.maxvideoai.com/jobs/job_old_seedance/video.mp4',
        ensureJobThumbnailFn: async () => null,
        upsertLegacyJobOutputsFn: async (payload: unknown) => {
          outputs.push(payload);
        },
        generateAndPersistJobPreviewVideoFn: async () => null,
        generateAndPersistJobKeyframesFn: async () => [],
        applyBytePlusTrialOutcomeSafelyFn: async () => undefined,
        recordBytePlusPollEventFn: async () => undefined,
      },
    }),
  };
}

test('an old BytePlus job that succeeded at the provider is completed without a refund', async () => {
  const queries: QueryEntry[] = [];
  const run = runWithDeps({ queries, providerStatus: 'completed' });
  const body = await (await run.response).json();

  assert.equal(body.updates, 1);
  const completedUpdate = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate, 'the durable provider output should complete the job');
  assert.equal(
    completedUpdate.params?.[1],
    'https://cdn.maxvideoai.com/jobs/job_old_seedance/video.mp4'
  );
  assert.equal(
    queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql) && /'refund'/.test(entry.sql)),
    false,
    'a successful provider task must never be refunded because of its age'
  );
  assert.equal(run.outputs.length, 1);
});

test('an old BytePlus job still running at the provider is stalled without a refund', async () => {
  const queries: QueryEntry[] = [];
  const run = runWithDeps({ queries, providerStatus: 'running' });
  const body = await (await run.response).json();

  assert.equal(body.updates, 1);
  assert.ok(
    queries.some(
      (entry) => /SET status = 'provider_polling_stalled'/.test(entry.sql)
        && entry.params?.[0] === oldJob.job_id
    ),
    'an overdue provider task should require review instead of being declared failed'
  );
  assert.equal(
    queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql)),
    false,
    'a non-terminal provider task must not be refunded'
  );
});

test('an old BytePlus job with an unavailable provider lookup is stalled without a refund', async () => {
  const queries: QueryEntry[] = [];
  const originalWarn = console.warn;
  console.warn = () => undefined;
  let result: { run: ReturnType<typeof runWithDeps>; body: { updates: number } };
  try {
    const run = runWithDeps({ queries, providerStatus: 'error' });
    result = { run, body: await (await run.response).json() };
  } finally {
    console.warn = originalWarn;
  }
  const { run, body } = result!;

  assert.equal(body.updates, 1);
  assert.ok(
    queries.some(
      (entry) => /SET status = 'provider_polling_stalled'/.test(entry.sql)
        && entry.params?.[0] === oldJob.job_id
    ),
    'an overdue provider lookup failure should require review instead of remaining ambiguous'
  );
  assert.equal(
    queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql)),
    false,
    'a provider lookup failure must not be treated as a terminal render failure'
  );
});
