import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { normalizeGoogleVertexOmniInteraction } from '../frontend/src/server/video-providers/google-vertex-omni/response';
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
  model: 'gemini-omni-flash-preview',
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
  engine_label: 'Gemini Omni Flash',
  provider_job_id: 'v1_omni_123',
  status: 'running',
  duration_sec: 8,
  thumb_url: '/assets/frames/thumb-16x9.svg',
  preview_video_url: null,
  keyframe_urls: null,
  aspect_ratio: '16:9',
  has_audio: true,
  final_price_cents: 99,
  pricing_snapshot: { totalCents: 99, currency: 'USD' },
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

test('Gemini Omni Flash direct submission stores the Interactions id and provider', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const metrics: Array<{ kind: string; event?: unknown }> = [];

  const result = await submitGoogleVertexOmniGenerateTask({
    jobId: 'job_omni_123',
    userId: 'user_123',
    engineId: 'gemini-omni-flash',
    engineLabel: 'Gemini Omni Flash',
    mode: 't2v',
    prompt: 'A documentary-style product demo with crisp synced audio',
    negativePrompt: null,
    durationSec: 8,
    aspectRatio: '16:9',
    audioEnabled: true,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: { amountCents: 99, currency: 'USD' },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    fallbackToFalEnabled: false,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A documentary-style product demo with crisp synced audio',
      mode: 't2v',
      durationSec: 8,
      aspectRatio: '16:9',
      audio: true,
      extraInputValues: { store_interaction: true },
    },
    falInputSummary: { hasImage: false, hasVideo: false, hasAudio: false, referenceImageCount: 0 },
    isLumaRay2: false,
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
        if (/INSERT INTO provider_attempts/.test(sql)) {
          return [{ id: 41, attempt_index: 1 }] as never;
        }
        return [] as never;
      },
      getGoogleVertexOmniClientFn: () => ({
        createInteraction: async () => ({ id: 'v1_omni_123', status: 'in_progress', object: 'interaction' }),
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

  const jobUpdate = queries.find((entry) => /UPDATE app_jobs/.test(entry.sql) && /provider_job_id = \$4/.test(entry.sql));
  assert.ok(jobUpdate, 'submission should persist provider_job_id on app_jobs');
  assert.equal(jobUpdate.params?.[2], 'google_vertex_omni_direct');
  assert.equal(jobUpdate.params?.[3], 'v1_omni_123');
  assert.equal(metrics[0]?.kind, 'accepted');
});

test('Gemini Omni Flash unsupported direct input fails without Fal when fallback is disabled', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const metrics: Array<{ kind: string; event?: unknown }> = [];
  let falCalls = 0;

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
    audioEnabled: true,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: { amountCents: 99, currency: 'USD' },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    fallbackToFalEnabled: false,
    falPayload: {
      engineId: 'gemini-omni-flash',
      prompt: 'A product launch video',
      mode: 't2v',
      durationSec: 8,
      aspectRatio: '16:9',
      audio: true,
    },
    falInputSummary: { hasImage: false, hasVideo: false, hasAudio: false, referenceImageCount: 0 },
    isLumaRay2: false,
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
      submitFalGenerateTaskFn: async () => {
        falCalls += 1;
        throw new Error('Fal fallback should not run');
      },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'negative_prompt_not_supported');
  assert.equal(falCalls, 0);
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
  assert.match(String(completedUpdate.params?.[3]), /google_vertex_omni_preview_unpriced/);
  assert.match(JSON.stringify(outputs[0]), /cdn\.maxvideoai\.com/);
});

test('Gemini Omni Flash polling is isolated and exposed through a cron route', () => {
  assert.ok(existsSync(pollPath), 'Gemini Omni Flash poller should exist');
  assert.ok(existsSync(routePath), 'Gemini Omni Flash cron route should exist');
  const source = readFileSync(pollPath, 'utf8');
  assert.doesNotMatch(source, /submitFalGenerateTask/);
  assert.doesNotMatch(source, /generateVideo/);
  assert.match(readFileSync(routePath, 'utf8'), /x-google-vertex-omni-poll-token/);
  assert.match(readFileSync(vercelConfigPath, 'utf8'), /google-vertex-omni-poll/);
});
