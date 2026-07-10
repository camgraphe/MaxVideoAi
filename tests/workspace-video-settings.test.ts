import assert from 'node:assert/strict';
import test from 'node:test';

import type { EngineCaps } from '../frontend/types/engines';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import {
  buildVideoSettingsFormState,
  buildVideoSettingsSnapshotFromTile,
  claimSharedVideoHydration,
  resolveVideoSettingsSnapshot,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';

function seedanceEngine(): EngineCaps {
  return {
    id: 'seedance-2-0',
    label: 'Seedance 2.0',
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 15,
    resolutions: ['720p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    updatedAt: '2026-07-10T00:00:00.000Z',
    ttlSec: 60,
    availability: 'available',
    modeCaps: {
      t2v: {
        modes: ['t2v'],
        duration: { options: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 8 },
        resolution: ['720p'],
        aspectRatio: ['16:9'],
        fps: [24],
        audioToggle: true,
      },
    },
  };
}

function previousForm(): FormState {
  return {
    engineId: 'seedance-2-0',
    mode: 't2v',
    durationSec: 8,
    durationOption: 8,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    audio: true,
    extraInputValues: {},
  };
}

test('shared video hydration waits for engines and claims the same id only once across revalidation', () => {
  let appliedVideoId: string | null = null;
  let prompt = '';
  let snapshotApplications = 0;
  let jobHydrations = 0;

  const runHydrationEffect = (sharedVideoId: string | null, engineCount: number) => {
    const claim = claimSharedVideoHydration(appliedVideoId, sharedVideoId, engineCount);
    appliedVideoId = claim.nextAppliedVideoId;
    if (!claim.shouldApply) return;
    snapshotApplications += 1;
    jobHydrations += 1;
    prompt = `snapshot:${sharedVideoId}`;
  };

  runHydrationEffect('job_123', 0);
  assert.equal(snapshotApplications, 0);
  assert.equal(jobHydrations, 0);

  runHydrationEffect('job_123', 1);
  assert.equal(snapshotApplications, 1);
  assert.equal(jobHydrations, 1);
  assert.equal(prompt, 'snapshot:job_123');

  prompt = 'visitor edit after recreation';
  runHydrationEffect('job_123', 1);
  assert.equal(snapshotApplications, 1);
  assert.equal(jobHydrations, 1);
  assert.equal(prompt, 'visitor edit after recreation');
});

test('shared video hydration resets for a changed or cleared shared video id', () => {
  const first = claimSharedVideoHydration(null, 'job_123', 1);
  assert.deepEqual(first, { nextAppliedVideoId: 'job_123', shouldApply: true });

  const changedWhileWaiting = claimSharedVideoHydration(first.nextAppliedVideoId, 'job_456', 0);
  assert.deepEqual(changedWhileWaiting, { nextAppliedVideoId: null, shouldApply: false });

  const changedReady = claimSharedVideoHydration(changedWhileWaiting.nextAppliedVideoId, 'job_456', 1);
  assert.deepEqual(changedReady, { nextAppliedVideoId: 'job_456', shouldApply: true });

  const cleared = claimSharedVideoHydration(changedReady.nextAppliedVideoId, null, 1);
  assert.deepEqual(cleared, { nextAppliedVideoId: null, shouldApply: false });

  const reappliedAfterClear = claimSharedVideoHydration(cleared.nextAppliedVideoId, 'job_456', 1);
  assert.deepEqual(reappliedAfterClear, { nextAppliedVideoId: 'job_456', shouldApply: true });
});

test('guest sample duration replaces the previous duration option', () => {
  const engine = seedanceEngine();
  const snapshot = buildVideoSettingsSnapshotFromTile({
    engineId: engine.id,
    durationSec: 12,
    aspectRatio: '16:9',
    iterationCount: 1,
    prompt: 'Starter sample',
    hasAudio: true,
  } as Parameters<typeof buildVideoSettingsSnapshotFromTile>[0]);
  const resolved = resolveVideoSettingsSnapshot(snapshot, {
    engines: [engine],
    engineMap: new Map([[engine.id, engine]]),
    createLocalId: (prefix) => `${prefix}-1`,
    createFallbackScene: () => ({ id: 'scene-1', prompt: '', duration: 5 }),
    createFallbackKlingElement: () => ({
      id: 'element-1',
      frontal: null,
      references: [null, null, null],
      video: null,
    }),
  });

  const next = buildVideoSettingsFormState(resolved, previousForm());

  assert.equal(next.durationSec, 12);
  assert.equal(next.durationOption, 12);
});
