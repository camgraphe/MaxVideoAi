import assert from 'node:assert/strict';
import test from 'node:test';

import { recommendAgentModels } from '../frontend/src/server/agent-api/model-recommendations';
import type { AgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import type { EngineCaps } from '../frontend/types/engines';

function candidate(
  id: string,
  options: { latencyTier?: 'fast' | 'standard'; base?: number; resolutions?: EngineCaps['resolutions'] } = {}
): EngineCaps {
  return {
    id,
    label: id,
    provider: 'test',
    status: 'live',
    latencyTier: options.latencyTier ?? 'standard',
    modes: ['t2v'],
    maxDurationSec: 10,
    resolutions: options.resolutions ?? ['1080p'],
    aspectRatios: ['16:9'],
    fps: [24],
    audio: true,
    upscale4k: options.resolutions?.includes('4k') ?? false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    pricing: options.base == null ? undefined : { unit: 'sec', base: options.base, currency: 'USD' },
    updatedAt: '2026-07-11T00:00:00.000Z',
    ttlSec: 300,
    availability: 'available',
  };
}

function deps(engines: EngineCaps[]): AgentModelCatalogDeps {
  return {
    async listEngines() {
      return engines;
    },
    surfaceByEngineId() {
      return 'video';
    },
  };
}

test('recommendations are deterministic, capped at three, and use real capability preferences', async () => {
  const catalogDeps = deps([
    candidate('standard-cheap', { base: 0.01 }),
    candidate('fast-mid', { latencyTier: 'fast', base: 0.03 }),
    candidate('fast-cheap', { latencyTier: 'fast', base: 0.02 }),
    candidate('fast-expensive', { latencyTier: 'fast', base: 0.08 }),
  ]);
  const input = {
    surface: 'video' as const,
    mode: 't2v' as const,
    aspectRatio: '16:9',
    maxDurationSec: 8,
    audio: true,
    speedPreference: 'fastest' as const,
    budgetPreference: 'lowest' as const,
  };

  const first = await recommendAgentModels(input, catalogDeps);
  const second = await recommendAgentModels(input, catalogDeps);

  assert.deepEqual(first, second);
  assert.equal(first.recommendations.length, 3);
  assert.equal(first.recommendations[0].model.id, 'fast-cheap');
  assert.equal(first.nextAction, 'prepare_generation');
  assert.ok(first.recommendations[0].reasons.some((reason) => reason.includes('16:9')));
  assert.equal(JSON.stringify(first).includes('$'), false);
  assert.equal(JSON.stringify(first).includes('0.02'), false);
});

test('recommendations explain quality tradeoffs without inventing exact prices', async () => {
  const result = await recommendAgentModels(
    { mode: 't2v', qualityPreference: 'highest' },
    deps([candidate('hd-only'), candidate('four-k', { resolutions: ['1080p', '4k'] })])
  );

  assert.equal(result.recommendations[0].model.id, 'four-k');
  assert.ok(result.recommendations[0].reasons.some((reason) => /4k/i.test(reason)));
  assert.ok(result.recommendations[1].tradeoffs.some((tradeoff) => /1080p/i.test(tradeoff)));
});

test('an incompatible request returns an explicit clarification next action', async () => {
  const result = await recommendAgentModels(
    { surface: 'video', mode: 'ref2v', referenceImages: true },
    deps([candidate('text-only')])
  );

  assert.deepEqual(result, {
    recommendations: [],
    nextAction: 'clarify_requirements',
    message: 'No public model matches all requested capabilities. Relax or clarify one or more requirements.',
  });
});
