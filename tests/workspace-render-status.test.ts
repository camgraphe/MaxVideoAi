import assert from 'node:assert/strict';
import test from 'node:test';

import type { Job } from '../frontend/types/jobs';
import type { SelectedVideoPreview } from '../frontend/lib/video-preview-group';
import type { LocalRender } from '../frontend/app/(core)/(workspace)/app/_lib/render-persistence';
import {
  applyPolledJobStatusToRender,
  applyPolledJobStatusToSelectedPreview,
  buildRecentJobIdSet,
  convertJobToLocalRender,
  getRendersNeedingStatusRefresh,
  mergeRecentJobsIntoLocalRenders,
  shouldRemoveCompletedSyncedRender,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-render-status';

const baseTime = Date.parse('2026-05-06T12:00:00.000Z');

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    jobId: 'job_1',
    engineLabel: 'Seedance 2.0',
    durationSec: 5,
    prompt: 'A cinematic product shot',
    createdAt: '2026-05-06T10:00:00.000Z',
    aspectRatio: '16:9',
    ...overrides,
  };
}

function makeRender(overrides: Partial<LocalRender> = {}): LocalRender {
  return {
    localKey: 'local_1',
    batchId: 'batch_1',
    iterationIndex: 0,
    iterationCount: 1,
    id: 'job_1',
    jobId: 'job_1',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    createdAt: '2026-05-06T10:00:00.000Z',
    aspectRatio: '16:9',
    durationSec: 5,
    prompt: 'A cinematic product shot',
    progress: 0,
    message: 'Render pending.',
    status: 'pending',
    startedAt: baseTime,
    minReadyAt: baseTime,
    ...overrides,
  };
}

test('convertJobToLocalRender normalizes API jobs into local render state', () => {
  const engineIdByLabel = new Map([['seedance 2.0', 'seedance-2-0']]);
  const render = convertJobToLocalRender(
    makeJob({
      localKey: 'local_existing',
      batchId: 'batch_existing',
      status: 'completed',
      progress: 132,
      videoUrl: 'https://cdn.example.com/video.mp4',
      previewVideoUrl: 'https://cdn.example.com/preview.mp4',
      thumbUrl: '/assets/frames/thumb-16x9.svg',
      previewFrame: 'https://cdn.example.com/frame.jpg',
      finalPriceCents: 123,
      currency: 'eur',
      renderIds: ['render_1', '', 'render_2'],
    }),
    { engineIdByLabel, now: baseTime }
  );

  assert.equal(render.localKey, 'local_existing');
  assert.equal(render.batchId, 'batch_existing');
  assert.equal(render.engineId, 'seedance-2-0');
  assert.equal(render.status, 'completed');
  assert.equal(render.progress, 100);
  assert.equal(render.thumbUrl, 'https://cdn.example.com/frame.jpg');
  assert.deepEqual(render.renderIds, ['render_1', 'render_2']);
  assert.equal(render.priceCents, 123);
  assert.equal(render.currency, 'eur');
});

test('getRendersNeedingStatusRefresh keeps only incomplete or media-incomplete renders', () => {
  const pending = makeRender({ jobId: 'pending', status: 'pending' });
  const completedMissingThumb = makeRender({
    jobId: 'missing_thumb',
    status: 'completed',
    videoUrl: 'https://cdn.example.com/video.mp4',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
  });
  const completedReady = makeRender({
    jobId: 'ready',
    status: 'completed',
    videoUrl: 'https://cdn.example.com/video.mp4',
    thumbUrl: 'https://cdn.example.com/thumb.jpg',
  });
  const failed = makeRender({ jobId: 'failed', status: 'failed' });

  assert.deepEqual(
    getRendersNeedingStatusRefresh([pending, completedMissingThumb, completedReady, failed]).map((render) => render.jobId),
    ['pending', 'missing_thumb']
  );
});

