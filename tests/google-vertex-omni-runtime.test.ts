import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { normalizeGoogleVertexOmniInteraction } from '../frontend/src/server/video-providers/google-vertex-omni/response';
import { GoogleVertexOmniError } from '../frontend/src/server/video-providers/google-vertex-omni/errors';
import { submitGoogleVertexOmniGenerateTask } from '../frontend/app/api/generate/_lib/google-vertex-omni-submission';
import { runGoogleVertexOmniPoll } from '../frontend/server/google-vertex-omni-poll';

const root = process.cwd();
const pollPath = join(root, 'frontend/server/google-vertex-omni-poll.ts');
const routePath = join(root, 'frontend/app/api/cron/google-vertex-omni-poll/route.ts');
const vercelConfigPath = join(root, 'frontend/vercel.json');

const completedInteraction = {
  id: 'v1_omni_123',
  status: 'completed',
  object: 'interaction',
  model: 'gemini-omni-1.1-flash-preview',
  steps: [
    {
      type: 'model_output',
      content: [
        {
          type: 'video',
          uri: 'gs://omni-output/job_omni_123.mp4',
          mime_type: 'video/mp4',
        },
      ],
    },
  ],
  usage: {
    total_tokens: 640,
    total_output_tokens: 128,
  },
};

const baseJob = {
  job_id: 'job_omni_123',
  user_id: 'user_123',
  engine_id: 'gemini-omni-flash',
  engine_label: 'Gemini Omni Flash 1.1',
  provider_job_id: 'v1_omni_123',
  status: 'running',
  duration_sec: 8,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 99,
  pricing_snapshot: {
    totalCents: 99,
    currency: 'USD',
    meta: {
      mode: 't2v',
      output_resolution: '1080p',
      input_image_count: 0,
      input_video_duration_sec: 0,
    },
  },
  settings_snapshot: { core: { durationSec: 8, aspectRatio: '16:9' } },
  currency: 'USD',
  payment_status: 'paid_wallet',
  updated_at: new Date(Date.now() - 20_000).toISOString(),
  created_at: new Date(Date.now() - 60_000).toISOString(),
};

test('Gemini Omni Flash response normalizes completed Interactions video output', () => {
  const normalized = normalizeGoogleVertexOmniInteraction(completedInteraction);

  assert.equal(normalized.providerJobId, 'v1_omni_123');
  assert.equal(normalized.status, 'completed');
  assert.equal(normalized.rawStatus, 'completed');
  assert.equal(normalized.videoUrl, 'gs://omni-output/job_omni_123.mp4');
  assert.deepEqual(normalized.usage, {
    totalTokens: 640,
    completionTokens: 128,
  });
});

test('Gemini Omni Flash response accepts SDK output_video data payloads', () => {
  const normalized = normalizeGoogleVertexOmniInteraction({
    id: 'v1_omni_sdk',
    status: 'completed',
    output_video: {
      data: 'b21uaS1tcDQtYnl0ZXM=',
      mime_type: 'video/mp4',
    },
  });

  assert.equal(normalized.providerJobId, 'v1_omni_sdk');
  assert.equal(normalized.status, 'completed');
  assert.equal(normalized.videoUrl, null);
  assert.equal(normalized.message, null);
});

