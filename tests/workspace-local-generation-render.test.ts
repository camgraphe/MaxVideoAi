import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareLocalGenerationRender } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-local-generation-render';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { EngineCaps, PreflightResponse } from '../frontend/types/engines';

function baseForm(overrides: Partial<FormState> = {}): FormState {
  return {
    engineId: 'veo-3-1',
    mode: 't2v',
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    iterations: 1,
    audio: false,
    extraInputValues: {},
    ...overrides,
  };
}

function engine(overrides: Partial<EngineCaps> = {}): EngineCaps {
  return {
    id: 'veo-3-1',
    label: 'Veo 3.1',
    latencyTier: 'fast',
    ...overrides,
  } as EngineCaps;
}

test('prepareLocalGenerationRender builds the pending render and selected preview', () => {
  const now = Date.UTC(2026, 0, 2, 3, 4, 5);
  const preflight = {
    currency: 'USD',
    pricing: {
      totalCents: 250,
      currency: 'EUR',
    },
  } as PreflightResponse;

  const prepared = prepareLocalGenerationRender({
    batchId: 'batch-abc',
    iterationIndex: 0,
    iterationCount: 2,
    selectedEngine: engine(),
    form: baseForm({ aspectRatio: '9:16' }),
    effectiveDurationSec: 5,
    effectivePrompt: 'A cinematic prompt',
    preflight,
    formatTakeLabel: (index, total) => `Take ${index}/${total}`,
    now,
  });

  assert.equal(prepared.localKey, 'local_batch-abc_1');
  assert.equal(prepared.id, 'local_batch-abc_1');
  assert.equal(prepared.thumb, '/assets/frames/thumb-9x16.svg');
  assert.equal(prepared.friendlyMessage, 'Take 1/2');
  assert.equal(prepared.startedAt, now);
  assert.equal(prepared.minReadyAt, now + prepared.minDurationMs);
  assert.equal(prepared.minDurationMs, 0);
  assert.equal(prepared.initialRender.createdAt, new Date(now).toISOString());
  assert.equal(prepared.initialRender.engineId, 'veo-3-1');
  assert.equal(prepared.initialRender.engineLabel, 'Veo 3.1');
  assert.equal(prepared.initialRender.priceCents, 250);
  assert.equal(prepared.initialRender.currency, 'EUR');
  assert.equal(prepared.initialRender.paymentStatus, 'pending_payment');
  assert.equal(prepared.initialRender.status, 'pending');
  assert.equal(prepared.initialRender.groupId, 'batch-abc');
  assert.equal(prepared.initialRender.heroRenderId, null);
  assert.deepEqual(prepared.selectedPreview, {
    id: prepared.id,
    localKey: prepared.localKey,
    batchId: 'batch-abc',
    iterationIndex: 0,
    iterationCount: 2,
    aspectRatio: '9:16',
    thumbUrl: '/assets/frames/thumb-9x16.svg',
    progress: 0,
    observation: { stage: 'submitting' },
    startedAt: now,
    etaSource: 'heuristic',
    message: 'Take 1/2',
    priceCents: 250,
    currency: 'EUR',
    etaSeconds: prepared.etaSeconds,
    etaLabel: prepared.etaLabel,
    prompt: 'A cinematic prompt',
    status: 'pending',
  });
});

test('prepareLocalGenerationRender falls back to single-render copy and currency', () => {
  const now = Date.UTC(2026, 0, 2, 3, 4, 5);
  const prepared = prepareLocalGenerationRender({
    batchId: 'batch-single',
    iterationIndex: 0,
    iterationCount: 1,
    selectedEngine: engine({ latencyTier: 'standard' }),
    form: baseForm({ aspectRatio: '1:1' }),
    effectiveDurationSec: 8,
    effectivePrompt: 'A square prompt',
    preflight: { currency: 'GBP' } as PreflightResponse,
    formatTakeLabel: (index, total) => `Take ${index}/${total}`,
    now,
  });

  assert.equal(prepared.friendlyMessage, '');
  assert.equal(prepared.thumb, '/assets/frames/thumb-1x1.svg');
  assert.equal(prepared.initialRender.currency, 'GBP');
  assert.equal(prepared.selectedPreview.message, '');
});

test('saved pending metadata reaches the preview adapter and a legacy gate cannot hide completed media', async () => {
  const { serializePendingRenders, deserializePendingRenders } = await import('../frontend/app/(core)/(workspace)/app/_lib/render-persistence');
  const { buildPendingGroupSummaries, buildRenderGroups } = await import('../frontend/app/(core)/(workspace)/app/_lib/workspace-render-groups');
  const { adaptGroupSummaries } = await import('../frontend/lib/video-group-adapter');
  const prepared = prepareLocalGenerationRender({
    batchId: 'timing', iterationIndex: 0, iterationCount: 1, selectedEngine: engine({ avgDurationMs: 96_000 }),
    form: baseForm(), effectiveDurationSec: 5, effectivePrompt: 'Fixture', formatTakeLabel: () => '', now: 1_000,
  });
  const local = { ...prepared.initialRender, jobId: 'job_timing', observation: { stage: 'processing' as const, checkedAt: 2_000 }, minReadyAt: Date.now() + 600_000 };
  const restored = deserializePendingRenders(serializePendingRenders([local]));
  assert.equal(restored[0].etaSource, 'observed');
  assert.equal(restored[0].etaSeconds, 96);
  const [group] = adaptGroupSummaries(buildPendingGroupSummaries(buildRenderGroups(restored), {}), 'fal');
  assert.deepEqual(group.items[0].meta?.observation, local.observation);
  assert.equal(group.items[0].meta?.etaSource, 'observed');
  assert.equal(group.items[0].meta?.startedAt, 1_000);
  const completed = { ...restored[0], status: 'completed' as const, videoUrl: '/fixture-completed.mp4' };
  const [ready] = buildPendingGroupSummaries(buildRenderGroups([completed]), {});
  assert.equal(ready.hero.videoUrl, '/fixture-completed.mp4');
  assert.equal(ready.hero.status, 'completed');
});
