import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { submitBytePlusGenerateTask } from '../frontend/app/api/generate/_lib/byteplus-submission';
import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/byteplus-submission.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const pendingReceipt: PendingReceipt = {
  userId: 'user_123',
  amountCents: 1200,
  currency: 'USD',
  description: 'Run Seedance - 8s',
  jobId: 'job_123',
  snapshot: { totalCents: 1200 },
  applicationFeeCents: null,
  vendorAccountId: null,
};

const baseParams = {
  jobId: 'job_123',
  userId: 'user_123',
  engineId: 'seedance-2-0',
  engineLabel: 'Seedance 2.0',
  prompt: 'A cinematic mountain shot',
  durationSec: 8,
  mode: 'ref2v' as const,
  initialImageUrl: null,
  endImageUrl: null,
  normalizedReferenceImages: ['https://cdn.maxvideoai.com/ref.jpg'],
  videoUrls: ['https://cdn.maxvideoai.com/ref.mp4'],
  resolvedAudioUrl: 'https://cdn.maxvideoai.com/ref.wav',
  audioUrls: ['https://cdn.maxvideoai.com/ref.wav', 'https://cdn.maxvideoai.com/alt.wav'],
  effectiveResolution: '720p',
  aspectRatio: '16:9',
  audioEnabled: true,
  placeholderThumb: '/assets/frames/thumb-16x9.svg',
  pricing: { totalCents: 1200, currency: 'USD' } as never,
  paymentStatus: 'paid_wallet',
  pendingReceipt: null,
  paymentMode: 'wallet' as const,
  walletChargeReserved: true,
  batchId: 'batch_123',
  groupId: 'group_123',
  iterationIndex: 0,
  iterationCount: 2,
  renderIds: ['job_123', 'job_456'],
  heroRenderId: 'job_123',
  localKey: 'local_123',
};

