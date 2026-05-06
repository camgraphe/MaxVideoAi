import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyGenerationPollToRender,
  applyGenerationPollToSelectedPreview,
  projectGenerationPollStatus,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-polling';
import type { LocalRender } from '../frontend/app/(core)/(workspace)/app/_lib/render-persistence';
import type { SelectedVideoPreview } from '../frontend/lib/video-preview-group';

function render(overrides: Partial<LocalRender> = {}): LocalRender {
  return {
    localKey: 'local_batch_1',
    batchId: 'batch',
    iterationIndex: 0,
    iterationCount: 1,
    id: 'job_123',
    jobId: 'job_123',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    createdAt: '2026-01-02T03:04:05.000Z',
    aspectRatio: '16:9',
    durationSec: 5,
    prompt: 'prompt',
    progress: 5,
    message: 'Working',
    status: 'pending',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    paymentStatus: 'pending_payment',
    startedAt: 1000,
    minReadyAt: 10_000,
    ...overrides,
  };
}

test('projectGenerationPollStatus defers completed videos until minReadyAt', () => {
  const target = render({ readyVideoUrl: 'https://cdn.example.com/previous.mp4' });
  const projection = projectGenerationPollStatus({
    status: {
      status: 'completed',
      progress: 100,
      videoUrl: 'https://cdn.example.com/final.mp4',
      thumbUrl: 'https://cdn.example.com/thumb.jpg',
      message: 'Ready',
    },
    target,
    jobId: 'job_123',
    localKey: 'local_batch_1',
    now: 5_000,
  });

  assert.equal(projection.deferUntilReady, true);
  assert.equal(projection.nextPollDelayMs, 5_000);
  assert.equal(projection.shouldApplyState, false);
  assert.equal(projection.progressMessage, 'Ready');
});

test('poll projection patches renders and selected preview when media is complete', () => {
  const target = render();
  const projection = projectGenerationPollStatus({
    status: {
      status: 'completed',
      progress: 100,
      videoUrl: 'https://cdn.example.com/final.mp4',
      previewVideoUrl: 'https://cdn.example.com/preview.mp4',
      thumbUrl: 'https://cdn.example.com/thumb.jpg',
      finalPriceCents: 450,
      currency: 'EUR',
      pricing: { totalCents: 450, currency: 'EUR' },
      paymentStatus: 'captured',
      message: 'Done',
    },
    target,
    jobId: 'job_123',
    localKey: 'local_batch_1',
    now: 12_000,
  });

  assert.equal(projection.deferUntilReady, false);
  assert.equal(projection.shouldKeepPolling, false);
  assert.equal(projection.nextPollDelayMs, null);
  assert.equal(projection.shouldStopProgressTracking, true);

  const nextRender = applyGenerationPollToRender(target, projection);
  assert.equal(nextRender.status, 'completed');
  assert.equal(nextRender.progress, 100);
  assert.equal(nextRender.readyVideoUrl, 'https://cdn.example.com/final.mp4');
  assert.equal(nextRender.videoUrl, 'https://cdn.example.com/final.mp4');
  assert.equal(nextRender.previewVideoUrl, 'https://cdn.example.com/preview.mp4');
  assert.equal(nextRender.thumbUrl, 'https://cdn.example.com/thumb.jpg');
  assert.equal(nextRender.priceCents, 450);
  assert.equal(nextRender.currency, 'EUR');
  assert.equal(nextRender.paymentStatus, 'captured');
  assert.equal(nextRender.message, 'Working');

  const selected: SelectedVideoPreview = {
    id: 'job_123',
    localKey: 'local_batch_1',
    progress: 5,
    status: 'pending',
    message: 'Working',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
  };
  const nextSelected = applyGenerationPollToSelectedPreview(selected, projection);
  assert.equal(nextSelected?.status, 'completed');
  assert.equal(nextSelected?.videoUrl, 'https://cdn.example.com/final.mp4');
  assert.equal(nextSelected?.thumbUrl, 'https://cdn.example.com/thumb.jpg');
});

test('poll projection marks refunded failures and stops progress tracking', () => {
  const target = render();
  const projection = projectGenerationPollStatus({
    status: {
      status: 'failed',
      progress: 100,
      videoUrl: null,
      thumbUrl: null,
      paymentStatus: 'refunded',
      message: 'Failed',
    },
    target,
    jobId: 'job_123',
    localKey: 'local_batch_1',
    now: 12_000,
  });

  assert.equal(projection.shouldKeepPolling, false);
  assert.equal(projection.shouldStopProgressTracking, true);

  const nextRender = applyGenerationPollToRender(target, projection);
  assert.equal(nextRender.status, 'failed');
  assert.equal(nextRender.paymentStatus, 'refunded');
  assert.equal(nextRender.failedAt, 12_000);
});