test('Gemini Omni Flash direct extension submission carries one owned source video', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const metrics: Array<{ kind: string; event?: unknown }> = [];
  let submittedPayload: Record<string, unknown> | null = null;

  const result = await submitGoogleVertexOmniGenerateTask({
    jobId: 'job_omni_123',
    userId: 'user_123',
    engineId: 'gemini-omni-flash',
    engineLabel: 'Gemini Omni Flash',
    mode: 'extend',
    prompt: 'Continue the documentary-style product demo with crisp synced audio',
    negativePrompt: null,
    durationSec: 8,
    aspectRatio: '16:9',
    resolution: '1080p',
    audioEnabled: true,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: {
      amountCents: 99,
      currency: 'USD',
      meta: {
        mode: 'extend',
        output_resolution: '1080p',
        input_image_count: 0,
        input_video_duration_sec: 5,
      },
    },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Continue the documentary-style product demo with crisp synced audio',
      mode: 'extend',
      durationSec: 8,
      aspectRatio: '16:9',
      audio: true,
      inputs: [
        {
          name: 'source.mp4',
          type: 'video/mp4',
          size: 2048,
          kind: 'video',
          url: 'gs://owned/source.mp4',
          durationSec: 4,
        },
      ],
      extraInputValues: { store_interaction: true },
    },
    batchId: null,
    groupId: null,
    iterationIndex: null,
    iterationCount: null,
    renderIds: null,
    heroRenderId: null,
    localKey: null,
    logMetricFn: (kind, event) => {
      metrics.push({ kind, event });
    },
    deps: {
      outputGcsPrefix: 'gs://maxvideoai-vertex/shared-inputs',
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/INSERT INTO provider_attempts/.test(sql)) {
          return [{ id: 41, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        accessToken: async () => 'test-access-token',
        createInteraction: async (payload) => {
          submittedPayload = payload as unknown as Record<string, unknown>;
          return { id: 'v1_omni_123', status: 'in_progress', object: 'interaction' };
        },
        fetchInteraction: async () => {
          throw new Error('not used');
        },
        downloadOutputUri: async () => {
          throw new Error('not used');
        },
      }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'accepted');
  assert.equal(result.body.provider, 'google_vertex_omni_direct');
  assert.equal(result.body.providerJobId, 'v1_omni_123');
  assert.equal(submittedPayload?.model, 'gemini-omni-1.1-flash-preview');
  assert.equal(submittedPayload?.store, true);
  assert.equal(
    ((submittedPayload?.generation_config as Record<string, Record<string, unknown>> | undefined)?.video_config?.task),
    'extend'
  );
  assert.deepEqual(
    (submittedPayload?.input as Array<Record<string, unknown>> | undefined)?.filter((input) => input.type === 'video'),
    [{ type: 'video', uri: 'gs://owned/source.mp4', mime_type: 'video/mp4' }]
  );
  assert.equal(
    ((submittedPayload?.response_format as Array<Record<string, unknown>> | undefined)?.[0]?.resolution),
    '1080p'
  );

  const jobUpdate = queries.find((entry) => /UPDATE app_jobs/.test(entry.sql) && /provider_job_id = \$4/.test(entry.sql));
  assert.ok(jobUpdate, 'submission should persist provider_job_id on app_jobs');
  assert.equal(jobUpdate.params?.[2], 'google_vertex_omni_direct');
  assert.equal(jobUpdate.params?.[3], 'v1_omni_123');
  const attemptInsert = queries.find((entry) => /INSERT INTO provider_attempts/.test(entry.sql));
  assert.ok(attemptInsert, 'submission should create a provider attempt');
  assert.equal(JSON.parse(String(attemptInsert.params?.[5])).estimatedProviderCostUsd, 1.25976);
  assert.equal(metrics[0]?.kind, 'accepted');
});

test('Gemini Omni provider pricing snapshot survives price-only job receipts through polling', async () => {
  let persistedAttemptSnapshot: Record<string, unknown> | null = null;
  const submission = await submitGoogleVertexOmniGenerateTask({
    jobId: 'job_omni_price_only',
    userId: 'user_123',
    engineId: 'gemini-omni-flash',
    engineLabel: 'Gemini Omni Flash 1.1',
    mode: 'v2v',
    prompt: 'Preserve the inherited five-second source timing',
    negativePrompt: null,
    durationSec: 10,
    aspectRatio: '16:9',
    resolution: '1080p',
    audioEnabled: true,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: {
      amountCents: 99,
      currency: 'USD',
      meta: {
        mode: 'v2v',
        output_resolution: '1080p',
        output_duration_sec: 5,
        input_image_count: 0,
        input_video_duration_sec: 5,
      },
    },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'Preserve the inherited five-second source timing',
      mode: 'v2v',
      videoUrl: 'gs://owned/source.mp4',
      durationSec: 10,
      aspectRatio: '16:9',
    },
    batchId: null,
    groupId: null,
    iterationIndex: null,
    iterationCount: null,
    renderIds: null,
    heroRenderId: null,
    localKey: null,
    logMetricFn: () => {},
    deps: {
      outputGcsPrefix: 'gs://maxvideoai-vertex/shared-inputs',
      queryFn: async (sql, params) => {
        if (/INSERT INTO provider_attempts/.test(sql)) {
          persistedAttemptSnapshot = JSON.parse(String(params?.[5]));
          return [{ id: 71, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        accessToken: async () => 'test-access-token',
        createInteraction: async () => ({ id: 'v1_omni_price_only', status: 'in_progress', object: 'interaction' }),
        fetchInteraction: async () => { throw new Error('not used'); },
        downloadOutputUri: async () => { throw new Error('not used'); },
      }),
    },
  });
  assert.equal(submission.ok, true);
  assert.deepEqual(persistedAttemptSnapshot?.providerPricing, {
    mode: 'v2v',
    outputResolution: '1080p',
    outputDurationSec: 5,
    inputImageCount: 0,
    inputVideoDurationSec: 5,
  });

  const pollQueries: Array<{ sql: string; params?: unknown[] }> = [];
  const response = await runGoogleVertexOmniPoll({
    deps: {
      queryFn: async (sql, params) => {
        pollQueries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [{
            ...baseJob,
            job_id: 'job_omni_price_only',
            provider_job_id: 'v1_omni_price_only',
            duration_sec: 10,
            pricing_snapshot: { totalCents: 99, currency: 'USD' },
          }] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 71, attempt_index: 1, request_snapshot: persistedAttemptSnapshot }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: 'job_omni_price_only' }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => { throw new Error('not used'); },
        fetchInteraction: async () => ({ ...completedInteraction, id: 'v1_omni_price_only' }),
        downloadOutputUri: async () => ({ data: Buffer.from('omni-price-only'), mime: 'video/mp4' }),
      }),
      isStorageConfiguredFn: () => true,
      uploadFileBufferFn: async () => ({
        key: 'renders/user_123/job_omni_price_only.mp4',
        url: 'https://cdn.maxvideoai.com/renders/job_omni_price_only.mp4',
      }),
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_omni_price_only-thumb.jpg',
      upsertLegacyJobOutputsFn: async () => {},
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });
  assert.equal((await response.json()).updates, 1);
  const completedUpdate = pollQueries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate);
  const costBreakdown = JSON.parse(String(completedUpdate.params?.[3]));
  assert.equal(costBreakdown.provider_cost_units, 5);
  assert.equal(costBreakdown.provider_cost_usd, 0.80364);
});