test('generate route delegates BytePlus submission', () => {
  assert.ok(existsSync(helperPath), 'BytePlus submission should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/byteplus-submission'/);
  assert.doesNotMatch(routeSource, /isPublicSeedanceBytePlus/);
  assert.doesNotMatch(routeSource, /buildBytePlusSeedancePayload/, 'BytePlus payload construction belongs in byteplus-submission.ts');
  assert.doesNotMatch(routeSource, /createSeedanceFastTask/, 'BytePlus task creation belongs in byteplus-submission.ts');
  assert.doesNotMatch(routeSource, /\[byteplus\] task submission failed/, 'BytePlus failure handling belongs in byteplus-submission.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1475, `/api/generate route should stay below 1475 lines after BytePlus extraction, got ${lineCount}`);
});

test('BytePlus submission helper exposes the route contract', () => {
  assert.match(helperSource, /export type BytePlusSubmissionResult/, 'BytePlusSubmissionResult should be exported');
  assert.match(helperSource, /export async function submitBytePlusGenerateTask/, 'submitBytePlusGenerateTask should be exported');
  assert.doesNotMatch(helperSource, /isPublicSeedanceBytePlus/);
});

test('BytePlus submission helper creates task, updates job, logs, and returns queued response', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const persistedProviderIds: string[] = [];
  const logs: Array<{ kind: string; options: Record<string, unknown> }> = [];
  const builtPayloads: Record<string, unknown>[] = [];

  const result = await submitBytePlusGenerateTask({
    ...baseParams,
    deps: {
      getBytePlusArkConfigFn: () => ({ seedanceModelId: 'model-public', seedanceFastModelId: 'model-fast' }),
      buildBytePlusSeedancePayloadFn: (payload) => {
        builtPayloads.push(payload);
        return { ...payload, normalized: true };
      },
      getBytePlusModelArkClientFn: () => ({
        createSeedanceFastTask: async () => ({ providerJobId: 'provider_123', status: 'queued' }),
      }),
      getBytePlusSeedanceAllowedResolutionsFn: () => ['720p', '1080p'] as never,
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
      },
      persistProviderJobIdFn: async (providerJobId) => {
        persistedProviderIds.push(providerJobId);
      },
      logMetricFn: (kind, options) => {
        logs.push({ kind, options });
      },
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(builtPayloads[0], {
    modelId: 'model-public',
    prompt: 'A cinematic mountain shot',
    durationSec: 8,
    mode: 'ref2v',
    imageUrl: null,
    endImageUrl: null,
    referenceImageUrls: ['https://cdn.maxvideoai.com/ref.jpg'],
    referenceVideoUrls: ['https://cdn.maxvideoai.com/ref.mp4'],
    referenceAudioUrls: ['https://cdn.maxvideoai.com/ref.wav', 'https://cdn.maxvideoai.com/alt.wav'],
    resolution: '720p',
    ratio: '16:9',
    generateAudio: true,
    allowedResolutions: ['720p', '1080p'],
    allowedDurationOptions: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  });
  assert.deepEqual(persistedProviderIds, ['provider_123']);
  assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
  assert.deepEqual(queries[0]?.params, [
    'job_123',
    'queued',
    10,
    'Render submitted.',
    'byteplus_modelark',
    'provider_123',
  ]);
  assert.equal(logs[0]?.kind, 'accepted');
  assert.deepEqual(result.body, {
    ok: true,
    jobId: 'job_123',
    videoUrl: null,
    video: null,
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    status: 'queued',
    progress: 10,
    pricing: { totalCents: 1200, currency: 'USD' },
    paymentStatus: 'paid_wallet',
    provider: 'byteplus_modelark',
    providerJobId: 'provider_123',
    batchId: 'batch_123',
    groupId: 'group_123',
    iterationIndex: 0,
    iterationCount: 2,
    renderIds: ['job_123', 'job_456'],
    heroRenderId: 'job_123',
    localKey: 'local_123',
  });
});

test('BytePlus submission helper chooses the Mini model id for Seedance 2.0 Mini', async () => {
  const builtPayloads: Record<string, unknown>[] = [];

  const result = await submitBytePlusGenerateTask({
    ...baseParams,
    engineId: 'seedance-2-0-mini',
    engineLabel: 'Seedance 2.0 Mini',
    durationSec: 4,
    mode: 'v2v',
    normalizedReferenceImages: [],
    videoUrls: ['https://cdn.maxvideoai.com/source.mp4'],
    audioEnabled: false,
    deps: {
      getBytePlusArkConfigFn: () =>
        ({
          seedanceModelId: 'model-public',
          seedanceFastModelId: 'model-fast',
          seedanceMiniModelId: 'model-mini',
        }) as never,
      buildBytePlusSeedancePayloadFn: (payload) => {
        builtPayloads.push(payload);
        return { ...payload, normalized: true };
      },
      getBytePlusModelArkClientFn: () => ({
        createSeedanceFastTask: async () => ({ providerJobId: 'provider_mini', status: 'queued' }),
      }),
      getBytePlusSeedanceAllowedResolutionsFn: () => ['480p', '720p'] as never,
      queryFn: async () => undefined,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(builtPayloads[0]?.modelId, 'model-mini');
  assert.equal(builtPayloads[0]?.durationSec, 4);
  assert.equal(builtPayloads[0]?.mode, 'v2v');
  assert.equal(builtPayloads[0]?.generateAudio, false);
  assert.deepEqual(builtPayloads[0]?.allowedResolutions, ['480p', '720p']);
});

test('BytePlus submission helper marks failed tasks, rolls back payments, and returns provider error', async () => {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const rollbacks: Array<{ refundDescription: string }> = [];
  const logs: Array<{ kind: string; options: Record<string, unknown> }> = [];

  try {
    const result = await submitBytePlusGenerateTask({
      ...baseParams,
      pendingReceipt,
      deps: {
        getBytePlusArkConfigFn: () => ({ seedanceModelId: 'model-public', seedanceFastModelId: 'model-fast' }),
        buildBytePlusSeedancePayloadFn: (payload) => payload,
        getBytePlusModelArkClientFn: () => ({
          createSeedanceFastTask: async () => {
            throw new Error('provider down');
          },
        }),
        getBytePlusSeedanceAllowedResolutionsFn: () => ['720p'] as never,
        getBytePlusUserSafeErrorMessageFn: () => 'Provider is temporarily unavailable',
        scrubBytePlusErrorFn: () => 'raw provider error',
        queryFn: async (sql, params) => {
          queries.push({ sql, params });
        },
        rollbackPendingPaymentFn: async ({ refundDescription }) => {
          rollbacks.push({ refundDescription });
        },
        logMetricFn: (kind, options) => {
          logs.push({ kind, options });
        },
      },
    });

    assert.equal(result.ok, false);
    assert.match(queries[0]?.sql ?? '', /UPDATE app_jobs/);
    assert.deepEqual(queries[0]?.params, [
      'job_123',
      'The render queue is temporarily busy. Please retry in a few moments.',
      'byteplus_modelark',
      'refunded_wallet',
    ]);
    assert.deepEqual(rollbacks, [{ refundDescription: 'Refund Seedance 2.0 - 8s - Render queue was temporarily busy.' }]);
    assert.equal(logs[0]?.kind, 'failed');
    assert.deepEqual(result.body, {
      ok: false,
      error: 'BYTEPLUS_PROVIDER_ERROR',
      message: 'The render queue is temporarily busy. Please retry in a few moments.',
    });
    assert.equal(result.status, 503);
  } finally {
    console.warn = originalWarn;
  }
});
