import assert from 'node:assert/strict';
import test from 'node:test';

import type { EngineCaps } from '../frontend/types/engines';
import { serializePendingRenders, type LocalRender } from '../frontend/app/(core)/(workspace)/app/_lib/render-persistence';
import {
  buildInitialWorkspaceFormState,
  buildPendingRenderHydrationState,
  parseStoredMultiPromptScenes,
  resolveWorkspaceRequestParams,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';
import type { StoredFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';

function makeEngine(id: string, overrides: Partial<EngineCaps> = {}): EngineCaps {
  return {
    id,
    label: id,
    provider: 'test',
    status: 'live',
    latencyTier: 'standard',
    modes: ['t2v'],
    maxDurationSec: 12,
    resolutions: ['720p', '1080p'],
    aspectRatios: ['16:9', '1:1'],
    fps: [24, 30],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    updatedAt: '2026-05-06T00:00:00.000Z',
    ttlSec: 60,
    availability: 'available',
    ...overrides,
  } as EngineCaps;
}

test('workspace request params normalize aliases and preserve redirect target', () => {
  const params = new URLSearchParams('engine=pika-image-to-video&mode=i2v&job=%20job_123%20&from=vid_1');
  const result = resolveWorkspaceRequestParams(params, '/app');

  assert.equal(result.fromVideoId, 'vid_1');
  assert.equal(result.requestedJobId, 'job_123');
  assert.equal(result.resolvedRequestedEngineId, 'pika-text-to-video');
  assert.equal(result.requestedEngineToken, 'pikatexttovideo');
  assert.equal(result.requestedMode, 'i2v');
  assert.equal(result.loginRedirectTarget, '/app?engine=pika-image-to-video&mode=i2v&job=+job_123+&from=vid_1');
});

test('stored multi-prompt scenes are sanitized with stable fallback', () => {
  const scenes = parseStoredMultiPromptScenes(
    JSON.stringify([
      { prompt: 'Opening shot', duration: 4.6 },
      { id: 'scene_existing', prompt: '', duration: 0 },
    ]),
    (prefix) => `${prefix}_generated`,
    () => ({ id: 'fallback', prompt: '', duration: 5 })
  );

  assert.deepEqual(scenes, [{ id: 'scene_generated', prompt: 'Opening shot', duration: 5 }]);
  assert.deepEqual(
    parseStoredMultiPromptScenes('not json', () => 'unused', () => ({ id: 'fallback', prompt: '', duration: 5 })),
    [{ id: 'fallback', prompt: '', duration: 5 }]
  );
});

test('initial workspace form applies requested engine while preserving stored draft metadata', () => {
  const stored: StoredFormState = {
    engineId: 'seedance-2-0',
    mode: 't2v',
    durationSec: 9,
    resolution: '1080p',
    aspectRatio: '1:1',
    fps: 30,
    iterations: 2,
    audio: false,
    extraInputValues: { camera: 'locked' },
  };
  const result = buildInitialWorkspaceFormState({
    engines: [
      makeEngine('seedance-2-0'),
      makeEngine('kling-3-pro', { modes: ['i2v', 't2v'], providerMeta: { modelSlug: 'kling-3-pro' } }),
    ],
    storedFormRaw: stored,
    effectiveRequestedEngineId: 'kling-3-pro',
    effectiveRequestedEngineToken: '',
    effectiveRequestedMode: 'i2v',
  });

  assert.equal(result.preserveStoredDraft, true);
  assert.equal(result.hasStoredForm, true);
  assert.equal(result.form?.engineId, 'kling-3-pro');
  assert.equal(result.form?.mode, 'i2v');
  assert.equal(result.form?.durationSec, 9);
  assert.equal(result.formToPersist?.engineId, 'kling-3-pro');
  assert.deepEqual(result.debugEngineOverride, {
    from: 'seedance-2-0',
    to: 'kling-3-pro',
    preserveStoredDraft: true,
  });
});

test('pending render hydration derives active group and batch hero state', () => {
  const render: LocalRender = {
    localKey: 'local_1',
    batchId: 'batch_1',
    iterationIndex: 0,
    iterationCount: 2,
    id: 'job_1',
    jobId: 'job_1',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    createdAt: '2026-05-06T00:00:00.000Z',
    aspectRatio: '16:9',
    durationSec: 5,
    prompt: 'Test',
    progress: 40,
    message: 'Pending',
    status: 'pending',
    startedAt: 1,
    minReadyAt: 1,
    groupId: 'group_1',
  };
  const state = buildPendingRenderHydrationState(serializePendingRenders([render]));

  assert.equal(state.pendingRenders.length, 1);
  assert.deepEqual(state.batchHeroes, { batch_1: 'local_1' });
  assert.equal(state.activeBatchId, 'batch_1');
  assert.equal(state.activeGroupId, 'group_1');
  assert.equal(typeof state.serialized, 'string');
});