test('Gemini Omni Flash unsupported direct input fails on Google without invoking another provider', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const metrics: Array<{ kind: string; event?: unknown }> = [];

  const result = await submitGoogleVertexOmniGenerateTask({
    jobId: 'job_omni_unsupported',
    userId: 'user_123',
    engineId: 'gemini-omni-flash',
    engineLabel: 'Gemini Omni Flash',
    mode: 't2v',
    prompt: 'A product launch video',
    negativePrompt: 'blurry',
    durationSec: 8,
    aspectRatio: '16:9',
    resolution: '720p',
    audioEnabled: true,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: { amountCents: 99, currency: 'USD' },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A product launch video',
      mode: 't2v',
      durationSec: 8,
      aspectRatio: '16:9',
      audio: true,
    },
    batchId: null,
    groupId: null,
    iterationIndex: null,
    iterationCount: null,
    renderIds: null,
    heroRenderId: null,
    localKey: null,
    logMetricFn: (kind, event) => {
      metrics.push({ kind, event });
    },
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        return [] as never;
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'negative_prompt_not_supported');
  assert.ok(queries.some((entry) => /SET status = 'failed'/.test(entry.sql)));
  assert.equal(metrics[0]?.kind, 'rejected');
});

test('Gemini Omni Flash poll copies Interactions video output before marking the job completed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const uploads: Array<{ data: Buffer; mime: string; fileName?: string | null }> = [];
  const outputs: unknown[] = [];

  const response = await runGoogleVertexOmniPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 42, attempt_index: 1 }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: 'job_omni_123' }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => {
          throw new Error('not used');
        },
        fetchInteraction: async () => completedInteraction,
        downloadOutputUri: async () => ({ data: Buffer.from('omni-mp4-bytes'), mime: 'video/mp4' }),
      }),
      isStorageConfiguredFn: () => true,
      uploadFileBufferFn: async (payload) => {
        uploads.push({ data: payload.data, mime: payload.mime, fileName: payload.fileName });
        return { key: 'renders/user_123/job_omni_123.mp4', url: 'https://cdn.maxvideoai.com/renders/job_omni_123.mp4' };
      },
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_omni_123-thumb.jpg',
      upsertLegacyJobOutputsFn: async (payload) => {
        outputs.push(payload);
      },
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(uploads[0]?.data.toString(), 'omni-mp4-bytes');
  assert.equal(uploads[0]?.fileName, 'job_omni_123-google-omni.mp4');

  const completedUpdate = queries.find((entry) => /SET status = 'completed'/.test(entry.sql));
  assert.ok(completedUpdate, 'completed app_jobs update should run');
  assert.equal(completedUpdate.params?.[1], 'https://cdn.maxvideoai.com/renders/job_omni_123.mp4');
  const costBreakdown = JSON.parse(String(completedUpdate.params?.[3]));
  assert.equal(costBreakdown.provider_cost_source, 'google_omni_1_1_token_pricing');
  assert.equal(costBreakdown.provider_cost_units, 8);
  assert.equal(costBreakdown.provider_cost_usd, 1.21632);
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);

  const attemptUpdate = queries.find((entry) => /UPDATE provider_attempts/.test(entry.sql) && /provider_cost_usd/.test(entry.sql));
  assert.ok(attemptUpdate, 'provider_attempts should store estimated Google Omni provider cost');
  assert.equal(attemptUpdate.params?.[3], 8);
  assert.equal(attemptUpdate.params?.[4], 1.21632);
});

