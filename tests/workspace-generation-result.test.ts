import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAcceptedGenerationResultToRender,
  applyAcceptedGenerationResultToSelectedPreview,
  projectAcceptedGenerationResult,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-result';
import type { LocalRender } from '../frontend/app/(core)/(workspace)/app/_lib/render-persistence';
import type { SelectedVideoPreview } from '../frontend/lib/video-preview-group';

function pendingRender(overrides: Partial<LocalRender> = {}): LocalRender {
  return {
    localKey: 'local_batch_1',
    batchId: 'batch',
    iterationIndex: 0,
    iterationCount: 1,
    id: 'local_batch_1',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    createdAt: '2026-01-02T03:04:05.000Z',
    aspectRatio: '16:9',
    durationSec: 5,
    prompt: 'prompt',
    progress: 5,
    message: '',
    status: 'pending',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    paymentStatus: 'pending_payment',
    startedAt: 1000,
    minReadyAt: 5000,
    ...overrides,
  };
}

test('projectAcceptedGenerationResult gates early completed videos while preserving the ready URL', () => {
  const projection = projectAcceptedGenerationResult({
    response: {
      jobId: 'job_123',
      videoUrl: 'https://cdn.example.com/video.mp4',
      status: 'completed',
      progress: 100,
      pricing: { totalCents: 500, currency: 'EUR' },
      paymentStatus: 'captured',
      batchId: 'remote-batch',
      groupId: 'remote-group',
      iterationIndex: 2,
      iterationCount: 4,
      thumbUrl: 'https://cdn.example.com/thumb.jpg',
      message: 'Ready',
      etaSeconds: 2,
      etaLabel: '2s',
      renderIds: ['r1', 'r2'],
      heroRenderId: 'r1',
    },
    fallback: {
      id: 'local_batch_3',
      batchId: 'batch',
      iterationIndex: 2,
      iterationCount: 4,
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      priceCents: 300,
      currency: 'USD',
      pricingSnapshot: { totalCents: 300, currency: 'USD' },
      etaSeconds: 8,
      etaLabel: '8s',
      message: 'Take 3/4',
      minReadyAt: 10_000,
      aspectRatio: '16:9',
      localKey: 'local_batch_3',
    },
    now: 5_000,
  });

  assert.equal(projection.jobId, 'job_123');
  assert.equal(projection.gatingActive, true);
  assert.equal(projection.gatedProgress, 95);
  assert.equal(projection.status, 'completed');
  assert.equal(projection.visibleStatus, 'pending');
  assert.equal(projection.videoUrl, 'https://cdn.example.com/video.mp4');
  assert.equal(projection.statusEventDetail.progress, 100);
  assert.equal(projection.statusEventDetail.videoUrl, 'https://cdn.example.com/video.mp4');
  assert.deepEqual(projection.renderIds, ['r1', 'r2']);

  const render = applyAcceptedGenerationResultToRender(pendingRender({ localKey: 'local_batch_3' }), projection);
  assert.equal(render.id, 'job_123');
  assert.equal(render.jobId, 'job_123');
  assert.equal(render.status, 'pending');
  assert.equal(render.progress, 95);
  assert.equal(render.readyVideoUrl, 'https://cdn.example.com/video.mp4');
  assert.equal(render.videoUrl, undefined);
  assert.equal(render.thumbUrl, 'https://cdn.example.com/thumb.jpg');
  assert.equal(render.priceCents, 500);
  assert.equal(render.currency, 'EUR');
});

test('accepted generation projection updates selected preview and marks refunded failures', () => {
  const projection = projectAcceptedGenerationResult({
    response: {
      jobId: 'job_failed',
      status: 'failed',
      progress: 100,
      paymentStatus: 'refunded',
      message: 'Provider failed',
    },
    fallback: {
      id: 'local_batch_1',
      batchId: 'batch',
      iterationIndex: 0,
      iterationCount: 1,
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      priceCents: undefined,
      currency: 'USD',
      pricingSnapshot: undefined,
      etaSeconds: 8,
      etaLabel: '8s',
      message: '',
      minReadyAt: 1_000,
      aspectRatio: '9:16',
      localKey: 'local_batch_1',
    },
    now: 2_000,
  });

  const render = applyAcceptedGenerationResultToRender(pendingRender(), projection);
  assert.equal(render.status, 'failed');
  assert.equal(render.failedAt, 2_000);
  assert.equal(render.message, 'Provider failed');

  const current: SelectedVideoPreview = {
    id: 'local_batch_1',
    localKey: 'local_batch_1',
    progress: 5,
    status: 'pending',
    message: '',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
  };
  const selected = applyAcceptedGenerationResultToSelectedPreview(current, projection);
  assert.equal(selected?.id, 'job_failed');
  assert.equal(selected?.status, 'failed');
  assert.equal(selected?.message, 'Provider failed');
  assert.equal(selected?.progress, 100);
  assert.equal(selected?.videoUrl, undefined);
});