test('polled status helpers update render and selected preview consistently', () => {
  const render = makeRender({
    readyVideoUrl: 'https://cdn.example.com/old.mp4',
    thumbUrl: 'https://cdn.example.com/old.jpg',
  });
  const status = {
    status: 'completed' as const,
    progress: 100,
    videoUrl: 'https://cdn.example.com/new.mp4',
    previewVideoUrl: 'https://cdn.example.com/preview.mp4',
    thumbUrl: 'https://cdn.example.com/new.jpg',
    aspectRatio: '9:16',
    finalPriceCents: 250,
    currency: 'eur',
    paymentStatus: 'paid',
    message: 'Render completed.',
  };

  const nextRender = applyPolledJobStatusToRender(render, status);
  assert.equal(nextRender.videoUrl, 'https://cdn.example.com/new.mp4');
  assert.equal(nextRender.readyVideoUrl, 'https://cdn.example.com/new.mp4');
  assert.equal(nextRender.thumbUrl, 'https://cdn.example.com/new.jpg');
  assert.equal(nextRender.aspectRatio, '9:16');
  assert.equal(nextRender.priceCents, 250);
  assert.equal(nextRender.message, 'Render completed.');

  const preview: SelectedVideoPreview = { id: 'job_1', localKey: 'local_1', status: 'pending' };
  const nextPreview = applyPolledJobStatusToSelectedPreview(preview, render, status);
  assert.equal(nextPreview?.status, 'completed');
  assert.equal(nextPreview?.videoUrl, 'https://cdn.example.com/new.mp4');
  assert.equal(nextPreview?.thumbUrl, 'https://cdn.example.com/new.jpg');
});

test('mergeRecentJobsIntoLocalRenders preserves local identity and returns hero candidates', () => {
  const existing = makeRender({
    localKey: 'local_existing',
    batchId: 'batch_existing',
    jobId: 'job_existing',
    id: 'job_existing',
    createdAt: '2026-05-06T09:00:00.000Z',
  });
  const result = mergeRecentJobsIntoLocalRenders(
    [existing],
    [
      makeJob({
        jobId: 'job_existing',
        localKey: 'server_local',
        batchId: 'server_batch',
        createdAt: '2026-05-06T11:00:00.000Z',
        status: 'completed',
        videoUrl: 'https://cdn.example.com/existing.mp4',
      }),
      makeJob({
        jobId: 'job_new',
        localKey: 'local_new',
        batchId: 'batch_new',
        createdAt: '2026-05-06T10:30:00.000Z',
      }),
    ],
    { now: baseTime }
  );

  assert.equal(result.changed, true);
  assert.equal(result.renders[0]?.jobId, 'job_existing');
  assert.equal(result.renders[0]?.localKey, 'local_existing');
  assert.equal(result.renders[0]?.batchId, 'batch_existing');
  assert.equal(result.renders[1]?.jobId, 'job_new');
  assert.deepEqual(result.heroCandidates, [
    { batchId: 'batch_existing', localKey: 'local_existing' },
    { batchId: 'batch_new', localKey: 'local_new' },
  ]);
});

test('recent job cleanup helpers identify completed synced renders', () => {
  const recentJobIds = buildRecentJobIdSet([{ jobId: 'job_1' }, { jobId: '' }]);

  assert.equal(
    shouldRemoveCompletedSyncedRender(
      makeRender({ jobId: 'job_1', status: 'completed', videoUrl: 'https://cdn.example.com/video.mp4' }),
      recentJobIds
    ),
    true
  );
  assert.equal(shouldRemoveCompletedSyncedRender(makeRender({ jobId: 'job_1', status: 'pending' }), recentJobIds), false);
  assert.equal(
    shouldRemoveCompletedSyncedRender(
      makeRender({ jobId: 'other', status: 'completed', videoUrl: 'https://cdn.example.com/video.mp4' }),
      recentJobIds
    ),
    false
  );
});