test('Gemini Omni Flash poll copies inline Interactions video data before marking the job completed', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const uploads: Array<{ data: Buffer; mime: string; fileName?: string | null }> = [];
  const inlineInteraction = {
    id: 'v1_omni_inline',
    status: 'completed',
    output_video: {
      data: Buffer.from('omni-inline-mp4-bytes').toString('base64'),
      mime_type: 'video/mp4',
    },
  };

  const response = await runGoogleVertexOmniPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [{ ...baseJob, provider_job_id: 'v1_omni_inline' }] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 43, attempt_index: 1 }] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: 'job_omni_123' }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => {
          throw new Error('not used');
        },
        fetchInteraction: async () => inlineInteraction,
        downloadOutputUri: async () => {
          throw new Error('inline data should not be downloaded by URI');
        },
      }),
      isStorageConfiguredFn: () => true,
      uploadFileBufferFn: async (payload) => {
        uploads.push({ data: payload.data, mime: payload.mime, fileName: payload.fileName });
        return { key: 'renders/user_123/job_omni_123.mp4', url: 'https://cdn.maxvideoai.com/renders/job_omni_123.mp4' };
      },
      ensureJobThumbnailFn: async () => 'https://cdn.maxvideoai.com/renders/job_omni_123-thumb.jpg',
      upsertLegacyJobOutputsFn: async () => {},
      generateAndPersistJobPreviewVideoFn: async () => null,
      generateAndPersistJobKeyframesFn: async () => [],
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(uploads[0]?.data.toString(), 'omni-inline-mp4-bytes');
  assert.equal(uploads[0]?.mime, 'video/mp4');
  assert.equal(uploads[0]?.fileName, 'job_omni_123-google-omni.mp4');
  assert.ok(queries.some((entry) => /SET status = 'completed'/.test(entry.sql)));
});

test('Gemini Omni Flash poll fails and refunds an accepted job when Google cannot retrieve its interaction', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const response = await runGoogleVertexOmniPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [baseJob] as never;
        }
        if (/UPDATE app_jobs/.test(sql) && /RETURNING job_id/.test(sql)) {
          return [{ job_id: baseJob.job_id }] as never;
        }
        if (/INSERT INTO app_receipts/.test(sql)) {
          return [{ id: 'refund_omni_123' }] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 44, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => {
          throw new Error('not used');
        },
        fetchInteraction: async () => {
          throw new GoogleVertexOmniError('Request contains an invalid argument.', {
            status: 400,
            code: 'invalid_request',
            errorClass: 'invalid_request',
          });
        },
        downloadOutputUri: async () => {
          throw new Error('not used');
        },
      }),
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.ok(queries.some((entry) => /SET status = 'failed'/.test(entry.sql)));
  assert.ok(queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql)));
  assert.ok(queries.some((entry) => /SET payment_status = 'refunded_wallet'/.test(entry.sql)));
  assert.ok(queries.some((entry) => /UPDATE provider_attempts/.test(entry.sql)));
});

test('Gemini Omni Flash poll marks unresolved jobs for manual review after 45 minutes without refunding', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  let fetchCalls = 0;

  const response = await runGoogleVertexOmniPoll({
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        if (/FROM app_jobs/.test(sql) && /provider = \$1/.test(sql)) {
          return [{ ...baseJob, created_at: new Date(Date.now() - 46 * 60_000).toISOString() }] as never;
        }
        if (/FROM provider_attempts/.test(sql)) {
          return [{ id: 45, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => {
          throw new Error('not used');
        },
        fetchInteraction: async () => {
          fetchCalls += 1;
          throw new Error('expired jobs should not reach Google');
        },
        downloadOutputUri: async () => {
          throw new Error('not used');
        },
      }),
    },
  });

  const body = await response.json();
  assert.equal(body.updates, 1);
  assert.equal(fetchCalls, 0);
  assert.ok(queries.some((entry) => /SET status = 'provider_polling_stalled'/.test(entry.sql)));
  assert.equal(queries.some((entry) => /INSERT INTO app_receipts/.test(entry.sql)), false);
  assert.equal(queries.some((entry) => /refunded_wallet/.test(entry.sql)), false);
});

test('Gemini Omni Flash polling is isolated and exposed through a cron route', () => {
  assert.ok(existsSync(pollPath), 'Gemini Omni Flash poller should exist');
  assert.ok(existsSync(routePath), 'Gemini Omni Flash cron route should exist');
  const source = readFileSync(pollPath, 'utf8');
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  assert.doesNotMatch(source, /generateVideo/);
  const submissionSource = readFileSync(
    join(root, 'frontend/app/api/generate/_lib/google-vertex-omni-submission.ts'),
    'utf8'
  );
  assert.doesNotMatch(submissionSource, /submitFalGenerateTask/);
  assert.doesNotMatch(submissionSource, /submitFalFromGoogleOmni/);
  assert.match(readFileSync(routePath, 'utf8'), /x-google-vertex-omni-poll-token/);
  assert.match(readFileSync(vercelConfigPath, 'utf8'), /google-vertex-omni-poll/);
});
