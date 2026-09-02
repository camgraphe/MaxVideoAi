import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { recommendAgentModels } from '../frontend/src/server/agent-api/model-recommendations';
import type { AgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import type { EngineCaps } from '../frontend/types/engines';

function candidate(
  id: string,
  options: {
    latencyTier?: 'fast' | 'standard';
    base?: number;
    resolutions?: EngineCaps['resolutions'];
    modes?: EngineCaps['modes'];
    audio?: boolean;
    maxDurationSec?: number;
  } = {},
): EngineCaps {
  const modes = options.modes ?? ['t2v'];
  const resolutions = options.resolutions ?? ['1080p'];
  return {
    id,
    label: id,
    provider: 'test',
    status: 'live',
    latencyTier: options.latencyTier ?? 'standard',
    modes,
    maxDurationSec: options.maxDurationSec ?? 10,
    resolutions,
    aspectRatios: ['16:9'],
    fps: [24],
    audio: options.audio ?? false,
    upscale4k: resolutions.includes('4k'),
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: {},
    modeCaps: Object.fromEntries(modes.map((mode) => [mode, {
      modes: [mode],
      duration: { options: [5, options.maxDurationSec ?? 10], default: 5 },
      resolution: resolutions,
      aspectRatio: ['16:9'],
      fps: [24],
      audioToggle: options.audio ?? false,
    }])),
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

function realRegistryDeps(): AgentModelCatalogDeps {
  const entries = listFalEngines();
  return {
    async listEngines() {
      return entries.map((entry) => entry.engine);
    },
    surfaceByEngineId(id) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return null;
      return entry.category === 'image' ? 'image' : 'video';
    },
  };
}

test('recommendations keep explicit capabilities as hard constraints and cap stable ties at three', async () => {
  const catalogDeps = deps([
    candidate('hidden-by-mode', { modes: ['t2v'] }),
    candidate('charlie', { modes: ['ref2v'], audio: true, maxDurationSec: 12 }),
    candidate('bravo', { modes: ['ref2v'], audio: true, maxDurationSec: 12 }),
    candidate('alpha', { modes: ['ref2v'], audio: true, maxDurationSec: 12 }),
    candidate('delta', { modes: ['ref2v'], audio: true, maxDurationSec: 12 }),
  ]);
  const input = {
    surface: 'video' as const,
    mode: 'ref2v' as const,
    audio: true,
    referenceImages: true,
    maxDurationSec: 10,
  };

  const first = await recommendAgentModels(input, catalogDeps);
  const second = await recommendAgentModels(input, catalogDeps);

  assert.deepEqual(first, second);
  assert.deepEqual(first.recommendations.map((entry) => entry.model.id), ['alpha', 'bravo', 'charlie']);
  assert.equal(first.recommendations.length, 3);
  assert.equal(first.recommendations.some((entry) => entry.model.id === 'hidden-by-mode'), false);
  assert.ok(first.recommendations[0].reasons.some((reason) => reason.includes('ref2v')));
});

test('real MiniMax H3 recommendations agree with current per-mode model details', async () => {
  const catalogDeps = realRegistryDeps();
  const details = await getAgentModelDetails('minimax-h3', catalogDeps);
  const t2vDetails = details.modes.find((entry) => entry.mode === 't2v');
  const i2vDetails = details.modes.find((entry) => entry.mode === 'i2v');
  assert.ok(t2vDetails);
  assert.ok(i2vDetails);
  assert.ok(t2vDetails.aspectRatios.includes('16:9'));
  assert.deepEqual(i2vDetails.aspectRatios, []);

  const incompatible = await recommendAgentModels(
    { id: 'minimax-h3', mode: 'i2v', aspectRatio: '16:9' },
    catalogDeps,
  );
  assert.deepEqual(incompatible.recommendations, []);
  assert.doesNotMatch(JSON.stringify(incompatible), /Supports the requested 16:9 aspect ratio/);

  const compatible = await recommendAgentModels(
    { id: 'minimax-h3', mode: 't2v', aspectRatio: '16:9' },
    catalogDeps,
  );
  assert.equal(compatible.recommendations[0].model.id, 'minimax-h3');
  assert.deepEqual(compatible.recommendations[0].model.modes, ['t2v']);
  assert.deepEqual(compatible.recommendations[0].model.aspectRatios, t2vDetails.aspectRatios);
  assert.ok(compatible.recommendations[0].reasons.some((reason) => reason.includes('16:9')));
});

test('compatible preferences are a bounded bonus while exclusions and incompatible preferences stay out', async () => {
  const catalogDeps = deps([
    candidate('alpha-fast', { latencyTier: 'fast' }),
    candidate('zulu-preferred'),
    candidate('not-compatible', { modes: ['i2v'] }),
  ]);
  const result = await recommendAgentModels(
    {
      mode: 't2v',
      priorities: ['speed'],
      preferredModelIds: ['zulu-preferred', 'not-compatible', 'does-not-exist'],
      excludedModelIds: ['alpha-fast'],
    },
    catalogDeps,
  );

  assert.deepEqual(result.recommendations.map((entry) => entry.model.id), ['zulu-preferred']);
  assert.ok(result.recommendations[0].reasons.some((reason) => /preferred/i.test(reason)));
  assert.equal(result.recommendations.some((entry) => entry.model.id === 'not-compatible'), false);
});

test('factual priorities and reviewed use cases provide deterministic ranking reasons', async () => {
  const catalogDeps = deps([
    candidate('fast', { latencyTier: 'fast' }),
    candidate('four-k', { resolutions: ['1080p', '4k'] }),
    candidate('audio', { audio: true }),
    candidate('reference', { modes: ['ref2v'] }),
    candidate('long', { maxDurationSec: 30 }),
    candidate('minimax-h3', { modes: ['ref2v'], audio: true, maxDurationSec: 15, resolutions: ['2K'] }),
  ]);

  const cases = [
    { input: { priorities: ['speed' as const] }, id: 'fast', reason: /fast latency/i },
    { input: { priorities: ['highest_resolution' as const] }, id: 'four-k', reason: /4K-class/i },
    { input: { priorities: ['native_audio' as const] }, id: 'audio', reason: /generated audio/i },
    { input: { priorities: ['reference_control' as const] }, id: 'minimax-h3', reason: /reference image/i },
    { input: { priorities: ['longer_clips' as const] }, id: 'long', reason: /longer clip/i },
    { input: { useCase: 'multi_shot' as const }, id: 'minimax-h3', reason: /multi_shot/i },
  ];

  for (const entry of cases) {
    const result = await recommendAgentModels(entry.input, catalogDeps);
    assert.equal(result.recommendations[0].model.id, entry.id);
    assert.ok(result.recommendations[0].reasons.some((reason) => entry.reason.test(reason)));
  }
});

test('recommendation reasons stay unique when requested capabilities are also priorities', async () => {
  const result = await recommendAgentModels(
    {
      surface: 'video',
      mode: 'ref2v',
      audio: true,
      referenceImages: true,
      priorities: ['native_audio', 'reference_control'],
    },
    deps([candidate('audio-reference', { modes: ['ref2v'], audio: true })]),
  );

  const reasons = result.recommendations[0]?.reasons ?? [];
  assert.equal(reasons.filter((reason) => reason === 'Supports generated audio.').length, 1);
  assert.equal(reasons.filter((reason) => reason === 'Accepts reference image input.').length, 1);
  assert.equal(new Set(reasons).size, reasons.length);
});

test('reviewed quality fits use the authored discovery order as a deterministic tie-breaker', async () => {
  const result = await recommendAgentModels(
    { surface: 'video', mode: 'ref2v', useCase: 'multi_shot', referenceImages: true },
    deps([
      candidate('minimax-h3', { modes: ['ref2v'], audio: true, maxDurationSec: 15 }),
      candidate('seedance-2-5', { modes: ['ref2v'], audio: true, maxDurationSec: 30 }),
    ]),
  );

  assert.deepEqual(result.recommendations.map((entry) => entry.model.id), [
    'seedance-2-5',
    'minimax-h3',
  ]);
});

test('an open shortlist keeps one representative per authored model family', async () => {
  const result = await recommendAgentModels(
    { surface: 'video', mode: 't2v' },
    deps([
      candidate('kling-3-pro'),
      candidate('kling-3-standard', { latencyTier: 'fast' }),
      candidate('zulu-a'),
      candidate('zulu-b'),
    ]),
  );

  assert.deepEqual(result.recommendations.map((entry) => entry.model.id), [
    'kling-3-pro',
    'zulu-a',
    'zulu-b',
  ]);
});

test('declared priority order can invert ranking between verified dimensions', async () => {
  const catalogDeps = deps([
    candidate('fast-hd', { latencyTier: 'fast', resolutions: ['1080p'] }),
    candidate('standard-four-k', { latencyTier: 'standard', resolutions: ['1080p', '4k'] }),
  ]);

  const speedFirst = await recommendAgentModels(
    { priorities: ['speed', 'highest_resolution'] },
    catalogDeps,
  );
  const resolutionFirst = await recommendAgentModels(
    { priorities: ['highest_resolution', 'speed'] },
    catalogDeps,
  );

  assert.equal(speedFirst.recommendations[0].model.id, 'fast-hd');
  assert.equal(resolutionFirst.recommendations[0].model.id, 'standard-four-k');
});

test('cost intent always routes to current project budgeting without static price ranking or tier labels', async () => {
  const firstDeps = deps([
    candidate('alpha', { base: 0.99 }),
    candidate('bravo', { base: 0.01 }),
    candidate('charlie', { base: 0.49 }),
  ]);
  const secondDeps = deps([
    candidate('alpha', { base: 0.01 }),
    candidate('bravo', { base: 0.99 }),
    candidate('charlie', { base: 0.49 }),
  ]);
  const input = { priorities: ['lower_cost' as const], budgetCeilingCents: 5_000 };

  const first = await recommendAgentModels(input, firstDeps);
  const second = await recommendAgentModels(input, secondDeps);

  assert.deepEqual(first, second);
  assert.equal(first.nextAction, 'calculate_project_budget');
  assert.ok(first.recommendations.every((entry) => entry.nextAction === 'calculate_project_budget'));
  assert.match(first.message ?? '', /calculate current comparable scenarios/i);
  assert.doesNotMatch(JSON.stringify(first), /0\.01|0\.49|0\.99|economy|balanced|premium/i);
});

test('advice leaves the final model choice with the user before any quote preparation', async () => {
  const result = await recommendAgentModels(
    {
      useCase: 'cinematic_story',
      priorities: ['reference_control'],
    },
    deps([
      candidate('story-model', { modes: ['ref2v'] }),
      candidate('alternate-model', { modes: ['ref2v'] }),
    ]),
  );

  assert.equal(result.nextAction as string, 'discuss_and_choose');
  assert.ok(result.recommendations.every((entry) => (entry.nextAction as string) === 'discuss_and_choose'));
  assert.match(result.message ?? '', /user.*choose|choose.*user/i);
  assert.doesNotMatch(JSON.stringify(result), /prepare_generation/);
});

test('an incompatible request returns an explicit clarification next action', async () => {
  const result = await recommendAgentModels(
    { surface: 'video', mode: 'ref2v', referenceImages: true },
    deps([candidate('text-only')]),
  );

  assert.deepEqual(result, {
    recommendations: [],
    nextAction: 'clarify_requirements',
    message: 'No public model matches all requested capabilities. Relax or clarify one or more requirements.',
  });
});

test('recommendations cannot revive a declared mode that has no executable mode caps', async () => {
  const sora = {
    ...candidate('sora-2-pro'),
    modes: ['t2v', 'i2v', 'ref2v'] as EngineCaps['modes'],
    modeCaps: {
      t2v: {
        modes: ['t2v'] as const,
        duration: { options: [4, 8, 12], default: 4 },
        resolution: ['720p', '1080p'],
        aspectRatio: ['16:9', '9:16'],
      },
      i2v: {
        modes: ['i2v'] as const,
        duration: { options: [4, 8, 12], default: 4 },
        resolution: ['720p', '1080p'],
        aspectRatio: ['16:9', '9:16'],
      },
    },
  } satisfies EngineCaps;
  const result = await recommendAgentModels(
    { surface: 'video', mode: 'ref2v', referenceImages: true, preferredModelIds: ['sora-2-pro'] },
    deps([sora]),
  );
  assert.deepEqual(result.recommendations, []);
  assert.equal(result.nextAction, 'clarify_requirements');
});

test('recommendations exclude public models disabled in the connected environment', async () => {
  const enabled = candidate('enabled');
  const disabled = candidate('disabled');
  const catalogDeps: AgentModelCatalogDeps = {
    ...deps([disabled, enabled]),
    isEngineExecutable(engine) {
      return engine.id !== 'disabled';
    },
  };

  const result = await recommendAgentModels(
    { surface: 'video', mode: 't2v', preferredModelIds: ['disabled'] },
    catalogDeps,
  );

  assert.deepEqual(result.recommendations.map((entry) => entry.model.id), ['enabled']);
});
